/**
 * useFirestoreCommuteRoutes tests — adapts BOTH commute legs from the
 * commuteSettings/<uid> store to CommuteTime, via a live subscription.
 *
 * Focus areas:
 *   - happy path: well-formed morning + evening rows → adapted CommuteTime
 *   - graceful nulls: missing uid / missing doc / incomplete leg
 *   - eveningEnabled === false → evening treated as absent
 *   - bufferMinutes default when omitted
 *   - cleanup: unsubscribe on unmount
 */
import { renderHook, act } from '@testing-library/react-native';
import { subscribeCommuteRoutes } from '@/services/commute/commuteService';
import type { CommuteSettings } from '@/services/commute/commuteService';
import { useFirestoreCommuteRoutes } from '../useFirestoreCommuteRoutes';

jest.mock('@/services/commute/commuteService', () => ({
  subscribeCommuteRoutes: jest.fn(),
}));

const mockedSubscribe = subscribeCommuteRoutes as jest.Mock;

let capturedOnChange: ((settings: CommuteSettings | null) => void) | null;
const mockUnsubscribe = jest.fn();

const emit = (settings: CommuteSettings | null): void => {
  if (!capturedOnChange) throw new Error('subscribeCommuteRoutes was not called');
  act(() => capturedOnChange!(settings));
};

const route = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  departureTime: '08:30',
  departureStationId: 'stn-a',
  arrivalStationId: 'stn-b',
  bufferMinutes: 10,
  ...over,
});

const settingsWith = (over: Partial<CommuteSettings>): CommuteSettings =>
  ({
    morningRoute: null,
    eveningRoute: null,
    eveningEnabled: true,
    createdAt: null,
    updatedAt: null,
    ...over,
  } as unknown as CommuteSettings);

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnChange = null;
  mockedSubscribe.mockImplementation((_uid: string, onChange: typeof capturedOnChange) => {
    capturedOnChange = onChange;
    return mockUnsubscribe;
  });
});

describe('useFirestoreCommuteRoutes', () => {
  it('returns both-null and does not subscribe without a uid', () => {
    const { result } = renderHook(() => useFirestoreCommuteRoutes(undefined));
    expect(result.current).toEqual({ morning: null, evening: null });
    expect(mockedSubscribe).not.toHaveBeenCalled();
  });

  it('returns both-null when the document is missing', () => {
    const { result } = renderHook(() => useFirestoreCommuteRoutes('uid-1'));
    emit(null);
    expect(result.current).toEqual({ morning: null, evening: null });
  });

  it('adapts both legs from a well-formed document', () => {
    const { result } = renderHook(() => useFirestoreCommuteRoutes('uid-1'));
    emit(
      settingsWith({
        morningRoute: route({ departureTime: '08:00' }) as never,
        eveningRoute: route({ departureTime: '18:00' }) as never,
      })
    );
    expect(result.current.morning).toEqual({
      departureTime: '08:00',
      stationId: 'stn-a',
      destinationStationId: 'stn-b',
      bufferMinutes: 10,
    });
    expect(result.current.evening).toEqual({
      departureTime: '18:00',
      stationId: 'stn-a',
      destinationStationId: 'stn-b',
      bufferMinutes: 10,
    });
  });

  it('nulls a leg that is missing a required field', () => {
    const { result } = renderHook(() => useFirestoreCommuteRoutes('uid-1'));
    emit(
      settingsWith({
        morningRoute: route({ arrivalStationId: '' }) as never,
        eveningRoute: route() as never,
      })
    );
    expect(result.current.morning).toBeNull();
    expect(result.current.evening).not.toBeNull();
  });

  it('treats a disabled evening leg as absent', () => {
    const { result } = renderHook(() => useFirestoreCommuteRoutes('uid-1'));
    emit(
      settingsWith({
        morningRoute: route() as never,
        eveningRoute: route() as never,
        eveningEnabled: false,
      })
    );
    expect(result.current.morning).not.toBeNull();
    expect(result.current.evening).toBeNull();
  });

  it('defaults bufferMinutes to 0 when omitted', () => {
    const { result } = renderHook(() => useFirestoreCommuteRoutes('uid-1'));
    const { bufferMinutes, ...rest } = route();
    void bufferMinutes;
    emit(settingsWith({ morningRoute: rest as never }));
    expect(result.current.morning?.bufferMinutes).toBe(0);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useFirestoreCommuteRoutes('uid-1'));
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
