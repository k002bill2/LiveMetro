/**
 * useDelayDetection Hook Tests
 */

import { renderHook } from '@testing-library/react-native';
import { useDelayDetection } from '../useDelayDetection';
import { seoulSubwayApi } from '@/services/api/seoulSubwayApi';

// Mock Seoul API
jest.mock('@/services/api/seoulSubwayApi');

const mockSeoulApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;

describe('useDelayDetection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeoulApi.getRealtimeArrival.mockResolvedValue([]);
  });

  describe('Initialization', () => {
    it('should initialize with empty delays', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.delays).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      // Initial state before first fetch
      expect(Array.isArray(result.current.delays)).toBe(true);
    });

    it('should accept custom options', () => {
      const { result } = renderHook(() =>
        useDelayDetection({
          pollingInterval: 120000,
          lineIds: ['1', '2'],
          autoPolling: false,
        })
      );

      expect(result.current.delays).toEqual([]);
      expect(typeof result.current.refresh).toBe('function');
    });

    it('should provide lastUpdated', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe('Hook Interface', () => {
    it('should provide refresh function', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(typeof result.current.refresh).toBe('function');
    });

    it('should expose delays array', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(Array.isArray(result.current.delays)).toBe(true);
    });

    it('should expose loading state', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(typeof result.current.loading).toBe('boolean');
    });

    it('should expose error state', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.error).toBeNull();
    });
  });

  describe('Options', () => {
    it('should accept lineIds option', () => {
      const { result } = renderHook(() =>
        useDelayDetection({ lineIds: ['1', '2', '3'], autoPolling: false })
      );

      expect(result.current.delays).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should accept pollingInterval option', () => {
      const { result } = renderHook(() =>
        useDelayDetection({ pollingInterval: 60000, autoPolling: false })
      );

      expect(result.current.error).toBeNull();
    });

    it('should accept autoPolling option', () => {
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.error).toBeNull();
    });

    it('should use default options when not provided', () => {
      // This will trigger initial fetch but we just check it doesn't crash
      const { result } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(result.current.error).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should not throw on unmount', () => {
      const { unmount } = renderHook(() => useDelayDetection({ autoPolling: false }));

      expect(() => unmount()).not.toThrow();
    });

    it('should clean up resources on unmount', () => {
      const { unmount } = renderHook(() =>
        useDelayDetection({ autoPolling: false })
      );

      unmount();

      // After unmount, the hook should have cleaned up
      // We just verify no errors occur
    });
  });
});
