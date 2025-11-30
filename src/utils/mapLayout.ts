/**
 * Seoul Subway Map Layout Generator
 * Generates map data from the new subway map data structure
 */

import {
  STATIONS,
  LINE_COLORS,
  LINE_STATIONS,
  MAP_WIDTH,
  MAP_HEIGHT,
  StationData,
} from './subwayMapData';

export interface MapNode {
  id: string;
  x: number;
  y: number;
  name: string;
  nameEn?: string;
  lineId: string;
  color: string;
  isTransfer: boolean;
  stationId: string;
  lines: string[]; // All lines passing through this station
}

export interface MapEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  lineId: string;
  // Bezier curve control points (optional)
  cx1?: number;
  cy1?: number;
  cx2?: number;
  cy2?: number;
  isCurve?: boolean;
}

export interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  width: number;
  height: number;
}

// Simplified interface for map generation (kept for compatibility)
export interface SimpleSubwayLine {
  id: string;
  color: string;
  stations: string[];
}

/**
 * Generate map layout from the predefined station data
 */
export const generateMapLayout = (lines?: SimpleSubwayLine[]): MapData => {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const addedStations = new Set<string>();

  // If custom lines provided, use them; otherwise use predefined data
  const lineData = lines || Object.entries(LINE_STATIONS).map(([id, stations]) => ({
    id,
    color: LINE_COLORS[id] || '#888888',
    stations,
  }));

  lineData.forEach(line => {
    const lineNodes: MapNode[] = [];

    line.stations.forEach((stationId) => {
      // Try to find station by ID first, then by name
      let stationData: StationData | undefined = STATIONS[stationId];

      if (!stationData) {
        // Try to find by name match
        stationData = Object.values(STATIONS).find(
          s => s.name === stationId || s.id === stationId
        );
      }

      if (stationData) {
        const isTransfer = stationData.lines.length > 1;

        // Only add node once (for transfer stations)
        if (!addedStations.has(stationData.id)) {
          const node: MapNode = {
            id: stationData.id,
            stationId: stationData.id,
            x: stationData.x,
            y: stationData.y,
            name: stationData.name,
            nameEn: stationData.nameEn,
            lineId: line.id,
            color: line.color,
            isTransfer,
            lines: stationData.lines,
          };
          nodes.push(node);
          addedStations.add(stationData.id);
        }

        // Track for edge creation
        lineNodes.push({
          id: `${line.id}-${stationData.id}`,
          stationId: stationData.id,
          x: stationData.x,
          y: stationData.y,
          name: stationData.name,
          lineId: line.id,
          color: line.color,
          isTransfer,
          lines: stationData.lines,
        });
      }
    });

    // Create edges between consecutive stations
    for (let i = 0; i < lineNodes.length - 1; i++) {
      const curr = lineNodes[i];
      const next = lineNodes[i + 1];

      if (curr && next) {
        edges.push({
          id: `edge-${line.id}-${i}`,
          x1: curr.x,
          y1: curr.y,
          x2: next.x,
          y2: next.y,
          color: line.color,
          lineId: line.id,
        });
      }
    }

    // Close loop for Line 2
    if (line.id === '2' && lineNodes.length > 1) {
      const first = lineNodes[0];
      const last = lineNodes[lineNodes.length - 1];

      if (first && last) {
        edges.push({
          id: `edge-2-loop`,
          x1: last.x,
          y1: last.y,
          x2: first.x,
          y2: first.y,
          color: line.color,
          lineId: '2',
        });
      }
    }
  });

  return {
    nodes,
    edges,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  };
};

/**
 * Get station node by name
 */
export const getNodeByName = (mapData: MapData, name: string): MapNode | undefined => {
  return mapData.nodes.find(n => n.name === name || n.nameEn === name);
};

/**
 * Get all transfer station nodes
 */
export const getTransferNodes = (mapData: MapData): MapNode[] => {
  return mapData.nodes.filter(n => n.isTransfer);
};

/**
 * Get edges for a specific line
 */
export const getLineEdges = (mapData: MapData, lineId: string): MapEdge[] => {
  return mapData.edges.filter(e => e.lineId === lineId);
};

/**
 * Calculate SVG path string from edges
 */
export const edgesToPath = (edges: MapEdge[]): string => {
  if (edges.length === 0) return '';

  let path = '';
  edges.forEach((edge, index) => {
    if (index === 0) {
      path += `M ${edge.x1} ${edge.y1} `;
    }

    if (edge.isCurve && edge.cx1 !== undefined && edge.cy1 !== undefined) {
      if (edge.cx2 !== undefined && edge.cy2 !== undefined) {
        // Cubic bezier
        path += `C ${edge.cx1} ${edge.cy1} ${edge.cx2} ${edge.cy2} ${edge.x2} ${edge.y2} `;
      } else {
        // Quadratic bezier
        path += `Q ${edge.cx1} ${edge.cy1} ${edge.x2} ${edge.y2} `;
      }
    } else {
      // Straight line
      path += `L ${edge.x2} ${edge.y2} `;
    }
  });

  return path.trim();
};

/**
 * Group edges by line and create path data
 */
export const createLinePaths = (mapData: MapData): Record<string, { path: string; color: string }> => {
  const linePaths: Record<string, { path: string; color: string }> = {};

  // Get unique line IDs
  const lineIds = [...new Set(mapData.edges.map(e => e.lineId))];

  lineIds.forEach(lineId => {
    const edges = getLineEdges(mapData, lineId);
    const color = LINE_COLORS[lineId] || '#888888';

    // Sort edges to form continuous path
    const sortedEdges = edges.sort((a, b) => {
      const aIndex = parseInt(a.id.split('-').pop() || '0');
      const bIndex = parseInt(b.id.split('-').pop() || '0');
      return aIndex - bIndex;
    });

    linePaths[lineId] = {
      path: edgesToPath(sortedEdges),
      color,
    };
  });

  return linePaths;
};

// Re-export constants for convenience
export { LINE_COLORS, MAP_WIDTH, MAP_HEIGHT };
