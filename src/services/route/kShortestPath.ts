/**
 * K-Shortest Path Algorithm (Yen's Algorithm)
 * Finds k shortest paths between two stations
 */

import { PriorityQueue } from '@/utils/priorityQueue';
import { STATIONS, LINE_STATIONS } from '@utils/subwayMapData';
import {
  Route,
  RouteSegment,
  createRoute,
  getLineName,
  AVG_STATION_TRAVEL_TIME,
  AVG_TRANSFER_TIME,
} from '@models/route';

// ============================================================================
// Types
// ============================================================================

/**
 * Path result from k-shortest paths
 */
export interface KShortestPathResult {
  readonly paths: readonly Route[];
  readonly k: number;
  readonly fromStationId: string;
  readonly toStationId: string;
  readonly executionTimeMs: number;
}

/**
 * Internal path representation
 */
interface InternalPath {
  nodes: string[];
  cost: number;
}

/**
 * Graph edge
 */
interface Edge {
  to: string;
  weight: number;
  isTransfer: boolean;
  lineId: string;
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build adjacency list graph
 */
function buildGraph(excludeNodeKeys?: Set<string>, excludeEdges?: Set<string>): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();

  // Add edges for each line
  Object.entries(LINE_STATIONS).forEach(([lineId, stationIds]) => {
    for (let i = 0; i < stationIds.length; i++) {
      const stationId = stationIds[i];
      if (!stationId) continue;

      const nodeKey = `${stationId}#${lineId}`;
      if (excludeNodeKeys?.has(nodeKey)) continue;

      if (!graph.has(nodeKey)) {
        graph.set(nodeKey, []);
      }

      // Add edge to next station
      if (i < stationIds.length - 1) {
        const nextStationId = stationIds[i + 1];
        if (nextStationId) {
          const nextKey = `${nextStationId}#${lineId}`;
          if (!excludeNodeKeys?.has(nextKey)) {
            const edgeKey = `${nodeKey}->${nextKey}`;
            if (!excludeEdges?.has(edgeKey)) {
              graph.get(nodeKey)?.push({
                to: nextKey,
                weight: AVG_STATION_TRAVEL_TIME,
                isTransfer: false,
                lineId,
              });
            }
          }
        }
      }

      // Add edge to previous station
      if (i > 0) {
        const prevStationId = stationIds[i - 1];
        if (prevStationId) {
          const prevKey = `${prevStationId}#${lineId}`;
          if (!excludeNodeKeys?.has(prevKey)) {
            const edgeKey = `${nodeKey}->${prevKey}`;
            if (!excludeEdges?.has(edgeKey)) {
              graph.get(nodeKey)?.push({
                to: prevKey,
                weight: AVG_STATION_TRAVEL_TIME,
                isTransfer: false,
                lineId,
              });
            }
          }
        }
      }
    }
  });

  // Handle circular line 2
  const line2Stations = LINE_STATIONS['2'];
  if (line2Stations && line2Stations.length > 1) {
    const first = line2Stations[0];
    const last = line2Stations[line2Stations.length - 1];
    if (first && last) {
      const firstKey = `${first}_2`;
      const lastKey = `${last}_2`;

      if (!excludeNodeKeys?.has(firstKey) && !excludeNodeKeys?.has(lastKey)) {
        if (!excludeEdges?.has(`${lastKey}->${firstKey}`)) {
          graph.get(lastKey)?.push({
            to: firstKey,
            weight: AVG_STATION_TRAVEL_TIME,
            isTransfer: false,
            lineId: '2',
          });
        }
        if (!excludeEdges?.has(`${firstKey}->${lastKey}`)) {
          graph.get(firstKey)?.push({
            to: lastKey,
            weight: AVG_STATION_TRAVEL_TIME,
            isTransfer: false,
            lineId: '2',
          });
        }
      }
    }
  }

  // Add transfer edges
  Object.values(STATIONS).forEach(station => {
    const stationLines = station.lines.filter(lineId => LINE_STATIONS[lineId]);

    for (let i = 0; i < stationLines.length; i++) {
      for (let j = i + 1; j < stationLines.length; j++) {
        const line1 = stationLines[i];
        const line2 = stationLines[j];
        if (!line1 || !line2) continue;

        const key1 = `${station.id}#${line1}`;
        const key2 = `${station.id}#${line2}`;

        if (excludeNodeKeys?.has(key1) || excludeNodeKeys?.has(key2)) continue;

        if (graph.has(key1) && !excludeEdges?.has(`${key1}->${key2}`)) {
          graph.get(key1)?.push({
            to: key2,
            weight: AVG_TRANSFER_TIME,
            isTransfer: true,
            lineId: line2,
          });
        }

        if (graph.has(key2) && !excludeEdges?.has(`${key2}->${key1}`)) {
          graph.get(key2)?.push({
            to: key1,
            weight: AVG_TRANSFER_TIME,
            isTransfer: true,
            lineId: line1,
          });
        }
      }
    }
  });

  return graph;
}

/**
 * Get all node keys for a station
 */
function getStationNodeKeys(stationId: string): string[] {
  const station = STATIONS[stationId];
  if (!station) return [];

  return station.lines
    .filter(lineId => LINE_STATIONS[lineId])
    .map(lineId => `${stationId}#${lineId}`);
}

// ============================================================================
// Dijkstra's Algorithm
// ============================================================================

/**
 * Find shortest path using Dijkstra
 */
function dijkstra(
  graph: Map<string, Edge[]>,
  startKeys: string[],
  endKeys: string[]
): InternalPath | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const queue = new PriorityQueue<string>();

  // Initialize
  graph.forEach((_, key) => {
    distances.set(key, Infinity);
  });

  for (const startKey of startKeys) {
    if (graph.has(startKey)) {
      distances.set(startKey, 0);
      queue.enqueue(startKey, 0);
    }
  }

  const visited = new Set<string>();

  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    if (!current) break;

    if (visited.has(current)) continue;
    visited.add(current);

    // Check if we reached destination
    if (endKeys.includes(current)) {
      const path: string[] = [];
      let node: string | undefined = current;
      while (node) {
        path.unshift(node);
        node = previous.get(node);
      }
      return {
        nodes: path,
        cost: distances.get(current) ?? Infinity,
      };
    }

    const edges = graph.get(current) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const currentDist = distances.get(current) ?? Infinity;
      const newDist = currentDist + edge.weight;
      const existingDist = distances.get(edge.to) ?? Infinity;

      if (newDist < existingDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, current);
        queue.enqueue(edge.to, newDist);
      }
    }
  }

  return null;
}

// ============================================================================
// Yen's K-Shortest Paths Algorithm
// ============================================================================

/**
 * Find k shortest paths using Yen's algorithm
 */
export function findKShortestPaths(
  fromStationId: string,
  toStationId: string,
  k: number = 3
): KShortestPathResult {
  const startTime = Date.now();

  const startKeys = getStationNodeKeys(fromStationId);
  const endKeys = getStationNodeKeys(toStationId);

  if (startKeys.length === 0 || endKeys.length === 0) {
    return {
      paths: [],
      k,
      fromStationId,
      toStationId,
      executionTimeMs: Date.now() - startTime,
    };
  }

  const A: InternalPath[] = []; // k shortest paths
  const B = new PriorityQueue<InternalPath>(); // Candidate paths

  // Find the first shortest path
  const graph = buildGraph();
  const firstPath = dijkstra(graph, startKeys, endKeys);

  if (!firstPath) {
    return {
      paths: [],
      k,
      fromStationId,
      toStationId,
      executionTimeMs: Date.now() - startTime,
    };
  }

  A.push(firstPath);

  // Find k-1 more paths
  for (let i = 1; i < k; i++) {
    const prevPath = A[i - 1];
    if (!prevPath) break;

    // Spur node iteration
    for (let j = 0; j < prevPath.nodes.length - 1; j++) {
      const spurNode = prevPath.nodes[j];
      if (!spurNode) continue;

      const rootPath = prevPath.nodes.slice(0, j + 1);

      // Remove edges that are part of previous paths with same root
      const excludeEdges = new Set<string>();
      for (const path of A) {
        if (path.nodes.length > j) {
          const pathRoot = path.nodes.slice(0, j + 1);
          if (pathRoot.join(',') === rootPath.join(',')) {
            const fromNode = path.nodes[j];
            const toNode = path.nodes[j + 1];
            if (fromNode && toNode) {
              excludeEdges.add(`${fromNode}->${toNode}`);
            }
          }
        }
      }

      // Exclude root path nodes (except spur node)
      const excludeNodes = new Set<string>(rootPath.slice(0, -1));

      // Find spur path
      const spurGraph = buildGraph(excludeNodes, excludeEdges);
      const spurPath = dijkstra(spurGraph, [spurNode], endKeys);

      if (spurPath && spurPath.nodes.length > 1) {
        // Combine root path and spur path
        const totalPath: InternalPath = {
          nodes: [...rootPath.slice(0, -1), ...spurPath.nodes],
          cost: calculatePathCost(rootPath.slice(0, -1)) + spurPath.cost,
        };

        // Add to candidates if not already in A or B
        const pathKey = totalPath.nodes.join(',');
        const existsInA = A.some(p => p.nodes.join(',') === pathKey);

        if (!existsInA) {
          B.enqueue(totalPath, totalPath.cost);
        }
      }
    }

    // Add lowest cost candidate to A
    if (B.isEmpty()) break;

    const nextPath = B.dequeue();
    if (nextPath) {
      // Remove duplicates from B
      const pathKey = nextPath.nodes.join(',');
      while (!B.isEmpty()) {
        const candidate = B.peek();
        if (candidate && candidate.nodes.join(',') === pathKey) {
          B.dequeue();
        } else {
          break;
        }
      }

      A.push(nextPath);
    }
  }

  // Convert internal paths to Route objects
  const routes = A.map(internalPath => convertToRoute(internalPath));

  return {
    paths: routes,
    k,
    fromStationId,
    toStationId,
    executionTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate path cost
 */
function calculatePathCost(nodes: string[]): number {
  let cost = 0;

  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    if (!current || !next) continue;

    const [currentStationId, currentLineId] = current.split('#');
    const [nextStationId, nextLineId] = next.split('#');

    if (currentStationId === nextStationId && currentLineId !== nextLineId) {
      cost += AVG_TRANSFER_TIME;
    } else {
      cost += AVG_STATION_TRAVEL_TIME;
    }
  }

  return cost;
}

/**
 * Convert internal path to Route
 */
function convertToRoute(internalPath: InternalPath): Route {
  const segments: RouteSegment[] = [];

  for (let i = 0; i < internalPath.nodes.length - 1; i++) {
    const currentKey = internalPath.nodes[i];
    const nextKey = internalPath.nodes[i + 1];
    if (!currentKey || !nextKey) continue;

    const [currentStationId, currentLineId] = currentKey.split('#');
    const [nextStationId, nextLineId] = nextKey.split('#');
    if (!currentStationId || !currentLineId || !nextStationId || !nextLineId) continue;

    const currentStation = STATIONS[currentStationId];
    const nextStation = STATIONS[nextStationId];
    if (!currentStation || !nextStation) continue;

    const isTransfer = currentStationId === nextStationId && currentLineId !== nextLineId;

    segments.push({
      fromStationId: currentStationId,
      fromStationName: currentStation.name,
      toStationId: nextStationId,
      toStationName: nextStation.name,
      lineId: isTransfer ? nextLineId : currentLineId,
      lineName: getLineName(isTransfer ? nextLineId : currentLineId),
      estimatedMinutes: isTransfer ? AVG_TRANSFER_TIME : AVG_STATION_TRAVEL_TIME,
      isTransfer,
    });
  }

  return createRoute(segments);
}

/**
 * Build a stable signature representing the *set of transfer stations* a
 * route visits. Used by `getDiverseRoutes` to cluster K-shortest candidates
 * by transfer-station identity — routes sharing the same transfer set are
 * variants of the same idea and collapse into one card.
 *
 * Signature rules:
 *  - Direct routes (no transfer) → '' (empty string)
 *  - Single transfer at 강남구청 → '강남구청'
 *  - Two transfers in any order → '강남구청|부평구청' (alphabetical sort)
 *
 * Station NAME is used (not ID) because the resulting signature also drives
 * the user-facing 'via-station' label. ID-based signature would require a
 * second lookup at label time.
 */
export function buildTransferSignature(route: Route): string {
  const names = route.segments
    .filter((s) => s.isTransfer)
    .map((s) => s.fromStationName)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .sort();
  return names.join('|');
}

/**
 * Hard cap on transfers for any suggested route. Empirically routes in
 * 수도권 cover all reasonable origin-destination pairs with ≤2 transfers;
 * 3+ transfers almost always indicate a detour the user would not pick.
 */
const MAX_ROUTE_TRANSFERS = 2;

/**
 * Default and max number of cards exposed by `getDiverseRoutes`. Adaptive —
 * fewer than this is fine when diversity is limited (e.g. only 1 signature
 * group exists, or short OD pairs).
 */
const DEFAULT_MAX_ROUTES = 5;

/**
 * Routes whose totalMinutes exceed `fastest.totalMinutes * UNREALISTIC_TIME_FACTOR`
 * are filtered out — they're typically valid graph paths but not realistic
 * commute options.
 */
const UNREALISTIC_TIME_FACTOR = 1.5;

/**
 * Pick a diverse set of 1–5 routes from the K-shortest candidates by
 * grouping on transfer-station signature. Returns up to `maxRoutes` cards
 * with the following category invariants:
 *
 *  - First card: `category: 'fastest'` (minimum totalMinutes overall)
 *  - Optional second card: `category: 'min-transfer'` ONLY when
 *    `minTransfer.transferCount < fastest.transferCount` (PR #55 invariant).
 *  - Remaining cards: `category: 'via-station'` with `viaTags: ['{역} 경유']`
 *    sorted by totalMinutes ascending.
 *
 * `via-station` label uses the *last* transfer station along the route
 * (closest to destination) because that's the more memorable hop for users
 * planning the trip.
 *
 * Routes with > MAX_ROUTE_TRANSFERS transfers are filtered out unless no
 * candidate qualifies (in which case we fall back to the K-shortest #1 so
 * the UI shows something).
 */
export function getDiverseRoutes(
  fromStationId: string,
  toStationId: string,
  maxRoutes: number = DEFAULT_MAX_ROUTES,
): Route[] {
  const result = findKShortestPaths(fromStationId, toStationId, 15);
  if (result.paths.length === 0) return [];

  const filtered = result.paths.filter((r) => r.transferCount <= MAX_ROUTE_TRANSFERS);
  const candidates = filtered.length > 0 ? filtered : [result.paths[0]!];

  // 1. Group by transfer signature, keep cost-min representative per group
  const groupMap = new Map<string, Route>();
  for (const c of candidates) {
    const sig = buildTransferSignature(c);
    const prev = groupMap.get(sig);
    if (!prev || c.totalMinutes < prev.totalMinutes) {
      groupMap.set(sig, c);
    }
  }
  const representatives = [...groupMap.values()].sort(
    (a, b) => a.totalMinutes - b.totalMinutes,
  );

  // 2. Identify fastest (already first after sort)
  const fastest = representatives[0]!;

  // 3. Apply 1.5x time-gap cap relative to fastest
  const timeThreshold = fastest.totalMinutes * UNREALISTIC_TIME_FACTOR;
  const reachableReps = representatives.filter(
    (r) => r.totalMinutes <= timeThreshold,
  );

  // 4. Identify min-transfer ONLY if strictly better than fastest
  // (PR #55 invariant — preserved). Pick from reachable, not fastest itself.
  const minTransfer = reachableReps.reduce<Route | null>((best, r) => {
    if (r === fastest) return best;
    if (r.transferCount >= fastest.transferCount) return best;
    if (!best) return r;
    if (r.transferCount < best.transferCount) return r;
    if (r.transferCount === best.transferCount && r.totalMinutes < best.totalMinutes) {
      return r;
    }
    return best;
  }, null);

  // 5. Adaptive selection up to maxRoutes
  const selected: Route[] = [labelFastest(fastest)];
  if (minTransfer) {
    selected.push(labelMinTransfer(minTransfer));
  }

  const remaining = reachableReps.filter(
    (r) => r !== fastest && r !== minTransfer,
  );
  for (const r of remaining) {
    if (selected.length >= maxRoutes) break;
    selected.push(labelViaStation(r));
  }

  return selected;
}

function labelFastest(route: Route): Route {
  return { ...route, category: 'fastest' };
}

function labelMinTransfer(route: Route): Route {
  return { ...route, category: 'min-transfer' };
}

/**
 * Label a route as 'via-station' using the last transfer station along
 * the route as the user-facing tag. Empty viaTags would be a contract
 * violation — we fall back to '환승 경유' (generic) if the route has no
 * transfers (which shouldn't reach this path, but defensive).
 */
function labelViaStation(route: Route): Route {
  const transfers = route.segments
    .filter((s) => s.isTransfer)
    .map((s) => s.fromStationName);
  const lastTransfer = transfers[transfers.length - 1];
  const tag = lastTransfer ? `${lastTransfer} 경유` : '환승 경유';
  return {
    ...route,
    category: 'via-station',
    viaTags: [tag],
  };
}

export default { findKShortestPaths, getDiverseRoutes };
