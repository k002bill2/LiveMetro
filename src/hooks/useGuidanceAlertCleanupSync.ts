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
 *   2. Orphan cleanup — a one-shot sweep for OS alerts left by a session dropped on
 *      a previous run (TTL expiry / app kill / a swap that died mid-flight). Gated
 *      behind boot hydration ({@link isGuidanceSessionHydrated}) so a cold-start
 *      sweep can't cancel a still-pending alert whose session hasn't hydrated yet.
 *      If hydration restored an active session, the sweep keeps that session's
 *      alerts (keepSessionKey) and clears only prior/keyless leftovers.
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

const cancelGuidanceAlerts = (keepSessionKey?: string): void => {
  const options = keepSessionKey !== undefined ? { keepSessionKey } : undefined;
  void cancelBoardingAlert(options);
  void cancelAlightAlert(options);
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
      // →null(종료)이면 전량 취소; →다른 key(교체)이면 새 세션이 방금 예약한
      // 알림은 보존(keepSessionKey) — 늦게 도는 이전 세션 정리가 새 알림을 지우는
      // 레이스를 실행 순서와 무관하게 차단한다.
      cancelGuidanceAlerts(activeKey ?? undefined);
    }
    prevKeyRef.current = activeKey;
  }, [activeKey]);

  // One-shot orphan cleanup, deferred until hydration completes. Runs whether
  // this hook mounts before hydration (via the subscription) or after (via the
  // immediate call). When hydration restores an ACTIVE session it still sweeps —
  // preserving that session's alerts (keepSessionKey) while clearing a prior
  // session's / keyless leftovers: an A→B swap that died mid-flight can leave A's
  // alerts in the OS queue, which would otherwise fire on the wrong journey.
  const orphanCleanedRef = useRef<boolean>(false);
  useEffect(() => {
    const maybeCleanup = (): void => {
      if (orphanCleanedRef.current || !isGuidanceSessionHydrated()) return;
      orphanCleanedRef.current = true;
      const restored = getGuidanceSession();
      // Restored + active → keep that session, sweep the rest; otherwise sweep all.
      const keepSessionKey =
        restored !== null && !restored.commuteLogCompletedAt
          ? String(restored.startedAt)
          : undefined;
      cancelGuidanceAlerts(keepSessionKey);
    };
    maybeCleanup();
    const unsubscribe = subscribe(maybeCleanup);
    return unsubscribe;
  }, []);
};

export default useGuidanceAlertCleanupSync;
