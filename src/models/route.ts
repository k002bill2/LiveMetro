/**
 * Route domain models and types
 * Handles alternative route calculation and comparison
 */

import LINE_SPEEDS_JSON from '@/data/lineSpeed.json';
import SEGMENT_SPEED_JSON from '@/data/segmentSpeed.json';

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
 * - Line `'2'` (circular): `'up' → '내선순환'`, `'down' → '외선순환'`
 * - Other known lines: `'up' → '상행'`, `'down' → '하행'`
 * - Unknown lines: same `'상행' | '하행'` fallback (safe default for the
 *   non-circular Korean subway network).
 *
 * Note: this is a line-level fallback — Line 2 branch stations (성수지선,
 * 신정지선) share lineId '2' but run 상행/하행 service. When a `Train` with
 * a raw API label is available, prefer `train.directionLabel` (sourced from
 * `updnLine` via {@link updnLineToDisplay}) over this function.
 *
 * @param direction Canonical direction token
 * @param lineId    Subway line id (e.g. `'1'`, `'2'`)
 */
export const directionToDisplay = (direction: Direction, lineId: string): string => {
  if (lineId === '2') {
    return direction === 'up' ? '내선순환' : '외선순환';
  }
  return direction === 'up' ? '상행' : '하행';
};

/**
 * Map a raw Seoul realtime-arrival `updnLine` value to a display label.
 *
 * - `'내선' → '내선순환'`, `'외선' → '외선순환'` (Line 2 circular service)
 * - Everything else (`'상행'`, `'하행'`, already-expanded or unknown values)
 *   passes through unchanged — the API value is the source of truth.
 */
export const updnLineToDisplay = (updnLine: string): string => {
  if (updnLine === '내선') return '내선순환';
  if (updnLine === '외선') return '외선순환';
  return updnLine;
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
 * fastest, fewest-transfer, via-station, and elevator-priority routes from
 * the K-shortest candidates.
 *
 * - 'fastest': 최단 시간 (Yen output 첫 번째)
 * - 'min-transfer': 환승 최소 (fastest보다 환승 적을 때만)
 * - 'via-station': 특정 환승역 경유 (viaTags에 라벨 텍스트)
 * - 'elevator-priority': 환승역에 엘리베이터가 있는 경로 (고령자·임산부 best-effort)
 */
export type RouteCategory = 'fastest' | 'min-transfer' | 'via-station' | 'elevator-priority';

/**
 * User-selectable sort criterion for the route result list (네이버 스타일
 * 세그먼트 탭). Orthogonal to {@link RouteCategory}: `category` explains why a
 * card was surfaced, `RouteSortTab` is how the user chose to order the cards.
 *
 * - 'optimal': 종합 (시간 + 환승 페널티 가중) — 기존 getDiverseRoutes 의미
 * - 'fastest': 최소 시간 (totalMinutes)
 * - 'min-transfer': 최소 환승 (transferCount, 동수 시 시간)
 * - 'min-fare': 최소 요금 (fare, 동수 시 시간)
 */
export type RouteSortTab = 'optimal' | 'fastest' | 'min-transfer' | 'min-fare';

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
  /**
   * Estimated regular-type fare in KRW, attached by the service layer
   * (`computeDiverseRoutes`) via {@link deriveFare}. Optional because raw
   * `createRoute` output and test fixtures may omit it — consumers fall back
   * to `deriveFare(route)`. Drives the 'min-fare' sort tab.
   */
  readonly fare?: number;
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
 * Per-edge segment override entry: a specific A↔B traversal whose actual
 * minutes differ from the line-level average.
 */
interface SegmentSpeedEntry {
  readonly from: string;
  readonly to: string;
  readonly minutes: number;
}

/**
 * Raw `segmentSpeed.json` shape. The `_schema_doc` key is the file's own
 * inline documentation and is filtered out at load time. All other keys are
 * trunk lineIds mapping to override arrays.
 */
type SegmentSpeedRaw = Record<string, SegmentSpeedEntry[] | string>;

const SEGMENT_SPEEDS_RAW = SEGMENT_SPEED_JSON as SegmentSpeedRaw;

/**
 * Normalized segment lookup table.
 *
 * Structure: `Map<lineId, Map<orderedEdgeKey, minutes>>`
 *
 * `orderedEdgeKey` = `${min(from, to)}->${max(from, to)}` so a single entry
 * covers both A→B and B→A traversals (most edges are bidirectional with
 * identical timing).
 *
 * Built once at module load; safe because the JSON is frozen at build time.
 */
const SEGMENT_SPEEDS: ReadonlyMap<string, ReadonlyMap<string, number>> = (() => {
  const out = new Map<string, Map<string, number>>();
  for (const [lineId, entries] of Object.entries(SEGMENT_SPEEDS_RAW)) {
    if (lineId.startsWith('_') || !Array.isArray(entries)) continue;
    const lineMap = new Map<string, number>();
    for (const entry of entries) {
      const a = entry.from < entry.to ? entry.from : entry.to;
      const b = entry.from < entry.to ? entry.to : entry.from;
      lineMap.set(`${a}->${b}`, entry.minutes);
    }
    if (lineMap.size > 0) out.set(lineId, lineMap);
  }
  return out;
})();

/**
 * Resolve traversal minutes for a specific edge (A↔B) on a given line, with
 * a three-level fallback chain:
 *
 *   1. Segment override (`segmentSpeed.json`) — A↔B specific minutes.
 *   2. Line-level default (`lineSpeed.json` via {@link getLineHopMinutes}).
 *   3. Global `AVG_STATION_TRAVEL_TIME`.
 *
 * Edge keys are direction-agnostic — a single `{from:'A',to:'B'}` entry
 * applies to both `A→B` and `B→A`. Most subway edges are bidirectional with
 * the same scheduled time.
 *
 * Why both fallbacks: `lineSpeed.json` cannot capture intra-line variation
 * (e.g. 2호선 도심 dwell time vs 외곽). Segments give that resolution where
 * it matters; the rest of the line still gets the line-level average.
 */
export function getEdgeMinutes(
  fromStationId: string,
  toStationId: string,
  lineId: string,
): number {
  const trunk = lineId.split('::')[0] ?? lineId;
  const lineMap = SEGMENT_SPEEDS.get(trunk);
  if (lineMap) {
    const a = fromStationId < toStationId ? fromStationId : toStationId;
    const b = fromStationId < toStationId ? toStationId : fromStationId;
    const minutes = lineMap.get(`${a}->${b}`);
    if (typeof minutes === 'number') return minutes;
  }
  return getLineHopMinutes(lineId);
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
 * Extra *ranking* cost (minutes) added to each transfer edge during graph
 * search so the algorithm avoids transfer-heavy paths the way Naver/Kakao do —
 * a rider perceives one transfer as far costlier than its literal walk time.
 *
 * CRITICAL: this is a *search cost only*. `convertToRoute` rebuilds each
 * segment's `estimatedMinutes` from `getEdgeMinutes`/`getTransferTime`, so a
 * route's displayed `totalMinutes` stays penalty-free (the honest travel
 * time). Do NOT derive `totalMinutes` from the path cost, or every time-based
 * assertion will shift by `transferCount * TRANSFER_PENALTY_MINUTES`.
 *
 * Kept small (4) and exported so K-shortest regressions (e.g. 강남구청 경유)
 * can be tuned without hunting through graph code.
 */
export const TRANSFER_PENALTY_MINUTES = 4;

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
