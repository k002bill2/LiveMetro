/**
 * canonicalLine — 길안내 파이프라인이 공유하는 노선 필터 술어.
 *
 * 대기 풀(destinationPreference), 출발 로그(departedTrainLog), 출발 감지
 * (departureDetection), 열차 선택 후보(RouteGuidanceScreen)가 각자 `/^[1-9]$/`로
 * 숫자 노선만 걸렀다. 확장 노선(수인분당선·경의중앙선 등)은 필터를 통째로 건너뛰었고
 * (fail-open), 서울 도착 API 스냅샷은 역 단위라 환승역에서 타 노선 열차가 그대로
 * 대기 칩·알림·자동 진행·선택 후보에 올라탔다.
 *
 * 두 번째 함정은 도메인 불일치다: step의 lineId는 경로 그래프 슬러그('bundang'),
 * Train.lineId는 Seoul subwayId 정규화 결과('수인분당선') — 원문끼리 맞대면 확장
 * 노선은 영원히 불일치한다. 비교 전 양쪽을 canonical id로 모아야 한다.
 *
 * 세 번째 함정이 이 모듈의 현재 경계다: **도착 스냅샷의 노선 소속**과
 * **realtimePosition API 커버리지**는 별개의 질문이다. 전자는 "이 열차가 내가 탈
 * 노선인가"(앱 canonical 노선 우주), 후자는 "이 노선으로 위치 API를 호출할 수
 * 있는가"(벤더 엔드포인트 지원 여부)다. 예전엔 후자(`toSeoulApiLineName`)로 전자를
 * 판정해, 인천2처럼 도착 스냅샷엔 정상적으로 존재하지만 위치 API가 없는 노선의
 * 열차가 통째로 버려졌다 — 필터가 아니라 화면 전멸이었다. 두 표는 서로 파생시키지
 * 않는다: 위치 API 커버리지가 줄어도 도착 소속 판정은 영향을 받지 않아야 한다.
 * 위치 API 커버리지는 `toSeoulApiLineName`(formatUtils)이 계속 엄격하게 판정한다.
 *
 * leaf 모듈이다. formatUtils(순수 문자열 유틸)만 의존한다 — services/·screens/를
 * import 하면 departureDetection ← departedTrainLog 사이에 순환이 생긴다.
 */
import { normalizeSeoulLineId } from '@/utils/formatUtils';

/**
 * 앱이 아는 canonical 노선 id의 유한 집합 — 도착 스냅샷 소속 판정의 유일한 기준.
 *
 * `normalizeSeoulLineId`의 별칭 표가 수렴시키는 목적지들이며, 경로 그래프
 * (`lines.json`)가 내보내는 모든 lineId가 여기로 모인다. 위치 API 커버리지 표
 * (`SEOUL_API_POSITION_LINE_NAMES`)와 의도적으로 독립이다 — 파생시키면 위치 API
 * 미지원이 곧 도착 열차 전멸로 번진다.
 */
const KNOWN_APP_CANONICAL_LINE_IDS: ReadonlySet<string> = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '경의선',
  '경춘선',
  '수인분당선',
  '신분당선',
  '경강선',
  '서해선',
  '신림선',
  'GTX-A',
  '공항철도',
  '우이신설경전철',
  '인천선',
  '인천2',
  '김포도시철도',
  '용인경전철',
  '의정부경전철',
]);

/**
 * 앱 lineId(그래프 슬러그·표시명·Seoul subwayId)를 canonical id로 모은다.
 *
 * 알려진 노선이 아니면 `null` — 미지의 id와 빈 id가 여기 해당한다. 호출부는 그때
 * 빈 결과로 fail-closed 해야 한다 (전량 통과는 곧 타 노선 열차 혼입). 위치 API가
 * 제공하지 않는 노선(인천2·김포도시철도 등)은 **여기서 살아남는다** — 도착
 * 스냅샷엔 그 노선 열차가 정상적으로 존재하기 때문이다.
 */
export const resolveCanonicalLineId = (lineId: string): string | null => {
  const canonical = normalizeSeoulLineId(lineId);
  return KNOWN_APP_CANONICAL_LINE_IDS.has(canonical) ? canonical : null;
};

/**
 * 후보(열차·출발 로그 항목)의 lineId가 canonical 노선과 같은 노선인지.
 * 후보 쪽도 정규화하므로 입력 도메인이 달라도 올바르게 일치한다.
 */
export const isOnCanonicalLine = (canonicalLineId: string, candidateLineId: string): boolean =>
  normalizeSeoulLineId(candidateLineId) === canonicalLineId;
