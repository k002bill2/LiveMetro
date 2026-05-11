/**
 * useAutoCommuteLog Hook
 *
 * 사용자가 즐겨찾기 통근역(isCommuteStation=true)을 출퇴근 시간대에 조회하면
 * 자동으로 commuteLogService에 로그를 남긴다. 로그가 쌓여야 useMLPrediction의
 * baselineMinutes(평균 출퇴근 시간)가 계산되고 Hero ETA 카드가 살아난다.
 *
 * 한 화면 mount당 1회만 호출 (중복 로깅은 commuteLogService가 todayLog 체크로 차단).
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { commuteLogService } from '@/services/pattern/commuteLogService';

interface UseAutoCommuteLogOptions {
  stationId: string;
  stationName: string;
  lineId: string;
  enabled?: boolean;
}

const MORNING_START_HOUR = 6;
const MORNING_END_HOUR = 11;
const EVENING_START_HOUR = 17;
const EVENING_END_HOUR = 23;

type CommuteType = 'departure' | 'arrival' | null;

const detectCommuteType = (date: Date = new Date()): CommuteType => {
  const hour = date.getHours();
  if (hour >= MORNING_START_HOUR && hour < MORNING_END_HOUR) return 'departure';
  if (hour >= EVENING_START_HOUR && hour < EVENING_END_HOUR) return 'arrival';
  return null;
};

export const useAutoCommuteLog = ({
  stationId,
  stationName,
  lineId,
  enabled = true,
}: UseAutoCommuteLogOptions): void => {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user?.id || !stationId) return;

    const isCommuteFavorite = favorites.some(
      (fav) => fav.stationId === stationId && fav.isCommuteStation === true,
    );
    if (!isCommuteFavorite) return;

    const commuteType = detectCommuteType();
    if (!commuteType) return;

    const dedupeKey = `${stationId}:${commuteType}:${new Date().toDateString()}`;
    if (loggedRef.current === dedupeKey) return;
    loggedRef.current = dedupeKey;

    commuteLogService
      .autoLogIfAppropriate(user.id, stationId, stationName, lineId, commuteType)
      .catch((error) => {
        if (__DEV__) {
          console.warn('[useAutoCommuteLog] auto-log failed:', error);
        }
      });
  }, [enabled, user?.id, stationId, stationName, lineId, favorites]);
};

export { detectCommuteType };
