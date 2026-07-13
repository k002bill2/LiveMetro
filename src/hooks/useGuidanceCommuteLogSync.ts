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
    // localCompletedAt 게이트(X1): W1의 updateGuidanceLocalCompletion emit이 이 훅을
    // 재실행시키는데, commuteLogId attach 전(예: 일시 Firestore 실패)에 isAtEnd에
    // 도달하면 화면의 complete 호출과 동시에 여기서 departure 로그를 시작해 중복/
    // departure-only 문서가 남는다. 이미 끝난 여정의 출발 기록은 무의미하므로 막는다.
    if (
      !user?.id ||
      !session ||
      session.commuteLogId ||
      session.commuteLogCompletedAt ||
      session.localCompletedAt
    ) {
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
