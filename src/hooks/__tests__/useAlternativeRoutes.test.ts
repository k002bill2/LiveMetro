/**
 * useAlternativeRoutes Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { routeService } from '@services/route';
import {
  useAlternativeRoutes,
  getDelayReason,
  formatRouteDisplay,
  getTransferStations,
} from '../useAlternativeRoutes';

jest.mock('@services/route', () => ({
  routeService: {
    calculateRoute: jest.fn(),
    findAlternativeRoutes: jest.fn(),
  },
}));

describe('useAlternativeRoutes', () => {
  const mockRoute = {
    lineIds: ['2', '3'],
    totalTime: 30,
    segments: [
      { fromStationName: '강남', toStationName: '교대', isTransfer: false },
      { fromStationName: '교대', toStationName: '남부터미널', isTransfer: true },
    ],
  };

  const mockAlternatives = [
    { id: 'alt-1', timeDifference: 5 },
    { id: 'alt-2', timeDifference: 10 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (routeService.calculateRoute as jest.Mock).mockReturnValue(mockRoute);
    (routeService.findAlternativeRoutes as jest.Mock).mockReturnValue(mockAlternatives);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAlternativeRoutes());

    expect(result.current.originalRoute).toBeNull();
    expect(result.current.alternatives).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasAffectedRoute).toBe(false);
  });

  describe('calculate', () => {
    it('should calculate route and alternatives when delays exist', async () => {
      const delays = [{ lineId: '2', delayMinutes: 10 }];

      const { result } = renderHook(() =>
        useAlternativeRoutes({ delays: delays as never[] })
      );

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      expect(routeService.calculateRoute).toHaveBeenCalledWith('s1', 's2');
      expect(routeService.findAlternativeRoutes).toHaveBeenCalledWith(
        's1', 's2', ['2'], 'DELAY', expect.anything()
      );
      expect(result.current.originalRoute).toEqual(mockRoute);
      expect(result.current.alternatives).toHaveLength(2);
    });

    it('should not calculate alternatives when route not affected', async () => {
      const delays = [{ lineId: '9', delayMinutes: 10 }];

      const { result } = renderHook(() =>
        useAlternativeRoutes({ delays: delays as never[] })
      );

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      expect(routeService.findAlternativeRoutes).not.toHaveBeenCalled();
      expect(result.current.alternatives).toEqual([]);
    });

    it('should validate input - empty stations', async () => {
      const { result } = renderHook(() => useAlternativeRoutes());

      await act(async () => {
        await result.current.calculate('', 's2');
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should validate input - same stations', async () => {
      const { result } = renderHook(() => useAlternativeRoutes());

      await act(async () => {
        await result.current.calculate('s1', 's1');
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle no route found', async () => {
      (routeService.calculateRoute as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useAlternativeRoutes());

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.originalRoute).toBeNull();
    });

    it('should handle calculate error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (routeService.calculateRoute as jest.Mock).mockImplementation(() => {
        throw new Error('Route error');
      });

      const { result } = renderHook(() => useAlternativeRoutes());

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      expect(result.current.error).toBeTruthy();
      consoleSpy.mockRestore();
    });

    it('should limit alternatives to maxAlternatives', async () => {
      const manyAlts = Array.from({ length: 10 }, (_, i) => ({
        id: `alt-${i}`,
        timeDifference: i * 5,
      }));
      (routeService.findAlternativeRoutes as jest.Mock).mockReturnValue(manyAlts);
      const delays = [{ lineId: '2', delayMinutes: 10 }];

      const { result } = renderHook(() =>
        useAlternativeRoutes({ delays: delays as never[], maxAlternatives: 2 })
      );

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      expect(result.current.alternatives).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all state', async () => {
      const delays = [{ lineId: '2' }];

      const { result } = renderHook(() =>
        useAlternativeRoutes({ delays: delays as never[] })
      );

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.originalRoute).toBeNull();
      expect(result.current.alternatives).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('hasAffectedRoute', () => {
    it('should return true when route uses delayed line', async () => {
      const delays = [{ lineId: '2', delayMinutes: 10 }];

      const { result } = renderHook(() =>
        useAlternativeRoutes({ delays: delays as never[] })
      );

      await act(async () => {
        await result.current.calculate('s1', 's2');
      });

      expect(result.current.hasAffectedRoute).toBe(true);
      expect(result.current.affectedLineIds).toContain('2');
    });
  });
});

describe('getDelayReason', () => {
  it('should return SUSPENSION for 중단', () => {
    expect(getDelayReason({ lineId: '2', reason: '운행 중단' } as never)).toBe('SUSPENSION');
  });

  it('should return CONGESTION for 혼잡', () => {
    expect(getDelayReason({ lineId: '2', reason: '혼잡 지연' } as never)).toBe('CONGESTION');
  });

  it('should return DELAY by default', () => {
    expect(getDelayReason({ lineId: '2', reason: '신호 장애' } as never)).toBe('DELAY');
  });

  it('should handle undefined reason', () => {
    expect(getDelayReason({ lineId: '2' } as never)).toBe('DELAY');
  });
});

describe('formatRouteDisplay', () => {
  it('should format route display', () => {
    const route = {
      segments: [
        { fromStationName: '강남', toStationName: '교대' },
        { fromStationName: '교대', toStationName: '서초' },
      ],
    };
    expect(formatRouteDisplay(route as never)).toBe('강남 → 서초');
  });

  it('should return empty for no segments', () => {
    expect(formatRouteDisplay({ segments: [] } as never)).toBe('');
  });
});

describe('getTransferStations', () => {
  it('should return transfer stations', () => {
    const route = {
      segments: [
        { toStationName: '교대', isTransfer: true },
        { toStationName: '강남', isTransfer: false },
        { toStationName: '잠실', isTransfer: true },
      ],
    };
    expect(getTransferStations(route as never)).toEqual(['교대', '잠실']);
  });
});
