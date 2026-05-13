/**
 * routeService — Phase C: realtime arrival integration into first segment
 *
 * `calculateRoute`에 realtimeArrivals 인자를 주입하면, 첫 segment의
 * estimatedMinutes에 다음 열차 대기 시간(분)이 가산되어 Route.totalMinutes에 반영됩니다.
 *
 * No-realtime / empty / non-matching line: 변화 없음 (graceful fallback).
 *
 * 실 데이터 integration 테스트 — STATIONS mock 없음.
 */

import { calculateRoute } from '../routeService';
import type { RealtimeArrival } from '../realtimeWeightOverride';

describe('Phase C — realtime arrival integration', () => {
  it('baseline: calculateRoute(seoul, city_hall_1) returns non-null route', () => {
    const route = calculateRoute('seoul', 'city_hall_1');
    expect(route).not.toBeNull();
    expect(route!.segments.length).toBeGreaterThan(0);
  });

  it('with realtime 5분 대기 → totalMinutes baseline + 5', () => {
    const baseline = calculateRoute('seoul', 'city_hall_1');
    expect(baseline).not.toBeNull();

    const firstLineId = baseline!.segments[0]!.lineId;
    const arrivals: RealtimeArrival[] = [
      { lineId: firstLineId, secondsUntilArrival: 300 }, // 5 minutes
    ];
    const adjusted = calculateRoute('seoul', 'city_hall_1', [], undefined, arrivals);
    expect(adjusted).not.toBeNull();
    expect(adjusted!.totalMinutes).toBe(baseline!.totalMinutes + 5);
  });

  it('with realtime 0초 (도착 임박) → totalMinutes 동일 (wait=0)', () => {
    const baseline = calculateRoute('seoul', 'city_hall_1');
    const firstLineId = baseline!.segments[0]!.lineId;
    const arrivals: RealtimeArrival[] = [
      { lineId: firstLineId, secondsUntilArrival: 0 },
    ];
    const adjusted = calculateRoute('seoul', 'city_hall_1', [], undefined, arrivals);
    expect(adjusted!.totalMinutes).toBe(baseline!.totalMinutes);
  });

  it('realtime for non-matching line → graceful fallback (totalMinutes baseline)', () => {
    const baseline = calculateRoute('seoul', 'city_hall_1');
    const arrivals: RealtimeArrival[] = [
      { lineId: 'non_existent_line_xyz', secondsUntilArrival: 600 },
    ];
    const adjusted = calculateRoute('seoul', 'city_hall_1', [], undefined, arrivals);
    expect(adjusted!.totalMinutes).toBe(baseline!.totalMinutes);
  });

  it('empty realtime arrivals → graceful fallback (baseline)', () => {
    const baseline = calculateRoute('seoul', 'city_hall_1');
    const adjusted = calculateRoute('seoul', 'city_hall_1', [], undefined, []);
    expect(adjusted!.totalMinutes).toBe(baseline!.totalMinutes);
  });

  it('undefined realtime (omitted) → baseline behavior preserved', () => {
    const baseline = calculateRoute('seoul', 'city_hall_1');
    const noRealtime = calculateRoute('seoul', 'city_hall_1', []);
    expect(noRealtime!.totalMinutes).toBe(baseline!.totalMinutes);
  });
});
