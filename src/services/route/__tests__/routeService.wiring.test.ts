/**
 * Route Service — Phase A wiring tests
 *
 * Tests that the optional `congestionMultipliers` parameter on calculateRoute
 * flows through buildGraph and affects dijkstra path selection.
 *
 * Network shape (mocked below):
 *   cityHall → sindorim
 *     · line 1: 3 edges (cityHall→jonggak→dongdaemun→sindorim)
 *     · line 2: 6 edges (cityHall→euljiro3ga→seolleung→gangnam→samseong→jamsil→sindorim)
 *   Default: line 1 wins (shorter).
 *   With heavy multiplier on line 1: line 2 wins.
 */

import { calculateRoute } from '../routeService';

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
  DEFAULT_ALTERNATIVE_OPTIONS: { maxTimeDifference: 30, maxTransfers: 3, excludeLineIds: [] },
  AlternativeReason: { DELAY: 'delay' },
  createAlternativeRoute: jest.fn(),
}));

describe('routeService — Phase A congestion multiplier wiring', () => {
  it('default route prefers shorter line (line 1 over line 2)', () => {
    const route = calculateRoute('cityHall', 'sindorim');
    expect(route).not.toBeNull();
    expect(route!.lineIds).toContain('1');
  });

  it('heavy multiplier on line 1 forces dijkstra to pick line 2', () => {
    const multipliers = new Map<string, number>([['1', 100]]);
    const route = calculateRoute('cityHall', 'sindorim', [], multipliers);
    expect(route).not.toBeNull();
    expect(route!.lineIds).toContain('2');
    expect(route!.lineIds).not.toContain('1');
  });

  it('multiplier 1.0 on all lines is a no-op (same lineIds as default)', () => {
    const noop = new Map<string, number>([['1', 1.0], ['2', 1.0]]);
    const baseline = calculateRoute('cityHall', 'sindorim');
    const adjusted = calculateRoute('cityHall', 'sindorim', [], noop);
    expect(adjusted!.lineIds).toEqual(baseline!.lineIds);
  });
});
