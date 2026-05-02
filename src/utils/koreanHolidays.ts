/**
 * Korean Public Holidays
 *
 * Seoul subway runs holiday schedules on Korean public holidays even when
 * those holidays fall on weekdays. Without holiday awareness, useTrainSchedule
 * shows weekday schedule (weekTag '1') on holidays — wrong by ~12-15 days/year.
 *
 * Lunar holidays (설날, 부처님오신날, 추석) require manual maintenance — update
 * this list yearly. Substitute holidays (대체공휴일) are pre-computed.
 *
 * Source: 관공서의 공휴일에 관한 규정 (대통령령)
 * Last updated: 2026 — TODO(2028): regenerate before 2028.
 */

/**
 * Set of Korean public holiday dates in YYYY-MM-DD form.
 * Includes substitute holidays (대체공휴일) when applicable.
 */
const KOREAN_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2025
  '2025-01-01', // 신정
  '2025-01-28', // 설날 연휴
  '2025-01-29', // 설날
  '2025-01-30', // 설날 연휴
  '2025-03-01', // 삼일절
  '2025-03-03', // 삼일절 대체공휴일 (3/1 토요일)
  '2025-05-05', // 어린이날 / 부처님오신날 (겹침)
  '2025-05-06', // 부처님오신날 대체공휴일
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', // 개천절
  '2025-10-05', // 추석 연휴
  '2025-10-06', // 추석
  '2025-10-07', // 추석 연휴
  '2025-10-08', // 추석 대체공휴일
  '2025-10-09', // 한글날
  '2025-12-25', // 성탄절

  // 2026
  '2026-01-01', // 신정
  '2026-02-16', // 설날 연휴
  '2026-02-17', // 설날
  '2026-02-18', // 설날 연휴
  '2026-03-01', // 삼일절 (일요일)
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날 (일요일)
  '2026-05-25', // 부처님오신날 대체공휴일
  '2026-06-06', // 현충일 (토요일)
  '2026-08-15', // 광복절 (토요일)
  '2026-08-17', // 광복절 대체공휴일
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-26', // 추석 연휴
  '2026-10-03', // 개천절 (토요일)
  '2026-10-09', // 한글날
  '2026-12-25', // 성탄절

  // 2027
  '2027-01-01', // 신정
  '2027-02-06', // 설날 연휴
  '2027-02-07', // 설날 (일요일)
  '2027-02-08', // 설날 연휴
  '2027-02-09', // 설날 대체공휴일
  '2027-03-01', // 삼일절
  '2027-05-05', // 어린이날
  '2027-05-13', // 부처님오신날
  '2027-06-06', // 현충일 (일요일)
  '2027-06-07', // 현충일 대체공휴일
  '2027-08-15', // 광복절 (일요일)
  '2027-08-16', // 광복절 대체공휴일
  '2027-09-14', // 추석 연휴
  '2027-09-15', // 추석
  '2027-09-16', // 추석 연휴
  '2027-10-03', // 개천절 (일요일)
  '2027-10-04', // 개천절 대체공휴일
  '2027-10-09', // 한글날 (토요일)
  '2027-12-25', // 성탄절
]);

/**
 * Convert a Date to YYYY-MM-DD form using local timezone.
 * Subway service runs on local Korean date — always interpret as device local
 * date (assumed to match KST in practice).
 */
const toLocalIsoDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Check whether a given date is a Korean public holiday.
 *
 * @param date Date object to check (defaults to today)
 * @returns true if the date is a registered Korean public holiday
 */
export const isKoreanHoliday = (date: Date = new Date()): boolean => {
  return KOREAN_HOLIDAYS.has(toLocalIsoDate(date));
};

/**
 * Exported for testing — direct access to underlying date string.
 */
export const __toLocalIsoDate = toLocalIsoDate;
