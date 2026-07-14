/**
 * Persist a commute-log departure row for every active guidance session, and own
 * the arrival-completion write:
 *   - live-session completion + retry (Z1/AB2): when a session is locally
 *     completed (localCompletedAt) but not yet remotely completed, write the
 *     arrival — creating a COMPLETED log even if the departure write never landed
 *     (no commuteLogId). A shared in-flight key serializes this against the
 *     departure write so the two can't create duplicate docs.
 *   - orphan recovery (AB3): if that write fails and the session is then cleared,
 *     a single-slot outbox retries the completion on mount / next emit.
 *
 * This runs app-wide so both entry points (home commute CTA and route-search
 * CTA) share the same logging behavior, including sessions restored after an
 * app restart.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import { getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import {
  startGuidanceCommuteLog,
  completeGuidanceCommuteLog,
} from '@/services/guidance/guidanceCommuteLogService';
import {
  savePendingCompletion,
  readPendingCompletion,
  clearPendingCompletion,
  clearPendingCompletionForSession,
  isPendingCompletionExpired,
} from '@/services/guidance/guidanceCompletionOutbox';

export const useGuidanceCommuteLogSync = (): void => {
  const { user } = useAuth();
  const session = useGuidanceSession();
  const inFlightKeyRef = useRef<string | null>(null);
  const drainingRef = useRef<boolean>(false);

  // 라이브 세션: 완료 write 소유(Z1/AB2) + 출발 로그 시작.
  useEffect(() => {
    if (!user?.id || !session) return;
    const userId = user.id;

    // 완료 write 소유(Z1/AB2): 로컬 완주(localCompletedAt)했고 원격 완료가 아직
    // 아니면 도착을 기록한다. commuteLogId가 없어도(지하에서 출발 로그 생성이 계속
    // 실패한 채 완주) 서비스가 출발+도착을 담은 *완결* 로그를 단일 write로 생성/입양
    // 하므로 완료를 스킵하지 않는다(AB2). 시작 write와 in-flight 키를 공유해(같은
    // key) 둘이 동시에 돌아 중복 문서를 만들지 않게 직렬화한다.
    if (session.localCompletedAt && !session.commuteLogCompletedAt) {
      const key = `${userId}:${session.startedAt}`;
      if (inFlightKeyRef.current === key) return;
      inFlightKeyRef.current = key;
      const snapshot = session;
      const arrivalAtMs = session.localCompletedAt;

      completeGuidanceCommuteLog(userId, snapshot, arrivalAtMs)
        .then(() => {
          // 성공: 이 세션의 outbox 슬롯이 있으면 정리(다른 세션 것은 보존).
          void clearPendingCompletionForSession(snapshot.startedAt);
        })
        .catch((error) => {
          // 실패: 세션 clear로 localCompletedAt이 유실돼 영구 로그 손실이 되지 않게
          // outbox에 스냅샷+도착 시각을 남긴다(AB3). 세션 clear와 독립적으로 재시도.
          void savePendingCompletion({
            userId,
            session: snapshot,
            arrivalAtMs,
            savedAt: Date.now(),
          });
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[useGuidanceCommuteLogSync] commute log complete failed:', error);
          }
        })
        .finally(() => {
          if (inFlightKeyRef.current === key) {
            inFlightKeyRef.current = null;
          }
        });
      return;
    }

    // departure 시작 게이트(X1): W1의 localCompletedAt emit이 이 훅을 재실행시키는데,
    // 로컬 완주 세션에는 신규 departure-only 로그를 만들지 않는다 — 위 완료 분기가
    // (완결 로그로) 처리한다. 여기서 막는 건 departure-only 신규 생성뿐이다(AB2로
    // 완결 로그 생성은 허용 — X1 취지 위배 아님).
    if (session.commuteLogId || session.commuteLogCompletedAt || session.localCompletedAt) {
      return;
    }

    const key = `${userId}:${session.startedAt}`;
    if (inFlightKeyRef.current === key) return;
    inFlightKeyRef.current = key;

    startGuidanceCommuteLog(userId, session)
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

  // Outbox drain(AB3): 마운트 + 세션 변경(emit)마다 고아 완료를 재시도한다. 현재
  // 활성 세션과 같은 sessionKey는 스킵한다 — 그건 위 라이브 분기가 소유하므로 동시
  // 실행 시 중복 write가 된다. 7일 초과 항목은 폐기한다. resolve = Firestore write
  // 완료(세션이 이미 clear돼 스탬프만 생략된 경로 포함)이므로 성공 시 슬롯을 지운다.
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;

    const drain = async (): Promise<void> => {
      if (drainingRef.current) return;
      drainingRef.current = true;
      try {
        const entry = await readPendingCompletion();
        if (entry === null || cancelled) return;
        if (isPendingCompletionExpired(entry, Date.now())) {
          await clearPendingCompletion();
          return;
        }
        // 소유권: 현재 활성 세션과 같은 여정이면 라이브 분기가 처리 — 스킵.
        const active = getGuidanceSession();
        if (active !== null && active.startedAt === entry.session.startedAt) return;
        // 다른 계정 로그인이면 남의 로그를 완료하지 않는다.
        if (entry.userId !== userId) return;

        await completeGuidanceCommuteLog(entry.userId, entry.session, entry.arrivalAtMs);
        await clearPendingCompletion();
      } catch {
        // 실패: 슬롯 유지 — 다음 마운트/emit에서 재시도.
      } finally {
        drainingRef.current = false;
      }
    };

    void drain();
    return () => {
      cancelled = true;
    };
  }, [user?.id, session]);
};

export default useGuidanceCommuteLogSync;
