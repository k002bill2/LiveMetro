/**
 * useTrainSchedule Hook
 * 열차시간표 데이터 조회 훅
 *
 * 서울열린데이터광장 SearchSTNTimeTableByIDService API 사용
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { seoulSubwayApi, SeoulTimetableRow, TimetableUnsupportedOnWebError } from '@/services/api/seoulSubwayApi';
import { findStationCdByNameAndLine } from '@/services/data/stationsDataService';
import { toSecondsOfDay } from '@/utils/dateUtils';
import { isKoreanHoliday } from '@/utils/koreanHolidays';

/** 시간표 캐시 TTL: 24시간 (시간표는 일 단위 변경) */
const TIMETABLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface TimetableCacheEntry {
  data: SeoulTimetableRow[];
  timestamp: number;
}

const getTimetableCacheKey = (stationCode: string, lineNumber: string, weekTag: string, direction: string): string =>
  `timetable:${stationCode}:${lineNumber}:${weekTag}:${direction}`;

const getCachedTimetable = async (cacheKey: string): Promise<SeoulTimetableRow[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return null;

    const entry: TimetableCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TIMETABLE_CACHE_TTL_MS) {
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
};

const setCachedTimetable = async (cacheKey: string, data: SeoulTimetableRow[]): Promise<void> => {
  try {
    const entry: TimetableCacheEntry = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (err) {
    console.warn('Failed to cache timetable:', err);
  }
};

/** 상하행 방향 코드 */
type DirectionCode = '1' | '2';

/** 요일 구분 코드 */
type WeekTagCode = '1' | '2' | '3';

/**
 * dayType 사용자 override.
 * - 'auto' (default): 현재 요일 자동 감지 (공휴일 → holiday, 토 → saturday, 일 → holiday, 평일 → weekday)
 * - 'weekday' / 'saturday' / 'holiday': 사용자가 선택한 요일별 시간표 강제 조회
 *
 * 이미지 디자인(2026-05-17)의 평일/토요일/일요일·공휴일 3-segment tab을
 * 지원하기 위함. UI tab 전환이 곧 fetch 재실행으로 이어진다.
 */
export type DayTypeOverride = 'auto' | 'weekday' | 'saturday' | 'holiday';

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
  /** 요일 override. 미지정/`'auto'`이면 현재 요일 자동 감지 */
  dayType?: DayTypeOverride;
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
 *
 * 우선순위:
 * 1. 한국 공휴일 → '3' (휴일/일요일 시간표)
 * 2. 토요일 → '2'
 * 3. 일요일 → '3'
 * 4. 평일 → '1'
 *
 * 공휴일이 평일에 떨어지는 경우(예: 어린이날 화요일)에도 휴일 시간표가 운행되므로
 * isKoreanHoliday 체크가 요일 분기보다 먼저 수행되어야 합니다.
 */
const getCurrentWeekTag = (now: Date = new Date()): WeekTagCode => {
  if (isKoreanHoliday(now)) return '3';
  const day = now.getDay();
  if (day === 0) return '3'; // 일요일
  if (day === 6) return '2'; // 토요일
  return '1'; // 평일
};

/**
 * DayType override(사용자 선택) → Seoul API weekTag 매핑.
 * Module-level constant — hook 호출마다 재생성 회피.
 */
const DAY_TYPE_TO_WEEK_TAG: Record<Exclude<DayTypeOverride, 'auto'>, WeekTagCode> = {
  weekday: '1',
  saturday: '2',
  holiday: '3',
};

/**
 * Convert "HH:MM:SS" arrival time to a sortable minute count anchored to the
 * **operating day** (which runs ~04:00 → next 03:59, not midnight → midnight).
 *
 * Why: late-night 막차 trains run past midnight (e.g. 강남 외선 막차 00:38).
 * A naive `string.localeCompare` or `parseInt(hour)*60` would rank "00:38" as
 * earliest of the day, mistaking the 막차 for the 첫차. Treating 00:00-03:59
 * as "previous operating day + 24h" makes `compareScheduleTime(a, b)` produce
 * the chronological order users expect.
 *
 * @returns minutes from 04:00 (e.g. "04:30" → 30, "00:30" → 1230, "23:59" → 1199).
 */
function arrivalTimeToOperatingMinutes(arrivalTime: string): number {
  const parts = arrivalTime.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
  if (h < 4) return (h + 24) * 60 + m;
  return h * 60 + m;
}

/**
 * Return the earliest-departing train of an operating day (첫차).
 *
 * Guide (2026-05-16) item #7 mandates separate 첫차/막차 surfacing in the
 * timetable UI. Implemented as a pure helper so screens or sub-tabs can
 * filter without re-implementing the late-night arithmetic.
 */
export function getFirstTrain(
  schedules: readonly TrainScheduleItem[],
): TrainScheduleItem | null {
  if (schedules.length === 0) return null;
  let earliest = schedules[0]!;
  let earliestMin = arrivalTimeToOperatingMinutes(earliest.arrivalTime);
  for (let i = 1; i < schedules.length; i++) {
    const candidate = schedules[i]!;
    const candidateMin = arrivalTimeToOperatingMinutes(candidate.arrivalTime);
    if (candidateMin < earliestMin) {
      earliest = candidate;
      earliestMin = candidateMin;
    }
  }
  return earliest;
}

/**
 * Return the latest-departing train of an operating day (막차).
 * See {@link getFirstTrain} for the operating-day rationale.
 */
export function getLastTrain(
  schedules: readonly TrainScheduleItem[],
): TrainScheduleItem | null {
  if (schedules.length === 0) return null;
  let latest = schedules[0]!;
  let latestMin = arrivalTimeToOperatingMinutes(latest.arrivalTime);
  for (let i = 1; i < schedules.length; i++) {
    const candidate = schedules[i]!;
    const candidateMin = arrivalTimeToOperatingMinutes(candidate.arrivalTime);
    if (candidateMin > latestMin) {
      latest = candidate;
      latestMin = candidateMin;
    }
  }
  return latest;
}

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
    dayType = 'auto',
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

      // dayType override가 'auto'면 현재 요일 자동 감지, 아니면 사용자 선택 매핑.
      // weekday → '1' / saturday → '2' / holiday → '3' (Seoul API weekTag 규격).
      const todayWeekTag = getCurrentWeekTag();
      const weekTag: WeekTagCode =
        dayType === 'auto' ? todayWeekTag : DAY_TYPE_TO_WEEK_TAG[dayType];
      const cacheKey = getTimetableCacheKey(stationCode, lineNumber, weekTag, direction);

      const cached = await getCachedTimetable(cacheKey);
      let data: SeoulTimetableRow[];

      if (cached) {
        data = cached;
      } else {
        data = await seoulSubwayApi.getStationTimetable(
          stationCode,
          weekTag,
          direction
        );
        // 성공 시 캐시 저장
        if (data.length > 0) {
          await setCachedTimetable(cacheKey, data);
        }
      }

      // 데이터 변환
      const convertedData = data.map((row) =>
        convertToScheduleItem(row, weekTag, direction)
      );
      setSchedules(convertedData);

      // 현재 시각 이후 열차만 필터링 — 사용자가 오늘 시간표를 보는 경우만.
      // 사용자가 dayType tab으로 다른 요일(예: 금요일에 토요일 시간표 조회)을
      // 선택했으면 "현재 시각" 기준 필터는 의미 없음 → 전체를 upcoming으로
      // 노출해야 토요일 첫 출발들을 사용자가 둘러볼 수 있다.
      //
      // Seoul API는 "9:35:00" 같은 비패딩 형식을 반환할 수 있어 lexicographic 비교가
      // 무너집니다 ('9' > '1'). toSecondsOfDay로 정수 비교해야 정확합니다.
      //
      // 자정 롤오버 처리: 서울 지하철은 ~01:00까지 운행하므로 23:55에 있는 사용자는
      // 00:05·00:30 막차를 "다음 열차"로 봐야 합니다. 시간표 행은 같은 운행일 안에
      // 인코딩되므로(00:05도 같은 row), 늦은 시간대(LATE_NIGHT_THRESHOLD 이후)에는
      // 새벽 시간대(EARLY_MORNING_LIMIT 이전) 행을 carry-over로 포함시킵니다.
      const isViewingToday = weekTag === todayWeekTag;
      if (!isViewingToday) {
        // 다른 요일 시간표 — 전체를 upcoming으로 (browsing 모드)
        setUpcomingTrains(convertedData);
      } else {
        const LATE_NIGHT_THRESHOLD = 22 * 3600; // 22:00
        const EARLY_MORNING_LIMIT = 3 * 3600;   // 03:00
        const now = new Date();
        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const isLateNight = currentSeconds >= LATE_NIGHT_THRESHOLD;
        const upcoming = convertedData.filter((item) => {
          const itemSec = toSecondsOfDay(item.arrivalTime);
          if (itemSec < 0) return false;
          if (itemSec >= currentSeconds) return true;
          // Late-night carry-over for next-day early morning runs
          return isLateNight && itemSec < EARLY_MORNING_LIMIT;
        });
        setUpcomingTrains(upcoming);
      }
    } catch (err) {
      console.error('Error fetching train schedule:', err);
      // Friendly message for the web-platform case so users don't see a
      // generic "failed" state when the limitation is platform-level.
      if (err instanceof TimetableUnsupportedOnWebError) {
        setError('시간표는 모바일 앱에서 확인할 수 있습니다.');
      } else {
        setError('시간표를 불러오는데 실패했습니다.');
      }
      setSchedules([]);
      setUpcomingTrains([]);
    } finally {
      setLoading(false);
    }
  }, [stationName, lineNumber, direction, enabled, dayType]);

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
