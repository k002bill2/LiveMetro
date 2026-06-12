/**
 * 서울 일출/일몰 근사 계산 — 테마 "시간대별 자동 전환"용.
 *
 * Almanac for Computers (Nautical Almanac Office, 1990) 일출 방정식을
 * 서울 고정 좌표(37.5665N, 126.978E)에 적용한다. 위치 권한 불필요.
 * 오차 ±수 분 수준으로 테마 전환 용도에는 충분하다.
 * 한국은 DST가 없어 KST = UTC+9 고정 오프셋으로 계산한다.
 */

const SEOUL_LAT = 37.5665;
const SEOUL_LNG = 126.978;
/** 공식(official) 일출/일몰 천정각 — 대기 굴절 보정 포함 */
const ZENITH_DEG = 90.833;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEG = Math.PI / 180;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

const sinDeg = (d: number): number => Math.sin(d * DEG);
const cosDeg = (d: number): number => Math.cos(d * DEG);
const tanDeg = (d: number): number => Math.tan(d * DEG);
const asinDeg = (x: number): number => Math.asin(x) / DEG;
const acosDeg = (x: number): number => Math.acos(x) / DEG;
const atanDeg = (x: number): number => Math.atan(x) / DEG;

const mod = (value: number, range: number): number =>
  ((value % range) + range) % range;

/** 주어진 시각이 속한 KST 달력일의 [연, 월(0-base), 일, day-of-year] */
const kstCalendarDay = (
  date: Date
): { year: number; month: number; day: number; dayOfYear: number } => {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  const day = kst.getUTCDate();
  const startOfYearMs = Date.UTC(year, 0, 1);
  const dayOfYear =
    Math.floor((Date.UTC(year, month, day) - startOfYearMs) / (24 * HOUR_MS)) + 1;
  return { year, month, day, dayOfYear };
};

/** 일출(rising=true) 또는 일몰 시각을 epoch ms로 계산 */
const computeEventMs = (
  year: number,
  month: number,
  day: number,
  dayOfYear: number,
  rising: boolean
): number => {
  const lngHour = SEOUL_LNG / 15;
  const t = dayOfYear + ((rising ? 6 : 18) - lngHour) / 24;

  // 태양 평균 근점 이각 → 황경
  const meanAnomaly = 0.9856 * t - 3.289;
  const trueLongitude = mod(
    meanAnomaly +
      1.916 * sinDeg(meanAnomaly) +
      0.02 * sinDeg(2 * meanAnomaly) +
      282.634,
    360
  );

  // 적경 — 황경과 같은 사분면으로 보정 후 시간 단위로 변환
  let rightAscension = mod(atanDeg(0.91764 * tanDeg(trueLongitude)), 360);
  const longitudeQuadrant = Math.floor(trueLongitude / 90) * 90;
  const ascensionQuadrant = Math.floor(rightAscension / 90) * 90;
  rightAscension = (rightAscension + (longitudeQuadrant - ascensionQuadrant)) / 15;

  // 태양 적위 → 시간각
  const sinDec = 0.39782 * sinDeg(trueLongitude);
  const cosDec = cosDeg(asinDeg(sinDec));
  const cosHourAngle =
    (cosDeg(ZENITH_DEG) - sinDec * sinDeg(SEOUL_LAT)) /
    (cosDec * cosDeg(SEOUL_LAT));

  // 서울 위도에서는 극야/백야가 없어 [-1, 1] 클램프만으로 충분
  const clamped = Math.min(1, Math.max(-1, cosHourAngle));
  const hourAngle = (rising ? 360 - acosDeg(clamped) : acosDeg(clamped)) / 15;

  // 지방 평균시 → UT → KST 벽시계 시각
  const localMeanTime =
    hourAngle + rightAscension - 0.06571 * t - 6.622;
  const utHours = mod(localMeanTime - lngHour, 24);
  const kstHours = mod(utHours + 9, 24);

  const kstMidnightMs = Date.UTC(year, month, day) - KST_OFFSET_MS;
  return kstMidnightMs + kstHours * HOUR_MS;
};

/** 주어진 시각이 속한 KST 달력일의 서울 일출/일몰 시각 */
export const getSeoulSunTimes = (date: Date): SunTimes => {
  const { year, month, day, dayOfYear } = kstCalendarDay(date);
  return {
    sunrise: new Date(computeEventMs(year, month, day, dayOfYear, true)),
    sunset: new Date(computeEventMs(year, month, day, dayOfYear, false)),
  };
};

/** 해 진 후(일몰~다음 일출) 여부 — 다크 모드 자동 전환 판정 */
export const isNightInSeoul = (date: Date): boolean => {
  const { sunrise, sunset } = getSeoulSunTimes(date);
  return date.getTime() < sunrise.getTime() || date.getTime() >= sunset.getTime();
};
