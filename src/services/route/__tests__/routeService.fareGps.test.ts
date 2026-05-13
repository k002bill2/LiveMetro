/**
 * routeService — Phase B: GPS 기반 요금 거리
 *
 * calculateEnhancedRoute가 segment 역의 실제 GPS 좌표 합을 사용하는지 검증.
 * 좌표 누락 시엔 stationCount × 1.2 fallback (graceful degradation).
 *
 * 본 테스트는 STATIONS를 mock하지 않고 실 데이터(stations.json + seoulStations.json +
 * stationCoordinates.json)를 사용하는 integration 테스트입니다.
 */

import { calculateEnhancedRoute } from '../routeService';

describe('Phase B — GPS-based fare distance', () => {
  it('서울역 → 시청 (line 1 adjacent): GPS strictly > stationCount estimate', () => {
    const result = calculateEnhancedRoute('seoul', 'city_hall_1');
    expect(result).not.toBeNull();
    // GPS ~1.30km vs stationCount estimate = (2-1) × 1.2 = 1.2km
    // GPS strictly greater → proves GPS path is taken
    expect(result!.fare.distance).toBeGreaterThan(1.25);
    expect(result!.fare.distance).toBeLessThan(1.4);
  });

  it('서울역 → 종각 (2 hops on line 1): GPS strictly < stationCount estimate', () => {
    const result = calculateEnhancedRoute('seoul', 's_eca285ea');
    expect(result).not.toBeNull();
    // GPS ≈ 1.95km vs stationCount estimate = (3-1) × 1.2 = 2.4km
    // GPS strictly less → proves GPS path is taken
    expect(result!.fare.distance).toBeGreaterThan(1.7);
    expect(result!.fare.distance).toBeLessThan(2.2);
  });

  it('short GPS distance stays within base fare (1400원 regular)', () => {
    const result = calculateEnhancedRoute('seoul', 'city_hall_1');
    expect(result).not.toBeNull();
    // 1.3km는 10km 기본요금 이내 → 1400원
    expect(result!.fare.totalFare).toBe(1400);
  });
});
