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
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import type { CommuteTime } from '@/models/user';

export function useFirestoreMorningCommute(
  uid: string | undefined,
): CommuteTime | null {
  const [value, setValue] = useState<CommuteTime | null>(null);

  useEffect(() => {
    if (!uid) {
      setValue(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const settings = await loadCommuteRoutes(uid);
      if (cancelled) return;
      const morning = settings?.morningRoute;
      if (
        !morning ||
        !morning.departureStationId ||
        !morning.arrivalStationId ||
        !morning.departureTime
      ) {
        setValue(null);
        return;
      }
      setValue({
        departureTime: morning.departureTime,
        stationId: morning.departureStationId,
        destinationStationId: morning.arrivalStationId,
        bufferMinutes: morning.bufferMinutes ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return value;
}

export default useFirestoreMorningCommute;
