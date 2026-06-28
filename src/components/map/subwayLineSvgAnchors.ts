/**
 * Subway-line SVG anchors.
 *
 * The rendered route image uses docs/subway_line.svg (1525 x 1000), while
 * stations.json still stores the older schematic coordinate space (4900 x
 * 4400). Keep SVG coordinates centralized here so current-location markers and
 * map recentering use one anchor source.
 */
import { SUBWAY_LINE_SVG_ANCHORS_BY_ID as GENERATED_SUBWAY_LINE_SVG_ANCHORS_BY_ID } from '@components/map/subwayLineSvgAnchorTable';

export interface SvgPoint {
  readonly x: number;
  readonly y: number;
}

export interface SubwayLineSvgAnchorStation {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export const FALLBACK_MAP_WIDTH = 1200;
export const FALLBACK_MAP_HEIGHT = 900;
export const SVG_MAP_WIDTH = 1525;
export const SVG_MAP_HEIGHT = 1000;
export const SOURCE_MAP_WIDTH = 4900;
export const SOURCE_MAP_HEIGHT = 4400;

export const SUBWAY_LINE_SVG_ANCHORS_BY_ID: Readonly<Record<string, SvgPoint>> =
  GENERATED_SUBWAY_LINE_SVG_ANCHORS_BY_ID;

export const projectSchematicPointToSvg = (
  station: SubwayLineSvgAnchorStation,
): SvgPoint => ({
  x: (station.x / SOURCE_MAP_WIDTH) * SVG_MAP_WIDTH,
  y: (station.y / SOURCE_MAP_HEIGHT) * SVG_MAP_HEIGHT,
});

export const resolveSubwayLineSvgAnchor = (
  station: SubwayLineSvgAnchorStation,
  anchorsById: Readonly<Record<string, SvgPoint>> = SUBWAY_LINE_SVG_ANCHORS_BY_ID,
): SvgPoint => anchorsById[station.id] ?? projectSchematicPointToSvg(station);

export const createSubwayLineSvgAnchorMap = (
  stations: readonly SubwayLineSvgAnchorStation[],
): Readonly<Record<string, SvgPoint>> =>
  stations.reduce<Record<string, SvgPoint>>((anchors, station) => {
    anchors[station.id] = resolveSubwayLineSvgAnchor(station);
    return anchors;
  }, {});
