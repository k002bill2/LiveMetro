/**
 * useFirestoreMorningCommute — bridge between the onboarding-side commute
 * settings (Firestore `commuteSettings/<uid>`) and the HomeScreen-side
 * `CommuteTime` shape consumed by `morningCommute` references.
 *
 * Background: onboarding's CommuteRouteScreen → CommuteTimeScreen →
 * FavoritesOnboardingScreen pipeline ultimately calls
 * `commuteService.saveCommuteRoutes(uid, morningRoute, eveningRoute)`,
 * which persists to a dedicated Firestore collection. HomeScreen,
 * however, historically reads `user.preferences.commuteSchedule
 * .weekdays.morningCommute` — populated by the SettingsScreen flow,
 * NOT by onboarding. The two stores are not kept in sync, so users who
 * registered via onboarding had no `morningCommute` on the profile and
 * `registeredCommuteHero` never fired.
 *
 * This hook reads the onboarding store and adapts the row to the
 * `CommuteTime` shape so callers can treat it as a uniform fallback.
 *
 * Failure modes (returns `null`):
 *   - no uid (signed out)
 *   - no document for that uid
 *   - missing departureStationId / arrivalStationId / departureTime
 *   - Firestore read error (logged inside commuteService)
 */
import { useEffect, useState } from 'react';
import { subscribeCommuteRoutes } from '@/services/commute/commuteService';
import type { CommuteTime } from '@/models/user';

export function useFirestoreMorningCommute(
  uid: string | undefined,
  // Bump this to force the live subscription to tear down and re-establish —
  // HomeScreen increments it on screen focus so a returning user always gets a
  // fresh read even if the prior onSnapshot link went stale. No-op (re-delivers
  // the same value) when the subscription was already healthy.
  refreshNonce: number = 0,
): CommuteTime | null {
  const [value, setValue] = useState<CommuteTime | null>(null);

  useEffect(() => {
    if (!uid) {
      setValue(null);
      return;
    }
    // Live subscription (onSnapshot). The callback fires once immediately and
    // again on every change, so a commute saved on CommuteSettings/onboarding
    // shows up here without a remount (home-refresh audit B4). The previous
    // one-shot `loadCommuteRoutes` could only ever reflect the first value.
    const unsubscribe = subscribeCommuteRoutes(uid, (settings) => {
      const morning = settings?.morningRoute;
      if (
        !morning ||
        !morning.departureStationId ||
        !morning.arrivalStationId ||
        !morning.departureTime
      ) {
        // A document exists but the morning leg is incomplete — log loudly
        // so this stops being a silent null. Most often this means the
        // commute was saved under a different uid than the one reading it.
        if (settings) {
          // Log which fields are missing (presence only — never the values,
          // a commute route is user data) so this stops being a silent null.
          console.warn(
            '[useFirestoreMorningCommute] commute document found but morning ' +
              'route is incomplete — falling back to null',
            {
              hasMorning: !!morning,
              hasDepartureStationId: !!morning?.departureStationId,
              hasArrivalStationId: !!morning?.arrivalStationId,
              hasDepartureTime: !!morning?.departureTime,
            },
          );
        }
        setValue(null);
        return;
      }
      setValue({
        departureTime: morning.departureTime,
        stationId: morning.departureStationId,
        destinationStationId: morning.arrivalStationId,
        bufferMinutes: morning.bufferMinutes ?? 0,
        // First chosen transfer drives the via-constrained canonical route.
        // Absent (no transfer saved) → undefined → globally fastest route.
        transferStationId: morning.transferStations?.[0]?.stationId,
      });
    });
    return unsubscribe;
    // refreshNonce is an intentional re-subscribe trigger (see param doc).
  }, [uid, refreshNonce]);

  return value;
}

export default useFirestoreMorningCommute;
