/**
 * useTrainSchedule Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTrainSchedule } from '../useTrainSchedule';
import { seoulSubwayApi, TimetableUnsupportedOnWebError } from '@/services/api/seoulSubwayApi';
import { findStationCdByNameAndLine } from '@/services/data/stationsDataService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/api/seoulSubwayApi', () => {
  class TimetableUnsupportedOnWebError extends Error {
    constructor() {
      super('Timetable API is not supported on web');
      this.name = 'TimetableUnsupportedOnWebError';
    }
  }
  return {
    seoulSubwayApi: {
      getStationTimetable: jest.fn().mockResolvedValue([]),
    },
    TimetableUnsupportedOnWebError,
  };
});

jest.mock('@/services/data/stationsDataService', () => ({
  findStationCdByNameAndLine: jest.fn().mockReturnValue('0222'),
}));

describe('useTrainSchedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findStationCdByNameAndLine as jest.Mock).mockReturnValue('0222');
    (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue([]);
  });

  it('should initialize with empty state', async () => {
    const { result } = renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '2' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.schedules).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when disabled', () => {
    renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '2', enabled: false })
    );

    expect(seoulSubwayApi.getStationTimetable).not.toHaveBeenCalled();
  });

  it('should not fetch without stationName', () => {
    renderHook(() =>
      useTrainSchedule({ stationName: '', lineNumber: '2' })
    );

    expect(seoulSubwayApi.getStationTimetable).not.toHaveBeenCalled();
  });

  it('should not fetch without lineNumber', () => {
    renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '' })
    );

    expect(seoulSubwayApi.getStationTimetable).not.toHaveBeenCalled();
  });

  it('should fetch and convert timetable data', async () => {
    // Pin system time before the mock arrival (06:00) so upcomingTrains is
    // deterministic regardless of when the test runs (CI usually runs UTC
    // past 06:00 → flaky without a fixed clock).
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 3, 27, 5, 0, 0));

    const mockData = [
      {
        TRAIN_NO: '2001',
        ARRIVETIME: '06:00:00',
        LEFTTIME: '06:00:30',
        DEST_STATION_NM: '성수',
        ORIGIN_STATION_NM: '신도림',
        STATION_CD: '0222',
        LINE_NUM: '02호선',
        INOUT_TAG: '1',
        FL_FLAG: '0',
        EXPRESS_YN: 'N',
      },
    ];

    (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '2' })
    );

    await waitFor(() => {
      expect(result.current.schedules).toHaveLength(1);
    });

    expect(result.current.schedules[0]).toEqual(
      expect.objectContaining({
        trainNumber: '2001',
        arrivalTime: '06:00:00',
        departureTime: '06:00:30',
        destinationName: '성수',
        originStationName: '신도림',
      })
    );
    expect(result.current.upcomingTrains).toHaveLength(1);

    jest.useRealTimers();
  });

  it('should handle station not found', async () => {
    (findStationCdByNameAndLine as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() =>
      useTrainSchedule({ stationName: '없는역', lineNumber: '2' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain('역 정보를 찾을 수 없습니다');
    expect(result.current.schedules).toEqual([]);
  });

  it('should handle API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (seoulSubwayApi.getStationTimetable as jest.Mock).mockRejectedValue(
      new Error('API error')
    );

    const { result } = renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '2' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('시간표를 불러오는데 실패했습니다.');
    expect(result.current.schedules).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('should refresh data', async () => {
    (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '2' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(seoulSubwayApi.getStationTimetable).toHaveBeenCalledTimes(2);
  });

  it('should use direction parameter', async () => {
    (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useTrainSchedule({ stationName: '강남', lineNumber: '2', direction: '2' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(seoulSubwayApi.getStationTimetable).toHaveBeenCalledWith(
      '0222',
      expect.any(String),
      '2'
    );
  });

  describe('C1 — midnight rollover (regression)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('includes early-morning trains as upcoming when current time is late night', async () => {
      // Current time: 23:55 — Seoul subway runs until ~01:00, so 00:05/00:30
      // last trains must still appear as "upcoming".
      jest.setSystemTime(new Date(2026, 3, 27, 23, 55, 0));

      const mockData = [
        { TRAIN_NO: 'L1', ARRIVETIME: '23:50:00', LEFTTIME: '23:50:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
        { TRAIN_NO: 'L2', ARRIVETIME: '00:05:00', LEFTTIME: '00:05:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
        { TRAIN_NO: 'L3', ARRIVETIME: '00:30:00', LEFTTIME: '00:30:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
      ];
      (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useTrainSchedule({ stationName: '강남', lineNumber: '2' })
      );

      await waitFor(() => {
        expect(result.current.schedules).toHaveLength(3);
      });

      // 23:50 already passed; 00:05 and 00:30 must show as upcoming via carry-over
      const upcomingNumbers = result.current.upcomingTrains.map((t) => t.trainNumber);
      expect(upcomingNumbers).toContain('L2');
      expect(upcomingNumbers).toContain('L3');
      expect(upcomingNumbers).not.toContain('L1');
    });

    it('does NOT carry over early morning runs when it is afternoon', async () => {
      // Current time: 14:00 — no carry-over expected. 00:05 train is for tonight,
      // not "upcoming next" from a 14:00 perspective.
      jest.setSystemTime(new Date(2026, 3, 27, 14, 0, 0));

      const mockData = [
        { TRAIN_NO: 'M1', ARRIVETIME: '00:05:00', LEFTTIME: '00:05:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
        { TRAIN_NO: 'M2', ARRIVETIME: '15:30:00', LEFTTIME: '15:30:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
      ];
      (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useTrainSchedule({ stationName: '강남', lineNumber: '2' })
      );

      await waitFor(() => {
        expect(result.current.schedules).toHaveLength(2);
      });

      const upcomingNumbers = result.current.upcomingTrains.map((t) => t.trainNumber);
      expect(upcomingNumbers).toEqual(['M2']);
    });
  });

  describe('B1 — non-padded time comparison (regression)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Set current time to 14:00:00 on a regular weekday (2026-04-27 Mon)
      jest.setSystemTime(new Date(2026, 3, 27, 14, 0, 0));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('treats non-padded "9:35:00" as past noon, not future evening', async () => {
      const mockData = [
        // Two non-padded morning entries (9:35, 9:40) and one padded afternoon entry (15:30)
        { TRAIN_NO: 'A', ARRIVETIME: '9:35:00', LEFTTIME: '9:35:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
        { TRAIN_NO: 'B', ARRIVETIME: '9:40:00', LEFTTIME: '9:40:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
        { TRAIN_NO: 'C', ARRIVETIME: '15:30:00', LEFTTIME: '15:30:30', DEST_STATION_NM: 'X', ORIGIN_STATION_NM: 'Y',
          STATION_CD: '0222', LINE_NUM: '02호선', INOUT_TAG: '1', FL_FLAG: '0', EXPRESS_YN: 'N' },
      ];
      (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue(mockData);

      const { result } = renderHook(() =>
        useTrainSchedule({ stationName: '강남', lineNumber: '2' })
      );

      await waitFor(() => {
        expect(result.current.schedules).toHaveLength(3);
      });

      // At 14:00, only the 15:30 train should be upcoming.
      // Old buggy lexicographic compare would have included "9:35:00" too
      // (because '9' > '1' makes "9:35:00" > "14:00:00" in string compare).
      expect(result.current.upcomingTrains).toHaveLength(1);
      expect(result.current.upcomingTrains[0]?.trainNumber).toBe('C');
    });
  });

  describe('B4 — web platform timetable error (regression)', () => {
    it('shows friendly mobile-only message when web error is thrown', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (seoulSubwayApi.getStationTimetable as jest.Mock).mockRejectedValue(
        new TimetableUnsupportedOnWebError()
      );

      const { result } = renderHook(() =>
        useTrainSchedule({ stationName: '강남', lineNumber: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('시간표는 모바일 앱에서 확인할 수 있습니다.');
      consoleSpy.mockRestore();
    });
  });

  describe('B2 — Korean holiday weekTag (regression)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('uses weekTag=3 (holiday) on 2026-05-05 어린이날 (Tuesday weekday)', async () => {
      jest.useFakeTimers();
      // Children's Day 2026 falls on Tuesday — a normal getDay() check
      // would return 2 (weekday) and pick weekTag '1', causing wrong schedule.
      jest.setSystemTime(new Date(2026, 4, 5, 10, 0, 0));

      (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useTrainSchedule({ stationName: '강남', lineNumber: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(seoulSubwayApi.getStationTimetable).toHaveBeenCalledWith(
        '0222',
        '3', // weekTag must be '3' (holiday), not '1' (weekday)
        expect.any(String)
      );
    });

    it('uses weekTag=1 on a regular Tuesday', async () => {
      jest.useFakeTimers();
      // 2026-04-28 is a regular Tuesday (no holiday)
      jest.setSystemTime(new Date(2026, 3, 28, 10, 0, 0));

      (seoulSubwayApi.getStationTimetable as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useTrainSchedule({ stationName: '강남', lineNumber: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(seoulSubwayApi.getStationTimetable).toHaveBeenCalledWith(
        '0222',
        '1',
        expect.any(String)
      );
    });
  });
});
