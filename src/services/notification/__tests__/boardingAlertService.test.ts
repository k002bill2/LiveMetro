import * as Notifications from 'expo-notifications';
import {
  scheduleBoardingAlert,
  cancelBoardingAlert,
  BOARDING_ALERT_KIND,
} from '../boardingAlertService';
import { notificationService } from '../notificationService';
import type { NotificationSettings } from '@models/user';

// shouldSendNotification is mocked, so only non-nullness matters for the gate.
const SETTINGS = {} as unknown as NotificationSettings;

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

const arrival = new Date('2026-05-19T11:05:00.000Z');

describe('boardingAlertService', () => {
  beforeEach(async () => {
    // 모듈 스코프 추적 상태를 확실히 비운다. 공개 cancelBoardingAlert는 standalone
    // 추적 슬롯을 보존(K1)하므로, guidance로 한 번 예약해 추적 컨텍스트를 guidance로
    // 만든 뒤 전량 취소해야 lastAlertId/trackedContext가 완전히 초기화된다.
    mockNotif.requestPermissions.mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof notificationService.requestPermissions>
    >);
    mockNotif.shouldSendNotification.mockReturnValue(true);
    mockNotif.scheduleArrivalAlert.mockResolvedValue('reset-id');
    mockNotif.cancelNotification.mockResolvedValue(undefined);
    mockGetAllScheduled.mockResolvedValue([]);
    mockCancelScheduled.mockResolvedValue(undefined);
    await scheduleBoardingAlert({
      context: 'guidance',
      sessionKey: 'reset',
      stationName: 'reset',
      finalDestination: 'reset',
      arrivalTime: new Date(Date.now() + 3_600_000),
    });
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
  });

  it('returns null and does not schedule when arrivalTime is null', async () => {
    const id = await scheduleBoardingAlert({ context: 'standalone',
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
    const id = await scheduleBoardingAlert({ context: 'standalone',
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBeNull();
    expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('schedules with station/destination copy when permission is granted', async () => {
    const id = await scheduleBoardingAlert({ context: 'standalone',
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
    await scheduleBoardingAlert({ context: 'standalone',
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
    await scheduleBoardingAlert({ context: 'standalone',
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
    await scheduleBoardingAlert({ context: 'standalone',
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
    await scheduleBoardingAlert({ context: 'standalone', stationName: '강남', finalDestination: '잠실', arrivalTime: arrival });
    // 첫 예약 시점엔 취소할 이전 알림 없음
    expect(mockNotif.cancelNotification).not.toHaveBeenCalled();

    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('second-id');
    await scheduleBoardingAlert({ context: 'standalone', stationName: '강남', finalDestination: '성수', arrivalTime: arrival });
    // 두 번째 예약 전, 첫 알림(first-id)을 취소
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('first-id');
  });

  it('cancelBoardingAlert cancels the tracked guidance id once and is a no-op afterwards', async () => {
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('tracked-id');
    await scheduleBoardingAlert({
      context: 'guidance',
      sessionKey: 'S',
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });

    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('tracked-id');

    mockNotif.cancelNotification.mockClear();
    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).not.toHaveBeenCalled();
  });

  it('공개 cancel은 standalone 추적 ID를 취소하지 않는다 (추적 슬롯 공유, K1)', async () => {
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('standalone-id');
    await scheduleBoardingAlert({
      context: 'standalone',
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });

    // guidance 수명주기 정리(전량/keep 모두) — standalone 추적 ID는 건드리지 않는다.
    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).not.toHaveBeenCalledWith('standalone-id');
    await cancelBoardingAlert({ keepSessionKey: 'X' });
    expect(mockNotif.cancelNotification).not.toHaveBeenCalledWith('standalone-id');

    // 추적 상태가 보존돼 standalone 자체 dedup(내부 교체)은 여전히 이전 것을 취소한다.
    mockNotif.cancelNotification.mockClear();
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('standalone-2');
    await scheduleBoardingAlert({
      context: 'standalone',
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('standalone-id');
  });

  it('returns null when scheduling rejects (never throws to caller)', async () => {
    mockNotif.scheduleArrivalAlert.mockRejectedValue(new Error('boom'));
    const id = await scheduleBoardingAlert({ context: 'standalone',
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
      const first = await scheduleBoardingAlert({ context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: imminent,
        trainId: 'train-fired-1',
      });
      expect(first).toBe('alert-id');

      const second = await scheduleBoardingAlert({ context: 'standalone',
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
      await scheduleBoardingAlert({ context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 120_000),
        trainId: 'train-pending-1',
      });

      mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('pending-2');
      const second = await scheduleBoardingAlert({ context: 'standalone',
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
      await scheduleBoardingAlert({ context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 10_000),
        trainId: 'train-a',
      });
      const other = await scheduleBoardingAlert({ context: 'standalone',
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
        await scheduleBoardingAlert({ context: 'standalone',
          stationName: '강남',
          finalDestination: '잠실',
          arrivalTime: new Date(Date.now() + 10_000),
          trainId: 'train-reused',
        });
        // 11분 뒤 — 같은 id라도 억제 창(10분)을 벗어나면 새 알림 허용
        jest.setSystemTime(new Date('2026-07-04T08:11:00.000Z'));
        const later = await scheduleBoardingAlert({ context: 'standalone',
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
      await scheduleBoardingAlert({ context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 10_000),
      });
      const second = await scheduleBoardingAlert({ context: 'standalone',
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
      const id = await scheduleBoardingAlert({ context: 'standalone',
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
      const id = await scheduleBoardingAlert({ context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
        trainId: 'train-gated-2',
        settings,
      });
      expect(id).toBe('alert-id');
    });

    it('skips the gate entirely when settings are omitted (backward compat)', async () => {
      const id = await scheduleBoardingAlert({ context: 'standalone',
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
    it('guidance 예약은 data에 BOARDING_ALERT_KIND 마커 + sessionKey를 포함한다', async () => {
      await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: '1000',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
        arrival,
        expect.objectContaining({
          data: expect.objectContaining({ kind: BOARDING_ALERT_KIND, sessionKey: '1000' }),
        })
      );
    });

    it('standalone 예약은 kind·sessionKey 마커가 없어 guidance 고아 sweep 대상이 아니다 (H1)', async () => {
      await scheduleBoardingAlert({
        context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
        arrival,
        expect.objectContaining({
          data: expect.not.objectContaining({ kind: expect.anything() }),
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

  // ── 세션 키 스탬프(호출자 param) + 교체 정리 keep-필터 (G3/H2): 세션 교체 시
  // 이전 세션의 늦은 정리가 새 세션이 방금 예약한 알림을 지우는 레이스를 차단한다.
  describe('세션 키 스탬프 + keep-필터 (G3/H2)', () => {
    it('guidance 예약은 호출자 sessionKey를 data에 스탬프한다 (서비스는 스토어를 읽지 않음)', async () => {
      await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 'sess-xyz',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
        arrival,
        expect.objectContaining({
          data: expect.objectContaining({ sessionKey: 'sess-xyz' }),
        })
      );
    });

    it('keepSessionKey 지정 시 그 세션 알림은 보존하고 나머지 kind 매칭만 취소한다 (standalone 무마커는 비대상)', async () => {
      mockGetAllScheduled.mockResolvedValue([
        { identifier: 'keep-new', content: { data: { kind: BOARDING_ALERT_KIND, sessionKey: 'new' } } },
        { identifier: 'drop-old', content: { data: { kind: BOARDING_ALERT_KIND, sessionKey: 'old' } } },
        { identifier: 'drop-nokey', content: { data: { kind: BOARDING_ALERT_KIND } } },
        { identifier: 'standalone', content: { data: {} } }, // 마커 없음 — H1 계약상 sweep 비대상
      ]);
      await cancelBoardingAlert({ keepSessionKey: 'new' });
      expect(mockCancelScheduled).toHaveBeenCalledWith('drop-old');
      expect(mockCancelScheduled).toHaveBeenCalledWith('drop-nokey');
      expect(mockCancelScheduled).not.toHaveBeenCalledWith('keep-new');
      expect(mockCancelScheduled).not.toHaveBeenCalledWith('standalone');
    });

    it('keepSessionKey 지정 시 추적 중 ID는 취소하지 않는다 (새 세션 것일 수 있음)', async () => {
      mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('tracked-new');
      await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 'new',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      mockNotif.cancelNotification.mockClear();
      await cancelBoardingAlert({ keepSessionKey: 'new' });
      expect(mockNotif.cancelNotification).not.toHaveBeenCalled();
    });
  });

  // ── 직렬화 큐 (J2): 전량 cancel의 무필터 sweep이 진행 중일 때 다른 세션 schedule이
  // 끼어들어 sweep 스냅샷에 잡혀 취소되는 레이스를, 순차 실행으로 차단한다.
  describe('직렬화 큐 (J2)', () => {
    it('전량 cancel이 진행 중이면 후속 schedule은 cancel 완료 후에야 예약한다', async () => {
      let resolveSweep: (v: unknown[]) => void = () => undefined;
      mockGetAllScheduled.mockReturnValueOnce(
        new Promise<unknown[]>((resolve) => {
          resolveSweep = resolve;
        })
      );
      const cancelP = cancelBoardingAlert(); // 전량 sweep — getAllScheduled에서 멈춤
      const scheduleP = scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 'B',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      // cancel이 sweep에서 대기 중 — schedule은 큐 뒤에서 대기, 아직 예약 안 됨.
      await Promise.resolve();
      await Promise.resolve();
      expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
      // cancel의 sweep 완료 → 이후 schedule 실행 → B 예약(취소되지 않음).
      resolveSweep([]);
      await cancelP;
      await scheduleP;
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalled();
    });
  });

  // ── 예약 경로 컨텍스트 격리 (T1): standalone 예약의 사전 dedup이 guidance 마커
  // 알림을 sweep하지 않는다(standalone은 마커가 없어 sweep이 남의 것만 지우는 역설).
  describe('예약 경로 컨텍스트 격리 (T1)', () => {
    it('standalone 예약은 guidance 알림을 sweep하지 않는다', async () => {
      mockGetAllScheduled.mockResolvedValue([
        { identifier: 'guidance-pending', content: { data: { kind: BOARDING_ALERT_KIND, sessionKey: 'g' } } },
      ]);
      await scheduleBoardingAlert({
        context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      // standalone 예약의 사전 dedup은 kind sweep을 돌리지 않는다 → guidance 알림 생존.
      expect(mockCancelScheduled).not.toHaveBeenCalledWith('guidance-pending');
    });

    it('guidance 예약은 사전 dedup에서 guidance kind를 sweep한다 (회귀)', async () => {
      mockGetAllScheduled.mockResolvedValue([
        { identifier: 'old-guidance', content: { data: { kind: BOARDING_ALERT_KIND, sessionKey: 'old' } } },
      ]);
      await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 'new',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockCancelScheduled).toHaveBeenCalledWith('old-guidance');
    });

    it('standalone 예약은 guidance 추적 ID를 취소하지 않는다 (같은 컨텍스트만)', async () => {
      // guidance 알림을 먼저 추적시킨 뒤 standalone 예약 → guidance 추적 ID 미취소.
      mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('g-tracked');
      await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 'g',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      mockNotif.cancelNotification.mockClear();
      await scheduleBoardingAlert({
        context: 'standalone',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: arrival,
      });
      expect(mockNotif.cancelNotification).not.toHaveBeenCalledWith('g-tracked');
    });
  });

  describe('settings opt-out (AA1 gated-reschedule cancellation)', () => {
    it('cancels the pending guidance boarding alert and does not reschedule when settings are off', async () => {
      // 1) settings ON → establish a tracked pending alert for this session.
      mockNotif.shouldSendNotification.mockReturnValue(true);
      mockNotif.scheduleArrivalAlert.mockResolvedValue('pending-id');
      await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 's1',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 3_600_000),
      });
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(1);
      mockNotif.scheduleArrivalAlert.mockClear();
      mockNotif.cancelNotification.mockClear();

      // 2) settings OFF → the gated schedule must cancel the pending alert
      //    (cancel-half of cancel-then-schedule) and NOT schedule a new one.
      mockNotif.shouldSendNotification.mockReturnValue(false);
      const id = await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 's1',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 3_600_000),
        settings: SETTINGS,
      });

      expect(id).toBeNull();
      expect(mockNotif.cancelNotification).toHaveBeenCalledWith('pending-id');
      expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
    });

    it('schedules normally when settings are on (regression)', async () => {
      mockNotif.shouldSendNotification.mockReturnValue(true);
      mockNotif.scheduleArrivalAlert.mockResolvedValue('new-id');
      const id = await scheduleBoardingAlert({
        context: 'guidance',
        sessionKey: 's1',
        stationName: '강남',
        finalDestination: '잠실',
        arrivalTime: new Date(Date.now() + 3_600_000),
      });
      expect(id).toBe('new-id');
      expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledTimes(1);
    });
  });
});
