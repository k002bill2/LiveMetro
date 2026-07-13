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

// cancelAlightAlert가 OS 큐를 직접 훑어 고아 하차 알림(kind 마커)을 sweep하므로
// expo-notifications를 직접 mock한다 (notificationService에 alight 도메인 지식을 새지 않기 위함).
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

// 세션 키 스탬프용 — 서비스가 직접 읽는 활성 세션을 제어한다 (기본 null).
jest.mock('@/services/guidance/guidanceSessionStore', () => ({
  getGuidanceSession: jest.fn(() => null),
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
type MockExpo = {
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
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
let expo: MockExpo;
let store: { getGuidanceSession: jest.Mock };

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  svc = require('../alightAlertService');
  notif = require('../notificationService').notificationService;
  expo = require('expo-notifications');
  store = require('@/services/guidance/guidanceSessionStore');
  notif.requestPermissions.mockResolvedValue({ granted: true });
  notif.shouldSendNotification.mockReturnValue(true);
  notif.scheduleArrivalAlert.mockResolvedValue('alert-1');
  notif.cancelNotification.mockResolvedValue(undefined);
  expo.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  expo.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  store.getGuidanceSession.mockReturnValue(null);
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
        data: { kind: 'alight-alert', variant: 'transfer', stationName: '신도림' },
      })
    );
  });

  it('uses alight copy for the final destination', async () => {
    await svc.scheduleAlightAlert({ ...baseParams, nextKind: 'alight', toLineName: undefined });
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({ body: '내릴 준비를 하세요', data: expect.objectContaining({ kind: 'alight-alert', variant: 'alight' }) })
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

  it('supersede: imminent re-call whose fireAt has shifted cancels the stale pending (더 이른 열차 rebase)', async () => {
    await svc.scheduleAlightAlert(baseParams); // alert-1, fireAt = NOW+8분 (미래)
    const id = await svc.scheduleAlightAlert({
      ...baseParams,
      arrivalAtMs: NOW + 2 * 60_000 + 3_000, // fireAt = NOW+3s < 5s 임박, 기존과 크게 이동
    });
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-1');
    expect(id).toBeNull();
  });

  it('preserves the valid pending when an imminent re-call is the same schedule (허용오차 내)', async () => {
    await svc.scheduleAlightAlert(baseParams); // alert-1, fireAt = NOW+8분
    notif.cancelNotification.mockClear();
    // 발사 3초 전으로 시간을 전진 — 동일 예약이지만 이제 임박 경로를 탄다.
    (Date.now as jest.Mock).mockReturnValue(baseParams.arrivalAtMs - 2 * 60_000 - 3_000);
    const id = await svc.scheduleAlightAlert(baseParams); // 동일 arrivalAtMs·동일 stepKey
    expect(notif.cancelNotification).not.toHaveBeenCalled();
    expect(id).toBeNull();
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

  it('sweeps orphaned alight alerts off the OS queue, sparing boarding alerts (재시작 복원 고아)', async () => {
    expo.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'orphan-1', content: { data: { kind: 'alight-alert' } } },
      {
        identifier: 'boarding-1',
        content: { data: { variant: 'transfer', stationName: 'x', finalDestination: 'y' } },
      },
    ]);
    await svc.cancelAlightAlert(); // 추적 상태 없음 — sweep만 수행
    expect(expo.cancelScheduledNotificationAsync).toHaveBeenCalledWith('orphan-1');
    expect(expo.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('boarding-1');
  });
});

describe('serialization (Codex P2 — 늦은 완료 레이스)', () => {
  it('a cancel awaiting an in-flight schedule cancels the late-resolved id', async () => {
    let resolveSchedule: (id: string) => void = () => undefined;
    notif.scheduleArrivalAlert.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveSchedule = resolve;
      })
    );
    const p = svc.scheduleAlightAlert(baseParams); // in-flight — schedule await 중
    const c = svc.cancelAlightAlert(); // 큐에 직렬화되어 p 완료 후 실행
    resolveSchedule('alert-9');
    await p;
    await c;
    // 직렬화가 없으면 cancel이 trackedId=null일 때 지나가고 'alert-9'가 고아로 남는다.
    expect(notif.cancelNotification).toHaveBeenCalledWith('alert-9');
    // 추적 상태가 비워졌는지 — 후속 cancel은 no-op.
    notif.cancelNotification.mockClear();
    await svc.cancelAlightAlert();
    expect(notif.cancelNotification).not.toHaveBeenCalled();
  });
});

// ── 세션 키 스탬프 + 교체 정리 keep-필터 (G3, boarding과 대칭)
describe('세션 키 스탬프 + keep-필터 (G3)', () => {
  it('활성 세션이 있으면 data에 sessionKey를 스탬프한다', async () => {
    store.getGuidanceSession.mockReturnValue({ startedAt: 1234 });
    await svc.scheduleAlightAlert(baseParams);
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({
        data: expect.objectContaining({ sessionKey: '1234' }),
      })
    );
  });

  it('세션이 없으면 sessionKey 필드를 생략한다', async () => {
    store.getGuidanceSession.mockReturnValue(null);
    await svc.scheduleAlightAlert(baseParams);
    expect(notif.scheduleArrivalAlert).toHaveBeenCalledWith(
      expect.any(Date),
      expect.objectContaining({
        data: expect.not.objectContaining({ sessionKey: expect.anything() }),
      })
    );
  });

  it('keepSessionKey 지정 시 그 세션 알림은 보존하고 나머지 kind 매칭만 취소한다', async () => {
    expo.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'keep-new', content: { data: { kind: 'alight-alert', sessionKey: 'new' } } },
      { identifier: 'drop-old', content: { data: { kind: 'alight-alert', sessionKey: 'old' } } },
      { identifier: 'drop-nokey', content: { data: { kind: 'alight-alert' } } },
    ]);
    await svc.cancelAlightAlert({ keepSessionKey: 'new' });
    expect(expo.cancelScheduledNotificationAsync).toHaveBeenCalledWith('drop-old');
    expect(expo.cancelScheduledNotificationAsync).toHaveBeenCalledWith('drop-nokey');
    expect(expo.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('keep-new');
  });

  it('keepSessionKey 지정 시 추적 중 ID는 취소하지 않는다', async () => {
    await svc.scheduleAlightAlert(baseParams); // trackedId='alert-1'
    notif.cancelNotification.mockClear();
    await svc.cancelAlightAlert({ keepSessionKey: 'new' });
    expect(notif.cancelNotification).not.toHaveBeenCalled();
  });
});
