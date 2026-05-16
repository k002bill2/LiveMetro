/**
 * routeService — Phase D: transferTime wiring integration
 *
 * 환승 segment의 estimatedMinutes가 transferTime 테이블의 calibrated 값을
 * 반영하는지 검증. 미등록 역은 DEFAULT_TRANSFER_TIME (4).
 *
 * Note: line-speed-weighting phase에서 routeService A* heuristic floor를
 * FASTEST_LINE_HOP_MINUTES 기준으로 재산정. 이전에는 동대문역사문화공원
 * 경유 28.5min 경로(sub-optimal)를 picks 했으나, 이제 종로3가 L5 환승
 * 경유 20.14min 경로(optimal)를 picks. 검증 의도(calibrated transfer time
 * 가 segment.estimatedMinutes에 반영)는 종로3가 6분 + 을지로4가 default 4분
 * 조합으로 동일하게 보존.
 */

import { calculateRoute } from '../routeService';

describe('Phase D — transferTime table wiring', () => {
  it('종각→을지로입구 경로의 종로3가 환승은 calibrated 6분 (default 4 아님)', () => {
    // 종각 (s_eca285ea, line 1) → 을지로입구 (s_ec9d84ec, line 2).
    // Optimal A* 경로: 종각 → 종로3가 (line 1→5 환승, calibrated 6) →
    //   을지로4가 (line 5→2 환승, default 4) → 을지로입구.
    const route = calculateRoute('s_eca285ea', 's_ec9d84ec');
    expect(route).not.toBeNull();
    const transfers = route!.segments.filter((s) => s.isTransfer);
    expect(transfers.length).toBeGreaterThan(0);
    const jongno3gaTransfer = transfers.find(
      (s) => s.fromStationId === 'jongno3ga_5',
    );
    expect(jongno3gaTransfer).toBeDefined();
    expect(jongno3gaTransfer!.estimatedMinutes).toBe(6);
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
