/**
 * boardingAlertService — orchestrates the "탑승 열차 30초 전 도착 알림".
 *
 * Sits on top of `notificationService.scheduleArrivalAlert` (which owns the
 * expo-notifications scheduling) and adds the boarding-specific lifecycle:
 *   - requests notification permission at board time (skipped silently if denied),
 *   - de-duplicates: cancels the previously scheduled boarding alert before
 *     scheduling a new one, so re-boarding a different train never leaves a stale
 *     alert pending,
 *   - composes the user-facing copy from station + destination.
 *
 * The scheduled id is tracked at module scope (JS-heap, like
 * boardingSelectionStore) — NOT in the screen — because the boarding screen
 * unmounts (goBack) right after scheduling. A screen-ref + unmount-cleanup would
 * cancel the very alert we just scheduled; module-level dedup avoids that trap.
 */
import { notificationService, NotificationType } from './notificationService';
import type { NotificationSettings } from '@models/user';

const DEFAULT_SECONDS_BEFORE = 30;

/**
 * 같은 열차 재알림 억제 창. 열차 번호(btrainNo)는 다른 날 재사용될 수 있어
 * 억제를 무기한 유지하면 정당한 알림까지 삼킨다 — 한 번의 승강장 대기를
 * 충분히 덮는 길이로 제한.
 */
const FIRED_DEDUP_WINDOW_MS = 10 * 60 * 1000;

let lastAlertId: string | null = null;
// 마지막으로 예약한 알림의 (열차 키, 발사 시각) — "이미 발사된 알림은 취소
// 불가"라는 OS 제약 아래에서, 발사 후 재스케줄(=즉시발사 강등 → 중복 배너)을
// 차단하는 발사 이력. trainId를 넘긴 호출자에게만 적용된다.
let lastScheduledTrainId: string | null = null;
let lastScheduledFireAtMs: number | null = null;

export interface BoardingAlertParams {
  readonly stationName: string;
  readonly finalDestination: string;
  readonly arrivalTime: Date | null;
  readonly secondsBefore?: number;
  /** Copy variant: 'board' (first train, default) or 'transfer' (transfer train). */
  readonly variant?: 'board' | 'transfer';
  /** Poll-stable train id (btrainNo 기반) — 제공 시 발사-이력 dedup 활성화. */
  readonly trainId?: string;
  /** 사용자 알림 설정 — 제공 시 shouldSendNotification 게이트를 통과해야 예약. */
  readonly settings?: NotificationSettings | null;
}

/**
 * Schedule a 30s-before-arrival local notification for the boarded train.
 * Returns the scheduled identifier, or null when not scheduled (no arrival time,
 * permission denied, or an error). Never throws.
 */
export const scheduleBoardingAlert = async (
  params: BoardingAlertParams
): Promise<string | null> => {
  const {
    stationName,
    finalDestination,
    arrivalTime,
    secondsBefore = DEFAULT_SECONDS_BEFORE,
    variant = 'board',
    trainId,
    settings,
  } = params;

  // 명시적 null 체크 — Date는 falsy가 아니므로 안전하지만 의도 명확화.
  if (arrivalTime === null) return null;

  try {
    const permission = await notificationService.requestPermissions();
    if (!permission.granted) return null;

    if (
      settings != null &&
      !notificationService.shouldSendNotification(settings, NotificationType.ARRIVAL_REMINDER)
    ) {
      return null;
    }

    // 발사 이력 dedup: 같은 열차의 알림이 이미 발사됐다면(fireAt 경과) 재예약
    // 금지 — 재예약은 과거 트리거로 강등되어 즉시 중복 배너가 된다.
    const fireAtMs = arrivalTime.getTime() - secondsBefore * 1000;
    if (
      trainId != null &&
      trainId === lastScheduledTrainId &&
      lastScheduledFireAtMs !== null
    ) {
      const now = Date.now();
      const alreadyFired =
        now >= lastScheduledFireAtMs && now - lastScheduledFireAtMs < FIRED_DEDUP_WINDOW_MS;
      if (alreadyFired) return null;
    }

    // 다른 열차로 재탑승 시 이전 알림이 남지 않도록 먼저 취소.
    await cancelBoardingAlert();

    // 환승은 종착역(finalDestination)이 대기 방향과 어긋날 수 있어 카피에서 생략.
    const copy =
      variant === 'transfer'
        ? { title: '환승 열차 곧 도착', body: `${stationName} 환승 승강장으로 이동하세요` }
        : {
            title: `${finalDestination} 방면 곧 도착`,
            body: `${stationName}역 승강장으로 이동할 시간이에요`,
          };

    const id = await notificationService.scheduleArrivalAlert(arrivalTime, {
      secondsBefore,
      title: copy.title,
      body: copy.body,
      data: { stationName, finalDestination, variant },
    });

    lastAlertId = id;
    if (id !== null) {
      lastScheduledTrainId = trainId ?? null;
      lastScheduledFireAtMs = fireAtMs;
    }
    return id;
  } catch (error) {
    console.error('Error scheduling boarding alert:', error);
    return null;
  }
};

/** Cancel the currently tracked boarding alert, if any. No-op when none. */
export const cancelBoardingAlert = async (): Promise<void> => {
  if (lastAlertId === null) return;
  const id = lastAlertId;
  lastAlertId = null;
  await notificationService.cancelNotification(id);
};
