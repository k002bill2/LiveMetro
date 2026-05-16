/**
 * Route Service
 * Calculates optimal and alternative routes using A* algorithm with heuristics
 */

import { STATIONS, LINE_STATIONS, LINE_COLORS } from '@utils/subwayMapData';
import type { StationData } from '@utils/subwayMapData';
import {
  Route,
  RouteSegment,
  AlternativeRoute,
  AlternativeReason,
  AlternativeRouteOptions,
  DEFAULT_ALTERNATIVE_OPTIONS,
  FASTEST_LINE_HOP_MINUTES,
  getEdgeMinutes,
  createRoute,
  createAlternativeRoute,
  getLineName,
} from '@models/route';
import { PriorityQueue } from '@/utils/priorityQueue';
import { sumHaversineDistanceKm, type LatLng } from '@/utils/haversine';
import { getStationCoordinates } from '@/utils/stationCoordinateLookup';
import { fareService, type FareResult } from './fareService';
import { getDiverseRoutes, trunkLineId } from './kShortestPath';
import {
  getNextTrainWaitMinutes,
  type RealtimeArrival,
} from './realtimeWeightOverride';
import { getTransferTime } from './transferTime';

// ============================================================================
// Types
// ============================================================================

interface GraphNode {
  stationId: string;
  lineId: string;
  key: string; // `${stationId}#${lineId}` for unique identification
}

interface GraphEdge {
  to: GraphNode;
  weight: number;
  isTransfer: boolean;
}

interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge[]>;
}

interface AStarResult {
  distance: number;
  previous: Map<string, string>;
  path: string[];
  nodesExplored: number;
}

// Dijkstra result type (same structure without nodesExplored)
interface DijkstraResult {
  distance: number;
  previous: Map<string, string>;
  path: string[];
}

/**
 * Route with additional metadata
 */
export interface EnhancedRoute extends Route {
  readonly fare: FareResult;
  readonly stationCount: number;
  readonly estimatedArrivalTime?: string;
}

/**
 * Real-time delay info for route calculation
 */
export interface DelayInfo {
  lineId: string;
  delayMinutes: number;
  reason?: string;
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build graph from station and line data
 */
const buildGraph = (
  excludeLineIds: readonly string[] = [],
  congestionMultipliers?: ReadonlyMap<string, number>,
): Graph => {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();

  // Phase A: compute edge weight with optional congestion multiplier
  // applied inline at edge creation. Multiplier keyed by destination
  // lineId — the line you're on after traversing the edge. Avoids the
  // extra O(E) post-pass and per-edge object allocation that a
  // post-construction pass would incur (this function is called many
  // times by Yen's k-shortest-paths algorithm).
  const adjustWeight = (baseWeight: number, destLineId: string): number =>
    baseWeight * (congestionMultipliers?.get(destLineId) ?? 1.0);

  // Create nodes for each station-line combination
  Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
    if (excludeLineIds.includes(lineId)) return;

    segments.forEach(stationIds => {
      stationIds.forEach((stationId, index) => {
        const key = `${stationId}#${lineId}`;
        const node: GraphNode = { stationId, lineId, key };
        nodes.set(key, node);

        // Initialize edges array
        if (!edges.has(key)) {
          edges.set(key, []);
        }

        // Add edge to next station on same subarray
        if (index < stationIds.length - 1) {
          const nextStationId = stationIds[index + 1];
          if (nextStationId) {
            const nextKey = `${nextStationId}#${lineId}`;
            const edgeList = edges.get(key) || [];
            edgeList.push({
              to: { stationId: nextStationId, lineId, key: nextKey },
              weight: adjustWeight(getEdgeMinutes(stationId, nextStationId, lineId), lineId),
              isTransfer: false,
            });
            edges.set(key, edgeList);
          }
        }

        // Add edge to previous station on same subarray (bidirectional)
        if (index > 0) {
          const prevStationId = stationIds[index - 1];
          if (prevStationId) {
            const prevKey = `${prevStationId}#${lineId}`;
            const edgeList = edges.get(key) || [];
            edgeList.push({
              to: { stationId: prevStationId, lineId, key: prevKey },
              weight: adjustWeight(getEdgeMinutes(stationId, prevStationId, lineId), lineId),
              isTransfer: false,
            });
            edges.set(key, edgeList);
          }
        }
      });
    });
  });

  // Handle circular line 2 — trunk subarray only.
  // Underscore key format preserved (existing silent no-op).
  const line2Trunk = LINE_STATIONS['2']?.[0];
  if (line2Trunk && line2Trunk.length > 1 && !excludeLineIds.includes('2')) {
    const firstStation = line2Trunk[0];
    const lastStation = line2Trunk[line2Trunk.length - 1];
    if (firstStation && lastStation) {
      const firstKey = `${firstStation}_2`;
      const lastKey = `${lastStation}_2`;

      // Last to first
      const lastEdges = edges.get(lastKey) || [];
      lastEdges.push({
        to: { stationId: firstStation, lineId: '2', key: firstKey },
        weight: adjustWeight(getEdgeMinutes(lastStation, firstStation, '2'), '2'),
        isTransfer: false,
      });
      edges.set(lastKey, lastEdges);

      // First to last
      const firstEdges = edges.get(firstKey) || [];
      firstEdges.push({
        to: { stationId: lastStation, lineId: '2', key: lastKey },
        weight: adjustWeight(getEdgeMinutes(firstStation, lastStation, '2'), '2'),
        isTransfer: false,
      });
      edges.set(firstKey, firstEdges);
    }
  }

  // Add transfer edges between same station on different lines
  Object.values(STATIONS).forEach((station: StationData) => {
    const stationLines = station.lines.filter(
      lineId => !excludeLineIds.includes(lineId) && (LINE_STATIONS[lineId]?.length ?? 0) > 0
    );

    // For each pair of lines at this station, add transfer edges
    for (let i = 0; i < stationLines.length; i++) {
      for (let j = i + 1; j < stationLines.length; j++) {
        const line1 = stationLines[i];
        const line2 = stationLines[j];
        if (!line1 || !line2) continue;

        const key1 = `${station.id}#${line1}`;
        const key2 = `${station.id}#${line2}`;

        // Only add if both nodes exist
        if (nodes.has(key1) && nodes.has(key2)) {
          // Line1 to Line2
          const edges1 = edges.get(key1) || [];
          edges1.push({
            to: { stationId: station.id, lineId: line2, key: key2 },
            weight: adjustWeight(getTransferTime(station.id), line2),
            isTransfer: true,
          });
          edges.set(key1, edges1);

          // Line2 to Line1
          const edges2 = edges.get(key2) || [];
          edges2.push({
            to: { stationId: station.id, lineId: line1, key: key1 },
            weight: adjustWeight(getTransferTime(station.id), line1),
            isTransfer: true,
          });
          edges.set(key2, edges2);
        }
      }
    }
  });

  return { nodes, edges };
};

// ============================================================================
// A* Algorithm (Optimized)
// ============================================================================

/**
 * Heuristic function for A* algorithm
 * Estimates minimum time to reach destination
 */
const heuristic = (
  currentKey: string,
  endKeys: string[],
  stationPositions: Map<string, number>
): number => {
  const currentStationId = currentKey.split('#')[0];
  if (!currentStationId) return 0;

  const currentPos = stationPositions.get(currentStationId) ?? 0;

  // Find closest end station
  let minDistance = Infinity;
  for (const endKey of endKeys) {
    const endStationId = endKey.split('#')[0];
    if (!endStationId) continue;
    const endPos = stationPositions.get(endStationId) ?? 0;
    const distance = Math.abs(endPos - currentPos);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  // A* admissibility: h ≤ actual cost. Use the fastest known line speed
  // (e.g. GTX-A) as the per-hop floor — any actual route has hop cost ≥ this
  // value, so h is a valid lower bound. 0.95 margin guards float jitter.
  return minDistance * FASTEST_LINE_HOP_MINUTES * 0.95;
};

/**
 * Build station position map for heuristic
 */
const buildStationPositions = (): Map<string, number> => {
  const positions = new Map<string, number>();
  let counter = 0;

  Object.entries(LINE_STATIONS).forEach(([_lineId, segments]) => {
    segments.forEach(stationIds => {
      stationIds.forEach(stationId => {
        if (!positions.has(stationId)) {
          positions.set(stationId, counter);
          counter++;
        }
      });
    });
  });

  return positions;
};

/**
 * Find shortest path using A* algorithm with priority queue
 */
const astar = (
  graph: Graph,
  startKeys: string[],
  endKeys: string[],
  lineDelays?: Map<string, number>
): AStarResult | null => {
  const gScores = new Map<string, number>();
  const fScores = new Map<string, number>();
  const previous = new Map<string, string>();
  const visited = new Set<string>();

  const queue = new PriorityQueue<string>();
  const stationPositions = buildStationPositions();
  let nodesExplored = 0;

  // Initialize
  graph.nodes.forEach((_, key) => {
    gScores.set(key, Infinity);
    fScores.set(key, Infinity);
  });

  // Add start nodes
  for (const startKey of startKeys) {
    if (graph.nodes.has(startKey)) {
      gScores.set(startKey, 0);
      const h = heuristic(startKey, endKeys, stationPositions);
      fScores.set(startKey, h);
      queue.enqueue(startKey, h);
    }
  }

  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    if (!current) break;

    nodesExplored++;

    if (visited.has(current)) continue;
    visited.add(current);

    // Check if reached destination
    if (endKeys.includes(current)) {
      const path: string[] = [];
      let node: string | undefined = current;
      while (node) {
        path.unshift(node);
        node = previous.get(node);
      }

      return {
        distance: gScores.get(current) ?? 0,
        previous,
        path,
        nodesExplored,
      };
    }

    const currentG = gScores.get(current) ?? Infinity;
    const edges = graph.edges.get(current) ?? [];

    for (const edge of edges) {
      if (visited.has(edge.to.key)) continue;

      // Apply delay penalty if line has delays
      let weight = edge.weight;
      if (lineDelays && !edge.isTransfer) {
        const lineId = edge.to.lineId;
        const delay = lineDelays.get(lineId) ?? 0;
        weight += delay;
      }

      const tentativeG = currentG + weight;
      const existingG = gScores.get(edge.to.key) ?? Infinity;

      if (tentativeG < existingG) {
        previous.set(edge.to.key, current);
        gScores.set(edge.to.key, tentativeG);
        const h = heuristic(edge.to.key, endKeys, stationPositions);
        const f = tentativeG + h;
        fScores.set(edge.to.key, f);
        queue.enqueue(edge.to.key, f);
      }
    }
  }

  return null;
};

/**
 * Find shortest path using Dijkstra's algorithm (fallback)
 */
const dijkstra = (
  graph: Graph,
  startKeys: string[],
  endKeys: string[]
): DijkstraResult | null => {
  const result = astar(graph, startKeys, endKeys);
  if (!result) return null;

  return {
    distance: result.distance,
    previous: result.previous,
    path: result.path,
  };
};

// ============================================================================
// Route Calculation
// ============================================================================

/**
 * Convert Dijkstra path to RouteSegments
 */
const pathToSegments = (path: string[]): RouteSegment[] => {
  const segments: RouteSegment[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const currentKey = path[i];
    const nextKey = path[i + 1];
    if (!currentKey || !nextKey) continue;

    const [currentStationId, currentLineId] = currentKey.split('#');
    const [nextStationId, nextLineId] = nextKey.split('#');
    if (!currentStationId || !currentLineId || !nextStationId || !nextLineId) continue;

    const currentStation = STATIONS[currentStationId];
    const nextStation = STATIONS[nextStationId];
    if (!currentStation || !nextStation) continue;

    // lineId here may carry a `::${subIdx}` suffix from sub-line encoding.
    // The suffix is essential for the `currentLineId !== nextLineId`
    // transfer comparison (sub-line shuttle change is a real user transfer),
    // but must NOT leak to the UI segment where LINE_LABELS lookup expects
    // the trunk id (e.g. "2", not "2::2"). Use trunkLineId helper.
    const isTransfer =
      currentStationId === nextStationId && currentLineId !== nextLineId;
    const displayLineId = trunkLineId(isTransfer ? nextLineId : currentLineId);

    segments.push({
      fromStationId: currentStationId,
      fromStationName: currentStation.name,
      toStationId: nextStationId,
      toStationName: nextStation.name,
      lineId: displayLineId,
      lineName: getLineName(displayLineId),
      estimatedMinutes: isTransfer
        ? getTransferTime(currentStationId)
        : getEdgeMinutes(currentStationId, nextStationId, displayLineId),
      isTransfer,
    });
  }

  return segments;
};

/**
 * Get all possible start keys for a station
 */
const getStationKeys = (
  stationId: string,
  excludeLineIds: readonly string[] = []
): string[] => {
  const station = STATIONS[stationId];
  if (!station) return [];

  return station.lines
    .filter(lineId => !excludeLineIds.includes(lineId) && (LINE_STATIONS[lineId]?.length ?? 0) > 0)
    .map(lineId => `${stationId}#${lineId}`);
};

/**
 * Calculate route between two stations
 */
export const calculateRoute = (
  fromStationId: string,
  toStationId: string,
  excludeLineIds: readonly string[] = [],
  congestionMultipliers?: ReadonlyMap<string, number>,
  realtimeArrivals?: readonly RealtimeArrival[],
): Route | null => {
  // Build graph
  const graph = buildGraph(excludeLineIds, congestionMultipliers);

  // Get start and end keys
  const startKeys = getStationKeys(fromStationId, excludeLineIds);
  const endKeys = getStationKeys(toStationId, excludeLineIds);

  if (startKeys.length === 0 || endKeys.length === 0) {
    return null;
  }

  // Find shortest path
  const result = dijkstra(graph, startKeys, endKeys);
  if (!result) return null;

  // Convert to segments
  const segments = pathToSegments(result.path);
  if (segments.length === 0) return null;

  // Phase C: add next-train wait time to first segment if realtime data available.
  // Graceful fallback when no data / non-matching line / wait=0.
  const adjustedSegments = (() => {
    if (!realtimeArrivals || realtimeArrivals.length === 0) return segments;
    const first = segments[0];
    if (!first) return segments;
    const wait = getNextTrainWaitMinutes(realtimeArrivals, first.lineId);
    if (wait === null || wait === 0) return segments;
    return [
      { ...first, estimatedMinutes: first.estimatedMinutes + wait },
      ...segments.slice(1),
    ];
  })();

  return createRoute(adjustedSegments);
};

/**
 * Find alternative routes excluding specified lines
 */
export const findAlternativeRoutes = (
  fromStationId: string,
  toStationId: string,
  affectedLineIds: readonly string[],
  reason: AlternativeReason,
  options: AlternativeRouteOptions = DEFAULT_ALTERNATIVE_OPTIONS
): AlternativeRoute[] => {
  const alternatives: AlternativeRoute[] = [];

  // Calculate original route (without exclusions)
  const originalRoute = calculateRoute(fromStationId, toStationId);
  if (!originalRoute) return [];

  // For each affected line, calculate alternative route
  const excludeLineIds = [
    ...(options.excludeLineIds || []),
    ...affectedLineIds,
  ];

  const alternativeRoute = calculateRoute(fromStationId, toStationId, excludeLineIds);
  if (!alternativeRoute) return [];

  // Check if alternative meets criteria
  const timeDiff = alternativeRoute.totalMinutes - originalRoute.totalMinutes;
  if (
    options.maxTimeDifference !== undefined &&
    timeDiff > options.maxTimeDifference
  ) {
    return [];
  }

  if (
    options.maxTransfers !== undefined &&
    alternativeRoute.transferCount > options.maxTransfers
  ) {
    return [];
  }

  // Calculate confidence based on time difference
  const confidence = Math.max(
    0,
    100 - Math.abs(timeDiff) * 5 - alternativeRoute.transferCount * 10
  );

  alternatives.push(
    createAlternativeRoute(
      originalRoute,
      alternativeRoute,
      reason,
      affectedLineIds[0] || '',
      confidence
    )
  );

  return alternatives;
};

/**
 * Get route summary for display
 */
export const getRouteSummary = (route: Route): string => {
  const lineNames = route.lineIds.map(getLineName);
  return lineNames.join(' → ');
};

/**
 * Check if a route passes through a specific line
 */
export const routeUsesLine = (route: Route, lineId: string): boolean => {
  return route.lineIds.includes(lineId);
};

/**
 * Get station info by ID
 */
export const getStationInfo = (
  stationId: string
): { id: string; name: string; lines: string[] } | null => {
  const station = STATIONS[stationId];
  if (!station) return null;
  return {
    id: station.id,
    name: station.name,
    lines: station.lines,
  };
};

/**
 * Get line color by ID
 */
export const getLineColor = (lineId: string): string => {
  return LINE_COLORS[lineId] || '#888888';
};

// ============================================================================
// Enhanced Route Calculation
// ============================================================================

/**
 * Calculate route with fare and additional metadata
 */
export const calculateEnhancedRoute = (
  fromStationId: string,
  toStationId: string,
  excludeLineIds: readonly string[] = [],
  delays?: DelayInfo[]
): EnhancedRoute | null => {
  const graph = buildGraph(excludeLineIds);
  const startKeys = getStationKeys(fromStationId, excludeLineIds);
  const endKeys = getStationKeys(toStationId, excludeLineIds);

  if (startKeys.length === 0 || endKeys.length === 0) {
    return null;
  }

  // Build delay map
  const lineDelays = delays
    ? new Map(delays.map(d => [d.lineId, d.delayMinutes]))
    : undefined;

  // Find path using A*
  const result = astar(graph, startKeys, endKeys, lineDelays);
  if (!result) return null;

  const segments = pathToSegments(result.path);
  if (segments.length === 0) return null;

  const route = createRoute(segments);

  // Count stations
  const stationCount = segments.filter(s => !s.isTransfer).length + 1;

  // Phase B: try GPS-based distance from path station coordinates.
  // path is ['stationId#lineId', ...]; dedupe consecutive duplicates (transfers
  // don't move physical location). If all coords available, use Haversine sum;
  // else fall back to stationCount × 1.2km estimation (graceful degradation).
  const pathStationIds = result.path
    .map(key => key.split('#')[0])
    .filter((id, i, arr): id is string => !!id && id !== arr[i - 1]);
  const coordLookups = pathStationIds.map(id => getStationCoordinates(id));
  const allCoordsAvailable = coordLookups.every((c): c is LatLng => c !== null);
  const fare = allCoordsAvailable
    ? fareService.calculateFareByDistance(sumHaversineDistanceKm(coordLookups))
    : fareService.calculateFare(stationCount);

  return {
    ...route,
    fare,
    stationCount,
  };
};

/**
 * Calculate route with real-time delay consideration
 */
export const calculateRouteWithDelays = (
  fromStationId: string,
  toStationId: string,
  delays: DelayInfo[]
): Route | null => {
  const enhanced = calculateEnhancedRoute(fromStationId, toStationId, [], delays);
  return enhanced ? {
    segments: enhanced.segments,
    totalMinutes: enhanced.totalMinutes,
    transferCount: enhanced.transferCount,
    lineIds: enhanced.lineIds,
  } : null;
};

/**
 * Find multiple alternative routes
 */
export const findMultipleAlternatives = (
  fromStationId: string,
  toStationId: string,
  affectedLineIds: readonly string[],
  reason: AlternativeReason,
  maxAlternatives: number = 3
): AlternativeRoute[] => {
  const alternatives: AlternativeRoute[] = [];

  // Original route
  const originalRoute = calculateRoute(fromStationId, toStationId);
  if (!originalRoute) return [];

  // Try excluding each affected line individually
  for (const lineId of affectedLineIds) {
    const altRoute = calculateRoute(fromStationId, toStationId, [lineId]);
    if (altRoute) {
      const timeDiff = altRoute.totalMinutes - originalRoute.totalMinutes;
      const confidence = Math.max(0, 100 - Math.abs(timeDiff) * 5 - altRoute.transferCount * 10);

      alternatives.push(
        createAlternativeRoute(originalRoute, altRoute, reason, lineId, confidence)
      );
    }
  }

  // Try excluding all affected lines
  if (affectedLineIds.length > 1) {
    const altRoute = calculateRoute(fromStationId, toStationId, affectedLineIds);
    if (altRoute) {
      const timeDiff = altRoute.totalMinutes - originalRoute.totalMinutes;
      const confidence = Math.max(0, 100 - Math.abs(timeDiff) * 5 - altRoute.transferCount * 10);

      alternatives.push(
        createAlternativeRoute(originalRoute, altRoute, reason, affectedLineIds[0] || '', confidence)
      );
    }
  }

  // Sort by time difference and return top alternatives
  alternatives.sort((a, b) => a.timeDifference - b.timeDifference);
  return alternatives.slice(0, maxAlternatives);
};

/**
 * Compare routes by different criteria
 */
export const compareRoutes = (
  route1: Route,
  route2: Route
): {
  fasterRoute: 1 | 2 | 'equal';
  timeDifference: number;
  transferDifference: number;
  recommendation: string;
} => {
  const timeDiff = route1.totalMinutes - route2.totalMinutes;
  const transferDiff = route1.transferCount - route2.transferCount;

  let fasterRoute: 1 | 2 | 'equal';
  if (timeDiff < 0) fasterRoute = 1;
  else if (timeDiff > 0) fasterRoute = 2;
  else fasterRoute = 'equal';

  let recommendation: string;
  if (timeDiff < -5) {
    recommendation = '경로 1이 훨씬 빠릅니다';
  } else if (timeDiff > 5) {
    recommendation = '경로 2가 훨씬 빠릅니다';
  } else if (transferDiff < 0) {
    recommendation = '경로 1이 환승이 적습니다';
  } else if (transferDiff > 0) {
    recommendation = '경로 2가 환승이 적습니다';
  } else {
    recommendation = '두 경로가 비슷합니다';
  }

  return {
    fasterRoute,
    timeDifference: Math.abs(timeDiff),
    transferDifference: Math.abs(transferDiff),
    recommendation,
  };
};

// ============================================================================
// Singleton Export
// ============================================================================

export const routeService = {
  calculateRoute,
  calculateEnhancedRoute,
  calculateRouteWithDelays,
  findAlternativeRoutes,
  findMultipleAlternatives,
  compareRoutes,
  getRouteSummary,
  routeUsesLine,
  getStationInfo,
  getLineColor,
  getDiverseRoutes,
};

export default routeService;
