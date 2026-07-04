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
import type { Route } from '@/models/route';
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

const mockedSelect = selectCommuteRoute as jest.Mock;
const mockedSet = setGuidanceSession as jest.Mock;
const mockedCancelMl = notificationService.cancelScheduledMlDepartureAlerts as jest.Mock;

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
  }> = {},
): {
  fromStationId?: string;
  toStationId?: string;
  viaTransferId?: string;
  fromStationName?: string;
  toStationName?: string;
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
