/**
 * applyRealtimeBoardingWait — 옵션(가) "거친 라벨 + 1회 조회"
 *
 * getDiverseRoutes 출력(구조적 경로 풀)에 출발역 첫 탑승 대기를 후처리로 얹는다.
 * 각 route의 *첫 segment* estimatedMinutes에 `getNextTrainWaitMinutes(arrivals,
 * firstSeg.lineId)`만큼 가산하고, totalMinutes도 동일하게 갱신한다(불변 — 새 객체).
 * 라벨용으로 `boardingWaitMinutes`를 양수일 때만 세팅한다.
 *
 * 정렬은 이 헬퍼가 하지 않는다 — 다운스트림 `sortRoutesByTab`이 갱신된
 * totalMinutes/fare를 읽어 탭 의미를 보존한 채 재정렬한다(아래 boundary 테스트).
 *
 * 순수 함수 — STATIONS/그래프 mock 불필요.
 */

import { applyRealtimeBoardingWait } from '../routeService';
import { sortRoutesByTab } from '../kShortestPath';
import type { RealtimeArrival } from '../realtimeWeightOverride';
import type { Route, RouteSegment } from '@/models/route';

function seg(partial: Partial<RouteSegment>): RouteSegment {
  return {
    fromStationId: 'a',
    fromStationName: '출발',
    toStationId: 'b',
    toStationName: '도착',
    lineId: '2',
    lineName: '2호선',
    estimatedMinutes: 10,
    isTransfer: false,
    ...partial,
  };
}

function makeRoute(partial: Partial<Route> & { segments: readonly RouteSegment[] }): Route {
  const total = partial.segments.reduce((acc, s) => acc + s.estimatedMinutes, 0);
  return {
    totalMinutes: total,
    transferCount: partial.segments.filter((s) => s.isTransfer).length,
    lineIds: [...new Set(partial.segments.map((s) => s.lineId))],
    ...partial,
  };
}

describe('applyRealtimeBoardingWait', () => {
  it('bumps first segment estimatedMinutes AND totalMinutes by the next-train wait', () => {
    const route = makeRoute({
      segments: [seg({ lineId: '2', estimatedMinutes: 10 }), seg({ lineId: '3', estimatedMinutes: 15 })],
    });
    const arrivals: RealtimeArrival[] = [{ lineId: '2', secondsUntilArrival: 300 }]; // 5분

    const [out] = applyRealtimeBoardingWait([route], arrivals);

    expect(out!.segments[0]!.estimatedMinutes).toBe(15); // 10 + 5
    expect(out!.segments[1]!.estimatedMinutes).toBe(15); // 비-첫 segment 무변경
    expect(out!.totalMinutes).toBe(route.totalMinutes + 5);
    expect(out!.boardingWaitMinutes).toBe(5);
  });

  it('matches the wait against the FIRST segment lineId only (not later legs)', () => {
    const route = makeRoute({
      segments: [seg({ lineId: '2', estimatedMinutes: 10 }), seg({ lineId: '3', estimatedMinutes: 15 })],
    });
    // 환승 노선(3)에만 실시간 → 출발역 첫 탑승(2)엔 데이터 없음 → 무변경
    const arrivals: RealtimeArrival[] = [{ lineId: '3', secondsUntilArrival: 600 }];

    const [out] = applyRealtimeBoardingWait([route], arrivals);

    expect(out!.totalMinutes).toBe(route.totalMinutes);
    expect(out!.boardingWaitMinutes).toBeUndefined();
  });

  it('wait=0 (도착 임박) → route unchanged, no boardingWaitMinutes', () => {
    const route = makeRoute({ segments: [seg({ lineId: '2', estimatedMinutes: 10 })] });
    const arrivals: RealtimeArrival[] = [{ lineId: '2', secondsUntilArrival: 0 }];

    const [out] = applyRealtimeBoardingWait([route], arrivals);

    expect(out!.totalMinutes).toBe(route.totalMinutes);
    expect(out!.segments[0]!.estimatedMinutes).toBe(10);
    expect(out!.boardingWaitMinutes).toBeUndefined();
  });

  it('no realtime for the line (no-data) → graceful, unchanged', () => {
    const route = makeRoute({ segments: [seg({ lineId: '2', estimatedMinutes: 10 })] });
    const arrivals: RealtimeArrival[] = [{ lineId: '9', secondsUntilArrival: 300 }];

    const [out] = applyRealtimeBoardingWait([route], arrivals);

    expect(out!.totalMinutes).toBe(route.totalMinutes);
    expect(out!.boardingWaitMinutes).toBeUndefined();
  });

  it('empty arrivals → all routes unchanged', () => {
    const route = makeRoute({ segments: [seg({ lineId: '2', estimatedMinutes: 10 })] });
    const [out] = applyRealtimeBoardingWait([route], []);
    expect(out!.totalMinutes).toBe(route.totalMinutes);
    expect(out!.boardingWaitMinutes).toBeUndefined();
  });

  it('empty segments route → returned unchanged (defensive)', () => {
    const route = makeRoute({ segments: [] });
    const arrivals: RealtimeArrival[] = [{ lineId: '2', secondsUntilArrival: 300 }];
    const [out] = applyRealtimeBoardingWait([route], arrivals);
    expect(out!.totalMinutes).toBe(0);
    expect(out!.boardingWaitMinutes).toBeUndefined();
  });

  it('is immutable — does not mutate input routes/segments', () => {
    const route = makeRoute({ segments: [seg({ lineId: '2', estimatedMinutes: 10 })] });
    const arrivals: RealtimeArrival[] = [{ lineId: '2', secondsUntilArrival: 300 }];

    const [out] = applyRealtimeBoardingWait([route], arrivals);

    expect(out).not.toBe(route);
    expect(out!.segments[0]).not.toBe(route.segments[0]);
    expect(route.segments[0]!.estimatedMinutes).toBe(10); // input untouched
    expect(route.totalMinutes).toBe(10);
    expect(route.boardingWaitMinutes).toBeUndefined();
  });

  it('processes each route in the pool independently', () => {
    const r2 = makeRoute({ segments: [seg({ lineId: '2', estimatedMinutes: 10 })] });
    const r3 = makeRoute({ segments: [seg({ lineId: '3', estimatedMinutes: 12 })] });
    const arrivals: RealtimeArrival[] = [
      { lineId: '2', secondsUntilArrival: 120 }, // 2분
      { lineId: '3', secondsUntilArrival: 180 }, // 3분
    ];

    const [o2, o3] = applyRealtimeBoardingWait([r2, r3], arrivals);

    expect(o2!.totalMinutes).toBe(12); // 10 + 2
    expect(o2!.boardingWaitMinutes).toBe(2);
    expect(o3!.totalMinutes).toBe(15); // 12 + 3
    expect(o3!.boardingWaitMinutes).toBe(3);
  });

  it('returns routes in input order (does NOT re-sort)', () => {
    const slow = makeRoute({ segments: [seg({ lineId: '2', estimatedMinutes: 30 })] });
    const fast = makeRoute({ segments: [seg({ lineId: '3', estimatedMinutes: 10 })] });
    // Bump the fast one so adjusted time exceeds slow — order must still be [slow, fast].
    const arrivals: RealtimeArrival[] = [{ lineId: '3', secondsUntilArrival: 1500 }]; // +25분 → 35
    const [a, b] = applyRealtimeBoardingWait([slow, fast], arrivals);
    expect(a!.totalMinutes).toBe(30);
    expect(b!.totalMinutes).toBe(35);
  });

  describe('tab-semantics preserved when piped into sortRoutesByTab (boundary)', () => {
    // fast: 20분 1환승 / direct: 22분 0환승. Static fastest = fast.
    // 출발역 첫 탑승(fast의 line '2')에 +5분 realtime → fast 25분 → direct가 더 빨라짐.
    const fast = makeRoute({
      segments: [
        seg({ lineId: '2', estimatedMinutes: 10 }),
        seg({ lineId: '3', estimatedMinutes: 5, isTransfer: true, fromStationName: '교대' }),
        seg({ lineId: '3', estimatedMinutes: 5 }),
      ],
      fare: 1500,
    });
    const direct = makeRoute({
      segments: [seg({ lineId: '4', estimatedMinutes: 22 })],
      fare: 1400,
    });
    const arrivals: RealtimeArrival[] = [{ lineId: '2', secondsUntilArrival: 300 }]; // fast +5 → 25

    it('fastest tab reflects realtime-adjusted time (direct now wins)', () => {
      const adjusted = applyRealtimeBoardingWait([fast, direct], arrivals);
      const sorted = sortRoutesByTab(adjusted, 'fastest');
      expect(sorted[0]!.totalMinutes).toBe(22); // direct, not the now-25 fast
      expect(sorted[1]!.totalMinutes).toBe(25);
    });

    it('min-transfer tab keeps transfer-count primary (fast pool order unchanged by realtime)', () => {
      const adjusted = applyRealtimeBoardingWait([fast, direct], arrivals);
      const sorted = sortRoutesByTab(adjusted, 'min-transfer');
      // direct has 0 transfers, fast has 1 → direct first regardless of realtime time.
      expect(sorted[0]!.transferCount).toBe(0);
      expect(sorted[1]!.transferCount).toBe(1);
    });

    it('min-fare tab keeps fare primary, not realtime-adjusted time', () => {
      const adjusted = applyRealtimeBoardingWait([fast, direct], arrivals);
      const sorted = sortRoutesByTab(adjusted, 'min-fare');
      // direct fare 1400 < fast 1500 → direct first. Realtime time is only a tiebreak.
      expect(sorted[0]!.fare).toBe(1400);
      expect(sorted[1]!.fare).toBe(1500);
    });
  });
});
