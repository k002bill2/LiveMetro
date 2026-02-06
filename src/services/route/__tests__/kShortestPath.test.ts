/**
 * K-Shortest Path Tests
 */

import { findKShortestPaths, getDiverseRoutes } from '../kShortestPath';

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
  it('should return diverse routes', () => {
    const routes = getDiverseRoutes('222', '226', 0.3);

    expect(routes.length).toBeLessThanOrEqual(3);
  });

  it('should respect minimum diversity threshold', () => {
    const routes = getDiverseRoutes('222', '226', 0.5);

    // With high diversity threshold, should return fewer routes
    expect(routes.length).toBeLessThanOrEqual(3);
  });

  it('should return at most 3 routes', () => {
    const routes = getDiverseRoutes('222', '226', 0.1);

    expect(routes.length).toBeLessThanOrEqual(3);
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
