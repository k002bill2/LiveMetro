/**
 * sunSchedule 테스트 — 서울 고정 좌표 일출/일몰 근사 계산 검증.
 *
 * 기준값: 서울 하지(6/21) 일출 ≈ 05:11 / 일몰 ≈ 19:57 KST,
 * 동지(12/21) 일출 ≈ 07:43 / 일몰 ≈ 17:17 KST (천문연 공표값, 연도별 ±2분).
 * 근사 알고리즘(Almanac for Computers)이므로 ±25분 허용 오차로 검증한다.
 */

import { getSeoulSunTimes, isNightInSeoul } from '@/utils/sunSchedule';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 벽시계 시각 → Date (TZ-naive 함정 회피: 항상 UTC 기준 생성) */
const kstDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): Date => new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS);

/** Date → KST 분 단위 시각 (0~1439) */
const kstMinutesOfDay = (date: Date): number => {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
};

const TOLERANCE_MIN = 25;

describe('getSeoulSunTimes', () => {
  it('approximates summer solstice sunrise/sunset (2026-06-21)', () => {
    const { sunrise, sunset } = getSeoulSunTimes(kstDate(2026, 6, 21, 12));

    // 일출 ≈ 05:11 KST = 311분
    expect(Math.abs(kstMinutesOfDay(sunrise) - 311)).toBeLessThanOrEqual(
      TOLERANCE_MIN
    );
    // 일몰 ≈ 19:57 KST = 1197분
    expect(Math.abs(kstMinutesOfDay(sunset) - 1197)).toBeLessThanOrEqual(
      TOLERANCE_MIN
    );
  });

  it('approximates winter solstice sunrise/sunset (2026-12-21)', () => {
    const { sunrise, sunset } = getSeoulSunTimes(kstDate(2026, 12, 21, 12));

    // 일출 ≈ 07:43 KST = 463분
    expect(Math.abs(kstMinutesOfDay(sunrise) - 463)).toBeLessThanOrEqual(
      TOLERANCE_MIN
    );
    // 일몰 ≈ 17:17 KST = 1037분
    expect(Math.abs(kstMinutesOfDay(sunset) - 1037)).toBeLessThanOrEqual(
      TOLERANCE_MIN
    );
  });

  it('returns sunrise strictly before sunset on the same KST day', () => {
    const { sunrise, sunset } = getSeoulSunTimes(kstDate(2026, 3, 15, 12));
    expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
  });
});

describe('isNightInSeoul', () => {
  it('returns false at noon KST', () => {
    expect(isNightInSeoul(kstDate(2026, 6, 12, 12, 0))).toBe(false);
  });

  it('returns true late at night (23:00 KST)', () => {
    expect(isNightInSeoul(kstDate(2026, 6, 12, 23, 0))).toBe(true);
  });

  it('returns true before dawn (03:00 KST)', () => {
    expect(isNightInSeoul(kstDate(2026, 6, 12, 3, 0))).toBe(true);
  });

  it('returns true after winter sunset (18:30 KST in December)', () => {
    expect(isNightInSeoul(kstDate(2026, 12, 21, 18, 30))).toBe(true);
  });

  it('returns false after winter sunrise (09:00 KST in December)', () => {
    expect(isNightInSeoul(kstDate(2026, 12, 21, 9, 0))).toBe(false);
  });
});
