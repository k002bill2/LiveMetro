/**
 * useTrainSchedule Hook
 * 열차시간표 데이터 조회 훅
 *
 * 서울열린데이터광장 SearchSTNTimeTableByIDService API 사용
 */

import { useState, useEffect, useCallback } from 'react';
import { seoulSubwayApi, SeoulTimetableRow } from '@/services/api/seoulSubwayApi';
import { findStationCdByNameAndLine } from '@/services/data/stationsDataService';

/** 상하행 방향 코드 */
type DirectionCode = '1' | '2';

/** 요일 구분 코드 */
type WeekTagCode = '1' | '2' | '3';

interface UseTrainScheduleOptions {
  /** 역명 (예: "강남") */
  stationName: string;
  /** 호선번호 (1-9) */
  lineNumber: string;
  /** 상하행 (1:상행/내선, 2:하행/외선) */
  direction?: DirectionCode;
  /** 자동 조회 여부 */
  enabled?: boolean;
  /** 향후 몇 분 이내 열차만 표시 */
  minutesAhead?: number;
}

/** 시간표 항목 */
interface TrainScheduleItem {
  trainNumber: string;
  arrivalTime: string;
  departureTime: string;
  destinationName: string;
  originStationName: string;
  dayType: 'weekday' | 'saturday' | 'holiday';
  direction: 'up' | 'down';
}

interface UseTrainScheduleResult {
  /** 전체 시간표 */
  schedules: TrainScheduleItem[];
  /** 향후 도착 예정 열차 */
  upcomingTrains: TrainScheduleItem[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 새로고침 */
  refresh: () => Promise<void>;
}

/**
 * 현재 요일 코드 반환
 */
const getCurrentWeekTag = (): WeekTagCode => {
  const day = new Date().getDay();
  if (day === 0) return '3'; // 일요일/공휴일
  if (day === 6) return '2'; // 토요일
  return '1'; // 평일
};

/**
 * SeoulTimetableRow를 TrainScheduleItem으로 변환
 */
const convertToScheduleItem = (
  row: SeoulTimetableRow,
  weekTag: WeekTagCode,
  inoutTag: DirectionCode
): TrainScheduleItem => {
  const dayTypeMap: Record<WeekTagCode, 'weekday' | 'saturday' | 'holiday'> = {
    '1': 'weekday',
    '2': 'saturday',
    '3': 'holiday',
  };

  return {
    trainNumber: row.TRAIN_NO,
    arrivalTime: row.ARRIVETIME,
    departureTime: row.LEFTTIME,
    destinationName: row.DEST_STATION_NM,
    originStationName: row.ORIGIN_STATION_NM,
    dayType: dayTypeMap[weekTag],
    direction: inoutTag === '1' ? 'up' : 'down',
  };
};

/**
 * 열차시간표 조회 훅
 * 서울열린데이터광장 SearchSTNTimeTableByIDService API 사용
 */
export const useTrainSchedule = (
  options: UseTrainScheduleOptions
): UseTrainScheduleResult => {
  const {
    stationName,
    lineNumber,
    direction = '1',
    enabled = true,
  } = options;

  const [schedules, setSchedules] = useState<TrainScheduleItem[]>([]);
  const [upcomingTrains, setUpcomingTrains] = useState<TrainScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!stationName || !lineNumber || !enabled) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 역명 + 호선으로 station_cd 찾기
      const stationCode = findStationCdByNameAndLine(stationName, lineNumber);
      if (!stationCode) {
        setError(`역 정보를 찾을 수 없습니다: ${stationName} ${lineNumber}호선`);
        setSchedules([]);
        setUpcomingTrains([]);
        return;
      }

      // 현재 요일 기준 시간표 조회
      const weekTag = getCurrentWeekTag();
      const data = await seoulSubwayApi.getStationTimetable(
        stationCode,
        weekTag,
        direction
      );

      // 데이터 변환
      const convertedData = data.map((row) =>
        convertToScheduleItem(row, weekTag, direction)
      );
      setSchedules(convertedData);

      // 전체 시간표를 upcomingTrains에도 할당 (필터링 제거)
      setUpcomingTrains(convertedData);
    } catch (err) {
      console.error('Error fetching train schedule:', err);
      setError('시간표를 불러오는데 실패했습니다.');
      setSchedules([]);
      setUpcomingTrains([]);
    } finally {
      setLoading(false);
    }
  }, [stationName, lineNumber, direction, enabled]);

  const refresh = useCallback(async () => {
    await fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    schedules,
    upcomingTrains,
    loading,
    error,
    refresh,
  };
};

export default useTrainSchedule;
export type { TrainScheduleItem, UseTrainScheduleOptions, UseTrainScheduleResult };
