/**
 * useStartCommuteGuidance tests — builds a GuidanceSession from a commute OD
 * and starts the live guidance screen. Mocks the three seams (selectCommuteRoute,
 * setGuidanceSession, navigation) and verifies the handler's gating + effects.
 *
 * `mockNavigate` is mock-prefixed so babel-plugin-jest-hoist allows the
 * jest.mock factory to close over it.
 */
import { renderHook, act } from '@testing-library/react-native';
import { selectCommuteRoute } from '@services/route/selectCommuteRoute';
import { setGuidanceSession } from '@services/guidance/guidanceSessionStore';
import { notificationService } from '@services/notification/notificationService';
import { attachDestinationPreferences } from '@services/guidance/destinationPreferenceSync';
import type { Route } from '@/models/route';
import type { CommuteType } from '@/models/commute';
import { useStartCommuteGuidance } from '../useStartCommuteGuidance';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@services/route/selectCommuteRoute', () => ({
  selectCommuteRoute: jest.fn(),
}));
jest.mock('@services/guidance/guidanceSessionStore', () => ({
  setGuidanceSession: jest.fn(),
}));
jest.mock('@services/notification/notificationService', () => ({
  notificationService: {
    cancelScheduledMlDepartureAlerts: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@services/guidance/destinationPreferenceSync', () => ({
  attachDestinationPreferences: jest.fn(() => Promise.resolve()),
}));

const mockedSelect = selectCommuteRoute as jest.Mock;
const mockedSet = setGuidanceSession as jest.Mock;
const mockedCancelMl = notificationService.cancelScheduledMlDepartureAlerts as jest.Mock;
const mockedAttach = attachDestinationPreferences as jest.Mock;

const ROUTE = {
  segments: [],
  totalMinutes: 18,
  transferCount: 0,
  lineIds: ['2'],
} as unknown as Route;

const args = (
  over: Partial<{
    fromStationId: string;
    toStationId: string;
    viaTransferId: string;
    fromStationName: string;
    toStationName: string;
    commuteType: CommuteType;
    uid: string;
  }> = {},
): {
  fromStationId?: string;
  toStationId?: string;
  viaTransferId?: string;
  fromStationName?: string;
  toStationName?: string;
  commuteType?: CommuteType;
  uid?: string;
} => ({
  fromStationId: '0220',
  toStationId: '0222',
  fromStationName: '홍대입구',
  toStationName: '강남',
  ...over,
});

describe('useStartCommuteGuidance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a handler when a route and both station names resolve', () => {
    mockedSelect.mockReturnValue(ROUTE);
    const { result } = renderHook(() => useStartCommuteGuidance(args()));
    expect(typeof result.current).toBe('function');
  });

  it('starts the guidance session and navigates when the handler is invoked', () => {
    mockedSelect.mockReturnValue(ROUTE);
    const { result } = renderHook(() => useStartCommuteGuidance(args()));
    act(() => {
      result.current?.();
    });
    expect(mockedSet).toHaveBeenCalledWith(
      expect.objectContaining({
        route: ROUTE,
        fromStationName: '홍대입구',
        toStationName: '강남',
        startedAt: expect.any(Number),
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('RouteGuidance');
    // 일반(비출퇴근) 진입은 leg 귀속이 없으므로 선호 attach도 하지 않는다.
    expect(mockedAttach).not.toHaveBeenCalled();
  });

  it('출퇴근 leg 진입이면 sourceCommuteType을 동기 기록하고 같은 startedAt으로 선호를 attach한다', () => {
    mockedSelect.mockReturnValue(ROUTE);
    const { result } = renderHook(() =>
      useStartCommuteGuidance(args({ commuteType: 'morning', uid: 'uid-1' })),
    );
    act(() => {
      result.current?.();
    });
    expect(mockedSet).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCommuteType: 'morning' }),
    );
    const { startedAt } = mockedSet.mock.calls[0][0] as { startedAt: number };
    expect(mockedAttach).toHaveBeenCalledWith('uid-1', 'morning', startedAt);
  });

  it('cancels the scheduled ML departure alert when guidance starts (이미 이동 중)', () => {
    mockedSelect.mockReturnValue(ROUTE);
    const { result } = renderHook(() => useStartCommuteGuidance(args()));
    act(() => {
      result.current?.();
    });
    expect(mockedCancelMl).toHaveBeenCalledTimes(1);
  });

  it('returns null when no route can be computed', () => {
    mockedSelect.mockReturnValue(null);
    const { result } = renderHook(() => useStartCommuteGuidance(args()));
    expect(result.current).toBeNull();
  });

  it('returns null when the origin name is missing', () => {
    mockedSelect.mockReturnValue(ROUTE);
    const { result } = renderHook(() =>
      useStartCommuteGuidance(args({ fromStationName: undefined })),
    );
    expect(result.current).toBeNull();
  });

  it('returns null when the destination name is missing', () => {
    mockedSelect.mockReturnValue(ROUTE);
    const { result } = renderHook(() =>
      useStartCommuteGuidance(args({ toStationName: undefined })),
    );
    expect(result.current).toBeNull();
  });
});
