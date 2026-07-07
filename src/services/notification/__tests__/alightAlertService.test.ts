/**
 * alightAlertService — 하차 임박 알림 예약/취소/dedup.
 * 모듈 스코프 상태(추적 id/stepKey/fireAt)가 있어 jest.resetModules로 격리한다.
 */
jest.mock('../notificationService', () => ({
  notificationService: {
    requestPermissions: jest.fn(),
    shouldSendNotification: jest.fn(),
    scheduleArrivalAlert: jest.fn(),
    cancelNotification: jest.fn(),
  },
  NotificationType: { ARRIVAL_REMINDER: 'arrival_reminder' },
}));

import type { NotificationSettings } from '@models/user';

const NOW = 1_750_000_000_000;

type Svc = typeof import('../alightAlertService');
type MockNotif = {
  requestPermissions: jest.Mock;
  shouldSendNotification: jest.Mock;
  scheduleArrivalAlert: jest.Mock;
  cancelNotification: jest.Mock;
};

// alightAlert만 실려 있으면 되므로 최소 형태로 캐스팅 (resolve/게이트 경로만 사용).
const settingsWith = (alightAlert?: { enabled: boolean; leadMinutes: 1 | 2 | 3 }): NotificationSettings =>
  ({ alightAlert } as unknown as NotificationSettings);

const baseParams = {
  stationName: '신도림',
  nextKind: 'transfer' as const,
  toLineName: '2호선',
  arrivalAtMs: NOW + 10 * 60_000, // 10분 뒤 도착
  stepKey: '1000:1',
  settings: settingsWith({ enabled: true, leadMinutes: 2 }),
};

let svc: Svc;
let notif: MockNotif;

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  svc = require('../alightAlertService');
  notif = require('../notificationService').notificationService;
  notif.requestPermissions.mockResolvedValue({ granted: true });
  notif.shouldSendNotification.mockReturnValue(true);
  notif.scheduleArrivalAlert.mockResolvedValue('alert-1');
  notif.cancelNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduleAlightAlert', () => {
  it('schedules leadMinutes*60 seconds before arrival with transfer copy', async () => {
    const id = await svc.scheduleAlightAlert(baseParams);
    expect(id).toBe('alert-1');
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      new Date(baseParams.arrivalAtMs),
      expect.objectContaining({
        secondsBefore: 120,
        title: '곧 신도림역 도착',
        body: '2호선 환승을 준비하세요',
        data: { variant: 'transfer', stationName: '신도림' },
      })
    );
  });

  it('uses alight copy for the final destination', async () => {
    await svc.scheduleAlightAlert({ ...baseParams, nextKind: 'alight', toLineName: undefined });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ body: '내릴 준비를 하세요', data: expect.objectContaining({ variant: 'alight' }) })
    );
  });

  it('applies leadMinutes from settings (3분 → 180s)', async () => {
    await svc.scheduleAlightAlert({
      ...baseParams,
      settings: settingsWith({ enabled: true, leadMinutes: 3 }),
    });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ secondsBefore: 180 })
    );
  });

  it('defaults to 2분 전 when settings is null (기본값 리졸브)', async () => {
    await svc.scheduleAlightAlert({ ...baseParams, settings: null });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ secondsBefore: 120 })
    );
  });

  it('returns null WITHOUT scheduling when fire time is past/imminent (즉시발사 강등 금지)', async () => {
    const id = await svc.scheduleAlightAlert({
      ...baseParams,
      arrivalAtMs: NOW + 2 * 60_000 + 3_000, // fireAt = NOW+3s < 5s 최소 리드
    });
    expect(id).toBeNull();
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('dedups: same stepKey + fireAt within 15s tolerance → returns tracked id, no reschedule', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockClear();
    const id = await svc.scheduleAlightAlert({ ...baseParams, arrivalAtMs: baseParams.arrivalAtMs + 10_000 });
    expect(id).toBe('alert-1');
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
    expect(notif.cancelNotification).not.toHaveBeenCalled();
  });

  it('reschedules (cancel → schedule) when fireAt shifts beyond tolerance — 열차 변경 rebase', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockResolvedValue('alert-2');
    const id = await svc.scheduleAlightAlert({ ...baseParams, arrivalAtMs: baseParams.arrivalAtMs + 60_000 });
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(id).toBe('alert-2');
  });

  it('reschedules when stepKey changes (다음 ride 구간)', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockResolvedValue('alert-2');
    const id = await svc.scheduleAlightAlert({ ...baseParams, stepKey: '1000:3' });
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(id).toBe('alert-2');
  });

  it('returns null and cancels pending when the setting is disabled', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockClear();
    const id = await svc.scheduleAlightAlert({
      ...baseParams,
      settings: settingsWith({ enabled: false, leadMinutes: 2 }),
    });
    expect(id).toBeNull();
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    notif.requestPermissions.mockResolvedValue({ granted: false });
    expect(await svc.scheduleAlightAlert(baseParams)).toBeNull();
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('returns null when shouldSendNotification gates it (quietHours 등)', async () => {
    notif.shouldSendNotification.mockReturnValue(false);
    expect(await svc.scheduleAlightAlert(baseParams)).toBeNull();
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('evaluates shouldSendNotification at the fire time, not the schedule time (조용한 시간 경계)', async () => {
    await svc.scheduleAlightAlert(baseParams);
    // leadMinutes 2분 → fireAt = arrivalAt - 2분. 게이트는 예약 시각(now)이 아닌 발사 시각으로 평가한다.
    expect(notif.shouldSendNotification).toHaveBeenCalledWith(
      baseParams.settings,
      'arrival_reminder',
      new Date(baseParams.arrivalAtMs - 2 * 60_000)
    );
  });

  it('cancels pending when a re-call is gated by shouldSendNotification (음소거 전환)', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockClear();
    notif.shouldSendNotification.mockReturnValue(false);
    const id = await svc.scheduleAlightAlert(baseParams);
    expect(id).toBeNull();
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('cancels pending when a re-call is denied permission (권한 회수)', async () => {
    await svc.scheduleAlightAlert(baseParams);
    notif.scheduleArrivalAlert.mockClear();
    notif.requestPermissions.mockResolvedValue({ granted: false });
    const id = await svc.scheduleAlightAlert(baseParams);
    expect(id).toBeNull();
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(notif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('never throws — returns null on scheduling error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    notif.scheduleArrivalAlert.mockRejectedValue(new Error('boom'));
    await expect(svc.scheduleAlightAlert(baseParams)).resolves.toBeNull();
    errorSpy.mockRestore();
  });
});

describe('cancelAlightAlert', () => {
  it('cancels the tracked alert and is a no-op when none', async () => {
    await svc.cancelAlightAlert(); // no-op
    expect(notif.cancelNotification).not.toHaveBeenCalled();
    await svc.scheduleAlightAlert(baseParams);
    await svc.cancelAlightAlert();
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    // 두 번째 호출은 no-op (추적 해제 확인)
    notif.cancelNotification.mockClear();
    await svc.cancelAlightAlert();
    expect(notif.cancelNotification).not.toHaveBeenCalled();
  });
});
