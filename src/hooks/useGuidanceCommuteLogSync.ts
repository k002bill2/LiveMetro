/**
 * Persist a commute-log departure row for every active guidance session.
 *
 * This runs app-wide so both entry points (home commute CTA and route-search
 * CTA) share the same logging behavior, including sessions restored after an
 * app restart.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import { startGuidanceCommuteLog } from '@/services/guidance/guidanceCommuteLogService';

export const useGuidanceCommuteLogSync = (): void => {
  const { user } = useAuth();
  const session = useGuidanceSession();
  const inFlightKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !session || session.commuteLogId || session.commuteLogCompletedAt) {
      return;
    }

    const key = `${user.id}:${session.startedAt}`;
    if (inFlightKeyRef.current === key) return;
    inFlightKeyRef.current = key;

    startGuidanceCommuteLog(user.id, session)
      .catch((error) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[useGuidanceCommuteLogSync] commute log start failed:', error);
        }
      })
      .finally(() => {
        if (inFlightKeyRef.current === key) {
          inFlightKeyRef.current = null;
        }
      });
  }, [user?.id, session]);
};

export default useGuidanceCommuteLogSync;
