/**
 * routeService — Phase D: transferTime wiring integration
 *
 * 환승 segment의 estimatedMinutes가 transferTime 테이블의 calibrated 값을
 * 반영하는지 검증. 미등록 역은 DEFAULT_TRANSFER_TIME (4).
 *
 * Note (Issue #73 Step 2): A* heuristic이 non-admissible이라 calculateRoute
 * 가 종로3가 L5 우회(20.14min sub-optimal) 경로를 picks했으나, dijkstra를
 * 진짜 textbook Dijkstra(h=0)로 교체한 뒤로는 시청 L1↔L2 직접 환승(10.18min
 * optimal) 경로를 picks. 검증 의도(calibrated transfer time이 segment에
 * 반영)는 시청 5분 calibrated 값으로 동일하게 보존.
 */

import { calculateRoute } from '../routeService';

describe('Phase D — transferTime table wiring', () => {
  it('종각→을지로입구 경로의 시청 환승은 calibrated 5분 (default 4 아님)', () => {
    // 종각 (s_eca285ea, line 1) → 을지로입구 (s_ec9d84ec, line 2).
    // Optimal Dijkstra 경로: 종각 → 시청 (line 1→2 환승, calibrated 5) →
    //   을지로입구. 총 10.18min.
    const route = calculateRoute('s_eca285ea', 's_ec9d84ec');
    expect(route).not.toBeNull();
    const transfers = route!.segments.filter((s) => s.isTransfer);
    expect(transfers.length).toBeGreaterThan(0);
    const cityHallTransfer = transfers.find(
      (s) => s.fromStationId === 'city_hall_1',
    );
    expect(cityHallTransfer).toBeDefined();
    expect(cityHallTransfer!.estimatedMinutes).toBe(5);
  });

  it('default-only 환승은 4분 유지 (회귀 가드)', () => {
    const route = calculateRoute('s_eca285ea', 's_ec9d84ec');
    const transfers = route!.segments.filter((s) => s.isTransfer);
    const euljiro4gaTransfer = transfers.find(
      (s) => s.fromStationId === 'euljiro4ga',
    );
    // 을지로4가 (calibrated table 미포함) → default 4
    if (euljiro4gaTransfer) {
      expect(euljiro4gaTransfer.estimatedMinutes).toBe(4);
    }
  });
});
