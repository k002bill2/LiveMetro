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
import { notificationService } from './notificationService';

const DEFAULT_SECONDS_BEFORE = 30;

let lastAlertId: string | null = null;

export interface BoardingAlertParams {
  readonly stationName: string;
  readonly finalDestination: string;
  readonly arrivalTime: Date | null;
  readonly secondsBefore?: number;
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
  } = params;

  // 명시적 null 체크 — Date는 falsy가 아니므로 안전하지만 의도 명확화.
  if (arrivalTime === null) return null;

  try {
    const permission = await notificationService.requestPermissions();
    if (!permission.granted) return null;

    // 다른 열차로 재탑승 시 이전 알림이 남지 않도록 먼저 취소.
    await cancelBoardingAlert();

    const id = await notificationService.scheduleArrivalAlert(arrivalTime, {
      secondsBefore,
      title: `${finalDestination} 방면 곧 도착`,
      body: `${stationName}역 승강장으로 이동할 시간이에요`,
      data: { stationName, finalDestination },
    });

    lastAlertId = id;
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
