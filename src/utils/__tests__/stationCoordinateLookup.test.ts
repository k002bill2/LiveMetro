/**
 * stationCoordinateLookup — Phase B: stationId → LatLng | null
 *
 * stations.json (named id) → seoulStations.json (station_cd) → stationCoordinates.json (LatLng)
 * 3단계 데이터 체인을 잇는 lookup. 누락 시 null 반환 (graceful degradation).
 *
 * Bridge chain:
 *   stations.json:    'seoul'      → name '서울역'
 *   seoulStations:    '서울역'      → station_cd '0150' (any line version)
 *   stationCoordinates: '0150'     → {latitude, longitude}
 */

import { getStationCoordinates } from '../stationCoordinateLookup';

describe('getStationCoordinates', () => {
  it('서울역 (seoul) → coords near (37.554, 126.972)', () => {
    const coords = getStationCoordinates('seoul');
    expect(coords).not.toBeNull();
    expect(coords!.latitude).toBeCloseTo(37.554, 2);
    expect(coords!.longitude).toBeCloseTo(126.972, 2);
  });

  it('강남 (gangnam) → coords near (37.497, 127.027)', () => {
    const coords = getStationCoordinates('gangnam');
    expect(coords).not.toBeNull();
    // 강남역 known location ~37.497, 127.027
    expect(coords!.latitude).toBeGreaterThan(37.49);
    expect(coords!.latitude).toBeLessThan(37.51);
    expect(coords!.longitude).toBeGreaterThan(127.02);
    expect(coords!.longitude).toBeLessThan(127.04);
  });

  it('unknown station id → null', () => {
    expect(getStationCoordinates('nonexistent_station_xyz')).toBeNull();
  });

  it('result is consistent across calls (cached lookup map)', () => {
    const a = getStationCoordinates('seoul');
    const b = getStationCoordinates('seoul');
    expect(a).toEqual(b);
  });

  it('lookup is case-sensitive — uppercase id returns null', () => {
    expect(getStationCoordinates('SEOUL')).toBeNull();
  });
});
