/**
 * kShortestPath — Phase A wiring tests
 *
 * Tests that the optional `congestionMultipliers` parameter on findKShortestPaths
 * and getDiverseRoutes flows through buildGraph and affects path costs / ordering.
 *
 * Network shape (mocked below):
 *   cityHall → sindorim
 *     · line 1: 3 edges (shorter, default winner)
 *     · line 2: 6 edges (longer, fallback when line 1 penalized)
 */

import { findKShortestPaths, getDiverseRoutes } from '../kShortestPath';

jest.mock('@utils/subwayMapData', () => ({
  STATIONS: {
    cityHall: { id: 'cityHall', name: '시청', lines: ['1', '2'] },
    jonggak: { id: 'jonggak', name: '종각', lines: ['1'] },
    dongdaemun: { id: 'dongdaemun', name: '동대문', lines: ['1'] },
    sindorim: { id: 'sindorim', name: '신도림', lines: ['1', '2'] },
    euljiro3ga: { id: 'euljiro3ga', name: '을지로3가', lines: ['2'] },
    seolleung: { id: 'seolleung', name: '선릉', lines: ['2'] },
    gangnam: { id: 'gangnam', name: '강남', lines: ['2'] },
    samseong: { id: 'samseong', name: '삼성', lines: ['2'] },
    jamsil: { id: 'jamsil', name: '잠실', lines: ['2'] },
  },
  LINE_STATIONS: {
    '1': ['cityHall', 'jonggak', 'dongdaemun', 'sindorim'],
    '2': ['cityHall', 'euljiro3ga', 'seolleung', 'gangnam', 'samseong', 'jamsil', 'sindorim'],
  },
  LINE_COLORS: { '1': '#0052A4', '2': '#00A84D' },
}));

jest.mock('@models/route', () => ({
  AVG_STATION_TRAVEL_TIME: 2,
  AVG_TRANSFER_TIME: 5,
  createRoute: jest.fn((segments) => ({
    segments,
    totalMinutes: segments.reduce((acc: number, s: { estimatedMinutes: number }) => acc + s.estimatedMinutes, 0),
    transferCount: segments.filter((s: { isTransfer: boolean }) => s.isTransfer).length,
    lineIds: [...new Set(segments.map((s: { lineId: string }) => s.lineId))],
  })),
  getLineName: jest.fn((lineId) => `${lineId}호선`),
}));

describe('kShortestPath — Phase A congestion multiplier wiring', () => {
  it('findKShortestPaths default: cheapest first path uses line 1', () => {
    const result = findKShortestPaths('cityHall', 'sindorim', 1);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.paths[0]!.lineIds).toContain('1');
  });

  it('findKShortestPaths with heavy multiplier on line 1 → cheapest path uses line 2', () => {
    const multipliers = new Map<string, number>([['1', 100]]);
    const result = findKShortestPaths('cityHall', 'sindorim', 1, multipliers);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.paths[0]!.lineIds).toContain('2');
    expect(result.paths[0]!.lineIds).not.toContain('1');
  });

  it('getDiverseRoutes threads multipliers through to candidate generation', () => {
    // Note: getDiverseRoutes sorts displayed routes by segment totalMinutes (not multiplied cost).
    // Multiplier influences which candidates findKShortestPaths surfaces, so a line-2-only
    // alternative should appear in the diverse set when line 1 is heavily penalized.
    const multipliers = new Map<string, number>([['1', 100]]);
    const routes = getDiverseRoutes('cityHall', 'sindorim', 5, multipliers);
    expect(routes.length).toBeGreaterThan(0);
    const hasLine2OnlyAlternative = routes.some(
      (r) => r.lineIds.includes('2') && !r.lineIds.includes('1'),
    );
    expect(hasLine2OnlyAlternative).toBe(true);
  });

  it('multiplier 1.0 on all lines is a no-op', () => {
    const noop = new Map<string, number>([['1', 1.0], ['2', 1.0]]);
    const baseline = findKShortestPaths('cityHall', 'sindorim', 1);
    const adjusted = findKShortestPaths('cityHall', 'sindorim', 1, noop);
    expect(adjusted.paths[0]!.lineIds).toEqual(baseline.paths[0]!.lineIds);
  });
});
