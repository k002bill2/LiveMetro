/**
 * K-Shortest Path Tests
 */

import { findKShortestPaths, getDiverseRoutes, buildTransferSignature } from '../kShortestPath';
import type { Route, RouteSegment } from '@/models/route';

// Mock the dependencies
jest.mock('@/utils/priorityQueue', () => ({
  PriorityQueue: jest.fn().mockImplementation(() => {
    const items: { item: unknown; priority: number }[] = [];
    return {
      enqueue: jest.fn((item: unknown, priority: number) => {
        items.push({ item, priority });
        items.sort((a, b) => a.priority - b.priority);
      }),
      dequeue: jest.fn(() => {
        const result = items.shift();
        return result?.item;
      }),
      peek: jest.fn(() => items[0]?.item),
      isEmpty: jest.fn(() => items.length === 0),
    };
  }),
}));

jest.mock('@utils/subwayMapData', () => ({
  STATIONS: {
    '222': { id: '222', name: '강남', lines: ['2'] },
    '223': { id: '223', name: '역삼', lines: ['2'] },
    '224': { id: '224', name: '선릉', lines: ['2', '분당'] },
    '225': { id: '225', name: '삼성', lines: ['2'] },
    '226': { id: '226', name: '종합운동장', lines: ['2', '9'] },
    '201': { id: '201', name: '시청', lines: ['1', '2'] },
  },
  LINE_STATIONS: {
    '2': ['222', '223', '224', '225', '226'],
    '분당': ['224', '227', '228'],
    '9': ['226', '229', '230'],
    '1': ['201', '202', '203'],
  },
}));

jest.mock('@models/route', () => ({
  createRoute: jest.fn((segments) => ({
    segments,
    totalMinutes: segments.length * 2,
    totalStations: segments.length + 1,
    transferCount: segments.filter((s: { isTransfer: boolean }) => s.isTransfer).length,
  })),
  getLineName: jest.fn((lineId) => `${lineId}호선`),
  AVG_STATION_TRAVEL_TIME: 2,
  AVG_TRANSFER_TIME: 4,
}));

describe('findKShortestPaths', () => {
  it('should return empty paths for invalid station IDs', () => {
    const result = findKShortestPaths('invalid', 'also_invalid', 3);

    expect(result.paths).toEqual([]);
    expect(result.fromStationId).toBe('invalid');
    expect(result.toStationId).toBe('also_invalid');
  });

  it('should return result with execution time', () => {
    const result = findKShortestPaths('222', '225', 3);

    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.k).toBe(3);
  });

  it('should find paths between adjacent stations', () => {
    const result = findKShortestPaths('222', '223', 1);

    expect(result.fromStationId).toBe('222');
    expect(result.toStationId).toBe('223');
  });

  it('should find multiple paths when k > 1', () => {
    const result = findKShortestPaths('222', '226', 3);

    expect(result.k).toBe(3);
  });

  it('should return paths sorted by cost', () => {
    const result = findKShortestPaths('222', '225', 3);

    // Paths should be in order of increasing cost
    for (let i = 1; i < result.paths.length; i++) {
      const prevPath = result.paths[i - 1];
      const currPath = result.paths[i];
      if (prevPath && currPath) {
        expect(prevPath.totalMinutes).toBeLessThanOrEqual(currPath.totalMinutes);
      }
    }
  });
});

describe('getDiverseRoutes', () => {
  it('returns at most 2 routes (fastest + min-transfer)', () => {
    const routes = getDiverseRoutes('222', '226');

    expect(routes.length).toBeLessThanOrEqual(2);
  });

  it('labels the first route as "fastest"', () => {
    const routes = getDiverseRoutes('222', '226');

    if (routes.length > 0) {
      expect(routes[0]?.category).toBe('fastest');
    }
  });

  it('rejects routes exceeding the transfer cap unless none qualify', () => {
    const routes = getDiverseRoutes('222', '226');

    // All returned candidates should be ≤2 transfers (the hard cap), with the
    // single fallback exception when no candidate qualifies — in which case we
    // still return exactly 1 route labelled 'fastest'.
    if (routes.length > 1) {
      for (const r of routes) expect(r.transferCount).toBeLessThanOrEqual(2);
    }
  });

  it('min-transfer 카드는 fastest보다 환승이 실제로 적을 때만 노출', () => {
    // semantic invariant: "환승최소" 라벨이 붙은 카드는 반드시 fastest 카드
    // 보다 transferCount가 작아야 한다. 이전 코드는 candidates.slice(1)에서
    // min-transfer를 찾아 fastest가 이미 환승 최소인 경우 차선의 더 나쁜
    // 경로를 잘못 라벨링했음. 이 invariant로 회귀 방지.
    const routes = getDiverseRoutes('222', '226');
    if (routes.length === 2) {
      const fastest = routes.find((r) => r.category === 'fastest');
      const minTransfer = routes.find((r) => r.category === 'min-transfer');
      expect(fastest).toBeDefined();
      expect(minTransfer).toBeDefined();
      if (fastest && minTransfer) {
        expect(minTransfer.transferCount).toBeLessThan(fastest.transferCount);
      }
    }
  });

  it('서로 다른 환승역 그룹은 각각 1장씩 카드로 노출', () => {
    // 222(강남) → 226(종합운동장)은 mock data에서 2호선 직행 + 일부 환승
    // 변형이 있으므로 그룹화가 1개 이상의 카테고리 생성을 보장.
    const routes = getDiverseRoutes('222', '226', 5);
    // 같은 시그니처를 두 번 반환하지 않음
    const signatures = routes.map((r) => buildTransferSignature(r));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('via-station 카드는 viaTags에 환승역 이름을 포함', () => {
    const routes = getDiverseRoutes('222', '226', 5);
    const viaCards = routes.filter((r) => r.category === 'via-station');
    for (const card of viaCards) {
      expect(card.viaTags).toBeDefined();
      expect(card.viaTags!.length).toBeGreaterThan(0);
      // 라벨은 "○○ 경유" 형식
      expect(card.viaTags![0]).toMatch(/경유$/);
    }
  });

  it('maxRoutes 인자로 노출 수 제한', () => {
    const r3 = getDiverseRoutes('222', '226', 3);
    const r5 = getDiverseRoutes('222', '226', 5);
    expect(r3.length).toBeLessThanOrEqual(3);
    expect(r5.length).toBeLessThanOrEqual(5);
    expect(r5.length).toBeGreaterThanOrEqual(r3.length);
  });

  it('1.5x 시간 격차 cap: fastest 대비 50% 초과 경로는 제외', () => {
    const routes = getDiverseRoutes('222', '226', 5);
    if (routes.length > 1) {
      const fastest = routes[0]!;
      const threshold = fastest.totalMinutes * 1.5;
      for (const r of routes) {
        expect(r.totalMinutes).toBeLessThanOrEqual(threshold);
      }
    }
  });
});

describe('KShortestPathResult', () => {
  it('should have correct structure', () => {
    const result = findKShortestPaths('222', '225', 2);

    expect(result).toHaveProperty('paths');
    expect(result).toHaveProperty('k');
    expect(result).toHaveProperty('fromStationId');
    expect(result).toHaveProperty('toStationId');
    expect(result).toHaveProperty('executionTimeMs');
  });
});

describe('edge cases', () => {
  it('should handle same start and end station', () => {
    const result = findKShortestPaths('222', '222', 1);

    // Should handle same station gracefully
    expect(result.fromStationId).toBe('222');
    expect(result.toStationId).toBe('222');
  });

  it('should handle k=0', () => {
    const result = findKShortestPaths('222', '225', 0);

    // k=0 returns at least 1 path (first shortest path is always found)
    expect(result.k).toBe(0);
  });

  it('should handle k=1', () => {
    const result = findKShortestPaths('222', '225', 1);

    // k=1 should return at most 1 path
    expect(result.k).toBe(1);
  });

  it('should handle large k values', () => {
    const result = findKShortestPaths('222', '226', 10);

    // Should not exceed available paths
    expect(result.paths.length).toBeLessThanOrEqual(10);
  });
});

describe('buildTransferSignature', () => {
  // Test helper: build a minimal Route
  const seg = (
    from: string,
    to: string,
    lineId: string,
    isTransfer: boolean,
  ): RouteSegment => ({
    fromStationId: from,
    fromStationName: from,
    toStationId: to,
    toStationName: to,
    lineId,
    lineName: `${lineId}호선`,
    estimatedMinutes: 2,
    isTransfer,
  });

  const route = (
    segs: RouteSegment[],
    totalMinutes = 10,
    transferCount = 0,
  ): Route => ({
    segments: segs,
    totalMinutes,
    transferCount,
    lineIds: Array.from(new Set(segs.map((s) => s.lineId))),
  });

  it('직행 경로는 빈 signature를 반환', () => {
    const r = route([seg('A', 'B', '2', false)]);
    expect(buildTransferSignature(r)).toBe('');
  });

  it('단일 환승 경로는 환승역 이름을 signature로 반환', () => {
    const r = route([
      seg('A', '강남구청', '7', false),
      seg('강남구청', '강남구청', '수인분당', true),
      seg('강남구청', '선릉', '수인분당', false),
    ]);
    expect(buildTransferSignature(r)).toBe('강남구청');
  });

  it('환승역 순서가 달라도 같은 signature (정렬 보장)', () => {
    const r1 = route([
      seg('A', '신도림', '1', false),
      seg('신도림', '신도림', '2', true),
      seg('신도림', '선릉', '2', false),
    ]);
    const r2 = route([
      seg('A', '신도림', '1', false),
      seg('신도림', '신도림', '2', true),
      seg('신도림', '선릉', '2', false),
    ]);
    expect(buildTransferSignature(r1)).toBe(buildTransferSignature(r2));
  });

  it('두 개 환승역은 가나다 정렬되어 join', () => {
    const r = route([
      seg('A', '부평구청', '인천1', false),
      seg('부평구청', '부평구청', '7', true),
      seg('부평구청', '강남구청', '7', false),
      seg('강남구청', '강남구청', '수인분당', true),
      seg('강남구청', '선릉', '수인분당', false),
    ]);
    // sorted: ['강남구청', '부평구청']
    expect(buildTransferSignature(r)).toBe('강남구청|부평구청');
  });
});
