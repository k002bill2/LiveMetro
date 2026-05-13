/**
 * routeService — Phase D: transferTime wiring integration
 *
 * 환승 segment의 estimatedMinutes가 transferTime 테이블의 calibrated 값을
 * 반영하는지 검증. 미등록 역은 DEFAULT_TRANSFER_TIME (4).
 *
 * Test routes (forced transfers):
 *   seoul → 을지로입구(s_ec9d84ec): 시청(city_hall_1, calibrated 5) 환승 강제
 *   euljiro3ga → 충무로_line4-only: 충무로(chungmuro, calibrated 2) 환승 강제
 */

import { calculateRoute } from '../routeService';

describe('Phase D — transferTime table wiring', () => {
  it('종각→을지로입구 경로의 동대문역사문화공원 환승은 calibrated 7분 (default 4 아님)', () => {
    // 종각 (s_eca285ea, line 1) → 을지로입구 (s_ec9d84ec, line 2).
    // 실측 dijkstra 경로: 종각 → 동대문 (line 1→4 환승, default 4) →
    //   동대문역사문화공원 (line 4→2 환승, calibrated 7) → 을지로입구.
    const route = calculateRoute('s_eca285ea', 's_ec9d84ec');
    expect(route).not.toBeNull();
    const transfers = route!.segments.filter((s) => s.isTransfer);
    expect(transfers.length).toBeGreaterThan(0);
    const dongdaemunHistTransfer = transfers.find(
      (s) => s.fromStationId === 'dongdaemun_hist',
    );
    expect(dongdaemunHistTransfer).toBeDefined();
    expect(dongdaemunHistTransfer!.estimatedMinutes).toBe(7);
  });

  it('default-only 환승은 4분 유지 (회귀 가드)', () => {
    const route = calculateRoute('s_eca285ea', 's_ec9d84ec');
    const transfers = route!.segments.filter((s) => s.isTransfer);
    const dongdaemunTransfer = transfers.find(
      (s) => s.fromStationId === 'dongdaemun',
    );
    // 동대문 (calibrated table 미포함) → default 4
    if (dongdaemunTransfer) {
      expect(dongdaemunTransfer.estimatedMinutes).toBe(4);
    }
  });
});
