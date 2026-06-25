/**
 * useCommuteDelayAlerts tests — foreground official-delay monitor.
 *
 * All seams mocked (officialDelayService, fireLineDelayAlert, shouldSendNotification,
 * useAuth, AppState). Fake timers drive the 90s poll; a microtask flush helper
 * drains the async check() chain.
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { officialDelayService } from '@services/delay/officialDelayService';
import { fireLineDelayAlert } from '@services/notification/lineDelayAlert';
import { notificationService } from '@services/notification/notificationService';
import { useAuth } from '@services/auth/AuthContext';
import { useCommuteDelayAlerts } from '../useCommuteDelayAlerts';

jest.mock('@services/delay/officialDelayService', () => ({
  officialDelayService: { getActiveDelays: jest.fn() },
}));
jest.mock('@services/notification/lineDelayAlert', () => ({
  fireLineDelayAlert: jest.fn(() => Promise.resolve('id')),
}));
jest.mock('@services/notification/notificationService', () => ({
  notificationService: { shouldSendNotification: jest.fn(() => true) },
  NotificationType: { DELAY_ALERT: 'delay_alert' },
}));
jest.mock('@services/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockGetActive = officialDelayService.getActiveDelays as jest.Mock;
const mockFire = fireLineDelayAlert as jest.Mock;
const mockShouldSend = notificationService.shouldSendNotification as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const delay = (lineId: string, status: string = 'delayed') => ({
  lineId,
  lineName: `${lineId}호선`,
  status,
  updatedAt: new Date(0),
  source: 'seoul_metro',
});

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const setAppState = (s: string): void => {
  (AppState as unknown as { currentState: string }).currentState = s;
};

describe('useCommuteDelayAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setAppState('active');
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    mockUseAuth.mockReturnValue({ user: { preferences: { notificationSettings: {} } } });
    mockShouldSend.mockReturnValue(true);
    mockGetActive.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires an alert for a new delay on a watched line', async () => {
    mockGetActive.mockResolvedValue([delay('2'), delay('9')]);
    renderHook(() => useCommuteDelayAlerts(['2']));
    await flush();
    expect(mockFire).toHaveBeenCalledTimes(1);
    expect(mockFire.mock.calls[0][0].lineId).toBe('2');
  });

  it('ignores delays on unwatched lines', async () => {
    mockGetActive.mockResolvedValue([delay('9')]);
    renderHook(() => useCommuteDelayAlerts(['2']));
    await flush();
    expect(mockFire).not.toHaveBeenCalled();
  });

  it('does not re-fire the same delay on the next poll (dedup)', async () => {
    mockGetActive.mockResolvedValue([delay('2')]);
    renderHook(() => useCommuteDelayAlerts(['2']));
    await flush();
    expect(mockFire).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(90_000);
    });
    await flush();
    expect(mockFire).toHaveBeenCalledTimes(1);
  });

  it('does not fire when shouldSendNotification is false', async () => {
    mockShouldSend.mockReturnValue(false);
    mockGetActive.mockResolvedValue([delay('2')]);
    renderHook(() => useCommuteDelayAlerts(['2']));
    await flush();
    expect(mockFire).not.toHaveBeenCalled();
  });

  it('does not poll when the app is not active', async () => {
    setAppState('background');
    renderHook(() => useCommuteDelayAlerts(['2']));
    await flush();
    expect(mockGetActive).not.toHaveBeenCalled();
  });

  it('cleans up the interval and AppState subscription on unmount', async () => {
    const remove = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValue({ remove });
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useCommuteDelayAlerts(['2']));
    await flush();
    unmount();
    expect(remove).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
