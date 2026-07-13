/**
 * useGuidanceAlertCleanupSync — cancels guidance alerts on session END, not on
 * screen unmount.
 *
 * The route-guidance screen no longer cancels boarding/alight alerts when it
 * unmounts: a session can outlive the screen (rider closes it mid-ride) and the
 * alight alert fires at an absolute time regardless of mount state. This app-
 * level hook owns cancellation instead, firing exactly when the session becomes
 * inactive.
 *
 * Two triggers:
 *   1. Transition cleanup — cancel when the active session's identity key
 *      (startedAt) changes: end (→null) OR replacement by a new route without an
 *      explicit end. Keyed on identity (not a boolean) so progress-anchor churn
 *      (same key, frequent emits) is a no-op, while a genuine session swap still
 *      cancels the previous route's alerts.
 *   2. Orphan cleanup — a one-shot sweep for OS alerts left by a session that was
 *      dropped on a previous run (TTL expiry / app kill). Gated behind boot
 *      hydration ({@link isGuidanceSessionHydrated}) so a cold-start sweep can't
 *      cancel a still-pending alert whose session hasn't hydrated yet.
 */
import { useEffect, useRef } from 'react';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import {
  getGuidanceSession,
  subscribe,
  isGuidanceSessionHydrated,
} from '@/services/guidance/guidanceSessionStore';
import { cancelBoardingAlert } from '@/services/notification/boardingAlertService';
import { cancelAlightAlert } from '@/services/notification/alightAlertService';

const cancelGuidanceAlerts = (): void => {
  void cancelBoardingAlert();
  void cancelAlightAlert();
};

export const useGuidanceAlertCleanupSync = (): void => {
  const session = useGuidanceSession();
  // Identity key of the active session (its startedAt), or null when inactive.
  const activeKey =
    session !== null && !session.commuteLogCompletedAt ? String(session.startedAt) : null;

  // Transition cleanup: fire when the active session ends (→null) OR is replaced
  // by a DIFFERENT session (key change) without an explicit end — starting a new
  // route from the screen leaves the old one's alerts otherwise. Keyed on the
  // session identity (not a boolean) so anchor-persistence churn (same key) stays
  // a no-op, but a genuine session swap still cancels the previous route's alerts.
  const prevKeyRef = useRef<string | null>(activeKey);
  useEffect(() => {
    if (prevKeyRef.current !== null && prevKeyRef.current !== activeKey) {
      cancelGuidanceAlerts();
    }
    prevKeyRef.current = activeKey;
  }, [activeKey]);

  // One-shot orphan cleanup, deferred until hydration completes. Runs whether
  // this hook mounts before hydration (via the subscription) or after (via the
  // immediate call). Skips cleanup when hydration restored an active session.
  const orphanCleanedRef = useRef<boolean>(false);
  useEffect(() => {
    const maybeCleanup = (): void => {
      if (orphanCleanedRef.current || !isGuidanceSessionHydrated()) return;
      orphanCleanedRef.current = true;
      const restored = getGuidanceSession();
      const restoredActive = restored !== null && !restored.commuteLogCompletedAt;
      if (!restoredActive) {
        cancelGuidanceAlerts();
      }
    };
    maybeCleanup();
    const unsubscribe = subscribe(maybeCleanup);
    return unsubscribe;
  }, []);
};

export default useGuidanceAlertCleanupSync;
