/**
 * useCommuteDelayAlerts — foreground monitor that fires a local notification
 * when one of the user's watched lines has an official delay.
 *
 * Source: officialDelayService (authoritative Seoul line status) — precision
 * over recall, so alerts don't cry wolf. Runs only while the app is in the
 * foreground (AppState 'active'); polls every 90s through the service cache
 * (one all-lines call, rate-limit friendly). Dedup prevents re-alerting an
 * ongoing delay; the user's notification settings gate every fire.
 *
 * Mutable inputs (watched lines, user) are held in refs so the long-lived
 * effect/interval is set up once and never tears down on prop/identity churn.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { officialDelayService } from '@services/delay/officialDelayService';
import { fireLineDelayAlert } from '@services/notification/lineDelayAlert';
import { notificationService, NotificationType } from '@services/notification/notificationService';
import { useAuth } from '@services/auth/AuthContext';
import { shouldAlert, nextDedupState, type AlertedState } from '@services/notification/delayAlertDedup';

const POLL_MS = 90_000;

export function useCommuteDelayAlerts(watchedLineIds: readonly string[]): void {
  const { user } = useAuth();
  const watchedRef = useRef(watchedLineIds);
  watchedRef.current = watchedLineIds;
  const userRef = useRef(user);
  userRef.current = user;
  const dedupRef = useRef<Map<string, AlertedState>>(new Map());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async (): Promise<void> => {
      const watched = watchedRef.current;
      if (watched.length === 0) return;
      try {
        const active = await officialDelayService.getActiveDelays();
        const watchedActive = active.filter((d) => watched.includes(d.lineId));
        const settings = userRef.current?.preferences?.notificationSettings;
        for (const d of watchedActive) {
          if (!shouldAlert(dedupRef.current, d)) continue;
          const allowed = settings
            ? notificationService.shouldSendNotification(settings, NotificationType.DELAY_ALERT)
            : true;
          if (allowed) await fireLineDelayAlert(d);
        }
        dedupRef.current = nextDedupState(watchedActive);
      } catch (error) {
        if (__DEV__) console.error('[useCommuteDelayAlerts] poll failed', error);
      }
    };

    const start = (): void => {
      if (timer) return;
      void check();
      timer = setInterval(() => void check(), POLL_MS);
    };
    const stop = (): void => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') start();
      else stop();
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, []);
}

export default useCommuteDelayAlerts;
