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
