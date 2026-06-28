/**
 * subwayMapViewData — static adapter that reshapes the canonical subway map
 * data (`subwayMapData`) into the props `SubwayMapView` consumes.
 *
 * `SubwayMapView` is otherwise unused (dead) — it expects `stations`
 * ({id,name,x,y,lineIds,isTransfer}) and `lines` (per-hop colored segments).
 * Both are static given the bundled data, so we compute them once at module
 * load.
 */
import { STATIONS, LINE_COLORS, LINE_STATIONS } from '@/utils/subwayMapData';
import {
  createSubwayLineSvgAnchorMap,
  type SvgPoint,
} from '@components/map/subwayLineSvgAnchors';

export interface SubwayMapStation {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly lineIds: string[];
  readonly isTransfer: boolean;
}

export interface SubwayMapLineSegment {
  readonly lineId: string;
  readonly fromStation: string;
  readonly toStation: string;
  readonly color: string;
}

export const SUBWAY_MAP_STATIONS: readonly SubwayMapStation[] = Object.values(STATIONS).map(
  (s) => ({
    id: s.id,
    name: s.name,
    x: s.x,
    y: s.y,
    lineIds: s.lines,
    isTransfer: s.lines.length > 1,
  }),
);

export const SUBWAY_MAP_STATION_ANCHORS_BY_ID: Readonly<Record<string, SvgPoint>> =
  createSubwayLineSvgAnchorMap(SUBWAY_MAP_STATIONS);

export const SUBWAY_MAP_LINES: readonly SubwayMapLineSegment[] = (() => {
  const segments: SubwayMapLineSegment[] = [];
  for (const [lineId, branches] of Object.entries(LINE_STATIONS)) {
    const color = LINE_COLORS[lineId] ?? '#888888';
    for (const branch of branches) {
      for (let i = 0; i < branch.length - 1; i++) {
        const from = branch[i];
        const to = branch[i + 1];
        if (from && to) {
          segments.push({ lineId, fromStation: from, toStation: to, color });
        }
      }
    }
  }
  return segments;
})();
