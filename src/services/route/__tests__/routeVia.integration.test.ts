/**
 * routeVia integration — real graph, no mocks. Proves the user-chosen via
 * transfer (신길 → 신도림 → 선릉) is actually produced, distinct from the
 * globally fastest 신길 → 선릉 route (which transfers elsewhere).
 */
import { routeVia } from '../routeVia';
import { getDiverseRoutes } from '../kShortestPath';

describe('routeVia — integration (real graph)', () => {
  it('신길 → 선릉 via 신도림: routes 1호선 → 신도림 환승 → 2호선', () => {
    // slugs from src/data/stations.json: 신길=s_1032, 신도림=sindorim, 선릉=seolleung
    const route = routeVia('s_1032', 'sindorim', 'seolleung');

    expect(route).not.toBeNull();
    // Exactly one transfer — at 신도림 (1호선 → 2호선).
    expect(route!.transferCount).toBe(1);

    const transfer = route!.segments.find((s) => s.isTransfer);
    expect(transfer).toBeDefined();
    expect(transfer!.toStationName).toBe('신도림');

    // First boarded line is 1호선 (신길 boards line 1 toward 신도림).
    const firstRide = route!.segments.find((s) => !s.isTransfer);
    expect(firstRide!.lineId).toBe('1');

    // The via route is genuinely constrained: 신도림 is on the path.
    const names = route!.segments.flatMap((s) => [s.fromStationName, s.toStationName]);
    expect(names).toContain('신도림');
  });

  it('via route differs from the globally fastest route for the same OD', () => {
    const fastest = getDiverseRoutes('s_1032', 'seolleung')[0];
    const via = routeVia('s_1032', 'sindorim', 'seolleung');

    expect(fastest).toBeDefined();
    expect(via).not.toBeNull();

    // The globally fastest route does NOT pass through 신도림 as a transfer;
    // the via route does. (If they were identical the constraint would be a
    // no-op and this whole feature pointless.)
    const fastestPassesVia = fastest!.segments.some(
      (s) => s.isTransfer && s.toStationName === '신도림',
    );
    expect(fastestPassesVia).toBe(false);
  });
});
