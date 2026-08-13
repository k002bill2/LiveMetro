/**
 * Measured travel duration derived from commute logs.
 *
 * Commute logs store wall-clock `HH:mm` strings, so a duration is the wrapped
 * difference between the pair. The average is always scoped to one
 * origin→destination leg: a round trip is not one population. The real account
 * runs 산곡→선릉 in ~69min but 선릉→산곡 in ~81min, so a leg-blind mean reported
 * ~75min for both — a number that is wrong in each direction while looking
 * plausible in neither.
 */
import type { CommuteLog } from '@/models/pattern';

const MIN_PER_DAY = 24 * 60;

/**
 * Strict `HH:mm` parse. Deliberately stricter than `parseTimeToMinutes` (which
 * is lenient and yields NaN on garbage): anything that is not a clean clock
 * time must drop out of the average rather than poison it.
 */
const parseHHmm = (value?: string): number | null => {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
};

/**
 * Measured minutes for one log, or null when it carries no usable pair.
 *
 * A zero-minute result is treated as unusable: departure and arrival landing in
 * the same minute means the log was opened and closed without a trip happening,
 * not that the trip took no time.
 */
export const commuteDurationMinutes = (
  log: Pick<CommuteLog, 'departureTime' | 'arrivalTime'>
): number | null => {
  const departed = parseHHmm(log.departureTime);
  const arrived = parseHHmm(log.arrivalTime);
  if (departed === null || arrived === null) return null;
  const diff = (((arrived - departed) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return diff > 0 ? diff : null;
};

/**
 * Mean measured duration over the logs that ran exactly `origin` → `destination`.
 *
 * Matching is by station **name**, not id: logs are written by several paths
 * whose station-id domains diverge (numeric codes vs slugs), while the names
 * agree. A destination-less stub (`arrivalStationName === ''`) therefore never
 * matches, which is correct — its route is unknown.
 *
 * Returns null when the leg is unresolved or has no completed logs, so callers
 * show an honest empty state instead of a confidently wrong number.
 */
export const averageCommuteDurationFor = (
  logs: readonly CommuteLog[],
  origin: string | undefined,
  destination: string | undefined
): number | null => {
  if (!origin || !destination) return null;

  const durations = logs
    .filter(
      (log) =>
        log.departureStationName === origin &&
        log.arrivalStationName === destination
    )
    .map(commuteDurationMinutes)
    .filter((minutes): minutes is number => minutes !== null);

  if (durations.length === 0) return null;
  return durations.reduce((sum, minutes) => sum + minutes, 0) / durations.length;
};
