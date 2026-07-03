/**
 * useCommuteSettingsAutoLog — 출퇴근 시간대 앱 사용을 commuteLogs로 자동 기록.
 *
 * 기존 두 저장 경로는 특정 기능을 써야만 발화한다: 역 상세 조회
 * (useAutoCommuteLog)와 길안내 세션(guidanceCommuteLogService). 홈 화면
 * 위주 사용자는 어느 쪽도 밟지 않아 기록이 영원히 비어 있었다. 이 훅은
 * 앱 실행/포그라운드 복귀 자체를 통근 신호로 보고, 사용자가 설정한
 * commuteSettings 경로(출발·도착역이 모두 확보됨)로 로그를 남긴다.
 *
 * 시간 게이트는 useAutoCommuteLog의 detectCommuteType과 동일
 * (출근 06–11 = departure, 퇴근 17–23 = arrival, 그 외 null → 기록 안 함).
 * dedup은 (user, leg, day) 단위 — 실패 시 키를 되돌려 다음 포그라운드
 * 전환에서 재시도한다.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { detectCommuteType } from '@/hooks/useAutoCommuteLog';

export const useCommuteSettingsAutoLog = (): void => {
  const { user } = useAuth();
  const attemptedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return undefined;

    const attempt = async (): Promise<void> => {
      const commuteType = detectCommuteType();
      if (!commuteType) return;

      const key = `${userId}:${commuteType}:${new Date().toDateString()}`;
      if (attemptedKeyRef.current === key) return;
      attemptedKeyRef.current = key;

      try {
        const settings = await loadCommuteRoutes(userId);
        if (!settings) return;

        const route =
          commuteType === 'departure'
            ? settings.morningRoute
            : settings.eveningEnabled
              ? settings.eveningRoute
              : null;
        if (!route?.departureStationId || !route.arrivalStationId) return;

        await commuteLogService.autoLogCommuteRoute(userId, route, commuteType);
      } catch (error) {
        attemptedKeyRef.current = null; // 다음 포그라운드 전환에서 재시도
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[useCommuteSettingsAutoLog] auto-log failed:', error);
        }
      }
    };

    if (AppState.currentState === 'active') void attempt();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void attempt();
    });

    return () => subscription.remove();
  }, [user?.id]);
};

export default useCommuteSettingsAutoLog;
