/**
 * Commute Departure Reminder Service
 *
 * 출퇴근 설정의 출근 출발시각에, 선택한 요일마다 앱이 꺼져 있어도 OS가 발사하는
 * 로컬 "출발 알림"을 자동 예약한다. ML 예측에 의존하지 않고 설정된 시각만 사용한다.
 *
 * 요일 표현 3종이 충돌하므로 `computeWeeklyTrigger`가 단일 격리 지점이다:
 *   - activeDays index: 0=Mon..6=Sun
 *   - 앱 DayOfWeek:      0=Sun..6=Sat
 *   - expo weekday:      1=Sun..7=Sat (WeeklyTriggerInput)
 */

import { storageUtils } from '@/utils/storageUtils';
import { notificationService } from './notificationService';

export interface CommuteReminderConfig {
  readonly departureTime: string; // "HH:mm" (morning leg)
  readonly activeDays: readonly boolean[]; // 7-element [Mon..Sun]
  readonly leadMinutes?: number; // default 0
}

export interface ScheduledReminder {
  readonly weekday: number; // expo 1=Sun..7=Sat
  readonly notificationId: string;
  readonly time: string; // "HH:mm" fire time
}

export interface WeeklyTriggerSpec {
  readonly weekday: number;
  readonly hour: number;
  readonly minute: number;
  readonly time: string;
}

// activeDays index (0=Mon..6=Sun) → expo weekday (1=Sun..7=Sat)
const activeDayIndexToExpoWeekday = (index: number): number => ((index + 1) % 7) + 1;

// shift an expo weekday by whole days (negative = earlier), staying in 1..7
const shiftExpoWeekday = (weekday: number, dayOffset: number): number =>
  ((((weekday - 1 + dayOffset) % 7) + 7) % 7) + 1;

/**
 * Convert a departure time + lead + activeDays index into an expo weekly trigger spec.
 * Returns null on malformed `departureTime`.
 */
export function computeWeeklyTrigger(
  departureTime: string,
  leadMinutes: number,
  activeDayIndex: number,
): WeeklyTriggerSpec | null {
  const parts = departureTime.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(h) || !Number.isInteger(m)) {
    return null;
  }

  const totalMinutes = h * 60 + m - leadMinutes;
  const dayOffset = Math.floor(totalMinutes / 1440); // -1 when wrapped before midnight
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const weekday = shiftExpoWeekday(activeDayIndexToExpoWeekday(activeDayIndex), dayOffset);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { weekday, hour, minute, time };
}

const STORAGE_PREFIX = '@livemetro_commute_reminders:';
const storageKey = (uid: string): string => `${STORAGE_PREFIX}${uid}`;

class CommuteReminderService {
  /** Read the persisted reminders for a user (empty when none). */
  async getCommuteReminders(uid: string): Promise<ScheduledReminder[]> {
    const stored = await storageUtils.getItem<ScheduledReminder[]>(storageKey(uid));
    return stored ?? [];
  }

  /** Cancel every persisted reminder for a user and clear storage. */
  async cancelCommuteReminders(uid: string): Promise<void> {
    const existing = await this.getCommuteReminders(uid);
    for (const reminder of existing) {
      await notificationService.cancelNotification(reminder.notificationId);
    }
    await storageUtils.removeItem(storageKey(uid));
  }

  /**
   * Schedule one weekly local notification per active day at (departureTime -
   * leadMinutes), persisting the ids. Cancels any existing reminders first so
   * repeated calls are idempotent. Persists only the schedules that succeeded.
   */
  async scheduleCommuteReminders(
    uid: string,
    config: CommuteReminderConfig,
  ): Promise<ScheduledReminder[]> {
    await this.cancelCommuteReminders(uid); // cancel-before-schedule (멱등)

    const leadMinutes = config.leadMinutes ?? 0;
    const title = '출발 시간이에요';
    const body = '지금 출발하세요';
    const scheduled: ScheduledReminder[] = [];

    for (let index = 0; index < config.activeDays.length; index++) {
      if (!config.activeDays[index]) continue;
      const spec = computeWeeklyTrigger(config.departureTime, leadMinutes, index);
      if (!spec) continue;
      const id = await notificationService.scheduleWeeklyReminder(
        spec.weekday,
        spec.hour,
        spec.minute,
        title,
        body,
      );
      if (id) {
        scheduled.push({ weekday: spec.weekday, notificationId: id, time: spec.time });
      }
    }

    await storageUtils.setItem(storageKey(uid), scheduled);
    return scheduled;
  }

  /**
   * Idempotent reconcile: ensure the OS-side reminder set matches the user's
   * current intent. Schedules when alerts are on AND a departure time exists,
   * otherwise cancels. Safe to call on app launch / settings focus — it
   * cancels-before-schedules so it never accumulates duplicates. Does NOT
   * request permission (the explicit toggle owns that interaction); a schedule
   * without permission simply won't display until permission is granted.
   */
  async reconcileCommuteReminders(
    uid: string,
    params: {
      alertEnabled: boolean;
      departureTime?: string;
      activeDays: readonly boolean[];
      leadMinutes?: number;
    },
  ): Promise<void> {
    if (params.alertEnabled && params.departureTime) {
      await this.scheduleCommuteReminders(uid, {
        departureTime: params.departureTime,
        activeDays: params.activeDays,
        leadMinutes: params.leadMinutes,
      });
    } else {
      await this.cancelCommuteReminders(uid);
    }
  }
}

export const commuteReminderService = new CommuteReminderService();
export default commuteReminderService;
