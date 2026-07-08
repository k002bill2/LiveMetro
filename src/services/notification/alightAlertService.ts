/**
 * alightAlertService — 길안내 "하차 임박 알림" (환승역/목적지 도착 N분 전).
 *
 * `notificationService.scheduleArrivalAlert` 위에 하차-특화 라이프사이클을 얹는다:
 *   - 설정 게이트: alightAlert.enabled(전용 토글) + shouldSendNotification(전역/quietHours),
 *   - 과거/임박 발사 시각은 예약 자체를 생략 — scheduleArrivalAlert의 즉시발사
 *     강등(trigger:null)에 절대 도달하지 않게 한다 (발사 후 재예약 반복 버그 클래스),
 *   - stepKey(세션 시각:스텝 인덱스) 단위 dedup: 같은 스텝의 틱/재렌더 재호출은
 *     기존 예약을 재사용하고, 도착 추정이 크게 바뀐 경우(열차 변경 rebase)만
 *     취소-후-교체한다.
 *
 * 추적 상태는 모듈 스코프(JS-heap) — boardingAlertService와 같은 이유로 화면
 * 라이프사이클과 분리한다. 서비스 함수는 throw하지 않는다.
 *
 * 강건성(Codex P2 3건):
 *   - 공개 API를 직렬화 큐로 감싸 await 도중 끼어드는 cancel/schedule의 늦은-완료
 *     레이스를 원천 차단한다 (commuteReminderService의 직렬화 큐 선례),
 *   - 예약에 전용 `kind` 마커를 심고 취소 시 OS 큐를 sweep — 앱/JS 재시작으로
 *     추적이 끊긴 고아 알림까지 청소한다,
 *   - 임박-생략 경로에서 새 요청이 기존 예약을 대체하면 구식 pending을 취소한다.
 */
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationType } from './notificationService';
import { resolveAlightAlertPreferences } from '@models/user';
import type { NotificationSettings } from '@models/user';

/** 발사 시각까지 최소 여유 — 이보다 임박하면 예약을 생략한다. */
const MIN_SCHEDULE_LEAD_MS = 5_000;
/** 같은 스텝에서 이 이내의 fireAt 변동은 틱 잡음으로 보고 재예약하지 않는다. */
const RESCHEDULE_TOLERANCE_MS = 15_000;

/**
 * 예약 data에 심는 하차 알림 전용 식별자. boarding 알림이 같은
 * NotificationType.ARRIVAL_REMINDER + variant:'board'|'transfer'를 쓰므로 variant로는
 * 구분 불가('transfer' 충돌) — sweep은 이 `kind`로만 하차 알림을 특정한다.
 */
export const ALIGHT_ALERT_KIND = 'alight-alert';

let trackedId: string | null = null;
let trackedStepKey: string | null = null;
let trackedFireAtMs: number | null = null;

// 공개 API 호출을 도착 순서대로 직렬화한다. await 도중 끼어드는 cancel/schedule이
// 추적 상태를 엇갈리게 읽는 레이스(늦은 완료가 취소를 덮어씀)를 원천 차단한다
// (commuteReminderService의 직렬화 큐 선례).
let opQueue: Promise<unknown> = Promise.resolve();

const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
  const run = opQueue.then(op, op);
  opQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

export interface AlightAlertParams {
  /** 하차할 역 이름 (다음 스텝의 stationName). */
  readonly stationName: string;
  /** 다음 스텝 종류 — 환승 대기('transfer') 또는 최종 하차('alight'). */
  readonly nextKind: 'transfer' | 'alight';
  /** nextKind='transfer'일 때 갈아탈 노선 이름. */
  readonly toLineName?: string;
  /** 하차역 도착 예정 epoch ms (ride 스텝 anchor + duration — 틱 불변). */
  readonly arrivalAtMs: number;
  /** `${session.startedAt}:${stepIndex}` — 스텝 단위 dedup 키. */
  readonly stepKey: string;
  /** 사용자 알림 설정 — 없으면 기본값(켜짐, 2분 전)으로 해석. */
  readonly settings?: NotificationSettings | null;
}

/**
 * 하차 임박 알림을 예약한다. 예약된 identifier를, 게이트/임박/에러로 예약하지
 * 않은 경우 null을 반환한다. 설정이 꺼져 있으면 기존 pending도 취소한다.
 * 공개 함수는 직렬화 큐를 통해 순차 실행된다. Never throws.
 */
export const scheduleAlightAlert = (
  params: AlightAlertParams
): Promise<string | null> => enqueue(() => scheduleAlightAlertInner(params));

const scheduleAlightAlertInner = async (
  params: AlightAlertParams
): Promise<string | null> => {
  const { stationName, nextKind, toLineName, arrivalAtMs, stepKey, settings } = params;

  try {
    const prefs = resolveAlightAlertPreferences(settings);
    if (!prefs.enabled) {
      await cancelAlightAlertInner();
      return null;
    }

    // 게이트(설정/권한/전역 알림 게이트)로 막힌 예약 요청은 직전 pending도 취소한다
    // — 권한 회수/음소거 전환에 옛 예약이 발사되면 안 되기 때문.
    const permission = await notificationService.requestPermissions();
    if (!permission.granted) {
      await cancelAlightAlertInner();
      return null;
    }

    // 발사 시각 기준으로 quiet-hours/weekdaysOnly를 평가한다 — pending은 예약 시각이 아닌
    // fireAtMs에 발사되므로, 승차가 조용한 시간 경계를 걸치면 예약 시각 평가는 틀린다.
    const fireAtMs = arrivalAtMs - prefs.leadMinutes * 60_000;
    if (
      settings != null &&
      !notificationService.shouldSendNotification(
        settings,
        NotificationType.ARRIVAL_REMINDER,
        new Date(fireAtMs)
      )
    ) {
      await cancelAlightAlertInner();
      return null;
    }

    if (fireAtMs - Date.now() < MIN_SCHEDULE_LEAD_MS) {
      // 새 요청이 기존 예약을 대체하는 경우(다른 스텝이거나 발사 시각이 크게
      // 이동 — 예: 더 이른 열차로 rebase)에는 구식 pending을 지운다. 같은
      // 스텝·같은 시각(허용오차 내)의 재호출이면 곧 발사될 유효 예약을 지키기
      // 위해 취소하지 않는다.
      const supersedesTracked =
        trackedId !== null &&
        !(
          stepKey === trackedStepKey &&
          trackedFireAtMs !== null &&
          Math.abs(fireAtMs - trackedFireAtMs) <= RESCHEDULE_TOLERANCE_MS
        );
      if (supersedesTracked) await cancelAlightAlertInner();
      return null;
    }

    if (
      trackedId !== null &&
      stepKey === trackedStepKey &&
      trackedFireAtMs !== null &&
      Math.abs(fireAtMs - trackedFireAtMs) <= RESCHEDULE_TOLERANCE_MS
    ) {
      return trackedId;
    }

    await cancelAlightAlertInner();

    const copy =
      nextKind === 'transfer'
        ? { title: `곧 ${stationName}역 도착`, body: `${toLineName ?? ''} 환승을 준비하세요`.trim() }
        : { title: `곧 ${stationName}역 도착`, body: '내릴 준비를 하세요' };

    const id = await notificationService.scheduleArrivalAlert(new Date(arrivalAtMs), {
      secondsBefore: prefs.leadMinutes * 60,
      title: copy.title,
      body: copy.body,
      data: { kind: ALIGHT_ALERT_KIND, variant: nextKind, stationName },
    });

    if (id !== null) {
      trackedId = id;
      trackedStepKey = stepKey;
      trackedFireAtMs = fireAtMs;
    }
    return id;
  } catch (error) {
    console.error('Error scheduling alight alert:', error);
    return null;
  }
};

/**
 * 추적 중인 하차 임박 알림을 취소하고, OS 큐에 남은 하차 알림 고아까지 sweep한다.
 * 공개 함수는 직렬화 큐를 통해 순차 실행된다. Never throws.
 */
export const cancelAlightAlert = (): Promise<void> =>
  enqueue(() => cancelAlightAlertInner());

const cancelAlightAlertInner = async (): Promise<void> => {
  const id = trackedId;
  trackedId = null;
  trackedStepKey = null;
  trackedFireAtMs = null;
  if (id !== null) {
    try {
      await notificationService.cancelNotification(id);
    } catch (error) {
      console.error('Error cancelling alight alert:', error);
    }
  }
  // OS 큐를 훑어 kind 마커가 붙은 하차 알림을 전부 취소한다 — 앱/JS 재시작으로
  // 추적이 끊긴 고아까지 청소한다. boarding 알림(kind 없음)은 건드리지 않는다.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.content?.data?.kind === ALIGHT_ALERT_KIND) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
  } catch (error) {
    console.error('Error sweeping alight alerts:', error);
  }
};
