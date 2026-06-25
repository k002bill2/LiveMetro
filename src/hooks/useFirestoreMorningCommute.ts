/**
 * useFirestoreCommuteLeg — bridge between onboarding-side commute settings
 * (Firestore `commuteSettings/<uid>`) and the HomeScreen-side `CommuteTime`
 * shape. Reads the morning OR evening leg and adapts the row to `CommuteTime`.
 *
 * Background: onboarding's CommuteRouteScreen → CommuteTimeScreen →
 * FavoritesOnboardingScreen pipeline ultimately calls
 * `commuteService.saveCommuteRoutes(uid, morningRoute, eveningRoute)`, which
 * persists both legs. HomeScreen historically read only the profile
 * `morningCommute`; this hook bridges the onboarding store as a uniform
 * fallback, now for either leg (the home card's time-aware morning/evening
 * switch needs the evening leg too).
 *
 * Returns `null` when:
 *   - no uid (signed out) or `enabled === false` (inactive leg — no subscription)
 *   - no document for that uid
 *   - the evening leg is toggled off (`eveningEnabled === false`)
 *   - missing departureStationId / arrivalStationId / departureTime
 *   - Firestore read error (logged inside commuteService)
 */
import { useEffect, useState } from 'react';
import { subscribeCommuteRoutes } from '@/services/commute/commuteService';
import type { CommuteTime } from '@/models/user';
import type { CommuteLeg } from '@/utils/commuteSchedule';

export function useFirestoreCommuteLeg(
  uid: string | undefined,
  leg: CommuteLeg,
  // Bump this to force the live subscription to tear down and re-establish —
  // HomeScreen increments it on screen focus so a returning user always gets a
  // fresh read even if the prior onSnapshot link went stale.
  refreshNonce: number = 0,
  // When false, skip the subscription entirely. Lets the inactive leg in
  // direction='morning' avoid a needless onSnapshot (WeeklyPrediction etc.).
  enabled: boolean = true,
): CommuteTime | null {
  const [value, setValue] = useState<CommuteTime | null>(null);

  useEffect(() => {
    if (!uid || !enabled) {
      setValue(null);
      return;
    }
    // Live subscription (onSnapshot). The callback fires once immediately and
    // again on every change, so a commute saved on CommuteSettings/onboarding
    // shows up here without a remount (home-refresh audit B4).
    const unsubscribe = subscribeCommuteRoutes(uid, (settings) => {
      const route =
        leg === 'morning' ? settings?.morningRoute : settings?.eveningRoute;
      // Respect the evening leg toggle: a saved-but-disabled 퇴근 route must read
      // as "not set" (legacy docs without the flag default to enabled = true).
      const legDisabled = leg === 'evening' && settings?.eveningEnabled === false;
      if (
        legDisabled ||
        !route ||
        !route.departureStationId ||
        !route.arrivalStationId ||
        !route.departureTime
      ) {
        // Document exists with an incomplete leg (not merely disabled/empty) —
        // log loudly so this stops being a silent null. Presence only — never
        // the values, a commute route is user data.
        if (settings && !legDisabled) {
          console.warn(
            `[useFirestoreCommuteLeg] commute document found but ${leg} ` +
              'route is incomplete — falling back to null',
            {
              leg,
              hasRoute: !!route,
              hasDepartureStationId: !!route?.departureStationId,
              hasArrivalStationId: !!route?.arrivalStationId,
              hasDepartureTime: !!route?.departureTime,
            },
          );
        }
        setValue(null);
        return;
      }
      setValue({
        departureTime: route.departureTime,
        stationId: route.departureStationId,
        destinationStationId: route.arrivalStationId,
        bufferMinutes: route.bufferMinutes ?? 0,
        // First chosen transfer drives the via-constrained canonical route.
        // Absent (no transfer saved) → undefined → globally fastest route.
        transferStationId: route.transferStations?.[0]?.stationId,
      });
    });
    return unsubscribe;
    // refreshNonce is an intentional re-subscribe trigger (see param doc).
  }, [uid, leg, refreshNonce, enabled]);

  return value;
}

/**
 * useFirestoreMorningCommute — back-compat wrapper preserving the original
 * morning-only signature for existing callers (useCommuteHeroEstimate, tests).
 */
export function useFirestoreMorningCommute(
  uid: string | undefined,
  refreshNonce: number = 0,
): CommuteTime | null {
  return useFirestoreCommuteLeg(uid, 'morning', refreshNonce);
}

export default useFirestoreMorningCommute;
