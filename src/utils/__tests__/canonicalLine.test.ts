/**
 * canonicalLine — 길안내 파이프라인이 공유하는 노선 필터 술어 테스트.
 *
 * 예전엔 각 소비 지점이 `/^[1-9]$/` 로 숫자 노선만 걸러, 확장 노선(수인분당선·
 * 경의중앙선 등)은 필터를 통째로 건너뛰었다(fail-open). 환승역 스냅샷은 역 단위라
 * 모든 노선이 섞여 있어, 그 통과분이 대기 칩·출발 로그·자동 진행에 그대로 올라탔다.
 */
import { isOnCanonicalLine, resolveCanonicalLineId } from '@/utils/canonicalLine';
import linesData from '@/data/lines.json';

describe('resolveCanonicalLineId', () => {
  it('숫자 노선을 canonical id로 모은다', () => {
    expect(resolveCanonicalLineId('2')).toBe('2');
    expect(resolveCanonicalLineId('2호선')).toBe('2');
    expect(resolveCanonicalLineId('1002')).toBe('2');
    expect(resolveCanonicalLineId('line-2')).toBe('2');
  });

  it('확장 노선의 그래프 슬러그·표시명·subwayId를 하나의 canonical id로 모은다', () => {
    expect(resolveCanonicalLineId('bundang')).toBe('수인분당선');
    expect(resolveCanonicalLineId('수인분당선')).toBe('수인분당선');
    expect(resolveCanonicalLineId('1071')).toBe('수인분당선');
    expect(resolveCanonicalLineId('경의중앙선')).toBe('경의선');
  });

  // 도착 스냅샷 소속과 realtimePosition API 커버리지는 별개 질문이다. 위치 API가
  // 없는 노선(인천2·김포 등)도 도착 스냅샷엔 정상적으로 존재하므로 canonical id로
  // 살아남아야 한다 — 예전엔 toSeoulApiLineName 으로 판정해 통째로 버려졌다.
  it('위치 API 미지원 노선도 도착 스냅샷 소속으로는 살아남는다', () => {
    expect(resolveCanonicalLineId('incheon2')).toBe('인천2');
    expect(resolveCanonicalLineId('인천2')).toBe('인천2');
    expect(resolveCanonicalLineId('인천2호선')).toBe('인천2');
    expect(resolveCanonicalLineId('김포도시철도')).toBe('김포도시철도');
    expect(resolveCanonicalLineId('gimpo')).toBe('김포도시철도');
    expect(resolveCanonicalLineId('incheon1')).toBe('인천선');
    expect(resolveCanonicalLineId('yongin')).toBe('용인경전철');
    expect(resolveCanonicalLineId('uijeongbu')).toBe('의정부경전철');
  });

  it('미지의 id와 빈 id는 null — 전량 통과로 fail-open 하지 않는다', () => {
    expect(resolveCanonicalLineId('K4')).toBeNull();
    expect(resolveCanonicalLineId('미지의노선')).toBeNull();
    expect(resolveCanonicalLineId('')).toBeNull();
    expect(resolveCanonicalLineId('   ')).toBeNull();
  });
});

describe('isOnCanonicalLine', () => {
  it('서로 다른 입력 도메인이어도 같은 노선이면 일치로 본다', () => {
    expect(isOnCanonicalLine('수인분당선', '수인분당선')).toBe(true);
    expect(isOnCanonicalLine('수인분당선', '1071')).toBe(true);
    expect(isOnCanonicalLine('2', '1002')).toBe(true);
    expect(isOnCanonicalLine('경의선', '경의중앙선')).toBe(true);
  });

  it('다른 노선은 불일치 — 환승역 다노선 스냅샷 혼입 방지', () => {
    expect(isOnCanonicalLine('수인분당선', '2')).toBe(false);
    expect(isOnCanonicalLine('2', '수인분당선')).toBe(false);
    expect(isOnCanonicalLine('2', '')).toBe(false);
  });

  it('인천2의 숫자를 2호선으로 흘리지 않는다', () => {
    expect(isOnCanonicalLine('2', '인천2')).toBe(false);
    expect(isOnCanonicalLine('2', '인천2호선')).toBe(false);
  });

  // 회귀: 위치 API 미지원 노선을 "도착 스냅샷에도 없는 노선"으로 취급하면 같은 노선
  // 열차까지 통째로 사라졌다. 필터는 타 노선만 걷어내야 한다.
  it('위치 API 미지원 노선에서도 같은 노선 열차는 남기고 타 노선만 걷어낸다', () => {
    const canonical = resolveCanonicalLineId('incheon2');
    expect(canonical).toBe('인천2');
    if (canonical === null) throw new Error('resolveCanonicalLineId returned null');
    expect(isOnCanonicalLine(canonical, '인천2')).toBe(true);
    expect(isOnCanonicalLine(canonical, '인천2호선')).toBe(true);
    expect(isOnCanonicalLine(canonical, '2')).toBe(false);
    expect(isOnCanonicalLine(canonical, '1002')).toBe(false);
    expect(isOnCanonicalLine(canonical, '인천선')).toBe(false);
  });
});

/**
 * fail-closed 로 바꾼 대가로 생기는 유일한 실패 모드를 막는 가드: 경로 그래프가
 * 실제로 내보내는 lineId 가 별칭 표나 canonical 집합에 없으면, 예전엔 "필터 없음"
 * (잘못된 열차 표시)이었지만 이제는 빈 결과(대기 칩·알림·선택 후보 전멸)가 된다 —
 * 실기기에선 빈 화면으로 보인다. 그래프 노선 키를 새로 추가할 때 양쪽 표도 함께
 * 갱신하도록 여기서 잠근다. 예외 목록은 없다: 그래프에 있는 노선은 도착 스냅샷에
 * 존재할 수 있는 노선이고, 위치 API 커버리지와는 무관하다.
 */
describe('경로 그래프 lineId 전수 커버리지', () => {
  const graphLineIds = Object.keys(
    (linesData as { readonly stations: Record<string, unknown> }).stations
  );

  it('그래프가 내보내는 모든 lineId는 예외 없이 resolve 된다', () => {
    const unresolved = graphLineIds.filter(id => resolveCanonicalLineId(id) === null);
    expect(unresolved).toEqual([]);
  });
});
