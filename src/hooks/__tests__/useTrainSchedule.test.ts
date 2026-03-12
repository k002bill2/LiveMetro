/**
 * useTrainSchedule Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTrainSchedule } from '../useTrainSchedule';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';
import { findStationCdByNameAndLine } from '@/services/data/stationsDataService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getStationTimetable: jest.fn().mockResolvedValue([]),
  },
}));

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
});
