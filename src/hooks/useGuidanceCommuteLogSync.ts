/**
 * Persist a commute-log departure row for every active guidance session, and
 * retry the arrival-completion write for a locally-completed session whose
 * completion failed (Z1) — the only recovery path once the screen is gone.
 *
 * This runs app-wide so both entry points (home commute CTA and route-search
 * CTA) share the same logging behavior, including sessions restored after an
 * app restart.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import {
  startGuidanceCommuteLog,
  completeGuidanceCommuteLog,
} from '@/services/guidance/guidanceCommuteLogService';

export const useGuidanceCommuteLogSync = (): void => {
  const { user } = useAuth();
  const session = useGuidanceSession();
  const inFlightKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !session) return;

    // 완료 write 재시도(Z1): 지하 등에서 완료 write가 실패한 채 unmount/재시작하면
    // localCompletedAt(도착 확정)과 commuteLogId(시작 로그)는 복원되지만 완료가
    // 미기록으로 남는다. 배너도 숨겨져 세션 만료 전 유일한 회복 경로이므로, 여기서
    // localCompletedAt을 도착 시각으로 완료를 재시도한다. 실패 시 조용히 반환하면
    // 다음 emit/재시작에서 자연히 재시도된다. commuteLogId가 없으면(시작 로그 자체
    // 부재) 할 일이 없어 아래 X1 게이트로 넘겨 신규 로그 생성을 막는다.
    if (session.localCompletedAt && session.commuteLogId && !session.commuteLogCompletedAt) {
      const completeKey = `complete:${user.id}:${session.startedAt}`;
      if (inFlightKeyRef.current === completeKey) return;
      inFlightKeyRef.current = completeKey;

      completeGuidanceCommuteLog(user.id, session, session.localCompletedAt)
        .catch((error) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[useGuidanceCommuteLogSync] commute log complete retry failed:', error);
          }
        })
        .finally(() => {
          if (inFlightKeyRef.current === completeKey) {
            inFlightKeyRef.current = null;
          }
        });
      return;
    }

    // localCompletedAt 게이트(X1): W1의 updateGuidanceLocalCompletion emit이 이 훅을
    // 재실행시키는데, commuteLogId attach 전(예: 일시 Firestore 실패)에 isAtEnd에
    // 도달하면 화면의 complete 호출과 동시에 여기서 departure 로그를 시작해 중복/
    // departure-only 문서가 남는다. 이미 끝난 여정의 출발 기록은 무의미하므로 막는다.
    if (session.commuteLogId || session.commuteLogCompletedAt || session.localCompletedAt) {
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
