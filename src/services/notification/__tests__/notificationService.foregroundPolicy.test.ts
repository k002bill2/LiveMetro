/**
 * notificationService foreground policy + ML departure alert sweep tests.
 *
 * (1) setNotificationHandler — 길안내 세션이 활성인 동안 도착한
 *     COMMUTE_REMINDER('지금 출발하세요' 주간 리마인더/ML 출발 알림)는 이미
 *     이동 중인 사용자에게 소음이므로 포그라운드 배너·사운드를 억제한다.
 *     주간 반복 트리거는 OS 큐에서 '오늘 것만' 선별 취소가 불가능해 표출
 *     시점 억제가 유일한 보완 지점이다. 다른 타입은 기존 동작 유지.
 * (2) cancelScheduledMlDepartureAlerts — 길안내 시작 시 오늘 예약된 ML 출발
 *     알림(date 트리거 COMMUTE_REMINDER)만 제거한다. 주간 리마인더는 보존
 *     (cancelScheduledCommuteReminders의 정확한 보수(補數) 스코프).
 */
import * as Notifications from 'expo-notifications';
import { getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import { notificationService } from '../notificationService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

jest.mock('@/services/guidance/guidanceSessionStore', () => ({
  getGuidanceSession: jest.fn(),
}));

const mockedGetSession = getGuidanceSession as jest.Mock;

type HandlerBehavior = {
  shouldShowAlert: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
};

// 모듈 로드 시 등록된 handleNotification을 즉시 캡처 — jest.config의
// `clearMocks: true`가 매 테스트 전에 mock.calls를 비우므로, 테스트 본문에서
// 기록을 조회하면 이미 사라져 있다.
const registeredHandler = (Notifications.setNotificationHandler as jest.Mock).mock
  .calls[0]?.[0]?.handleNotification as (notification: unknown) => Promise<HandlerBehavior>;

const getHandler = (): ((notification: unknown) => Promise<HandlerBehavior>) => {
  expect(registeredHandler).toBeDefined();
  return registeredHandler;
};

const notificationOf = (dataType?: string): unknown => ({
  request: { content: { data: dataType === undefined ? {} : { type: dataType } } },
});

describe('notificationService foreground handler', () => {
  beforeEach(() => {
    mockedGetSession.mockReset();
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockReset();
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockReset();
  });

  it('suppresses banner + sound for COMMUTE_REMINDER while a guidance session is active', async () => {
    mockedGetSession.mockReturnValue({ startedAt: 1 });
    const behavior = await getHandler()(notificationOf('commute_reminder'));
    expect(behavior).toEqual({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it('shows COMMUTE_REMINDER normally when no guidance session is active', async () => {
    mockedGetSession.mockReturnValue(null);
    const behavior = await getHandler()(notificationOf('commute_reminder'));
    expect(behavior).toEqual({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('never suppresses other types even while a guidance session is active', async () => {
    mockedGetSession.mockReturnValue({ startedAt: 1 });
    const arrival = await getHandler()(notificationOf('arrival_reminder'));
    expect(arrival.shouldShowAlert).toBe(true);
    const delay = await getHandler()(notificationOf('delay_alert'));
    expect(delay.shouldShowAlert).toBe(true);
  });

  it('shows notifications with missing/malformed data (never throws)', async () => {
    mockedGetSession.mockReturnValue({ startedAt: 1 });
    const noData = await getHandler()(notificationOf(undefined));
    expect(noData.shouldShowAlert).toBe(true);
    const empty = await getHandler()({});
    expect(empty.shouldShowAlert).toBe(true);
  });
});

describe('notificationService.cancelScheduledMlDepartureAlerts', () => {
  beforeEach(() => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockReset();
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockReset();
  });

  it('cancels only date-trigger COMMUTE_REMINDERs, preserving weekly reminders and other types', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      // ML 출발 알림 (iOS): calendar 트리거 + 구체 날짜 → 취소 대상
      {
        identifier: 'ml-date',
        content: { data: { type: 'commute_reminder' } },
        trigger: {
          type: 'calendar',
          repeats: true,
          dateComponents: { year: 2026, month: 7, day: 4, hour: 8, minute: 0, isLeapMonth: false },
        },
      },
      // ML 출발 알림 (Android): date 트리거 → 취소 대상
      {
        identifier: 'ml-date-android',
        content: { data: { type: 'commute_reminder' } },
        trigger: { type: 'date', repeats: false, value: 1780560000000 },
      },
      // 주간 리마인더 (Android weekly) → 보존
      {
        identifier: 'weekly-android',
        content: { data: { type: 'commute_reminder' } },
        trigger: { type: 'weekly', weekday: 2, hour: 8, minute: 15 },
      },
      // 주간 리마인더 (iOS calendar, weekday만) → 보존
      {
        identifier: 'weekly-ios',
        content: { data: { type: 'commute_reminder' } },
        trigger: {
          type: 'calendar',
          repeats: true,
          dateComponents: { weekday: 2, hour: 8, minute: 15, isLeapMonth: false },
        },
      },
      // 다른 타입 → 보존
      {
        identifier: 'arrival',
        content: { data: { type: 'arrival_reminder' } },
        trigger: { type: 'date', repeats: false, value: 1780560000000 },
      },
      // malformed → 무시
      { identifier: 'no-data', content: {}, trigger: null },
    ]);

    await notificationService.cancelScheduledMlDepartureAlerts();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ml-date');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ml-date-android');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('weekly-android');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('weekly-ios');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('arrival');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('no-data');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when nothing is scheduled', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    await notificationService.cancelScheduledMlDepartureAlerts();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('swallows errors from the OS query (never throws)', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockRejectedValue(
      new Error('boom')
    );
    await expect(notificationService.cancelScheduledMlDepartureAlerts()).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});
