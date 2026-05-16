/**
 * useCommuteRouteSummary — integration test (real services).
 *
 * Unit test (`useCommuteRouteSummary.test.ts`) mocks `@services/route` to
 * exercise the hook's contract; this file pins the actual data + algorithm
 * + fare-table pipeline so that:
 *   - line-speed-weighting Phase의 가중치 변화가 hook 결과를 깨면 회귀 catch
 *   - boundary normalize (external station_cd ↔ internal slug) 실측 검증
 *
 * Anchor OD: 산곡(외부 '3762', slug 's_ec82b0ea') ↔ 선릉(외부 '0220', slug
 * 'seolleung'). Phase 목표는 강남구청 환승(7+수인분당) 경로가 fastest로
 * 선택되는 것 — `getDiverseRoutes[0]` 반환과 정확히 일치해야 함.
 */
import { renderHook } from '@testing-library/react-native';
import { useCommuteRouteSummary } from '../useCommuteRouteSummary';

describe('useCommuteRouteSummary — integration (no service mocks)', () => {
  it('산곡↔선릉 (외부 station_cd 입력): ready=true, 강남구청 환승 1회, 32역, 요금 ~2000원', () => {
    // 외부 station_cd 입력 — 온보딩이 실제로 persist 하는 형태.
    const { result } = renderHook(() =>
      useCommuteRouteSummary('3762', '0220'),
    );
    expect(result.current.ready).toBe(true);
    expect(result.current.transferCount).toBe(1);
    expect(result.current.stationCount).toBe(32);
    expect(result.current.fareKrw).toBe(2000);
    // 시간은 ±15% 가드. 알고리즘 출력 ~75.8min.
    expect(result.current.rideMinutes).toBeGreaterThan(65);
    expect(result.current.rideMinutes).toBeLessThan(90);
  });

  it('산곡↔선릉 (internal slug 입력): boundary normalize도 동일 결과', () => {
    // resolveInternalStationId가 slug pass-through 하므로 외부/내부 입력 동일.
    const { result } = renderHook(() =>
      useCommuteRouteSummary('s_ec82b0ea', 'seolleung'),
    );
    expect(result.current.ready).toBe(true);
    expect(result.current.transferCount).toBe(1);
    expect(result.current.stationCount).toBe(32);
    expect(result.current.fareKrw).toBe(2000);
  });

  it('빈 입력: ready=false (회귀 가드)', () => {
    const { result } = renderHook(() =>
      useCommuteRouteSummary(undefined, undefined),
    );
    expect(result.current).toEqual({ ready: false });
  });

  it('unresolvable id: ready=false', () => {
    // station_cd가 stations.json에도 seoulStations.json에도 없는 가짜 코드.
    const { result } = renderHook(() =>
      useCommuteRouteSummary('99999', '0220'),
    );
    expect(result.current.ready).toBe(false);
  });
});
