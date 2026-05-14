/**
 * useFirestoreMorningCommute tests — verifies the adapter between
 * onboarding's commuteSettings store and HomeScreen's CommuteTime shape.
 *
 * Focus areas:
 *   - happy path: well-formed Firestore row → adapted CommuteTime
 *   - graceful nulls: missing uid / missing doc / missing required fields
 *   - bufferMinutes default when omitted
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { loadCommuteRoutes } from '@services/commute/commuteService';
import { useFirestoreMorningCommute } from '../useFirestoreMorningCommute';

jest.mock('@services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
}));

const mockedLoad = loadCommuteRoutes as jest.Mock;

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

describe('useFirestoreMorningCommute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when uid is undefined (signed out)', () => {
    const { result } = renderHook(() => useFirestoreMorningCommute(undefined));
    expect(result.current).toBeNull();
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('returns null when no Firestore document exists', async () => {
    mockedLoad.mockResolvedValue(null);
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledWith('uid-1'));
    expect(result.current).toBeNull();
  });

  it('returns null when morningRoute is missing departureStationId', async () => {
    mockedLoad.mockResolvedValue({
      morningRoute: { ...fullMorning, departureStationId: '' },
      eveningRoute: null,
      createdAt: null,
      updatedAt: null,
    });
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    await waitFor(() => expect(mockedLoad).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('returns null when morningRoute is missing arrivalStationId', async () => {
    mockedLoad.mockResolvedValue({
      morningRoute: { ...fullMorning, arrivalStationId: '' },
      eveningRoute: null,
      createdAt: null,
      updatedAt: null,
    });
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    await waitFor(() => expect(mockedLoad).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('returns null when morningRoute is missing departureTime', async () => {
    mockedLoad.mockResolvedValue({
      morningRoute: { ...fullMorning, departureTime: '' },
      eveningRoute: null,
      createdAt: null,
      updatedAt: null,
    });
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    await waitFor(() => expect(mockedLoad).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('adapts a full Firestore morningRoute to CommuteTime shape', async () => {
    mockedLoad.mockResolvedValue({
      morningRoute: fullMorning,
      eveningRoute: null,
      createdAt: null,
      updatedAt: null,
    });
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({
      departureTime: '08:30',
      stationId: 'stn-hongdae',
      destinationStationId: 'stn-gangnam',
      bufferMinutes: 10,
    });
  });

  it('defaults bufferMinutes to 0 when omitted in Firestore row', async () => {
    mockedLoad.mockResolvedValue({
      morningRoute: { ...fullMorning, bufferMinutes: undefined },
      eveningRoute: null,
      createdAt: null,
      updatedAt: null,
    });
    const { result } = renderHook(() => useFirestoreMorningCommute('uid-1'));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.bufferMinutes).toBe(0);
  });

  it('refetches when uid changes', async () => {
    mockedLoad.mockResolvedValue({
      morningRoute: fullMorning,
      eveningRoute: null,
      createdAt: null,
      updatedAt: null,
    });
    const { rerender } = renderHook(
      ({ uid }: { uid: string | undefined }) => useFirestoreMorningCommute(uid),
      { initialProps: { uid: 'uid-1' as string | undefined } },
    );
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledWith('uid-1'));
    rerender({ uid: 'uid-2' });
    await waitFor(() => expect(mockedLoad).toHaveBeenCalledWith('uid-2'));
    expect(mockedLoad).toHaveBeenCalledTimes(2);
  });
});
