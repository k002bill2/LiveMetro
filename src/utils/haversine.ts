/**
 * haversine — Phase B: GPS 두 좌표 간 대원거리(km) 계산
 *
 * Standard Haversine formula.
 *
 * Used by:
 *  - fareService: 역 사이 GPS 거리 합산으로 요금 계산
 *  - routeService A* heuristic: admissible 직선거리 추정
 *
 * Invariants:
 *  - 결과는 항상 ≥ 0
 *  - 대칭: f(a,b) === f(b,a)
 *  - 동일 좌표: 0
 */

const EARTH_RADIUS_KM = 6371;

export interface LatLng {
  readonly latitude: number;
  readonly longitude: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}
