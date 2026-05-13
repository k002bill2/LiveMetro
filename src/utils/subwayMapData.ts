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
 * Normalize raw lines.json[lineId] into nested-array form.
 *
 * Backwards-compat: legacy single-trunk lines stored as `string[]` are
 * wrapped to `[[...]]`. Branched lines stored as `string[][]` pass through.
 *
 * Convention: a station id appearing in multiple subarrays is an
 * implicit branch point — graph builder dedupes via node key
 * `${stationId}#${lineId}` and adds bidirectional edges to neighbors
 * in each subarray.
 */
const normalizeLine = (raw: unknown): readonly string[][] => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'string') return [raw as string[]];
  return raw as string[][];
};

/**
 * Station IDs for each line, normalized to nested-array form.
 * Source: src/data/lines.json (post-normalize)
 *
 * Type: `Record<lineId, readonly string[][]>` — outer key is line, value
 * is one or more monotone subarrays. Single-trunk lines have one
 * subarray; branched lines have multiple.
 */
export const LINE_STATIONS: Record<string, readonly string[][]> =
  Object.fromEntries(
    Object.entries(linesData.stations).map(
      ([lineId, raw]) => [lineId, normalizeLine(raw)]
    )
  );

/**
 * Set of station ids that appear in any line's order. Used to filter
 * search results so the user never picks a non-routable station.
 */
export const ROUTABLE_STATION_IDS: ReadonlySet<string> = new Set(
  Object.values(LINE_STATIONS).flat(2)
);

export const isRoutableStation = (stationId: string): boolean =>
  ROUTABLE_STATION_IDS.has(stationId);

/**
 * Helper: flat station id set for a single line.
 * Use for membership checks; do NOT use for adjacency (subarray order matters).
 */
export const lineStationSet = (lineId: string): ReadonlySet<string> =>
  new Set(LINE_STATIONS[lineId]?.flat() ?? []);

/**
 * Search stations in the routing graph by Korean or English name.
 *
 * Returns StationData whose `id` is the slug used by routeService /
 * kShortestPath (e.g. "seolleung", "gangnam_gu_office"). Filters out
 * stations not wired into any line's order in lines.json — those would
 * always produce "no route found" if selected.
 */
export const searchGraphStations = (query: string, limit: number = 20): StationData[] => {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: StationData[] = [];
  for (const station of Object.values(STATIONS)) {
    if (!ROUTABLE_STATION_IDS.has(station.id)) continue;
    const nameMatch = station.name.toLowerCase().includes(q);
    const nameEnMatch = station.nameEn?.toLowerCase().includes(q) ?? false;
    if (nameMatch || nameEnMatch) {
      results.push(station);
      if (results.length >= limit) break;
    }
  }
  return results;
};

// ============================================================================
// Map Dimensions
// ============================================================================

export const MAP_WIDTH = 4900;
export const MAP_HEIGHT = 4400;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate path data for each line.
 * Branched lines produce multiple `M ... L ... L` runs (one per subarray).
 */
export const generateLinePathData = (): LinePathData[] => {
  const paths: LinePathData[] = [];

  Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
    const lineColor = LINE_COLORS[lineId] || '#888888';
    const allSegments: PathSegment[] = [];

    segments.forEach(stationIds => {
      stationIds.forEach((stationId, index) => {
        const station = STATIONS[stationId];
        if (!station) return;
        // Each subarray starts with M, continues with L. This produces
        // multiple disconnected polylines for branched lines, which is
        // the visually correct rendering.
        allSegments.push({
          type: index === 0 ? 'M' : 'L',
          points: [station.x, station.y],
        });
      });
    });

    // Close loop for Line 2 trunk subarray (segments[0]) only.
    // Branch subarrays (성수지선, 신정지선) are not circular.
    if (lineId === '2' && segments[0] && segments[0].length > 1) {
      const trunk = segments[0];
      const firstStation = STATIONS[trunk[0]!];
      if (firstStation) {
        allSegments.push({ type: 'L', points: [firstStation.x, firstStation.y] });
      }
    }

    paths.push({
      lineId,
      color: lineColor,
      segments: allSegments,
      stations: segments.flat(),
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
 * Get all stations for a specific line (flat, dedupe across subarrays).
 *
 * Branch points appear once even if in multiple subarrays.
 */
export const getStationsForLine = (lineId: string): StationData[] => {
  const segments = LINE_STATIONS[lineId];
  if (!segments) return [];

  const seen = new Set<string>();
  const result: StationData[] = [];
  segments.forEach(stationIds => {
    stationIds.forEach(id => {
      if (seen.has(id)) return;
      seen.add(id);
      const s = STATIONS[id];
      if (s) result.push(s);
    });
  });
  return result;
};
