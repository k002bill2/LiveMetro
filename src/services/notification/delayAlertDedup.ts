/**
 * delayAlertDedup — pure dedup logic for the foreground official-delay monitor.
 *
 * A delay can persist across many polls; without dedup the monitor would fire
 * the same alert every 90s. Rule: alert when a watched line is newly delayed or
 * when its status *escalates* (e.g. delayed → suspended). When a line clears
 * (drops out of the active set), its dedup entry is pruned so a later
 * recurrence alerts again.
 */
import type { OfficialDelay, DelayStatus } from '@services/delay/officialDelayService';

export interface AlertedState {
  readonly status: DelayStatus;
}

/** Higher = more severe. Drives "alert only on escalation". */
const SEVERITY: Record<DelayStatus, number> = {
  normal: 0,
  modified: 1,
  delayed: 2,
  suspended: 3,
};

/** True when this line has not been alerted, or its status escalated since last alert. */
export function shouldAlert(
  prev: ReadonlyMap<string, AlertedState>,
  delay: OfficialDelay,
): boolean {
  const seen = prev.get(delay.lineId);
  return !seen || SEVERITY[delay.status] > SEVERITY[seen.status];
}

/**
 * Rebuild dedup state from the current active set. Lines absent from `active`
 * are pruned (cleared), so a future recurrence re-alerts.
 */
export function nextDedupState(active: readonly OfficialDelay[]): Map<string, AlertedState> {
  return new Map(active.map((delay) => [delay.lineId, { status: delay.status }]));
}
