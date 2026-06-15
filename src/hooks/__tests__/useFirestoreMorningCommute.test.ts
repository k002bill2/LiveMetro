/**
 * useFirestoreMorningCommute tests — verifies the adapter between
 * onboarding's commuteSettings store and HomeScreen's CommuteTime shape.
 *
 * The hook subscribes to the commuteSettings/<uid> document in real time
 * (onSnapshot via commuteService.subscribeCommuteRoutes) so a commute saved
 * on another screen propagates to Home without a remount (home-refresh audit
 * B4). These tests drive the subscription callback directly.
 *
 * Focus areas:
 *   - happy path: well-formed Firestore row → adapted CommuteTime
 *   - graceful nulls: missing uid / missing doc / missing required fields
 *   - bufferMinutes default when omitted
 *   - reactivity: a second snapshot updates the returned value
 *   - cleanup: unsubscribe on unmount and on uid change (no leaked listener)
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { subscribeCommuteRoutes } from '@services/commute/commuteService';
import type { CommuteSettings } from '@services/commute/commuteService';
import { useFirestoreMorningCommute } from '../useFirestoreMorningCommute';

jest.mock('@services/commute/commuteService', () => ({
  subscribeCommuteRoutes: jest.fn(),
}));

const mockedSubscribe = subscribeCommuteRoutes as jest.Mock;

// Capture the onChange callback handed to subscribeCommuteRoutes so tests can
// simulate Firestore snapshots firing.
let capturedOnChange: ((settings: CommuteSettings | null) => void) | null;
const mockUnsubscribe = jest.fn();

const emit = (settings: CommuteSettings | null): void => {
  if (!capturedOnChange) throw new Error('subscribeCommuteRoutes was not called');
  act(() => capturedOnChange!(settings));
};

const fullMorning = {
  departureTime: '08:30',
  departureStationId: 'stn-hongdae',
  departureStationName: '홍대입구',
  departureLineId: '2',
  arrivalStationId: 'stn-gangnam',
  arrivalStationName: '강남',
  arrivalLineId: '2',
  transferStations: [],
  notifications: { departureAlert: true, arrivalAlert: false, delayAlert: true },
  bufferMinutes: 10,
};

const settingsWith = (
  morningRoute: Record<string, unknown> | null,
): CommuteSettings =>
  ({
    morningRoute,
    eveningRoute: null,
    eveningEnabled: true,
    createdAt: null,
    updatedAt: null,
  } as unknown as CommuteSettings);

describe('useFirestoreMorningCommute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnChange = null;
    mockedSubscribe.mockImplementation((_uid: string, onChange) => {
      capturedOnChange = onChange;
      return mockUnsubscribe;
    });
  });

  it('returns null when uid is undefined (signed out) and does not subscribe', () => {
    const { result } = renderHook(() => useFirestoreMorningCommute(undefined));
    expect(result.current).toBeNull();
    expect(mockedSubscribe).not.toHaveBeenCalled();
  });

  it('subscribes with the uid when provided', () => {
    renderHook(() => useFirestoreMorningCommute('uid-1'));
    expect(mockedSubscribe).toHaveBeenCalledWith('uid-1', expect.any(Function));
  });

  it('returns null when the snapshot has no document', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(null);
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns null when morningRoute is missing departureStationId', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(settingsWith({ ...fullMorning, departureStationId: '' }));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns null when morningRoute is missing arrivalStationId', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(settingsWith({ ...fullMorning, arrivalStationId: '' }));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns null when morningRoute is missing departureTime', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(settingsWith({ ...fullMorning, departureTime: '' }));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('adapts a full Firestore morningRoute to CommuteTime shape', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(settingsWith(fullMorning));
    await waitFor(() =>
      expect(result.current).toEqual({
        departureTime: '08:30',
        stationId: 'stn-hongdae',
        destinationStationId: 'stn-gangnam',
        bufferMinutes: 10,
      }),
    );
  });

  it('defaults bufferMinutes to 0 when omitted in Firestore row', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(settingsWith({ ...fullMorning, bufferMinutes: undefined }));
    await waitFor(() => expect(result.current?.bufferMinutes).toBe(0));
  });

  it('projects the first transferStation id as transferStationId (drives via route)', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(
      settingsWith({
        ...fullMorning,
        transferStations: [
          {
            stationId: 'stn-via',
            stationName: '신도림',
            lineId: '2',
            lineName: '',
            order: 0,
          },
        ],
      }),
    );
    await waitFor(() => expect(result.current?.transferStationId).toBe('stn-via'));
  });

  it('updates the returned value when a later snapshot changes the route (reactive)', async () => {
    // The core B4 fix: a one-shot fetch could only ever reflect the first
    // value. A live subscription must apply the second snapshot too — this is
    // what makes a commute saved on another screen appear on Home.
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));

    emit(settingsWith(fullMorning));
    await waitFor(() => expect(result.current?.stationId).toBe('stn-hongdae'));

    emit(
      settingsWith({
        ...fullMorning,
        departureTime: '09:15',
        departureStationId: 'stn-seongsu',
        arrivalStationId: 'stn-jamsil',
      }),
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        departureTime: '09:15',
        stationId: 'stn-seongsu',
        destinationStationId: 'stn-jamsil',
        bufferMinutes: 10,
      }),
    );
  });

  it('clears the value when a later snapshot deletes the document', async () => {
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    emit(settingsWith(fullMorning));
    await waitFor(() => expect(result.current).not.toBeNull());
    emit(null);
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('unsubscribes on unmount (no leaked listener)', () => {
    const { unmount } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes and unsubscribes the old listener when uid changes', () => {
    const { rerender } = renderHook(
      ({ uid }: { uid: string | undefined }) => useFirestoreMorningCommute(uid),
      { initialProps: { uid: 'uid-1' as string | undefined } },
    );
    expect(mockedSubscribe).toHaveBeenCalledWith('uid-1', expect.any(Function));

    rerender({ uid: 'uid-2' });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockedSubscribe).toHaveBeenCalledWith('uid-2', expect.any(Function));
    expect(mockedSubscribe).toHaveBeenCalledTimes(2);
  });

  it('re-subscribes (fresh read) and unsubscribes the old listener when refreshNonce changes', () => {
    // HomeScreen bumps refreshNonce on focus to force a fresh commute read; the
    // hook must tear down the old onSnapshot link and re-establish it so a
    // returning user recovers from any stale/dropped subscription.
    const { rerender } = renderHook(
      ({ nonce }: { nonce: number }) => useFirestoreMorningCommute('uid-1', nonce),
      { initialProps: { nonce: 0 } },
    );
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);

    rerender({ nonce: 1 });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockedSubscribe).toHaveBeenCalledTimes(2);
    expect(mockedSubscribe).toHaveBeenLastCalledWith('uid-1', expect.any(Function));
  });

  it('does not re-subscribe when refreshNonce is unchanged across rerenders', () => {
    const { rerender } = renderHook(
      ({ nonce }: { nonce: number }) => useFirestoreMorningCommute('uid-1', nonce),
      { initialProps: { nonce: 3 } },
    );
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);

    rerender({ nonce: 3 });
    expect(mockedSubscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });
});
