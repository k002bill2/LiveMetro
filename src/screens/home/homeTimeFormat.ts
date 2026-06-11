/**
 * Pure time/format helpers for the Home screen.
 * Extracted verbatim from HomeScreen.tsx (file-size split) — no behavior change.
 */

const MIN_PER_DAY = 24 * 60;

const parseHHmm = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
};

/**
 * Compute commute minutes from "HH:mm" departure → arrival strings.
 * Wraps midnight (23:55 → 00:20 = 25 min). Returns null on malformed input.
 */
export const minutesBetween = (departure?: string, arrival?: string): number | null => {
  if (!departure || !arrival) return null;
  const d = parseHHmm(departure);
  const a = parseHHmm(arrival);
  if (d === null || a === null) return null;
  const diff = ((a - d) % MIN_PER_DAY + MIN_PER_DAY) % MIN_PER_DAY;
  return diff > 0 ? diff : null;
};

/**
 * Add minutes to an "HH:mm" time string, wrapping at midnight.
 * Returns null on malformed input. Used to derive an arrival time when
 * only the registered departure + estimated ride duration is known
 * (no ML prediction yet).
 */
export const addMinutesToHHmm = (
  hhmm: string | undefined,
  minutes: number | undefined,
): string | null => {
  if (!hhmm || minutes === undefined || !Number.isFinite(minutes)) return null;
  const base = parseHHmm(hhmm);
  if (base === null) return null;
  const total = ((base + Math.round(minutes)) % MIN_PER_DAY + MIN_PER_DAY) % MIN_PER_DAY;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

/** "방금 전" / "12분 전" / "3시간 전" / "2일 전" */
export const formatRelativeKorean = (ts?: Date, now: Date = new Date()): string | null => {
  if (!ts) return null;
  const diffSec = Math.max(0, Math.floor((now.getTime() - ts.getTime()) / 1000));
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}일 전`;
};

/** "2026.05.03 (수) · 오전 8:32" */
export const formatDateTimeLabel = (now: Date = new Date()): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dow = days[now.getDay()];
  const h = now.getHours();
  const min = String(now.getMinutes()).padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${yyyy}.${mm}.${dd} (${dow}) · ${period} ${h12}:${min}`;
};
