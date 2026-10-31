/**
 * selectCommuteRoute — single source of truth for turning a commute OD pair
 * (+ optional via transfer) into a {@link Route}.
 *
 * Previously this exact id-normalization + route-selection block was duplicated
 * in `useCommuteRouteSummary` and `useCommuteRouteSteps` (both comments claimed
 * "single SSOT" while the code diverged). Extracting it here gives the home
 * "길안내 시작" CTA the full Route it needs and removes the drift risk.
 *
 * Selection policy (identical to the two hooks it replaces):
 *   - via transfer chosen → `routeVia` constrains the path through it
 *   - otherwise → `getFastestRoute` — the same Route as `getDiverseRoutes[0]`
 *     (Yen's K-shortest fastest path), proven equal or computed by falling
 *     back to it, without the full Yen search on the hot path
 *   - `routePreference === 'direct'` (no via) → the first transfer-free route
 *     of `getDiverseRoutes` — the exact definition the route editor uses for
 *     its "직행 (환승 없음)" minutes — falling back to the fastest route when
 *     the OD has no direct ride
 *
 * Returns `null` (no throw — project error policy) when:
 *   - either station id is missing, or both are equal
 *   - the resolver cannot map an id to an internal slug
 *   - resolved slugs collapse to the same station
 *   - graph search returns no path
 *   - any thrown error during calculation
 */
import { getDiverseRoutes, getFastestRoute } from '@services/route/kShortestPath';
import { routeVia } from '@services/route/routeVia';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import type { Route } from '@/models/route';
import type { CommuteRoutePreference } from '@/models/commute';

export function selectCommuteRoute(
  fromStationId?: string,
  toStationId?: string,
  viaTransferId?: string,
  routePreference?: CommuteRoutePreference,
): Route | null {
  if (!fromStationId || !toStationId || fromStationId === toStationId) return null;

  // Storage layer (onboarding / Firestore) may persist Seoul Metro station_cd
  // codes ("0220") while the graph keys on internal slugs ("seolleung").
  // Normalize at the boundary so the graph stays slug-only.
  const fromSlug = resolveInternalStationId(fromStationId);
  const toSlug = resolveInternalStationId(toStationId);
  if (!fromSlug || !toSlug || fromSlug === toSlug) return null;

  try {
    const viaSlug = viaTransferId ? resolveInternalStationId(viaTransferId) : null;
    if (viaSlug) return routeVia(fromSlug, viaSlug, toSlug) ?? null;
    if (routePreference === 'direct') {
      const direct = getDiverseRoutes(fromSlug, toSlug).find((r) => r.transferCount === 0);
      if (direct) return direct;
    }
    return getFastestRoute(fromSlug, toSlug) ?? null;
  } catch {
    return null;
  }
}

export default selectCommuteRoute;
