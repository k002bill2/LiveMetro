/**
 * Starts native background location while route guidance is active.
 *
 * This hook intentionally does not request new background permission on its
 * own. Android 11+ may send users to Settings, so permission education belongs
 * in a foreground UX. If permission is already granted, the native task starts.
 */
import { useEffect, useRef } from 'react';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import {
  startGuidanceBackgroundLocation,
  stopGuidanceBackgroundLocation,
} from '@/services/guidance/guidanceBackgroundLocationTask';

export const useGuidanceBackgroundLocationSync = (): void => {
  const session = useGuidanceSession();
  const activeSessionKey = session && !session.commuteLogCompletedAt
    ? String(session.startedAt)
    : null;
  const startedForKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSessionKey) {
      startedForKeyRef.current = null;
      void stopGuidanceBackgroundLocation();
      return;
    }

    if (startedForKeyRef.current === activeSessionKey) return;
    startedForKeyRef.current = activeSessionKey;

    startGuidanceBackgroundLocation()
      .then((started) => {
        if (!started && startedForKeyRef.current === activeSessionKey) {
          startedForKeyRef.current = null;
        }
      })
      .catch(() => {
        startedForKeyRef.current = null;
      });
  }, [activeSessionKey]);
};

export default useGuidanceBackgroundLocationSync;
