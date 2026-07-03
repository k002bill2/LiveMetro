/**
 * useCommuteSettingsAutoLog tests — 출퇴근 시간대 앱 포그라운드 자동 로그.
 *
 * 시간 게이트(detectCommuteType)는 실물을 쓰고 fake timer의 setSystemTime으로
 * 창(출근 06–11 / 퇴근 17–23)을 제어한다. Firestore seam(loadCommuteRoutes,
 * commuteLogService)과 useAuth, AppState는 mock.
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { useCommuteSettingsAutoLog } from '../useCommuteSettingsAutoLog';
import type { CommuteRoute } from '@/models/commute';
import type { CommuteSettings } from '@/services/commute/commuteService';

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
}));
jest.mock('@/services/pattern/commuteLogService', () => ({
  commuteLogService: { autoLogCommuteRoute: jest.fn() },
}));
// detectCommuteType의 소스 모듈(useAutoCommuteLog)이 당기는
// FavoritesContext → Firebase 캐스케이드 차단.
jest.mock('@/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({ favorites: [] })),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockLoadRoutes = loadCommuteRoutes as jest.Mock;
const mockAutoLog = commuteLogService.autoLogCommuteRoute as jest.Mock;

const buildRoute = (overrides: Partial<CommuteRoute> = {}): CommuteRoute => ({
  departureTime: '08:00',
  departureStationId: 'sindorim',
  departureStationName: '신도림',
  departureLineId: '2',
  transferStations: [],
  arrivalStationId: 'gangnam',
  arrivalStationName: '강남',
  arrivalLineId: '2',
  notifications: {
    transferAlert: false,
    arrivalAlert: false,
    delayAlert: false,
    incidentAlert: false,
    alertMinutesBefore: 5,
  },
  bufferMinutes: 10,
  ...overrides,
});

const buildSettings = (overrides: Partial<CommuteSettings> = {}): CommuteSettings => ({
  morningRoute: buildRoute(),
  eveningRoute: buildRoute({
    departureStationId: 'gangnam',
    departureStationName: '강남',
    arrivalStationId: 'sindorim',
    arrivalStationName: '신도림',
    departureTime: '19:00',
  }),
  eveningEnabled: true,
  createdAt: null,
  updatedAt: null,
  ...overrides,
});

let appStateListener: ((next: string) => void) | null = null;
const removeMock = jest.fn();

const setAppState = (s: string): void => {
  (AppState as unknown as { currentState: string }).currentState = s;
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useCommuteSettingsAutoLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-03T08:00:00'));
    appStateListener = null;
    setAppState('active');
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      cb: (next: string) => void
    ) => {
      appStateListener = cb;
      return { remove: removeMock };
    }) as never);
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
    mockLoadRoutes.mockResolvedValue(buildSettings());
    mockAutoLog.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs the morning route as departure during the morning window', async () => {
    const settings = buildSettings();
    mockLoadRoutes.mockResolvedValue(settings);

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockLoadRoutes).toHaveBeenCalledWith('user-1');
    expect(mockAutoLog).toHaveBeenCalledTimes(1);
    expect(mockAutoLog).toHaveBeenCalledWith('user-1', settings.morningRoute, 'departure');
  });

  it('logs the evening route as arrival during the evening window', async () => {
    jest.setSystemTime(new Date('2026-07-03T19:00:00'));
    const settings = buildSettings();
    mockLoadRoutes.mockResolvedValue(settings);

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockAutoLog).toHaveBeenCalledTimes(1);
    expect(mockAutoLog).toHaveBeenCalledWith('user-1', settings.eveningRoute, 'arrival');
  });

  it('does nothing outside commute windows', async () => {
    jest.setSystemTime(new Date('2026-07-03T14:00:00'));

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockLoadRoutes).not.toHaveBeenCalled();
    expect(mockAutoLog).not.toHaveBeenCalled();
  });

  it('does nothing when there is no signed-in user', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockLoadRoutes).not.toHaveBeenCalled();
    expect(mockAutoLog).not.toHaveBeenCalled();
  });

  it('does nothing when the user has no commute settings', async () => {
    mockLoadRoutes.mockResolvedValue(null);

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockAutoLog).not.toHaveBeenCalled();
  });

  it('skips the evening leg when eveningEnabled is false', async () => {
    jest.setSystemTime(new Date('2026-07-03T19:00:00'));
    mockLoadRoutes.mockResolvedValue(buildSettings({ eveningEnabled: false }));

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockAutoLog).not.toHaveBeenCalled();
  });

  it('skips a route with missing station ids', async () => {
    mockLoadRoutes.mockResolvedValue(
      buildSettings({ morningRoute: buildRoute({ arrivalStationId: '' }) })
    );

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    expect(mockAutoLog).not.toHaveBeenCalled();
  });

  it('dedupes repeated foreground transitions within the same leg and day', async () => {
    renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    await act(async () => {
      appStateListener?.('background');
      appStateListener?.('active');
    });
    await flush();

    expect(mockAutoLog).toHaveBeenCalledTimes(1);
  });

  it('recovers on the next foreground transition after a failure', async () => {
    mockLoadRoutes
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(buildSettings());

    renderHook(() => useCommuteSettingsAutoLog());
    await flush();
    expect(mockAutoLog).not.toHaveBeenCalled();

    await act(async () => {
      appStateListener?.('active');
    });
    await flush();

    expect(mockAutoLog).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState subscription on unmount', async () => {
    const { unmount } = renderHook(() => useCommuteSettingsAutoLog());
    await flush();

    unmount();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
