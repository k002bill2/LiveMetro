/**
 * routeVia unit tests — sub-route concatenation stitching logic.
 * getDiverseRoutes is mocked so the two legs are controlled; createRoute /
 * getLineName / AVG_TRANSFER_TIME run for real (pure model helpers).
 */
import { getDiverseRoutes } from '../kShortestPath';
import { routeVia } from '../routeVia';
import type { RouteSegment } from '@models/route';

jest.mock('../kShortestPath', () => ({ getDiverseRoutes: jest.fn() }));

const mockDiverse = getDiverseRoutes as jest.Mock;

const ride = (
  from: string,
  to: string,
  lineId: string,
  minutes: number,
): RouteSegment => ({
  fromStationId: from,
  fromStationName: `${from}역`,
  toStationId: to,
  toStationName: `${to}역`,
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes: minutes,
  isTransfer: false,
});

const leg = (segments: RouteSegment[]) => ({
  segments,
  totalMinutes: segments.reduce((t, s) => t + s.estimatedMinutes, 0),
  transferCount: segments.filter((s) => s.isTransfer).length,
  lineIds: Array.from(new Set(segments.map((s) => s.lineId))),
});

beforeEach(() => {
  mockDiverse.mockReset();
});

describe('routeVia', () => {
  it('stitches the two legs with a transfer at V when the line changes there', () => {
    mockDiverse.mockImplementation((from: string, to: string) => {
      if (from === 'A' && to === 'V') return [leg([ride('A', 'V', '1', 5)])];
      if (from === 'V' && to === 'B') return [leg([ride('V', 'B', '2', 7)])];
      return [];
    });

    const route = routeVia('A', 'V', 'B');

    expect(route).not.toBeNull();
    // 1 inserted transfer at V.
    expect(route!.transferCount).toBe(1);
    expect(route!.segments).toHaveLength(3);
    const mid = route!.segments[1]!;
    expect(mid.isTransfer).toBe(true);
    expect(mid.fromStationId).toBe('V');
    expect(mid.toStationId).toBe('V');
    expect(mid.lineId).toBe('2'); // line departing V
    // ride(5) + transfer(4=AVG_TRANSFER_TIME) + ride(7) = 16
    expect(route!.totalMinutes).toBe(16);
    // station rides (non-transfer) = 2.
    expect(route!.segments.filter((s) => !s.isTransfer)).toHaveLength(2);
    expect(route!.lineIds).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('does NOT insert a phantom transfer when both legs ride the same line through V', () => {
    mockDiverse.mockImplementation((from: string, to: string) => {
      if (from === 'A' && to === 'V') return [leg([ride('A', 'V', '1', 5)])];
      if (from === 'V' && to === 'B') return [leg([ride('V', 'B', '1', 7)])];
      return [];
    });

    const route = routeVia('A', 'V', 'B');

    expect(route).not.toBeNull();
    expect(route!.transferCount).toBe(0);
    expect(route!.segments.every((s) => !s.isTransfer)).toBe(true);
    expect(route!.totalMinutes).toBe(12); // no transfer time added
  });

  it('returns null when either leg has no path', () => {
    mockDiverse.mockImplementation((from: string, to: string) => {
      if (from === 'A' && to === 'V') return [leg([ride('A', 'V', '1', 5)])];
      return []; // V → B has no path
    });

    expect(routeVia('A', 'V', 'B')).toBeNull();
  });

  it('returns null for a degenerate via (V equals an endpoint) without querying the graph', () => {
    expect(routeVia('A', 'A', 'B')).toBeNull();
    expect(routeVia('A', 'B', 'B')).toBeNull();
    expect(mockDiverse).not.toHaveBeenCalled();
  });
});
