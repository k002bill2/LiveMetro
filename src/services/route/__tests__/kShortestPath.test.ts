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
    '202': { id: '202', name: '종각', lines: ['1'] },
    '203': { id: '203', name: '종로3가', lines: ['1'] },
    // Synthetic branched line B for Task 7 topology tests.
    // Topology: B1 — B2 — B3 (trunk)
    //                \— B4 — B5 (branch off B2)
    'B1': { id: 'B1', name: 'B1', lines: ['B'] },
    'B2': { id: 'B2', name: 'B2', lines: ['B'] },
    'B3': { id: 'B3', name: 'B3', lines: ['B'] },
    'B4': { id: 'B4', name: 'B4', lines: ['B'] },
    'B5': { id: 'B5', name: 'B5', lines: ['B'] },
  },
  // Nested array shape (Task 3+ contract: Record<string, readonly string[][]>).
  // Each top-level array is a list of segments; single-segment lines wrap once.
  LINE_STATIONS: {
    '2': [['222', '223', '224', '225', '226']],
    '분당': [['224', '227', '228']],
    '9': [['226', '229', '230']],
    '1': [['201', '202', '203']],
    // Branched line: B2 appears in both subarrays as branch point.
    // Used by 'buildGraph — branched line topology' describe block.
    'B': [
      ['B1', 'B2', 'B3'],
      ['B2', 'B4', 'B5'],
    ],
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
  FASTEST_LINE_HOP_MINUTES: 2,
  getLineHopMinutes: jest.fn(() => 2),
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
  it('returns [] for invalid station IDs', () => {
    expect(getDiverseRoutes('invalid', 'also_invalid')).toEqual([]);
  });

  it('returns at most DEFAULT_MAX_ROUTES (5) routes adaptively', () => {
    const routes = getDiverseRoutes('222', '226');

    expect(routes.length).toBeLessThanOrEqual(5);
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

  it('회귀: min-transfer 카드의 transferCount는 항상 fastest보다 작음 (PR #55)', () => {
    // semantic invariant — Task 3 재작성 후에도 유지돼야 함.
    const routes = getDiverseRoutes('222', '226', 5);
    const fastest = routes.find((r) => r.category === 'fastest');
    const minTransfer = routes.find((r) => r.category === 'min-transfer');
    if (fastest && minTransfer) {
      expect(minTransfer.transferCount).toBeLessThan(fastest.transferCount);
    }
  });

  it('회귀: 첫 카드는 항상 fastest 카테고리', () => {
    const routes = getDiverseRoutes('222', '226', 5);
    if (routes.length > 0) {
      expect(routes[0]?.category).toBe('fastest');
    }
  });

  it('짧은 OD pair (인접역)는 카드 1장만 반환', () => {
    // 222(강남) → 223(역삼)은 1정거장 직행. 환승 옵션 없음.
    // segment 구조도 검증: hardcoded placeholder가 아닌 실제 경로인지 확인.
    const routes = getDiverseRoutes('222', '223', 5);
    expect(routes.length).toBe(1);
    expect(routes[0]?.category).toBe('fastest');
    expect(routes[0]?.transferCount).toBe(0);
    const segs = routes[0]?.segments ?? [];
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0]?.fromStationId).toBe('222');
    expect(segs[segs.length - 1]?.toStationId).toBe('223');
  });

  it('maxRoutes 기본값은 5', () => {
    // 인자 생략 시 DEFAULT_MAX_ROUTES(5) 적용.
    // 더 큰 값을 명시한 호출 결과와 비교해 cap이 default에서 실제로 동작함을 검증.
    const defaultRoutes = getDiverseRoutes('222', '226');
    const largerRoutes = getDiverseRoutes('222', '226', 10);
    expect(defaultRoutes.length).toBeLessThanOrEqual(5);
    // 다양성이 충분하면 maxRoutes=10에서 더 많이 반환되어야 하지만,
    // 다양성이 부족하면 동일할 수 있음. cap이 default를 초과하지 않음만 보장.
    expect(largerRoutes.length).toBeGreaterThanOrEqual(defaultRoutes.length);
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

describe('buildGraph — branched line topology (nested LINE_STATIONS)', () => {
  // These tests exercise the Task 4 nested-loop graph builder via the public
  // findKShortestPaths API. The synthetic line 'B' in the module mock has
  // shape [[B1,B2,B3],[B2,B4,B5]] — B2 is the branch point.

  it('동일 station이 여러 subarray에 등장하면 분기 셔틀 transfer edge 생성', () => {
    // B1 → B5 must traverse via the branch point B2 onto the second subarray.
    // With `::subIdx` encoding, B2 has distinct nodes B2#B::0 (subarray[0])
    // and B2#B::1 (subarray[1]); the branch junction logic adds a shuttle
    // transfer edge between them. So the traversal is a 1-transfer path:
    // B1 → B2 (::0) → [branch shuttle] → B2 (::1) → B4 → B5.
    const result = findKShortestPaths('B1', 'B5', 1);

    expect(result.paths.length).toBeGreaterThan(0);
    const path = result.paths[0]!;
    // Branch shuttle at B2 counts as 1 transfer (operationally a train change).
    expect(path.transferCount).toBe(1);
    // Path: B1 → B2 → B2 (shuttle) → B4 → B5. The doubled B2 reflects the
    // self-station shuttle segment.
    const stationIds = [
      path.segments[0]?.fromStationId,
      ...path.segments.map(s => s.toStationId),
    ];
    expect(stationIds).toEqual(['B1', 'B2', 'B2', 'B4', 'B5']);
  });

  it('reverse 방향도 분기 셔틀 edge 사용 가능 (B5 → B1 대칭)', () => {
    // Bidirectional check: prev-edge logic + branch shuttle edge must also
    // produce the branch-point traversal in reverse.
    const result = findKShortestPaths('B5', 'B1', 1);

    expect(result.paths.length).toBeGreaterThan(0);
    const path = result.paths[0]!;
    expect(path.transferCount).toBe(1);
    const stationIds = [
      path.segments[0]?.fromStationId,
      ...path.segments.map(s => s.toStationId),
    ];
    expect(stationIds).toEqual(['B5', 'B4', 'B2', 'B2', 'B1']);
  });

  it('단일 subarray (legacy flat) 노선은 인접 동작 보존 (backwards compat)', () => {
    // Line '1' mock has shape [['201','202','203']] — single segment, and
    // (unlike line '2') is NOT the hardcoded circular line, so no first↔last
    // wrap edge interferes. Adjacent station traversal must still work.
    const result = findKShortestPaths('201', '203', 1);

    expect(result.paths.length).toBeGreaterThan(0);
    const path = result.paths[0]!;
    expect(path.transferCount).toBe(0);
    // 201 → 202 → 203: 2 hops on Line 1.
    const stationIds = [
      path.segments[0]?.fromStationId,
      ...path.segments.map(s => s.toStationId),
    ];
    expect(stationIds).toEqual(['201', '202', '203']);
  });

  it('branch trunk 끝 (B3)에서 다른 branch (B5)로 분기 셔틀 1회로 도달', () => {
    // B3 → B5: must go B3 → B2 (back along trunk) → [branch shuttle] → B4 → B5.
    // Exercises the prev-edge logic at B3 + branch shuttle edge at B2.
    const result = findKShortestPaths('B3', 'B5', 1);

    expect(result.paths.length).toBeGreaterThan(0);
    const path = result.paths[0]!;
    expect(path.transferCount).toBe(1);
    const stationIds = [
      path.segments[0]?.fromStationId,
      ...path.segments.map(s => s.toStationId),
    ];
    expect(stationIds).toEqual(['B3', 'B2', 'B2', 'B4', 'B5']);
  });

  it('branched line의 비인접 station 간 false circular wrap 미발생', () => {
    // The Line-2 trunk wrap code is hardcoded to LINE_STATIONS['2']?.[0].
    // For other lines (like 'B'), no circular edge from first to last of
    // any subarray should exist. So B1 (start of subarray[0]) has no
    // direct edge to B3 (end of subarray[0]) — must traverse B2.
    const result = findKShortestPaths('B1', 'B3', 1);

    expect(result.paths.length).toBeGreaterThan(0);
    const path = result.paths[0]!;
    // Direct path is B1 → B2 → B3 (2 hops). If a false circular wrap edge
    // existed, the path could be 1 hop, which would be wrong.
    expect(path.segments.length).toBe(2);
  });
});
