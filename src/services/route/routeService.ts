/**
 * Route Service
 * Calculates optimal and alternative routes using Dijkstra's algorithm
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
  AVG_STATION_TRAVEL_TIME,
  AVG_TRANSFER_TIME,
  createRoute,
  createAlternativeRoute,
  getLineName,
} from '@models/route';

// ============================================================================
// Types
// ============================================================================

interface GraphNode {
  stationId: string;
  lineId: string;
  key: string; // `${stationId}_${lineId}` for unique identification
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

interface DijkstraResult {
  distance: number;
  previous: Map<string, string>;
  path: string[];
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build graph from station and line data
 */
const buildGraph = (excludeLineIds: readonly string[] = []): Graph => {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();

  // Create nodes for each station-line combination
  Object.entries(LINE_STATIONS).forEach(([lineId, stationIds]) => {
    if (excludeLineIds.includes(lineId)) return;

    stationIds.forEach((stationId, index) => {
      const key = `${stationId}_${lineId}`;
      const node: GraphNode = { stationId, lineId, key };
      nodes.set(key, node);

      // Initialize edges array
      if (!edges.has(key)) {
        edges.set(key, []);
      }

      // Add edge to next station on same line
      if (index < stationIds.length - 1) {
        const nextStationId = stationIds[index + 1];
        if (nextStationId) {
          const nextKey = `${nextStationId}_${lineId}`;
          const edgeList = edges.get(key) || [];
          edgeList.push({
            to: { stationId: nextStationId, lineId, key: nextKey },
            weight: AVG_STATION_TRAVEL_TIME,
            isTransfer: false,
          });
          edges.set(key, edgeList);
        }
      }

      // Add edge to previous station on same line (bidirectional)
      if (index > 0) {
        const prevStationId = stationIds[index - 1];
        if (prevStationId) {
          const prevKey = `${prevStationId}_${lineId}`;
          const edgeList = edges.get(key) || [];
          edgeList.push({
            to: { stationId: prevStationId, lineId, key: prevKey },
            weight: AVG_STATION_TRAVEL_TIME,
            isTransfer: false,
          });
          edges.set(key, edgeList);
        }
      }
    });
  });

  // Handle circular line 2 (connect last to first)
  const line2Stations = LINE_STATIONS['2'];
  if (line2Stations && line2Stations.length > 1 && !excludeLineIds.includes('2')) {
    const firstStation = line2Stations[0];
    const lastStation = line2Stations[line2Stations.length - 1];
    if (firstStation && lastStation) {
      const firstKey = `${firstStation}_2`;
      const lastKey = `${lastStation}_2`;

      // Last to first
      const lastEdges = edges.get(lastKey) || [];
      lastEdges.push({
        to: { stationId: firstStation, lineId: '2', key: firstKey },
        weight: AVG_STATION_TRAVEL_TIME,
        isTransfer: false,
      });
      edges.set(lastKey, lastEdges);

      // First to last
      const firstEdges = edges.get(firstKey) || [];
      firstEdges.push({
        to: { stationId: lastStation, lineId: '2', key: lastKey },
        weight: AVG_STATION_TRAVEL_TIME,
        isTransfer: false,
      });
      edges.set(firstKey, firstEdges);
    }
  }

  // Add transfer edges between same station on different lines
  Object.values(STATIONS).forEach((station: StationData) => {
    const stationLines = station.lines.filter(
      lineId => !excludeLineIds.includes(lineId) && LINE_STATIONS[lineId]
    );

    // For each pair of lines at this station, add transfer edges
    for (let i = 0; i < stationLines.length; i++) {
      for (let j = i + 1; j < stationLines.length; j++) {
        const line1 = stationLines[i];
        const line2 = stationLines[j];
        if (!line1 || !line2) continue;

        const key1 = `${station.id}_${line1}`;
        const key2 = `${station.id}_${line2}`;

        // Only add if both nodes exist
        if (nodes.has(key1) && nodes.has(key2)) {
          // Line1 to Line2
          const edges1 = edges.get(key1) || [];
          edges1.push({
            to: { stationId: station.id, lineId: line2, key: key2 },
            weight: AVG_TRANSFER_TIME,
            isTransfer: true,
          });
          edges.set(key1, edges1);

          // Line2 to Line1
          const edges2 = edges.get(key2) || [];
          edges2.push({
            to: { stationId: station.id, lineId: line1, key: key1 },
            weight: AVG_TRANSFER_TIME,
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
// Dijkstra's Algorithm
// ============================================================================

/**
 * Find shortest path using Dijkstra's algorithm
 */
const dijkstra = (
  graph: Graph,
  startKeys: string[],
  endKeys: string[]
): DijkstraResult | null => {
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const visited = new Set<string>();

  // Priority queue (simple array-based for clarity)
  const queue: { key: string; distance: number }[] = [];

  // Initialize distances
  graph.nodes.forEach((_, key) => {
    distances.set(key, Infinity);
  });

  // Set start nodes distance to 0
  startKeys.forEach(key => {
    if (graph.nodes.has(key)) {
      distances.set(key, 0);
      queue.push({ key, distance: 0 });
    }
  });

  // Process queue
  while (queue.length > 0) {
    // Sort by distance and get minimum
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (!current) break;

    const { key: currentKey, distance: currentDistance } = current;

    // Skip if already visited
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    // Check if we reached any end node
    if (endKeys.includes(currentKey)) {
      // Reconstruct path
      const path: string[] = [];
      let curr: string | undefined = currentKey;
      while (curr) {
        path.unshift(curr);
        curr = previous.get(curr);
      }

      return {
        distance: currentDistance,
        previous,
        path,
      };
    }

    // Process neighbors
    const neighbors = graph.edges.get(currentKey) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.to.key)) continue;

      const newDistance = currentDistance + edge.weight;
      const existingDistance = distances.get(edge.to.key) ?? Infinity;

      if (newDistance < existingDistance) {
        distances.set(edge.to.key, newDistance);
        previous.set(edge.to.key, currentKey);
        queue.push({ key: edge.to.key, distance: newDistance });
      }
    }
  }

  return null; // No path found
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

    const [currentStationId, currentLineId] = currentKey.split('_');
    const [nextStationId, nextLineId] = nextKey.split('_');
    if (!currentStationId || !currentLineId || !nextStationId || !nextLineId) continue;

    const currentStation = STATIONS[currentStationId];
    const nextStation = STATIONS[nextStationId];
    if (!currentStation || !nextStation) continue;

    const isTransfer =
      currentStationId === nextStationId && currentLineId !== nextLineId;

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
    .filter(lineId => !excludeLineIds.includes(lineId) && LINE_STATIONS[lineId])
    .map(lineId => `${stationId}_${lineId}`);
};

/**
 * Calculate route between two stations
 */
export const calculateRoute = (
  fromStationId: string,
  toStationId: string,
  excludeLineIds: readonly string[] = []
): Route | null => {
  // Build graph
  const graph = buildGraph(excludeLineIds);

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

  return createRoute(segments);
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
// Singleton Export
// ============================================================================

export const routeService = {
  calculateRoute,
  findAlternativeRoutes,
  getRouteSummary,
  routeUsesLine,
  getStationInfo,
  getLineColor,
};

export default routeService;
