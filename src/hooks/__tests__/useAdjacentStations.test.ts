/**
 * useAdjacentStations Hook Tests
 * Tests for finding previous and next stations in a subway line
 */

import { renderHook } from '@testing-library/react-native';
import { useAdjacentStations } from '../useAdjacentStations';
import { getLocalStationsByLine } from '@/services/data/stationsDataService';
import { Station } from '@/models/train';

// Mock the stationsDataService
jest.mock('@/services/data/stationsDataService', () => ({
  getLocalStationsByLine: jest.fn(),
}));

const mockGetLocalStationsByLine = getLocalStationsByLine as jest.MockedFunction<
  typeof getLocalStationsByLine
>;

// Create mock stations helper
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

describe('useAdjacentStations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return null for both stations when line has no stations', () => {
      mockGetLocalStationsByLine.mockReturnValue([]);

      const { result } = renderHook(() => useAdjacentStations('강남역', '2'));

      expect(result.current.prevStation).toBeNull();
      expect(result.current.nextStation).toBeNull();
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should return null when station not found in line', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
        createMockStation('3', '을지로3가', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('강남역', '2'));

      expect(result.current.prevStation).toBeNull();
      expect(result.current.nextStation).toBeNull();
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should return correct prev/next for middle station', () => {
      const mockStations = [
        createMockStation('1', '시청', '3'),
        createMockStation('2', '을지로3가', '3'),
        createMockStation('3', '충무로', '3'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('을지로3가', '3'));

      expect(result.current.prevStation?.name).toBe('시청');
      expect(result.current.nextStation?.name).toBe('충무로');
      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(true);
    });

    it('should return null prev for first station (non-circular)', () => {
      const mockStations = [
        createMockStation('1', '시청', '3'),
        createMockStation('2', '을지로3가', '3'),
        createMockStation('3', '충무로', '3'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('시청', '3'));

      expect(result.current.prevStation).toBeNull();
      expect(result.current.nextStation?.name).toBe('을지로3가');
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(true);
    });

    it('should return null next for last station (non-circular)', () => {
      const mockStations = [
        createMockStation('1', '시청', '3'),
        createMockStation('2', '을지로3가', '3'),
        createMockStation('3', '충무로', '3'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('충무로', '3'));

      expect(result.current.prevStation?.name).toBe('을지로3가');
      expect(result.current.nextStation).toBeNull();
      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(false);
    });
  });

  describe('Circular Line (Line 2) Handling', () => {
    it('should wrap around for first station (prev = last station)', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
        createMockStation('3', '을지로3가', '2'),
        createMockStation('4', '을지로4가', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('시청', '2'));

      expect(result.current.prevStation?.name).toBe('을지로4가');
      expect(result.current.nextStation?.name).toBe('을지로입구');
      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(true);
    });

    it('should wrap around for last station (next = first station)', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
        createMockStation('3', '을지로3가', '2'),
        createMockStation('4', '을지로4가', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('을지로4가', '2'));

      expect(result.current.prevStation?.name).toBe('을지로3가');
      expect(result.current.nextStation?.name).toBe('시청');
      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(true);
    });

    it('should correctly identify line 2 as circular', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      // First station should have prev (circular)
      const { result: firstResult } = renderHook(() =>
        useAdjacentStations('시청', '2')
      );
      expect(firstResult.current.hasPrev).toBe(true);

      // Last station should have next (circular)
      const { result: lastResult } = renderHook(() =>
        useAdjacentStations('을지로입구', '2')
      );
      expect(lastResult.current.hasNext).toBe(true);
    });

    it('should not wrap around for non-circular lines', () => {
      const mockStations = [
        createMockStation('1', '시청', '1'),
        createMockStation('2', '종각', '1'),
        createMockStation('3', '종로3가', '1'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      // Line 1 first station should NOT have prev
      const { result: firstResult } = renderHook(() =>
        useAdjacentStations('시청', '1')
      );
      expect(firstResult.current.hasPrev).toBe(false);
      expect(firstResult.current.prevStation).toBeNull();

      // Line 1 last station should NOT have next
      const { result: lastResult } = renderHook(() =>
        useAdjacentStations('종로3가', '1')
      );
      expect(lastResult.current.hasNext).toBe(false);
      expect(lastResult.current.nextStation).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty stationName', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('', '2'));

      expect(result.current.prevStation).toBeNull();
      expect(result.current.nextStation).toBeNull();
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should handle empty lineId', () => {
      mockGetLocalStationsByLine.mockReturnValue([]);

      const { result } = renderHook(() => useAdjacentStations('강남역', ''));

      expect(result.current.prevStation).toBeNull();
      expect(result.current.nextStation).toBeNull();
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });

    it('should handle single station line', () => {
      const mockStations = [createMockStation('1', '시청', '2')];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('시청', '2'));

      // Single station in circular line - wraps to itself
      expect(result.current.prevStation?.name).toBe('시청');
      expect(result.current.nextStation?.name).toBe('시청');
      expect(result.current.hasPrev).toBe(true);
      expect(result.current.hasNext).toBe(true);
    });

    it('should handle single station on non-circular line', () => {
      const mockStations = [createMockStation('1', '시청', '3')];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result } = renderHook(() => useAdjacentStations('시청', '3'));

      expect(result.current.prevStation).toBeNull();
      expect(result.current.nextStation).toBeNull();
      expect(result.current.hasPrev).toBe(false);
      expect(result.current.hasNext).toBe(false);
    });
  });

  describe('Memoization', () => {
    it('should call getLocalStationsByLine with correct lineId', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      renderHook(() => useAdjacentStations('시청', '2'));

      expect(mockGetLocalStationsByLine).toHaveBeenCalledWith('2');
    });

    it('should memoize result based on stationName and lineId', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result, rerender } = renderHook(
        ({ stationName, lineId }) => useAdjacentStations(stationName, lineId),
        { initialProps: { stationName: '시청', lineId: '2' } }
      );

      const firstResult = result.current;

      // Rerender with same props - should return memoized value
      rerender({ stationName: '시청', lineId: '2' });

      expect(result.current).toEqual(firstResult);
    });

    it('should recalculate when stationName changes', () => {
      const mockStations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
        createMockStation('3', '을지로3가', '2'),
      ];
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const { result, rerender } = renderHook(
        ({ stationName, lineId }) => useAdjacentStations(stationName, lineId),
        { initialProps: { stationName: '시청', lineId: '2' } }
      );

      expect(result.current.nextStation?.name).toBe('을지로입구');

      // Change stationName
      rerender({ stationName: '을지로입구', lineId: '2' });

      expect(result.current.nextStation?.name).toBe('을지로3가');
    });

    it('should recalculate when lineId changes', () => {
      const line2Stations = [
        createMockStation('1', '시청', '2'),
        createMockStation('2', '을지로입구', '2'),
      ];
      const line3Stations = [
        createMockStation('1', '시청', '3'),
        createMockStation('2', '충무로', '3'),
      ];

      mockGetLocalStationsByLine.mockImplementation((lineId) => {
        if (lineId === '2') return line2Stations;
        if (lineId === '3') return line3Stations;
        return [];
      });

      const { result, rerender } = renderHook(
        ({ stationName, lineId }) => useAdjacentStations(stationName, lineId),
        { initialProps: { stationName: '시청', lineId: '2' } }
      );

      // Line 2 is circular
      expect(result.current.hasPrev).toBe(true);

      // Change to line 3 (non-circular)
      rerender({ stationName: '시청', lineId: '3' });

      expect(result.current.hasPrev).toBe(false);
    });
  });
});
