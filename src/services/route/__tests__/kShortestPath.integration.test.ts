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
