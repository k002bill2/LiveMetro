/**
 * useCommuteRouteSteps — derive the full guidance-style step timeline
 * (board → ride → (transfer → ride)* → alight) from a pair of station IDs.
 *
 * Used by the ML prediction screen (WeeklyPredictionScreen) to render the
 * *configured* commute route as a 전체 경로 timeline — the same shape the
 * live 길안내 screen shows — without waiting for ML commute logs to
 * accumulate. The route is computed on demand from the origin/destination the
 * user already saved (commuteSettings store), so the timeline is available the
 * moment a commute is set, even with zero logged trips.
 *
 * Mirrors {@link useCommuteRouteSummary}'s id-normalization + getDiverseRoutes
 * path, then reshapes the chosen Route into guidance steps via
 * {@link routeToGuidanceSteps}. Both seams are pure given station IDs, so the
 * hook collapses to a `useMemo` keyed on the input pair.
 *
 * Returns [] (no throw — project error policy) when:
 *   - either station id is missing
 *   - both ids are equal (no journey)
 *   - the resolver cannot map an id to an internal slug
 *   - the resolved slugs collapse to the same station
 *   - graph search returns no path
 *   - routeToGuidanceSteps yields no actionable steps (malformed route)
 *   - any thrown error during calculation
 */
import { useMemo } from 'react';
import { getDiverseRoutes } from '@services/route';
import { routeVia } from '@services/route/routeVia';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import { routeToGuidanceSteps } from '@/services/guidance/guidanceSteps';
import type { GuidanceStep } from '@/models/guidance';

const EMPTY: readonly GuidanceStep[] = [];

export function useCommuteRouteSteps(
  fromStationId?: string,
  toStationId?: string,
  viaTransferId?: string,
): readonly GuidanceStep[] {
  return useMemo<readonly GuidanceStep[]>(() => {
    if (!fromStationId || !toStationId || fromStationId === toStationId) {
      return EMPTY;
    }
    // Storage layer (onboarding / Firestore) may persist Seoul Metro
    // station_cd codes ("0220", "3762") while the graph keys on internal
    // slugs ("seolleung"). Normalize at the boundary so the graph stays
    // slug-only — same treatment as useCommuteRouteSummary.
    const fromSlug = resolveInternalStationId(fromStationId);
    const toSlug = resolveInternalStationId(toStationId);
    if (!fromSlug || !toSlug || fromSlug === toSlug) return EMPTY;
    try {
      // Canonical route selection — identical policy to useCommuteRouteSummary
      // so the ML timeline and the home fact grid never diverge:
      //   - via transfer chosen → `routeVia` constrains the path through it
      //   - otherwise → `getDiverseRoutes[0]` = fastest path.
      const viaSlug = viaTransferId
        ? resolveInternalStationId(viaTransferId)
        : null;
      const route = viaSlug
        ? routeVia(fromSlug, viaSlug, toSlug)
        : getDiverseRoutes(fromSlug, toSlug)[0] ?? null;
      if (!route) return EMPTY;
      const steps = routeToGuidanceSteps(route);
      return steps.length > 0 ? steps : EMPTY;
    } catch (error) {
      if (__DEV__) {
        console.warn('[useCommuteRouteSteps] calculation threw', {
          fromStationId,
          toStationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return EMPTY;
    }
  }, [fromStationId, toStationId, viaTransferId]);
}

export default useCommuteRouteSteps;
