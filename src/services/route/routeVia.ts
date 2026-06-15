/**
 * routeVia — compute the fastest commute route CONSTRAINED to pass through a
 * user-chosen transfer station V (Approach A: sub-route concatenation).
 *
 * `getDiverseRoutes` optimizes from→to globally and has no via-constraint, so
 * a forced transfer (e.g. 신길→선릉 via 신도림 instead of the globally fastest
 * 노량진/선정릉) is produced by stitching the two optimal legs:
 *
 *     getDiverseRoutes(from, V)[0]  +  [transfer @ V]  +  getDiverseRoutes(V, to)[0]
 *
 * and re-deriving totals via `createRoute` so totalMinutes / transferCount /
 * lineIds stay consistent. The V transfer marker is inserted ONLY when the line
 * boarded into V differs from the line departing V — otherwise it is a
 * continuous ride and a marker would inflate transferCount (phantom transfer).
 *
 * Returns null (project error policy — callers degrade gracefully) when:
 *   - any id missing, or V collides with an endpoint (no meaningful via)
 *   - either leg has no path
 */
import { getDiverseRoutes } from './kShortestPath';
import {
  createRoute,
  getLineName,
  AVG_TRANSFER_TIME,
  type Route,
  type RouteSegment,
} from '@models/route';

export function routeVia(
  fromSlug: string,
  viaSlug: string,
  toSlug: string,
): Route | null {
  if (!fromSlug || !viaSlug || !toSlug) return null;
  // A via that collides with an endpoint is not a meaningful transfer.
  if (viaSlug === fromSlug || viaSlug === toSlug || fromSlug === toSlug) {
    return null;
  }

  const legA = getDiverseRoutes(fromSlug, viaSlug)[0] ?? null;
  const legB = getDiverseRoutes(viaSlug, toSlug)[0] ?? null;
  if (!legA || !legB) return null;
  if (legA.segments.length === 0 || legB.segments.length === 0) return null;

  // Line boarded INTO V (legA's last ride) vs line departing V (legB's first
  // ride). A transfer marker is inserted only when these differ — otherwise the
  // legs form one continuous ride and a marker would be a phantom transfer.
  const lineIntoV = [...legA.segments]
    .reverse()
    .find((s) => !s.isTransfer)?.lineId;
  const lineOutOfV = legB.segments.find((s) => !s.isTransfer)?.lineId;
  const viaName = legA.segments[legA.segments.length - 1]!.toStationName;

  const transferSeg: RouteSegment[] =
    lineIntoV && lineOutOfV && lineIntoV !== lineOutOfV
      ? [
          {
            fromStationId: viaSlug,
            fromStationName: viaName,
            toStationId: viaSlug,
            toStationName: viaName,
            lineId: lineOutOfV,
            lineName: getLineName(lineOutOfV),
            estimatedMinutes: AVG_TRANSFER_TIME,
            isTransfer: true,
          },
        ]
      : [];

  return createRoute([...legA.segments, ...transferSeg, ...legB.segments]);
}

export type { Route, RouteSegment };
