/**
 * Route Service — graph cache tests
 *
 * `calculateRoute` rebuilt the full station-line graph (`buildGraph`) on every
 * call. In the commute-route search flow that runs up to 12× per keystroke,
 * causing input lag. The graph depends only on (excludeLineIds,
 * congestionMultipliers) and is read-only to consumers, so it is memoized.
 *
 * We observe the rebuild by counting `getTransferTime` — a collaborator invoked
 * many times while building the transfer edges, but NOT invoked by
 * `pathToSegments` for a 0-transfer (same-line) route. So a second identical
 * query that triggers any `getTransferTime` call proves the graph was rebuilt.
 */

import { calculateRoute, clearRouteGraphCache } from '../routeService';
import { getTransferTime } from '../transferTime';

jest.mock('@utils/subwayMapData', () => ({
  STATIONS: {
    gangnam: { id: 'gangnam', name: '강남', lines: ['2'] },
    jamsil: { id: 'jamsil', name: '잠실', lines: ['2'] },
    seolleung: { id: 'seolleung', name: '선릉', lines: ['2', 'bundang'] },
    samseong: { id: 'samseong', name: '삼성', lines: ['2'] },
    seoul: { id: 'seoul', name: '서울', lines: ['1', '4'] },
    cityHall: { id: 'cityHall', name: '시청', lines: ['1', '2'] },
    jonggak: { id: 'jonggak', name: '종각', lines: ['1'] },
    euljiro3ga: { id: 'euljiro3ga', name: '을지로3가', lines: ['2', '3'] },
    chungmuro: { id: 'chungmuro', name: '충무로', lines: ['3', '4'] },
    dongdaemun: { id: 'dongdaemun', name: '동대문', lines: ['1', '4'] },
    sindorim: { id: 'sindorim', name: '신도림', lines: ['1', '2'] },
    guro: { id: 'guro', name: '구로', lines: ['1'] },
  },
  LINE_STATIONS: {
    '1': [['seoul', 'cityHall', 'jonggak', 'dongdaemun', 'sindorim', 'guro']],
    '2': [['cityHall', 'euljiro3ga', 'seolleung', 'gangnam', 'samseong', 'jamsil', 'sindorim']],
    '3': [['euljiro3ga', 'chungmuro']],
    '4': [['seoul', 'chungmuro', 'dongdaemun']],
    bundang: [['seolleung']],
  },
  LINE_COLORS: {
    '1': '#0052A4',
    '2': '#00A84D',
    '3': '#EF7C1C',
    '4': '#00A5DE',
    bundang: '#FABE00',
  },
}));

jest.mock('@models/route', () => ({
  AlternativeReason: { DELAY: 'delay', EMERGENCY: 'emergency', MAINTENANCE: 'maintenance' },
  DEFAULT_ALTERNATIVE_OPTIONS: { maxTimeDifference: 30, maxTransfers: 3, excludeLineIds: [] },
  getEdgeMinutes: jest.fn(() => 2),
  createRoute: jest.fn((segments) => ({
    segments,
    totalMinutes: segments.reduce((acc: number, s: { estimatedMinutes: number }) => acc + s.estimatedMinutes, 0),
    transferCount: segments.filter((s: { isTransfer: boolean }) => s.isTransfer).length,
    lineIds: [...new Set(segments.map((s: { lineId: string }) => s.lineId))],
  })),
  createAlternativeRoute: jest.fn(),
  getLineName: jest.fn((lineId) => lineId),
}));

jest.mock('../transferTime', () => ({
  getTransferTime: jest.fn(() => 5),
}));

const mockGetTransferTime = getTransferTime as jest.MockedFunction<typeof getTransferTime>;

describe('routeService graph cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRouteGraphCache();
  });

  it('rebuilds the graph only once for repeated identical queries', () => {
    // First call builds the graph: getTransferTime is invoked for transfer edges.
    const first = calculateRoute('gangnam', 'jamsil'); // same line 2, 0 transfers
    expect(first).not.toBeNull();
    expect(mockGetTransferTime).toHaveBeenCalled();

    mockGetTransferTime.mockClear();

    // Second identical call must hit the cache. The route is 0-transfer, so
    // pathToSegments never calls getTransferTime — any call here means the
    // graph was rebuilt.
    const second = calculateRoute('gangnam', 'jamsil');
    expect(second).not.toBeNull();
    expect(mockGetTransferTime).toHaveBeenCalledTimes(0);
  });

  it('rebuilds for a different excludeLineIds key (cache is keyed, not global)', () => {
    calculateRoute('gangnam', 'jamsil');
    mockGetTransferTime.mockClear();

    // Different exclusion → different cache key → must rebuild.
    calculateRoute('gangnam', 'jamsil', ['1']);
    expect(mockGetTransferTime).toHaveBeenCalled();
  });

  it('rebuilds after clearRouteGraphCache()', () => {
    calculateRoute('gangnam', 'jamsil');
    mockGetTransferTime.mockClear();

    clearRouteGraphCache();

    calculateRoute('gangnam', 'jamsil');
    expect(mockGetTransferTime).toHaveBeenCalled();
  });
});
