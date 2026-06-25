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
 *   - otherwise → `getDiverseRoutes[0]` = Yen's K-shortest fastest path
 *
 * Returns `null` (no throw — project error policy) when:
 *   - either station id is missing, or both are equal
 *   - the resolver cannot map an id to an internal slug
 *   - resolved slugs collapse to the same station
 *   - graph search returns no path
 *   - any thrown error during calculation
 */
import { getDiverseRoutes } from '@services/route';
import { routeVia } from '@services/route/routeVia';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import type { Route } from '@/models/route';

export function selectCommuteRoute(
  fromStationId?: string,
  toStationId?: string,
  viaTransferId?: string,
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
    const route = viaSlug
      ? routeVia(fromSlug, viaSlug, toSlug)
      : getDiverseRoutes(fromSlug, toSlug)[0] ?? null;
    return route ?? null;
  } catch {
    return null;
  }
}

export default selectCommuteRoute;
