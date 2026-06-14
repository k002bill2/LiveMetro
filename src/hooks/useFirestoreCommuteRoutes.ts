/**
 * useFirestoreCommuteRoutes — adapts BOTH commute legs from the onboarding /
 * CommuteSettings store (Firestore `commuteSettings/<uid>`) to the
 * `CommuteTime` shape, via a single live subscription.
 *
 * Why this exists: the commute route a user configures in onboarding or on
 * CommuteSettingsScreen is persisted by `commuteService` to a dedicated
 * Firestore collection (store #2), NOT to `user.preferences.commuteSchedule`
 * (store #1). Screens that only read store #1 (e.g. the old
 * NotificationTimeScreen) therefore never see a commute that was set up that
 * way — showing a false "set your route first" prompt. This hook is the
 * store #2 reader; callers gate store #1 with `isUsableCommuteTime` and fall
 * back to these values (the HomeScreen `store1 ?? store2` pattern, per leg).
 *
 * `useFirestoreMorningCommute` is the morning-only sibling kept for HomeScreen;
 * this returns both legs for screens that need the evening too.
 *
 * Each leg is `null` when: signed out, no document, the leg is incomplete
 * (missing station ids / departureTime), or — for evening — the leg is
 * disabled (`eveningEnabled === false`).
 */
import { useEffect, useState } from 'react';
import { subscribeCommuteRoutes } from '@/services/commute/commuteService';
import type { CommuteTime } from '@/models/user';

export interface FirestoreCommuteRoutes {
  readonly morning: CommuteTime | null;
  readonly evening: CommuteTime | null;
}

interface RouteLeg {
  readonly departureStationId?: string;
  readonly arrivalStationId?: string;
  readonly departureTime?: string;
  readonly bufferMinutes?: number;
}

/** Adapt a store #2 route leg to a `CommuteTime`, or null when incomplete. */
const adaptLeg = (leg: RouteLeg | null | undefined): CommuteTime | null => {
  if (
    !leg ||
    !leg.departureStationId ||
    !leg.arrivalStationId ||
    !leg.departureTime
  ) {
    return null;
  }
  return {
    departureTime: leg.departureTime,
    stationId: leg.departureStationId,
    destinationStationId: leg.arrivalStationId,
    bufferMinutes: leg.bufferMinutes ?? 0,
  };
};

const EMPTY: FirestoreCommuteRoutes = { morning: null, evening: null };

export function useFirestoreCommuteRoutes(
  uid: string | undefined
): FirestoreCommuteRoutes {
  const [routes, setRoutes] = useState<FirestoreCommuteRoutes>(EMPTY);

  useEffect(() => {
    if (!uid) {
      setRoutes(EMPTY);
      return;
    }
    // Live subscription (onSnapshot) — a route saved on CommuteSettings or
    // onboarding shows up here without a remount. Cleanup unsubscribes.
    const unsubscribe = subscribeCommuteRoutes(uid, (settings) => {
      if (!settings) {
        setRoutes(EMPTY);
        return;
      }
      setRoutes({
        morning: adaptLeg(settings.morningRoute),
        // A disabled evening leg is treated as absent (no window/alerts).
        evening:
          settings.eveningEnabled === false
            ? null
            : adaptLeg(settings.eveningRoute),
      });
    });
    return unsubscribe;
  }, [uid]);

  return routes;
}

export default useFirestoreCommuteRoutes;
