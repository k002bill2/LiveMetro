/**
 * useFirestoreCommuteLeg tests — the generalized morning/evening leg adapter.
 *
 * Mirrors the useFirestoreMorningCommute test idioms (emit/act over the captured
 * onSnapshot callback) but exercises the evening leg + the eveningEnabled gate +
 * the `enabled` no-op flag introduced for the home commute card's time-aware
 * switch.
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { subscribeCommuteRoutes } from '@services/commute/commuteService';
import type { CommuteSettings } from '@services/commute/commuteService';
import { useFirestoreCommuteLeg } from '../useFirestoreMorningCommute';

jest.mock('@services/commute/commuteService', () => ({
  subscribeCommuteRoutes: jest.fn(),
}));

const mockedSubscribe = subscribeCommuteRoutes as jest.Mock;

let capturedOnChange: ((settings: CommuteSettings | null) => void) | null;
const mockUnsubscribe = jest.fn();

const emit = (settings: CommuteSettings | null): void => {
  if (!capturedOnChange) throw new Error('subscribeCommuteRoutes was not called');
  act(() => capturedOnChange!(settings));
};

const fullRoute = (over: Record<string, unknown> = {}) => ({
  departureTime: '08:30',
  departureStationId: 'stn-from',
  departureStationName: '출발',
  departureLineId: '2',
  arrivalStationId: 'stn-to',
  arrivalStationName: '도착',
  arrivalLineId: '2',
  transferStations: [],
  notifications: { departureAlert: true, arrivalAlert: false, delayAlert: true },
  bufferMinutes: 10,
  ...over,
});

const settings = (over: Partial<CommuteSettings>): CommuteSettings =>
  ({
    morningRoute: null,
    eveningRoute: null,
    eveningEnabled: true,
    createdAt: null,
    updatedAt: null,
    ...over,
  } as unknown as CommuteSettings);

describe('useFirestoreCommuteLeg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnChange = null;
    mockedSubscribe.mockImplementation((_uid: string, onChange) => {
      capturedOnChange = onChange;
      return mockUnsubscribe;
    });
  });

  it('morning leg adapts morningRoute to CommuteTime', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('uid-1', 'morning'));
    emit(settings({ morningRoute: fullRoute() as never }));
    await waitFor(() =>
      expect(result.current).toEqual({
        departureTime: '08:30',
        stationId: 'stn-from',
        destinationStationId: 'stn-to',
        bufferMinutes: 10,
      }),
    );
  });

  it('evening leg adapts eveningRoute to CommuteTime', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('uid-1', 'evening'));
    emit(
      settings({
        eveningRoute: fullRoute({
          departureTime: '19:00',
          departureStationId: 'stn-work',
          arrivalStationId: 'stn-home',
        }) as never,
        eveningEnabled: true,
      }),
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        departureTime: '19:00',
        stationId: 'stn-work',
        destinationStationId: 'stn-home',
        bufferMinutes: 10,
      }),
    );
  });

  it('evening leg returns null when eveningEnabled is false (toggled off)', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('uid-1', 'evening'));
    emit(settings({ eveningRoute: fullRoute({ departureTime: '19:00' }) as never, eveningEnabled: false }));
    await waitFor(() => expect(capturedOnChange).not.toBeNull());
    expect(result.current).toBeNull();
  });

  it('evening leg ignores the morning route entirely', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('uid-1', 'evening'));
    emit(settings({ morningRoute: fullRoute() as never, eveningRoute: null, eveningEnabled: true }));
    await waitFor(() => expect(capturedOnChange).not.toBeNull());
    expect(result.current).toBeNull();
  });

  it('returns null when the leg route is incomplete (missing arrival id)', async () => {
    const { result } = renderHook(() => useFirestoreCommuteLeg('uid-1', 'morning'));
    emit(settings({ morningRoute: fullRoute({ arrivalStationId: '' }) as never }));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('does not subscribe when enabled=false (no-op for inactive leg)', () => {
    renderHook(() => useFirestoreCommuteLeg('uid-1', 'evening', 0, false));
    expect(mockedSubscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when uid is undefined', () => {
    renderHook(() => useFirestoreCommuteLeg(undefined, 'morning'));
    expect(mockedSubscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount (no leaked listener)', () => {
    const { unmount } = renderHook(() => useFirestoreCommuteLeg('uid-1', 'evening'));
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
