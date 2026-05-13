/**
 * K-Shortest Path Integration Tests
 *
 * 별도 파일로 분리한 이유: kShortestPath.test.ts가 `@utils/subwayMapData`,
 * `@models/route`, `@/utils/priorityQueue`를 mock한다. 단위 테스트로는 알고리즘
 * 동작을 빠르게 검증할 수 있지만, lines.json/stations.json의 데이터 정합성
 * 회귀는 잡지 못한다.
 *
 * 이 파일은 mock 없이 실제 데이터로 `getDiverseRoutes`를 호출해 사용자가
 * 경로검색 화면에서 보게 될 카드 set을 직접 검증한다. PR #58 다음 단계로,
 * lines.json의 bundang 노선 순서가 잘못돼 강남구청 환승 경로가 K-shortest
 * 탐색 후보 set에 포함조차 못 들어가던 회귀를 고정한다.
 */

import { getDiverseRoutes } from '../kShortestPath';

describe('getDiverseRoutes — 실제 데이터 회귀 (lines.json order + K-shortest 탐색)', () => {
  /**
   * 산곡(7호선, id=s_ec82b0ea) → 선릉(2호선/수인분당선, id=seolleung)
   *
   * 회귀 원인 두 가지:
   *  1. lines.json의 `bundang` 노선 순서가 청량리→...→인천 운행 순서가 아닌
   *     무작위 순서였음. 강남구청→선릉이 1정거장(~5분)이 아니라 21정거장
   *     (~52분)으로 잘못 계산되어 강남구청 경유 경로가 비현실적 시간 cap에
   *     걸려 제거됨.
   *  2. K-shortest의 K=15가 Yen's 자연 탐색 순서에서 강남구청 경로를
   *     포함하기에 부족(해당 경로가 K=25 부근 후보). K=30으로 확대해야
   *     후보 set에 진입.
   *
   * 정상 동작 시 후보 set 예시:
   *  - 대림 경유 (7→2, 76.5분, fastest)
   *  - 교대 경유 (7→3→2, ~83분)
   *  - 강남구청 경유 (7→bundang, ~84분)  ← 본 회귀의 핵심
   *  - 초지/부천종합운동장 경유 등
   */
  it('산곡→선릉 경로 카드에 "강남구청 경유" 옵션이 포함된다', () => {
    const routes = getDiverseRoutes('s_ec82b0ea', 'seolleung');

    expect(routes.length).toBeGreaterThan(0);

    const hasGangnamGuOfficeTransfer = routes.some((route) =>
      route.segments.some(
        (seg) => seg.isTransfer && seg.fromStationName === '강남구청',
      ),
    );

    expect(hasGangnamGuOfficeTransfer).toBe(true);
  });

  /**
   * 분당선 내부의 짧은 OD pair. lines.json의 인접 순서가 실제 운행 순서와
   * 일치하면 1정거장 직행으로 ~5분, 잘못된 순서면 우회로 ~20-50분.
   */
  it('강남구청→선릉은 환승 0회 직행으로 매우 짧다 (분당선 내부 인접)', () => {
    const routes = getDiverseRoutes('gangnam_gu_office', 'seolleung');

    expect(routes.length).toBeGreaterThan(0);

    const fastest = routes[0]!;
    // 강남구청 → 선정릉 → 선릉 = 2 hop. AVG_STATION_TRAVEL_TIME(2.5)*2 = 5분.
    expect(fastest.totalMinutes).toBeLessThan(10);
    expect(fastest.transferCount).toBe(0);
  });

  /**
   * 정자→선릉: 실제 운행 시간이 30분 내외인 일반 통근 OD pair.
   *
   * 알고리즘은 신분당선→2호선(강남 환승) 경로를 ~21.5분으로 가장 빠르게
   * 계산. 분당선 직행은 약 37.5분이라 1.5x cap(32분)에 걸려 자연스럽게
   * 제외됨 — 이는 올바른 동작이다. 분당선이 cost 모델에서 더 빠르도록
   * 압축할 수 없는 한, "직행이 fastest여야 한다"는 잘못된 invariant.
   *
   * 데이터 회귀 검증: fastest가 비합리적으로 느리면(60분+) lines.json
   * 어디선가 정자 근처 노선 순서가 깨졌다는 신호. 회귀 경계 40분.
   */
  it('정자→선릉 fastest 경로는 합리적 시간 내 (≤40분)', () => {
    const routes = getDiverseRoutes('s_1857', 'seolleung'); // 정자 id = s_1857

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.totalMinutes).toBeLessThanOrEqual(40);
  });

  /**
   * 강남구청→정자: 분당선 직행 (강남구청→선정릉→...→정자, ~17 hops).
   * lines.json 순서가 맞으면 환승 0회 직행이 fastest로 등장.
   * 잘못된 순서면 우회 경로가 더 빠르거나 비현실적 시간.
   */
  it('강남구청→정자 fastest는 분당선 직행에 가깝다', () => {
    const routes = getDiverseRoutes('gangnam_gu_office', 's_1857');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    // 17 hops × 2.5 = 42.5분 ± 환승 가능. 회귀 경계 50분.
    expect(fastest.totalMinutes).toBeLessThanOrEqual(50);
  });
});

describe('Line 3 운행 순서 회귀 (2026-05-13 hybrid 순서 교정)', () => {
  /**
   * 회귀 원인:
   *  - 기존 lines.json `3`은 1-34(지축→오금) + 35-44(원흥→대화) hybrid 구성.
   *  - graph builder가 `array[i] ↔ array[i+1]` 단순 인접 edge를 만들므로
   *    `오금(34) ↔ 원흥(35)` 잘못된 직접 edge 2.5분이 생성.
   *  - 실제 오금↔원흥은 약 35 hops(약 87분) 거리. 잘못된 edge로 라우팅이
   *    오염되어 사용자에게 비현실적 직행이 제공될 수 있었음.
   *  - Wikipedia ground truth: 대화 → 주엽 → 정발산 → ... → 원당 → 원흥 →
   *    삼송 → 지축 → ... → 오금 (44 stations, 단일 운행선, 분기 없음).
   */

  /**
   * 오금→원흥: 잘못된 edge 회귀 가드. 정상 동작 시 단일 노선 직행으로
   * 약 35 hops × 2.5 = 87.5분. 환승 없이도 충분히 길어야 함.
   * 잘못된 edge면 1 hop 2.5분 직행이 fastest로 잘못 등장.
   */
  it('오금→원흥은 단일 노선 직행이지만 거리가 길어 fastest > 30분', () => {
    const routes = getDiverseRoutes('ogeum', 's_ec9b90ed');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.totalMinutes).toBeGreaterThan(30);
  });

  /**
   * 원흥↔삼송 순서 회귀 가드. Wikipedia 운행 순서는
   * "원당(8) → 원흥(9) → 삼송(10) → 지축(11)". 두 역은 실제로 인접하므로
   * fastest는 환승 0회 1 hop 직행.
   */
  it('원흥→삼송은 환승 0회 직행으로 매우 짧다 (실제 인접)', () => {
    const routes = getDiverseRoutes('s_ec9b90ed', 's_1950');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    // 1 hop × 2.5 = 2.5분. 회귀 경계 5분.
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  /**
   * 양재→교대: Line 3 내부 짧은 OD. 양재(34) → 남부터미널(33) → 교대(32)
   * 운행 순서로 2 hops 직행. fastest는 환승 0회 5분 내외.
   */
  it('양재→교대는 Line 3 직행 2 hops로 짧다', () => {
    const routes = getDiverseRoutes('yangjae', 's_eab590eb');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    // 2 hops × 2.5 = 5분. 회귀 경계 8분.
    expect(fastest.totalMinutes).toBeLessThanOrEqual(8);
  });
});

describe('Line 4 운행 순서 회귀 (2026-05-13 수리산 위치 교정)', () => {
  /**
   * 회귀 원인:
   *  - 기존 lines.json `4`에서 수리산(s_1763)이 array 끝(#51)에 위치
   *  - 실제 운행 순서는 산본 → 수리산 → 대야미 → 반월 → ... → 오이도
   *  - 잘못된 인접 edge `오이도(50) ↔ 수리산(51)` 2.5분 직행이 그래프에 존재
   *  - 실제 오이도↔수리산은 약 11 hops(~28분) 거리 — 잘못된 edge로 라우팅 오염
   *  - Wikipedia ground truth: 진접 → ... → 산본 → 수리산 → 대야미 → ... → 오이도
   *    (51 stations, 단일 운행선, 분기 없음)
   */

  /**
   * 산본→수리산: Wikipedia 운행 순서로 1 hop 인접. 환승 0회, ≤5분.
   */
  it('산본→수리산은 환승 0회 직행 1 hop (실제 인접)', () => {
    const routes = getDiverseRoutes('sanbon', 's_1763');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  /**
   * 수리산→대야미: Wikipedia 순서로 수리산(40) → 대야미(41) 인접. 1 hop ≤5분.
   */
  it('수리산→대야미는 환승 0회 직행 1 hop (실제 인접)', () => {
    const routes = getDiverseRoutes('s_1763', 's_1752');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  /**
   * 오이도→수리산: 잘못된 array 끝 인접 edge 회귀 가드. 정상 동작 시
   * 단일 노선 직행 약 11 hops(약 28분) 또는 환승 우회. fastest > 15분.
   * 잘못된 edge면 1 hop 2.5분 직행이 fastest로 잘못 등장.
   */
  it('오이도→수리산은 거리가 있어 fastest > 15분 (잘못된 인접 edge 가드)', () => {
    const routes = getDiverseRoutes('oido', 's_1763');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.totalMinutes).toBeGreaterThan(15);
  });
});

describe('Line 8 운행 순서 회귀 (2026-05-13 남위례 위치 교정)', () => {
  /**
   * 회귀 원인:
   *  - 기존 lines.json `8`에서 남위례(s_2828)가 array 끝(#24)에 위치
   *  - 실제 운행 순서는 복정(17) → 남위례 → 산성(이후) → ... → 모란
   *  - 잘못된 인접 edge `모란(23) ↔ 남위례(24)` 2.5분 직행이 그래프에 존재
   *  - 실제 모란↔남위례는 약 6 hops(~15분) 거리 — 잘못된 edge로 라우팅 오염
   *  - Wikipedia ground truth: 별내 → 다산 → ... → 복정 → 남위례 → 산성 →
   *    남한산성입구 → 단대오거리 → 신흥 → 수진 → 모란 (24 stations 본선+
   *    별내선 연장, 단일 운행선, 분기 없음)
   *  - Line 4 수리산과 동일한 single misplacement 패턴 (2021.12 신설역 누락)
   */

  /**
   * 복정→남위례: Wikipedia 운행 순서로 1 hop 인접. 환승 0회, ≤5분.
   */
  it('복정→남위례는 환승 0회 직행 1 hop (실제 인접)', () => {
    const routes = getDiverseRoutes('s_ebb3b5ec', 's_2828');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  /**
   * 남위례→산성: Wikipedia 순서로 남위례(18) → 산성(19) 인접. 1 hop ≤5분.
   */
  it('남위례→산성은 환승 0회 직행 1 hop (실제 인접)', () => {
    const routes = getDiverseRoutes('s_2828', 's_ec82b0ec');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  /**
   * 모란→남위례: 잘못된 array 끝 인접 edge 회귀 가드. 정상 동작 시
   * 단일 노선 직행 약 6 hops(약 15분). fastest > 10분.
   * 잘못된 edge면 1 hop 2.5분 직행이 fastest로 잘못 등장.
   */
  it('모란→남위례는 거리가 있어 fastest > 10분 (잘못된 인접 edge 가드)', () => {
    const routes = getDiverseRoutes('moran', 's_2828');

    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.totalMinutes).toBeGreaterThan(10);
  });
});

describe('외곽선 운행 순서 회귀 (2026-05-13 batch 교정)', () => {
  /**
   * gyeonggang (경강선): 성남(s_0009)이 array 끝(#12)에 위치한 single
   * misplacement. Wikipedia 운행 순서: 판교 → 성남 → 이매 → ... → 여주.
   * 잘못된 인접 edge `여주(11) ↔ 성남(12)` 제거.
   */
  it('판교→성남(경강)은 환승 0회 직행 1 hop (실제 인접)', () => {
    const routes = getDiverseRoutes('s_ed8c90ea', 's_0009');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  it('여주→성남(경강)은 거리가 있어 fastest > 15분 (잘못된 인접 edge 가드)', () => {
    const routes = getDiverseRoutes('s_1511', 's_0009');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.totalMinutes).toBeGreaterThan(15);
  });

  /**
   * airport (공항철도): 영종(s_ec9881ec)이 array 끝(#14)에 위치한 single
   * misplacement. Wikipedia 운행 순서: ... 청라국제도시 → 영종 → 운서 →
   * 공항화물청사 → 인천공항1터미널 → 인천공항2터미널.
   */
  it('청라국제도시→영종은 환승 0회 직행 1 hop (실제 인접)', () => {
    const routes = getDiverseRoutes('s_4210', 's_ec9881ec');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.transferCount).toBe(0);
    expect(fastest.totalMinutes).toBeLessThanOrEqual(5);
  });

  it('인천공항2터미널→영종은 거리가 있어 fastest > 5분 (잘못된 인접 edge 가드)', () => {
    const routes = getDiverseRoutes('s_4215', 's_ec9881ec');
    expect(routes.length).toBeGreaterThan(0);
    const fastest = routes[0]!;
    expect(fastest.totalMinutes).toBeGreaterThan(5);
  });

});
