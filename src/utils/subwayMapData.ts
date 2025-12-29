/**
 * Seoul Subway Map Data - 2024 Design System
 * Based on official Seoul Metro Design Guide 2.0
 *
 * Design Features:
 * - 8선형 (Octolinear) grid system with 45° angles
 * - Color-blind friendly palette (명도/채도 최적화)
 * - Traffic light style transfer stations (신호등 방식 환승역)
 * - Award: Red Dot Design Award 2024
 *
 * Performance Improvements:
 * - Task finding time: -55%
 * - Transfer finding time: -69%
 * - Foreign user improvement: +21.5%
 *
 * Map dimensions: 4900 × 4400 (scaled from SVG viewbox)
 *
 * Data Source: JSON files in src/data/
 * - stations.json: Station coordinates and metadata
 * - lines.json: Line colors and station order
 */

// Import JSON data
import stationsData from '../data/stations.json';
import linesData from '../data/lines.json';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Station data with coordinates
 */
export interface StationData {
  id: string;
  name: string;
  nameEn?: string;
  x: number;
  y: number;
  lines: string[]; // Lines passing through this station
}

/**
 * Path segment for drawing lines
 */
export interface PathSegment {
  type: 'M' | 'L' | 'Q' | 'C'; // Move, Line, Quadratic, Cubic bezier
  points: number[];
}

/**
 * Line path data
 */
export interface LinePathData {
  lineId: string;
  color: string;
  segments: PathSegment[];
  stations: string[]; // Station IDs in order
}

// ============================================================================
// Data Exports (from JSON)
// ============================================================================

/**
 * All station data with coordinates
 * Source: src/data/stations.json
 */
export const STATIONS: Record<string, StationData> = stationsData as Record<string, StationData>;

/**
 * Line colors - 2024 Official Seoul Metro Design
 * Source: src/data/lines.json
 */
export const LINE_COLORS: Record<string, string> = linesData.colors;

/**
 * Station IDs for each line in order
 * Source: src/data/lines.json
 */
export const LINE_STATIONS: Record<string, string[]> = linesData.stations;

// ============================================================================
// Map Dimensions
// ============================================================================

export const MAP_WIDTH = 4900;
export const MAP_HEIGHT = 4400;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate path data for each line
 */
export const generateLinePathData = (): LinePathData[] => {
  const paths: LinePathData[] = [];

  Object.entries(LINE_STATIONS).forEach(([lineId, stationIds]) => {
    const lineColor = LINE_COLORS[lineId] || '#888888';
    const segments: PathSegment[] = [];

    stationIds.forEach((stationId, index) => {
      const station = STATIONS[stationId];
      if (station) {
        if (index === 0) {
          segments.push({ type: 'M', points: [station.x, station.y] });
        } else {
          segments.push({ type: 'L', points: [station.x, station.y] });
        }
      }
    });

    // Close loop for Line 2 (circular line)
    if (lineId === '2' && stationIds.length > 1) {
      const firstStation = STATIONS[stationIds[0]!];
      if (firstStation) {
        segments.push({ type: 'L', points: [firstStation.x, firstStation.y] });
      }
    }

    paths.push({
      lineId,
      color: lineColor,
      segments,
      stations: stationIds,
    });
  });

  return paths;
};

/**
 * Get station by Korean or English name
 */
export const getStationByName = (name: string): StationData | undefined => {
  return Object.values(STATIONS).find(s => s.name === name || s.nameEn === name);
};

/**
 * Check if a station is a transfer station
 */
export const isTransferStation = (stationId: string): boolean => {
  const station = STATIONS[stationId];
  return station ? station.lines.length > 1 : false;
};

/**
 * Get all transfer stations
 */
export const getTransferStations = (): StationData[] => {
  return Object.values(STATIONS).filter(s => s.lines.length > 1);
};

/**
 * Get station by ID
 */
export const getStationById = (stationId: string): StationData | undefined => {
  return STATIONS[stationId];
};

/**
 * Get line color by line ID
 */
export const getLineColor = (lineId: string): string => {
  return LINE_COLORS[lineId] || '#888888';
};

/**
 * Get all stations for a specific line
 */
export const getStationsForLine = (lineId: string): StationData[] => {
  const stationIds = LINE_STATIONS[lineId];
  if (!stationIds) return [];
  
  return stationIds
    .map(id => STATIONS[id])
    .filter((s): s is StationData => s !== undefined);
};
