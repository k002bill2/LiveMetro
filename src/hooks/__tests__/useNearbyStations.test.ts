/**
 * useNearbyStations Hook Tests
 * Tests for finding and managing nearby subway stations based on user location
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNearbyStations, useStationDistance } from '../useNearbyStations';
import { locationService, NearbyStation, LocationCoordinates } from '../../services/location/locationService';
import { trainService } from '../../services/train/trainService';
import { Station, SubwayLine } from '../../models/train';

// Import useLocation mock
import { useLocation } from '../useLocation';

// Mock dependencies
jest.mock('../../services/location/locationService');
jest.mock('../../services/train/trainService');
jest.mock('../useLocation');

const mockLocationService = locationService as jest.Mocked<typeof locationService>;
const mockTrainService = trainService as jest.Mocked<typeof trainService>;
const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

const createMockLocation = (): LocationCoordinates => ({
  latitude: 37.5665,
  longitude: 126.978,
  accuracy: 10,
});

const createMockStation = (id: string, name: string, lineId: string): Station => ({
  id,
  name,
  nameEn: `${name} Station`,
  lineId,
  lineName: `${lineId}호선`,
  lineColor: '#00A86B',
  coordinates: { latitude: 37.5 + Math.random() * 0.1, longitude: 127.0 + Math.random() * 0.1 },
  transfers: [],
  address: `${name} 주소`,
  facilities: [],
});

const createMockNearbyStation = (id: string, name: string, distance: number): NearbyStation => ({
  ...createMockStation(id, name, '2'),
  distance,
  bearing: 45,
});

const createMockSubwayLines = (): SubwayLine[] => [
  { id: '1', name: '1호선', color: '#0052A4', stations: [] },
  { id: '2', name: '2호선', color: '#00A84D', stations: [] },
];

describe('useNearbyStations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock for useLocation
    mockUseLocation.mockReturnValue({
      location: createMockLocation(),
      loading: false,
      error: null,
      hasPermission: true,
      isTracking: false,
      accuracy: 10,
      getCurrentLocation: jest.fn(),
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      checkLocationServices: jest.fn(),
      initializeLocation: jest.fn(),
    });

    // Default mock for trainService
    mockTrainService.getSubwayLines.mockResolvedValue(createMockSubwayLines());
    mockTrainService.getStationsByLine.mockResolvedValue([
      createMockStation('station-1', '강남역', '2'),
      createMockStation('station-2', '역삼역', '2'),
      createMockStation('station-3', '선릉역', '2'),
    ]);

    // Default mock for locationService
    mockLocationService.findNearbyStations.mockReturnValue([
      createMockNearbyStation('station-1', '강남역', 100),
      createMockNearbyStation('station-2', '역삼역', 300),
      createMockNearbyStation('station-3', '선릉역', 800),
    ]);
    mockLocationService.getDistanceCategory.mockReturnValue('close');
    mockLocationService.formatDistance.mockReturnValue('100m');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with loading true', () => {
      const { result } = renderHook(() => useNearbyStations());

      expect(result.current.loading).toBe(true);
    });

    it('should load nearby stations when location is available', async () => {
      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nearbyStations).toHaveLength(3);
    });

    it('should set closestStation to first nearby station', async () => {
      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.closestStation?.name).toBe('강남역');
    });

    it('should load all stations from all lines', async () => {
      renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(mockTrainService.getSubwayLines).toHaveBeenCalled();
      });

      expect(mockTrainService.getStationsByLine).toHaveBeenCalledWith('1');
      expect(mockTrainService.getStationsByLine).toHaveBeenCalledWith('2');
    });
  });

  describe('Mock Location', () => {
    it('should use mockLocation when provided', async () => {
      const mockLocation = { latitude: 37.5, longitude: 127.0 };

      const { result } = renderHook(() =>
        useNearbyStations({ mockLocation })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockLocationService.findNearbyStations).toHaveBeenCalledWith(
        mockLocation,
        expect.any(Array),
        expect.any(Number)
      );
    });
  });

  describe('Options', () => {
    it('should use custom radius', async () => {
      renderHook(() => useNearbyStations({ radius: 500 }));

      await waitFor(() => {
        expect(mockLocationService.findNearbyStations).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Array),
          500
        );
      });
    });

    it('should limit results to maxStations', async () => {
      mockLocationService.findNearbyStations.mockReturnValue([
        createMockNearbyStation('1', '역1', 100),
        createMockNearbyStation('2', '역2', 200),
        createMockNearbyStation('3', '역3', 300),
        createMockNearbyStation('4', '역4', 400),
        createMockNearbyStation('5', '역5', 500),
      ]);

      const { result } = renderHook(() =>
        useNearbyStations({ maxStations: 3 })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.nearbyStations).toHaveLength(3);
    });

    it('should call onStationsFound callback', async () => {
      const onStationsFound = jest.fn();

      renderHook(() => useNearbyStations({ onStationsFound }));

      await waitFor(() => {
        expect(onStationsFound).toHaveBeenCalled();
      });

      expect(onStationsFound).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should call onClosestStationChanged when closest changes', async () => {
      const onClosestStationChanged = jest.fn();

      renderHook(() =>
        useNearbyStations({ onClosestStationChanged })
      );

      await waitFor(() => {
        expect(onClosestStationChanged).toHaveBeenCalled();
      });

      expect(onClosestStationChanged).toHaveBeenCalledWith(
        expect.objectContaining({ name: '강남역' })
      );
    });
  });

  describe('Refresh', () => {
    it('refresh should reset throttle and update', async () => {
      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockLocationService.findNearbyStations.mockClear();

      await act(async () => {
        result.current.refresh();
      });

      expect(mockLocationService.findNearbyStations).toHaveBeenCalled();
    });
  });

  describe('Throttling', () => {
    it('should throttle updates based on minUpdateInterval', async () => {
      const { result } = renderHook(() =>
        useNearbyStations({ minUpdateInterval: 10000 })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = mockLocationService.findNearbyStations.mock.calls.length;

      // Try to update within throttle window
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Should not have called again (within throttle window)
      expect(mockLocationService.findNearbyStations.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Derived Values', () => {
    it('getStationsByCategory should categorize stations', async () => {
      mockLocationService.getDistanceCategory
        .mockReturnValueOnce('very-close')
        .mockReturnValueOnce('close')
        .mockReturnValueOnce('nearby');

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const categories = result.current.getStationsByCategory;
      expect(categories['very-close']).toHaveLength(1);
      expect(categories['close']).toHaveLength(1);
      expect(categories['nearby']).toHaveLength(1);
    });

    it('isAtStation should be true when within 100m', async () => {
      mockLocationService.findNearbyStations.mockReturnValue([
        createMockNearbyStation('station-1', '강남역', 50), // Within 100m
      ]);

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAtStation).toBe(true);
    });

    it('isAtStation should be false when all stations > 100m', async () => {
      mockLocationService.findNearbyStations.mockReturnValue([
        createMockNearbyStation('station-1', '강남역', 150),
        createMockNearbyStation('station-2', '역삼역', 300),
      ]);

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAtStation).toBe(false);
    });

    it('getFormattedStations should include formatted distance', async () => {
      mockLocationService.formatDistance.mockReturnValue('100m');
      mockLocationService.getDistanceCategory.mockReturnValue('very-close');

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const formattedStations = result.current.getFormattedStations;
      expect(formattedStations[0]).toHaveProperty('formattedDistance', '100m');
      expect(formattedStations[0]).toHaveProperty('distanceCategory', 'very-close');
    });

    it('hasLocation should reflect location availability', async () => {
      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasLocation).toBe(true);
    });

    it('searchRadius should reflect radius option', () => {
      const { result } = renderHook(() => useNearbyStations({ radius: 2000 }));

      expect(result.current.searchRadius).toBe(2000);
    });
  });

  describe('Error Handling', () => {
    it('should handle station loading error', async () => {
      mockTrainService.getSubwayLines.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.error).toContain('역 정보');
      });
    });

    it('should handle location error from useLocation', async () => {
      mockUseLocation.mockReturnValue({
        location: null,
        loading: false,
        error: '위치 권한 없음',
        hasPermission: false,
        isTracking: false,
        accuracy: null,
        getCurrentLocation: jest.fn(),
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        checkLocationServices: jest.fn(),
        initializeLocation: jest.fn(),
      });

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.error).toBe('위치 권한 없음');
      });
    });

    it('should handle findNearbyStations error', async () => {
      mockLocationService.findNearbyStations.mockImplementation(() => {
        throw new Error('Find error');
      });

      const { result } = renderHook(() => useNearbyStations());

      await waitFor(() => {
        expect(result.current.error).toContain('주변 역');
      });
    });
  });

  describe('No Location', () => {
    it('should not find stations without location', async () => {
      mockUseLocation.mockReturnValue({
        location: null,
        loading: false,
        error: null,
        hasPermission: true,
        isTracking: false,
        accuracy: null,
        getCurrentLocation: jest.fn(),
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        checkLocationServices: jest.fn(),
        initializeLocation: jest.fn(),
      });

      const { result } = renderHook(() => useNearbyStations());

      // When no location, findNearbyStations is not called, so we verify by checking service not called with location
      await waitFor(() => {
        expect(result.current.hasLocation).toBe(false);
      });

      // Should not have called findNearbyStations with location
      expect(mockLocationService.findNearbyStations).not.toHaveBeenCalled();
    });
  });
});

describe('useStationDistance', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLocation.mockReturnValue({
      location: createMockLocation(),
      loading: false,
      error: null,
      hasPermission: true,
      isTracking: false,
      accuracy: 10,
      getCurrentLocation: jest.fn(),
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
      checkLocationServices: jest.fn(),
      initializeLocation: jest.fn(),
    });

    mockTrainService.searchStations.mockResolvedValue([
      createMockStation('station-1', '강남역', '2'),
    ]);

    mockLocationService.calculateDistance.mockReturnValue(500);
    mockLocationService.calculateBearing.mockReturnValue(90);
    mockLocationService.formatDistance.mockReturnValue('500m');
    mockLocationService.getDistanceCategory.mockReturnValue('close');
  });

  describe('Find Station', () => {
    it('should find station by name', async () => {
      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.station).toBeTruthy();
      expect(result.current.station?.name).toBe('강남역');
    });

    it('should calculate distance to station', async () => {
      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockLocationService.calculateDistance).toHaveBeenCalled();
      expect(result.current.station?.distance).toBe(500);
    });

    it('should calculate bearing to station', async () => {
      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockLocationService.calculateBearing).toHaveBeenCalled();
      expect(result.current.station?.bearing).toBe(90);
    });

    it('should provide formatted distance', async () => {
      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.formattedDistance).toBe('500m');
    });

    it('should provide distance category', async () => {
      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.distanceCategory).toBe('close');
    });
  });

  describe('Error Handling', () => {
    it('should set error when station not found', async () => {
      mockTrainService.searchStations.mockResolvedValue([]);

      const { result } = renderHook(() => useStationDistance('없는역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('없는역');
    });

    it('should handle search error', async () => {
      mockTrainService.searchStations.mockRejectedValue(new Error('Search failed'));

      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should not search with empty station name', async () => {
      const { result } = renderHook(() => useStationDistance(''));

      expect(result.current.station).toBeNull();
      expect(mockTrainService.searchStations).not.toHaveBeenCalled();
    });

    it('should not search without location', async () => {
      mockUseLocation.mockReturnValue({
        location: null,
        loading: false,
        error: null,
        hasPermission: true,
        isTracking: false,
        accuracy: null,
        getCurrentLocation: jest.fn(),
        startTracking: jest.fn(),
        stopTracking: jest.fn(),
        checkLocationServices: jest.fn(),
        initializeLocation: jest.fn(),
      });

      const { result } = renderHook(() => useStationDistance('강남역'));

      expect(result.current.station).toBeNull();
      expect(mockTrainService.searchStations).not.toHaveBeenCalled();
    });
  });

  describe('Refresh', () => {
    it('refresh should find station again', async () => {
      const { result } = renderHook(() => useStationDistance('강남역'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockTrainService.searchStations.mockClear();

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockTrainService.searchStations).toHaveBeenCalled();
    });
  });
});
