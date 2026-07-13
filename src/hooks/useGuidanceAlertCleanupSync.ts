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
 *   1. Transition cleanup — cancel when the active flag goes true→false. Keyed on
 *      the boolean (NOT session identity): progress-anchor persistence now emits
 *      on every rebase, so identity churns mid-journey while active stays true;
 *      those same-active emits must be no-ops.
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
  const active = session !== null && !session.commuteLogCompletedAt;

  // Transition cleanup: fire only on active true→false.
  const prevActiveRef = useRef<boolean>(active);
  useEffect(() => {
    if (prevActiveRef.current && !active) {
      cancelGuidanceAlerts();
    }
    prevActiveRef.current = active;
  }, [active]);

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
