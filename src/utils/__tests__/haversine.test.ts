/**
 * haversine — Phase B: GPS 두 좌표 간 대원거리(km) 계산
 *
 * Standard Haversine formula. Earth radius 6371 km.
 *
 * Tolerances:
 *  - 인접역 (~1km): ±50m
 *  - 도심 내 (~10km): ±100m
 *  - 장거리 (~100km): ±1km
 */

import { haversineDistanceKm, sumHaversineDistanceKm } from '../haversine';

// 실제 Seoul Metro 좌표 (stationCoordinates.json에서 가져옴)
const seoulStation = { latitude: 37.554648, longitude: 126.972559 }; // 서울역 (0150)
const cityHall = { latitude: 37.565715, longitude: 126.977088 };     // 시청 (0151)
const jonggak = { latitude: 37.570208, longitude: 126.98294 };       // 종각 (0152)

describe('haversineDistanceKm', () => {
  it('identical points → 0', () => {
    expect(haversineDistanceKm(seoulStation, seoulStation)).toBe(0);
  });

  it('서울역 ↔ 시청 (adjacent on line 1) ≈ 1.3 km', () => {
    const d = haversineDistanceKm(seoulStation, cityHall);
    expect(d).toBeGreaterThan(1.2);
    expect(d).toBeLessThan(1.4);
  });

  it('시청 ↔ 종각 (adjacent on line 1) ≈ 0.65 km', () => {
    const d = haversineDistanceKm(cityHall, jonggak);
    expect(d).toBeGreaterThan(0.55);
    expect(d).toBeLessThan(0.75);
  });

  it('symmetric: f(a,b) === f(b,a)', () => {
    const ab = haversineDistanceKm(seoulStation, jonggak);
    const ba = haversineDistanceKm(jonggak, seoulStation);
    expect(ab).toBe(ba);
  });

  it('서울역 ↔ 종각 (2 hops apart) ≈ 1.9 km', () => {
    const d = haversineDistanceKm(seoulStation, jonggak);
    expect(d).toBeGreaterThan(1.8);
    expect(d).toBeLessThan(2.0);
  });

  it('antipodal points ≈ 20015 km (half earth circumference)', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 180 };
    const d = haversineDistanceKm(a, b);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThan(20030);
  });

  it('always non-negative', () => {
    const a = { latitude: 37.0, longitude: 126.0 };
    const b = { latitude: -37.0, longitude: -126.0 };
    expect(haversineDistanceKm(a, b)).toBeGreaterThanOrEqual(0);
  });
});

describe('sumHaversineDistanceKm', () => {
  it('empty array → 0', () => {
    expect(sumHaversineDistanceKm([])).toBe(0);
  });

  it('single point → 0 (no segments)', () => {
    expect(sumHaversineDistanceKm([seoulStation])).toBe(0);
  });

  it('two points → same as haversineDistanceKm(a, b)', () => {
    const direct = haversineDistanceKm(seoulStation, cityHall);
    const summed = sumHaversineDistanceKm([seoulStation, cityHall]);
    expect(summed).toBe(direct);
  });

  it('three points (서울역 → 시청 → 종각) → 1.3 + 0.65 ≈ 1.95 km', () => {
    const total = sumHaversineDistanceKm([seoulStation, cityHall, jonggak]);
    expect(total).toBeGreaterThan(1.85);
    expect(total).toBeLessThan(2.05);
  });

  it('result equals sum of adjacent pairs', () => {
    const points = [seoulStation, cityHall, jonggak];
    const total = sumHaversineDistanceKm(points);
    const manual =
      haversineDistanceKm(points[0]!, points[1]!) +
      haversineDistanceKm(points[1]!, points[2]!);
    expect(total).toBe(manual);
  });
});
