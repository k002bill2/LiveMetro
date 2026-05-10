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
 * Hard cap on transfers for any suggested route. Empirically routes in
 * 수도권 cover all reasonable origin-destination pairs with ≤2 transfers;
 * 3+ transfers almost always indicate a detour the user would not pick.
 */
const MAX_ROUTE_TRANSFERS = 2;

/**
 * Pick the fastest route and the fewest-transfer route from the K-shortest
 * candidates. Replaces the old Jaccard-similarity-based diversity selection,
 * which kept high-transfer detours just because their segments differed.
 *
 * Returns 1 or 2 routes:
 *  - `category: 'fastest'`     — minimum totalMinutes (Yen output is asc-sorted)
 *  - `category: 'min-transfer'` — minimum transferCount, tie-broken by time
 *
 * If both selections converge on the same path (e.g. only one route exists,
 * or the fastest route already has the minimum transferCount), only one card
 * is returned. Routes with > MAX_ROUTE_TRANSFERS transfers are filtered out
 * unless no candidate qualifies (in which case we fall back to the K-shortest
 * #1 so the UI shows something).
 */
export function getDiverseRoutes(
  fromStationId: string,
  toStationId: string
): Route[] {
  const result = findKShortestPaths(fromStationId, toStationId, 10);
  if (result.paths.length === 0) return [];

  const candidates = result.paths.filter(r => r.transferCount <= MAX_ROUTE_TRANSFERS);
  if (candidates.length === 0) {
    // Fallback: cap is too strict for this OD pair; show the K-shortest #1
    // labelled as 'fastest' so the user still gets a result + a clear category.
    return [{ ...result.paths[0]!, category: 'fastest' }];
  }

  const fastest: Route = { ...candidates[0]!, category: 'fastest' };

  // Pick the candidate with fewest transfers; tie-break by shortest time.
  const minTransfer = candidates.slice(1).reduce<Route | null>((best, r) => {
    if (!best) return r;
    if (r.transferCount < best.transferCount) return r;
    if (r.transferCount === best.transferCount && r.totalMinutes < best.totalMinutes) {
      return r;
    }
    return best;
  }, null);

  if (minTransfer && !isSamePath(fastest, minTransfer)) {
    return [fastest, { ...minTransfer, category: 'min-transfer' }];
  }
  return [fastest];
}

/**
 * Two routes are the same path if every segment matches by from/to/line.
 * Used to drop the 'min-transfer' card when it would duplicate 'fastest'.
 */
function isSamePath(a: Route, b: Route): boolean {
  if (a.segments.length !== b.segments.length) return false;
  for (let i = 0; i < a.segments.length; i++) {
    const sa = a.segments[i]!;
    const sb = b.segments[i]!;
    if (
      sa.fromStationId !== sb.fromStationId ||
      sa.toStationId !== sb.toStationId ||
      sa.lineId !== sb.lineId
    ) {
      return false;
    }
  }
  return true;
}

export default { findKShortestPaths, getDiverseRoutes };
