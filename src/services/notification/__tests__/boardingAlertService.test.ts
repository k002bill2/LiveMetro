import {
  scheduleBoardingAlert,
  cancelBoardingAlert,
} from '../boardingAlertService';
import { notificationService } from '../notificationService';

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

const mockNotif = notificationService as jest.Mocked<typeof notificationService>;

const arrival = new Date('2026-05-19T11:05:00.000Z');

describe('boardingAlertService', () => {
  beforeEach(async () => {
    mockNotif.cancelNotification.mockResolvedValue(undefined);
    // 이전 테스트의 모듈 레벨 lastId 잔재 제거
    await cancelBoardingAlert();
    jest.clearAllMocks();
    mockNotif.requestPermissions.mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof notificationService.requestPermissions>
    >);
    mockNotif.scheduleArrivalAlert.mockResolvedValue('alert-id');
    mockNotif.cancelNotification.mockResolvedValue(undefined);
    mockNotif.shouldSendNotification.mockReturnValue(true);
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
});
