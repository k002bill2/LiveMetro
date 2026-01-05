/**
 * useStationNavigation Hook Tests
 * Tests for navigation between stations in a subway line
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useStationNavigation } from '../useStationNavigation';
import { trainService } from '../../services/train/trainService';
import { Station } from '../../models/train';

// Mock trainService
jest.mock('../../services/train/trainService');

const mockTrainService = trainService as jest.Mocked<typeof trainService>;

const createMockStation = (id: string, name: string, lineId: string): Station => ({
  id,
  name,
  nameEn: `${name} Station`,
  lineId,
  lineName: `${lineId}호선`,
  lineColor: '#00A86B',
  coordinates: { latitude: 37.5, longitude: 127.0 },
  transfers: [],
  address: `${name} 주소`,
  facilities: [],
});

const createMockStations = (): Station[] => [
  createMockStation('station-1', '시청', '2'),
  createMockStation('station-2', '을지로입구', '2'),
  createMockStation('station-3', '을지로3가', '2'),
  createMockStation('station-4', '을지로4가', '2'),
];

describe('useStationNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrainService.getStationsByLine.mockResolvedValue(createMockStations());
  });

  describe('Initialization', () => {
    it('should load stations on mount', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockTrainService.getStationsByLine).toHaveBeenCalledWith('2');
      expect(result.current.allStations).toHaveLength(4);
    });

    it('should set initial index from initialStationId', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-3' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(2);
      expect(result.current.currentStation?.name).toBe('을지로3가');
    });

    it('should default to index 0 when no initialStationId', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.currentStation?.name).toBe('시청');
    });

    it('should default to index 0 when initialStationId not found', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'invalid-station' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Navigation', () => {
    it('goToPrevious should decrement index', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(1);

      act(() => {
        result.current.goToPrevious();
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('goToPrevious should not go below 0', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(0);

      act(() => {
        result.current.goToPrevious();
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('goToNext should increment index', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentIndex).toBe(1);
    });

    it('goToNext should not exceed stations length', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-4' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(3);

      act(() => {
        result.current.goToNext();
      });

      expect(result.current.currentIndex).toBe(3);
    });

    it('goToStation should set correct index for valid stationId', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.goToStation('station-3');
      });

      expect(result.current.currentIndex).toBe(2);
      expect(result.current.currentStation?.name).toBe('을지로3가');
    });

    it('goToStation should not change for invalid stationId', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentIndex).toBe(0);

      act(() => {
        result.current.goToStation('invalid-station');
      });

      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('Derived Values', () => {
    it('currentStation should reflect current index', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.currentStation?.name).toBe('을지로입구');
    });

    it('previousStation should be null at index 0', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.previousStation).toBeNull();
    });

    it('previousStation should return correct station', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.previousStation?.name).toBe('시청');
    });

    it('nextStation should be null at last index', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-4' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nextStation).toBeNull();
    });

    it('nextStation should return correct station', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nextStation?.name).toBe('을지로입구');
    });

    it('canGoPrevious should be false at index 0', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canGoPrevious).toBe(false);
    });

    it('canGoPrevious should be true when not at first', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canGoPrevious).toBe(true);
    });

    it('canGoNext should be false at last index', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2', initialStationId: 'station-4' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canGoNext).toBe(false);
    });

    it('canGoNext should be true when not at last', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canGoNext).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty stations array', async () => {
      mockTrainService.getStationsByLine.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('이 노선에 역 정보가 없습니다.');
    });

    it('should set error when line has no stations', async () => {
      mockTrainService.getStationsByLine.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('역 정보를 불러오는데 실패했습니다.');
    });
  });

  describe('Refresh', () => {
    it('refresh should reload stations', async () => {
      const { result } = renderHook(() =>
        useStationNavigation({ lineId: '2' })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockTrainService.getStationsByLine.mockClear();

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockTrainService.getStationsByLine).toHaveBeenCalled();
    });
  });
});
