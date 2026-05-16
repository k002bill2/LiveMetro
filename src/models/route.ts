/**
 * Route domain models and types
 * Handles alternative route calculation and comparison
 */

import LINE_SPEEDS_JSON from '@/data/lineSpeed.json';

/**
 * Canonical travel direction used for storage, queries, and ML pipelines.
 *
 * Convention (mirrors `src/services/api/seoulSubwayApi.ts:641`):
 *   - 'up'   = 상행 (or 내선 on Line 2 circular)
 *   - 'down' = 하행 (or 외선 on Line 2 circular)
 *
 * UI surfaces should localize via {@link directionToDisplay} rather than
 * reading the canonical token directly.
 */
export type Direction = 'up' | 'down';

/**
 * Map a canonical {@link Direction} to a localized display label, given the
 * line context.
 *
 * - Line `'2'` (circular): `'up' → '내선'`, `'down' → '외선'`
 * - Other known lines: `'up' → '상행'`, `'down' → '하행'`
 * - Unknown lines: same `'상행' | '하행'` fallback (safe default for the
 *   non-circular Korean subway network).
 *
 * @param direction Canonical direction token
 * @param lineId    Subway line id (e.g. `'1'`, `'2'`)
 */
export const directionToDisplay = (direction: Direction, lineId: string): string => {
  if (lineId === '2') {
    return direction === 'up' ? '내선' : '외선';
  }
  return direction === 'up' ? '상행' : '하행';
};

/**
 * Reason for suggesting an alternative route
 */
export type AlternativeReason = 'DELAY' | 'SUSPENSION' | 'CONGESTION';

/**
 * A segment of a route between two stations
 */
export interface RouteSegment {
  readonly fromStationId: string;
  readonly fromStationName: string;
  readonly toStationId: string;
  readonly toStationName: string;
  readonly lineId: string;
  readonly lineName: string;
  readonly estimatedMinutes: number;
  readonly isTransfer: boolean;
}

/**
 * Why a route was suggested. Set by `getDiverseRoutes` when picking the
 * fastest, fewest-transfer, and via-station differentiated routes from
 * the K-shortest candidates.
 *
 * - 'fastest': 최단 시간 (Yen output 첫 번째)
 * - 'min-transfer': 환승 최소 (fastest보다 환승 적을 때만)
 * - 'via-station': 특정 환승역 경유 (viaTags에 라벨 텍스트)
 */
export type RouteCategory = 'fastest' | 'min-transfer' | 'via-station';

/**
 * Complete route from origin to destination
 */
export interface Route {
  readonly segments: readonly RouteSegment[];
  readonly totalMinutes: number;
  readonly transferCount: number;
  readonly lineIds: readonly string[];
  readonly category?: RouteCategory;
  /**
   * Dynamic display tags for `category: 'via-station'` cards. Caller
   * (RouteCard) prefers `viaTags` over the static CATEGORY_TAGS mapping
   * when category === 'via-station'. Example: ['강남구청 경유'].
   */
  readonly viaTags?: readonly string[];
}

/**
 * Alternative route with comparison to original
 */
export interface AlternativeRoute {
  readonly id: string;
  readonly originalRoute: Route;
  readonly alternativeRoute: Route;
  readonly timeDifference: number; // positive = slower, negative = faster
  readonly reason: AlternativeReason;
  readonly confidence: number; // 0-100
  readonly affectedLineId: string;
  readonly createdAt: Date;
}

/**
 * Graph node for pathfinding
 */
export interface GraphNode {
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly connections: readonly GraphEdge[];
}

/**
 * Graph edge representing connection between stations
 */
export interface GraphEdge {
  readonly toStationId: string;
  readonly toLineId: string;
  readonly weight: number; // minutes
  readonly isTransfer: boolean;
}

/**
 * Result from route calculation
 */
export interface RouteCalculationResult {
  readonly success: boolean;
  readonly route: Route | null;
  readonly error?: string;
}

/**
 * Options for finding alternative routes
 */
export interface AlternativeRouteOptions {
  readonly excludeLineIds?: readonly string[];
  readonly maxTransfers?: number;
  readonly maxTimeDifference?: number; // minutes
  readonly preferFewerTransfers?: boolean;
}

/**
 * Default options for alternative route calculation
 */
export const DEFAULT_ALTERNATIVE_OPTIONS: AlternativeRouteOptions = {
  excludeLineIds: [],
  maxTransfers: 4,
  maxTimeDifference: 30,
  preferFewerTransfers: true,
};

/**
 * Default average travel time between adjacent stations (minutes).
 * Fallback when a lineId is missing from `data/lineSpeed.json`.
 */
export const AVG_STATION_TRAVEL_TIME = 2.5;

/**
 * Per-line average minutes per hop, derived from published 표정속도.
 * Used by `kShortestPath.buildGraph` and `routeService` A* heuristic.
 * Edit `src/data/lineSpeed.json` to tune.
 */
export const LINE_SPEEDS: Readonly<Record<string, number>> =
  LINE_SPEEDS_JSON as Record<string, number>;

/**
 * Return minutes per hop for a given lineId, with `AVG_STATION_TRAVEL_TIME`
 * fallback. Accepts trunk lineIds (e.g. '7') or sub-line ids with `::N` suffix.
 */
export function getLineHopMinutes(lineId: string): number {
  const trunk = lineId.split('::')[0] ?? lineId;
  return LINE_SPEEDS[trunk] ?? AVG_STATION_TRAVEL_TIME;
}

/**
 * Fastest known line speed (minutes per hop) — used as A* heuristic floor.
 * Computed once at module load; safe because LINE_SPEEDS is frozen at build.
 */
export const FASTEST_LINE_HOP_MINUTES: number = Object.values(LINE_SPEEDS).reduce(
  (min, v) => (v < min ? v : min),
  AVG_STATION_TRAVEL_TIME,
);

/**
 * Average transfer time between lines (minutes)
 */
export const AVG_TRANSFER_TIME = 4;

/**
 * Line name mapping
 */
export const LINE_NAMES: Record<string, string> = {
  '1': '1호선',
  '2': '2호선',
  '3': '3호선',
  '4': '4호선',
  '5': '5호선',
  '6': '6호선',
  '7': '7호선',
  '8': '8호선',
  '9': '9호선',
};

/**
 * Get line name by ID
 */
export const getLineName = (lineId: string): string => {
  return LINE_NAMES[lineId] || `${lineId}호선`;
};

/**
 * Calculate total time from route segments
 */
export const calculateRouteTotalTime = (segments: readonly RouteSegment[]): number => {
  return segments.reduce((total, segment) => total + segment.estimatedMinutes, 0);
};

/**
 * Count transfers in route
 */
export const countTransfers = (segments: readonly RouteSegment[]): number => {
  return segments.filter(segment => segment.isTransfer).length;
};

/**
 * Get unique line IDs from route
 */
export const getRouteLineIds = (segments: readonly RouteSegment[]): string[] => {
  const lineIds = new Set<string>();
  segments.forEach(segment => lineIds.add(segment.lineId));
  return Array.from(lineIds);
};

/**
 * Create Route from segments
 */
export const createRoute = (segments: readonly RouteSegment[]): Route => ({
  segments,
  totalMinutes: calculateRouteTotalTime(segments),
  transferCount: countTransfers(segments),
  lineIds: getRouteLineIds(segments),
});

/**
 * Create AlternativeRoute
 */
export const createAlternativeRoute = (
  originalRoute: Route,
  alternativeRoute: Route,
  reason: AlternativeReason,
  affectedLineId: string,
  confidence: number = 80
): AlternativeRoute => ({
  id: `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  originalRoute,
  alternativeRoute,
  timeDifference: alternativeRoute.totalMinutes - originalRoute.totalMinutes,
  reason,
  confidence,
  affectedLineId,
  createdAt: new Date(),
});

/**
 * Format time difference for display
 */
export const formatTimeDifference = (minutes: number): string => {
  if (minutes === 0) return '동일';
  if (minutes > 0) return `+${minutes}분`;
  return `${minutes}분`;
};

/**
 * Get severity text based on time difference
 */
export const getTimeDifferenceSeverity = (
  minutes: number
): 'faster' | 'same' | 'slower' | 'much_slower' => {
  if (minutes < -2) return 'faster';
  if (minutes <= 2) return 'same';
  if (minutes <= 10) return 'slower';
  return 'much_slower';
};
