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
 */
import { notificationService, NotificationType } from './notificationService';
import { resolveAlightAlertPreferences } from '@models/user';
import type { NotificationSettings } from '@models/user';

/** 발사 시각까지 최소 여유 — 이보다 임박하면 예약을 생략한다. */
const MIN_SCHEDULE_LEAD_MS = 5_000;
/** 같은 스텝에서 이 이내의 fireAt 변동은 틱 잡음으로 보고 재예약하지 않는다. */
const RESCHEDULE_TOLERANCE_MS = 15_000;

let trackedId: string | null = null;
let trackedStepKey: string | null = null;
let trackedFireAtMs: number | null = null;

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
 * Never throws.
 */
export const scheduleAlightAlert = async (
  params: AlightAlertParams
): Promise<string | null> => {
  const { stationName, nextKind, toLineName, arrivalAtMs, stepKey, settings } = params;

  try {
    const prefs = resolveAlightAlertPreferences(settings);
    if (!prefs.enabled) {
      await cancelAlightAlert();
      return null;
    }

    // 게이트(설정/권한/전역 알림 게이트)로 막힌 예약 요청은 직전 pending도 취소한다
    // — 권한 회수/음소거 전환에 옛 예약이 발사되면 안 되기 때문. 임박-발사 생략 경로는
    //   제외(유효한 기존 예약을 유지한다).
    const permission = await notificationService.requestPermissions();
    if (!permission.granted) {
      await cancelAlightAlert();
      return null;
    }

    if (
      settings != null &&
      !notificationService.shouldSendNotification(settings, NotificationType.ARRIVAL_REMINDER)
    ) {
      await cancelAlightAlert();
      return null;
    }

    const fireAtMs = arrivalAtMs - prefs.leadMinutes * 60_000;
    if (fireAtMs - Date.now() < MIN_SCHEDULE_LEAD_MS) return null;

    if (
      trackedId !== null &&
      stepKey === trackedStepKey &&
      trackedFireAtMs !== null &&
      Math.abs(fireAtMs - trackedFireAtMs) <= RESCHEDULE_TOLERANCE_MS
    ) {
      return trackedId;
    }

    await cancelAlightAlert();

    const copy =
      nextKind === 'transfer'
        ? { title: `곧 ${stationName}역 도착`, body: `${toLineName ?? ''} 환승을 준비하세요`.trim() }
        : { title: `곧 ${stationName}역 도착`, body: '내릴 준비를 하세요' };

    const id = await notificationService.scheduleArrivalAlert(new Date(arrivalAtMs), {
      secondsBefore: prefs.leadMinutes * 60,
      title: copy.title,
      body: copy.body,
      data: { variant: nextKind, stationName },
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

/** 추적 중인 하차 임박 알림을 취소한다. 없으면 no-op. Never throws. */
export const cancelAlightAlert = async (): Promise<void> => {
  if (trackedId === null) return;
  const id = trackedId;
  trackedId = null;
  trackedStepKey = null;
  trackedFireAtMs = null;
  try {
    await notificationService.cancelNotification(id);
  } catch (error) {
    console.error('Error cancelling alight alert:', error);
  }
};
