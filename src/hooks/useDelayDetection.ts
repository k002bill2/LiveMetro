/**
 * Delay Detection Hook
 * Seoul Open Data API에서 실시간 지연 정보를 감지합니다
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { seoulSubwayApi, SeoulRealtimeArrival } from '@/services/api/seoulSubwayApi';
import type { DelayInfo } from '@/components/delays/DelayAlertBanner';

// 지연 감지 키워드
const DELAY_KEYWORDS = [
  '지연',
  '운행지연',
  '서행',
  '운행중지',
  '운행중단',
  '장애',
  '고장',
  '사고',
  '점검',
];

// 노선별 대표 역 (지연 감지용)
const LINE_REPRESENTATIVE_STATIONS: Record<string, string> = {
  '1': '서울역',
  '2': '강남',
  '3': '교대',
  '4': '동대문역사문화공원',
  '5': '광화문',
  '6': '삼각지',
  '7': '건대입구',
  '8': '잠실',
  '9': '여의도',
};

interface UseDelayDetectionOptions {
  /** 폴링 간격 (ms). 기본값: 60000 (1분) */
  pollingInterval?: number;
  /** 감시할 노선 목록. 기본값: 전체 노선 */
  lineIds?: string[];
  /** 자동 폴링 활성화. 기본값: true */
  autoPolling?: boolean;
}

interface UseDelayDetectionResult {
  /** 현재 감지된 지연 정보 목록 */
  delays: DelayInfo[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 마지막 업데이트 시간 */
  lastUpdated: Date | null;
  /** 수동 새로고침 함수 */
  refresh: () => Promise<void>;
}

/**
 * Seoul API 도착 메시지에서 지연을 감지합니다
 */
function detectDelayFromArrival(arrival: SeoulRealtimeArrival): {
  isDelayed: boolean;
  delayMinutes: number;
  reason?: string;
} {
  const message = `${arrival.arvlMsg2 || ''} ${arrival.arvlMsg3 || ''}`;

  // 지연 키워드 검색
  const hasDelayKeyword = DELAY_KEYWORDS.some(keyword =>
    message.includes(keyword)
  );

  if (!hasDelayKeyword) {
    return { isDelayed: false, delayMinutes: 0 };
  }

  // 지연 시간 추출 시도 (예: "약 10분 지연")
  const minuteMatch = message.match(/(\d+)\s*분\s*(지연|서행)/);
  const delayMinutes = minuteMatch && minuteMatch[1] ? parseInt(minuteMatch[1], 10) : 5; // 기본값 5분

  // 지연 원인 추출
  let reason: string | undefined;
  if (message.includes('고장')) reason = '열차 고장';
  else if (message.includes('사고')) reason = '사고 발생';
  else if (message.includes('점검')) reason = '시설 점검';
  else if (message.includes('혼잡')) reason = '역 혼잡';
  else reason = '운행 지연';

  return { isDelayed: true, delayMinutes, reason };
}

/**
 * 노선 ID를 표시 이름으로 변환합니다
 */
function getLineName(subwayId: string): string {
  // Seoul API의 subwayId 형식: "1001" (1호선), "1002" (2호선), etc.
  const lineNumber = subwayId.replace('100', '').replace('00', '');
  return `${lineNumber}호선`;
}

/**
 * Seoul Open Data API를 사용하여 실시간 지연 정보를 감지하는 훅
 */
export function useDelayDetection(
  options: UseDelayDetectionOptions = {}
): UseDelayDetectionResult {
  const {
    pollingInterval = 60000, // 1분
    lineIds = Object.keys(LINE_REPRESENTATIVE_STATIONS),
    autoPolling = true,
  } = options;

  const [delays, setDelays] = useState<DelayInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * 지정된 노선들의 지연 정보를 조회합니다
   */
  const fetchDelays = useCallback(async (): Promise<void> => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const detectedDelays: DelayInfo[] = [];
      const delayMap = new Map<string, DelayInfo>(); // 중복 방지

      // 각 노선의 대표 역에서 도착 정보 조회
      const fetchPromises = lineIds.map(async (lineId) => {
        const stationName = LINE_REPRESENTATIVE_STATIONS[lineId];
        if (!stationName) return;

        try {
          const arrivals = await seoulSubwayApi.getRealtimeArrival(stationName);

          // 해당 노선의 도착 정보만 필터링
          const lineArrivals = arrivals.filter(a =>
            a.subwayId === `100${lineId}` ||
            a.trainLineNm?.includes(`${lineId}호선`)
          );

          // 각 도착 정보에서 지연 감지
          for (const arrival of lineArrivals) {
            const detection = detectDelayFromArrival(arrival);

            if (detection.isDelayed && !delayMap.has(lineId)) {
              const delayInfo: DelayInfo = {
                lineId,
                lineName: getLineName(arrival.subwayId || lineId),
                delayMinutes: detection.delayMinutes,
                reason: detection.reason,
                timestamp: new Date(),
              };
              delayMap.set(lineId, delayInfo);
            }
          }
        } catch (lineError) {
          console.warn(`Failed to fetch delays for line ${lineId}:`, lineError);
        }
      });

      await Promise.allSettled(fetchPromises);

      // Map을 배열로 변환
      delayMap.forEach(delay => detectedDelays.push(delay));

      // 지연 시간 순으로 정렬 (큰 지연부터)
      detectedDelays.sort((a, b) => b.delayMinutes - a.delayMinutes);

      if (isMountedRef.current) {
        setDelays(detectedDelays);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error detecting delays:', err);
      if (isMountedRef.current) {
        setError('지연 정보를 가져오는데 실패했습니다');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [lineIds, loading]);

  /**
   * 수동 새로고침
   */
  const refresh = useCallback(async (): Promise<void> => {
    await fetchDelays();
  }, [fetchDelays]);

  // 초기 로드 및 폴링 설정
  useEffect(() => {
    isMountedRef.current = true;

    // 초기 조회
    fetchDelays();

    // 자동 폴링 설정
    if (autoPolling && pollingInterval >= 30000) { // 최소 30초
      pollingTimerRef.current = setInterval(() => {
        fetchDelays();
      }, pollingInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [autoPolling, pollingInterval, fetchDelays]);

  return {
    delays,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

export default useDelayDetection;
