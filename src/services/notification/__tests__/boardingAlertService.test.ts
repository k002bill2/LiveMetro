import * as Notifications from 'expo-notifications';
import {
  scheduleBoardingAlert,
  cancelBoardingAlert,
  BOARDING_ALERT_KIND,
} from '../boardingAlertService';
import { notificationService } from '../notificationService';
import { getGuidanceSession } from '@/services/guidance/guidanceSessionStore';

// 세션 키 스탬프용 — 서비스가 직접 읽는 활성 세션을 제어한다 (기본 null).
jest.mock('@/services/guidance/guidanceSessionStore', () => ({
  getGuidanceSession: jest.fn(() => null),
}));

// notificationService는 expo-notifications를 감싸므로 통째로 mock —
// boardingAlertService의 오케스트레이션(권한 게이트 + dedup)만 검증한다.
jest.mock('../notificationService', () => ({
  notificationService: {
    requestPermissions: jest.fn(),
    scheduleArrivalAlert: jest.fn(),
    cancelNotification: jest.fn(),
    shouldSendNotification: jest.fn(),
  },
  NotificationType: { ARRIVAL_REMINDER: 'arrival_reminder' },
}));

// cancelBoardingAlert가 OS 큐를 직접 훑어 고아 탑승 알림(kind 마커)을 sweep하므로
// expo-notifications를 직접 mock한다 (재시작 시 추적 ID 소실 커버).
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

const mockNotif = notificationService as jest.Mocked<typeof notificationService>;
const mockGetAllScheduled = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const mockCancelScheduled = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockGetSession = getGuidanceSession as jest.Mock;

const arrival = new Date('2026-05-19T11:05:00.000Z');

describe('boardingAlertService', () => {
  beforeEach(async () => {
    mockNotif.cancelNotification.mockResolvedValue(undefined);
    // 이전 테스트가 남긴 sweep 구현 잔재를 비운 뒤 모듈 레벨 lastId 잔재 제거.
    mockGetAllScheduled.mockResolvedValue([]);
    mockCancelScheduled.mockResolvedValue(undefined);
    await cancelBoardingAlert();
    jest.clearAllMocks();
    mockNotif.requestPermissions.mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof notificationService.requestPermissions>
    >);
    mockNotif.scheduleArrivalAlert.mockResolvedValue('alert-id');
    mockNotif.cancelNotification.mockResolvedValue(undefined);
    mockNotif.shouldSendNotification.mockReturnValue(true);
    mockGetAllScheduled.mockResolvedValue([]);
    mockCancelScheduled.mockResolvedValue(undefined);
    mockGetSession.mockReturnValue(null);
  });

  it('returns null and does not schedule when arrivalTime is null', async () => {
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: null,
    });
    expect(id).toBeNull();
    expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('returns null and does not schedule when permission is denied', async () => {
    mockNotif.requestPermissions.mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof notificationService.requestPermissions>
    >);
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBeNull();
    expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('schedules with station/destination copy when permission is granted', async () => {
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBe('alert-id');
    expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
      arrival,
      expect.objectContaining({
        secondsBefore: 30,
        title: expect.stringContaining('잠실'),
        body: expect.stringContaining('강남'),
        data: expect.objectContaining({ stationName: '강남', finalDestination: '잠실' }),
      })
    );
  });

  it('uses transfer copy (no destination) when variant is "transfer"', async () => {
    await scheduleBoardingAlert({
      stationName: '불광',
      finalDestination: '오금',
      arrivalTime: arrival,
      variant: 'transfer',
    });
    expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
      arrival,
      expect.objectContaining({
        title: expect.stringContaining('환승'),
        body: expect.stringContaining('불광'),
      })
    );
  });

  it('defaults to destination-based board copy when variant is omitted', async () => {
    await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
      arrival,
      expect.objectContaining({ title: expect.stringContaining('잠실') })
    );
  });

  it('honors a custom secondsBefore', async () => {
    await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
      secondsBefore: 60,
    });
    expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
      arrival,
      expect.objectContaining({ secondsBefore: 60 })
    );
  });

  it('cancels the previously scheduled boarding alert before scheduling a new one', async () => {
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('first-id');
    await scheduleBoardingAlert({ stationName: '강남', finalDestination: '잠실', arrivalTime: arrival });
    // 첫 예약 시점엔 취소할 이전 알림 없음
    expect(mockNotif.cancelNotification).not.toHaveBeenCalled();

    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('second-id');
    await scheduleBoardingAlert({ stationName: '강남', finalDestination: '성수', arrivalTime: arrival });
    // 두 번째 예약 전, 첫 알림(first-id)을 취소
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('first-id');
  });

  it('cancelBoardingAlert cancels the tracked id once and is a no-op afterwards', async () => {
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('tracked-id');
    await scheduleBoardingAlert({ stationName: '강남', finalDestination: '잠실', arrivalTime: arrival });

    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('tracked-id');

    mockNotif.cancelNotification.mockClear();
    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).not.toHaveBeenCalled();
  });

  it('returns null when scheduling rejects (never throws to caller)', async () => {
    mockNotif.scheduleArrivalAlert.mockRejectedValue(new Error('boom'));
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBeNull();
  });

  // ── 발사 이력 dedup: trainId를 넘긴 호출자(길안내 화면)에 한해, 이미
  // 발사된(=fireAt이 지난) 같은 열차의 알림을 재스케줄하지 않는다. 재스케줄은
  // 즉시발사(trigger:null)로 강등되어 취소 불가능한 중복 배너가 되기 때문.
  describe('fired-train dedup (trainId)', () => {
    it('skips re-scheduling when the same train alert has already fired', async () => {
      // 도착 10초 전 → fireAt(도착-30초)은 이미 과거 = 스케줄 즉시 발사됨
      const imminent = new Date(Date.now() + 10_000);
      const first = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: imminent,
        trainId: 'train-fired-1',
      });
      expect(first).toBe('alert-id');

      const second = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 8_000),
        trainId: 'train-fired-1',
      });
      expect(second).toBeNull();
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(1);
    });

    it('re-schedules (cancel-then-schedule) while the same train alert is still pending', async () => {
      // 도착 120초 전 → fireAt은 90초 뒤 = 아직 pending → 갱신 허용
      mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('pending-1');
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 120_000),
        trainId: 'train-pending-1',
      });

      mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('pending-2');
      const second = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 115_000),
        trainId: 'train-pending-1',
      });
      expect(second).toBe('pending-2');
      expect(mockNotif.cancelNotification).toHaveBeenCalledWith('pending-1');
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(2);
    });

    it('schedules a different train even after a previous train alert fired', async () => {
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 10_000),
        trainId: 'train-a',
      });
      const other = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 10_000),
        trainId: 'train-b',
      });
      expect(other).toBe('alert-id');
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(2);
    });

    it('re-alerts the same train id after the dedup window (id 재사용 대비)', async () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-07-04T08:00:00.000Z'));
        await scheduleBoardingAlert({
          stationName: '강남',
          finalDestination: '잠실',
          arrivalTime: new Date(Date.now() + 10_000),
          trainId: 'train-reused',
        });
        // 11분 뒤 — 같은 id라도 억제 창(10분)을 벗어나면 새 알림 허용
        jest.setSystemTime(new Date('2026-07-04T08:11:00.000Z'));
        const later = await scheduleBoardingAlert({
          stationName: '강남',
          finalDestination: '잠실',
          arrivalTime: new Date(Date.now() + 10_000),
          trainId: 'train-reused',
        });
        expect(later).toBe('alert-id');
        expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not dedup callers that omit trainId (기존 호출자 행동 불변)', async () => {
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 10_000),
      });
      const second = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 10_000),
      });
      expect(second).toBe('alert-id');
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(2);
    });
  });

  // ── 설정 게이트: settings가 제공되면 shouldSendNotification(ARRIVAL_REMINDER)
  // 판정을 따른다 — 알림 전체 off/quietHours/열차도착 이벤트 off가 실제로 먹힘.
  describe('notification settings gate', () => {
    const settings = { enabled: false } as Parameters<
      typeof notificationService.shouldSendNotification
    >[0];

    it('returns null and does not schedule when settings disallow the alert', async () => {
      mockNotif.shouldSendNotification.mockReturnValue(false);
      const id = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
        trainId: 'train-gated-1',
        settings,
      });
      expect(id).toBeNull();
      expect(mockNotif.shouldSendNotification).toHaveBeenCalledWith(settings, 'arrival_reminder');
      expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
    });

    it('schedules when settings allow the alert', async () => {
      mockNotif.shouldSendNotification.mockReturnValue(true);
      const id = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
        trainId: 'train-gated-2',
        settings,
      });
      expect(id).toBe('alert-id');
    });

    it('skips the gate entirely when settings are omitted (backward compat)', async () => {
      const id = await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(id).toBe('alert-id');
      expect(mockNotif.shouldSendNotification).not.toHaveBeenCalled();
    });
  });

  // ── OS 큐 sweep: 프로세스 재시작으로 모듈 스코프 추적 ID가 소실돼도 kind 마커로
  // pending 탑승 알림 고아를 청소한다 (alightAlertService 패턴 이식).
  describe('OS 큐 sweep (재시작 고아 정리)', () => {
    it('schedule 시 data에 BOARDING_ALERT_KIND 마커를 포함한다', async () => {
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
        arrival,
        expect.objectContaining({
          data: expect.objectContaining({ kind: BOARDING_ALERT_KIND }),
        })
      );
    });

    it('추적 ID가 없어도(재시작 시뮬) OS 큐의 kind 매칭 탑승 알림을 취소한다', async () => {
      mockGetAllScheduled.mockResolvedValue([
        { identifier: 'os-board-1', content: { data: { kind: BOARDING_ALERT_KIND } } },
        { identifier: 'os-other', content: { data: { kind: 'something-else' } } },
      ]);
      // lastAlertId는 이미 null (beforeEach cancel) → 재시작 후 상태를 모사.
      await cancelBoardingAlert();
      expect(mockCancelScheduled).toHaveBeenCalledWith('os-board-1');
      expect(mockCancelScheduled).not.toHaveBeenCalledWith('os-other');
    });

    it('alight kind 알림은 sweep 대상이 아니다 (상수 불일치)', async () => {
      mockGetAllScheduled.mockResolvedValue([
        { identifier: 'os-alight', content: { data: { kind: 'alight-alert' } } },
      ]);
      await cancelBoardingAlert();
      expect(mockCancelScheduled).not.toHaveBeenCalled();
    });

    it('getAllScheduled가 throw해도 호출자에게 던지지 않는다', async () => {
      mockGetAllScheduled.mockRejectedValue(new Error('os queue read failed'));
      await expect(cancelBoardingAlert()).resolves.toBeUndefined();
    });
  });

  // ── 세션 키 스탬프 + 교체 정리 keep-필터 (G3): 세션 교체 시 이전 세션의 늦은
  // 정리가 새 세션이 방금 예약한 알림을 지우는 레이스를 차단한다.
  describe('세션 키 스탬프 + keep-필터 (G3)', () => {
    it('활성 세션이 있으면 data에 sessionKey를 스탬프한다', async () => {
      mockGetSession.mockReturnValue({ startedAt: 1234 });
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
        arrival,
        expect.objectContaining({
          data: expect.objectContaining({ sessionKey: '1234' }),
        })
      );
    });

    it('세션이 없으면 sessionKey 필드를 생략한다', async () => {
      mockGetSession.mockReturnValue(null);
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
        arrival,
        expect.objectContaining({
          data: expect.not.objectContaining({ sessionKey: expect.anything() }),
        })
      );
    });

    it('keepSessionKey 지정 시 그 세션 알림은 보존하고 나머지 kind 매칭만 취소한다', async () => {
      mockGetAllScheduled.mockResolvedValue([
        { identifier: 'keep-new', content: { data: { kind: BOARDING_ALERT_KIND, sessionKey: 'new' } } },
        { identifier: 'drop-old', content: { data: { kind: BOARDING_ALERT_KIND, sessionKey: 'old' } } },
        { identifier: 'drop-nokey', content: { data: { kind: BOARDING_ALERT_KIND } } },
      ]);
      await cancelBoardingAlert({ keepSessionKey: 'new' });
      expect(mockCancelScheduled).toHaveBeenCalledWith('drop-old');
      expect(mockCancelScheduled).toHaveBeenCalledWith('drop-nokey');
      expect(mockCancelScheduled).not.toHaveBeenCalledWith('keep-new');
    });

    it('keepSessionKey 지정 시 추적 중 ID는 취소하지 않는다 (새 세션 것일 수 있음)', async () => {
      mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('tracked-new');
      await scheduleBoardingAlert({
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      mockNotif.cancelNotification.mockClear();
      await cancelBoardingAlert({ keepSessionKey: 'new' });
      expect(mockNotif.cancelNotification).not.toHaveBeenCalled();
    });
  });
});
