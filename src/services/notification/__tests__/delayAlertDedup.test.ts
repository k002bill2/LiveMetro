/**
 * delayAlertDedup tests — pure dedup logic for foreground official-delay alerts.
 * Prevents re-alerting an ongoing delay every poll; re-alerts on escalation or
 * after a delay clears and recurs.
 */
import type { OfficialDelay } from '@services/delay/officialDelayService';
import { shouldAlert, nextDedupState, type AlertedState } from '../delayAlertDedup';

const d = (lineId: string, status: OfficialDelay['status']): OfficialDelay => ({
  lineId,
  lineName: `${lineId}호선`,
  status,
  updatedAt: new Date(0),
  source: 'seoul_metro',
});

describe('delayAlertDedup', () => {
  describe('shouldAlert', () => {
    it('alerts when the line was not previously alerted', () => {
      expect(shouldAlert(new Map(), d('2', 'delayed'))).toBe(true);
    });

    it('does not re-alert the same line+status', () => {
      const prev = new Map<string, AlertedState>([['2', { status: 'delayed' }]]);
      expect(shouldAlert(prev, d('2', 'delayed'))).toBe(false);
    });

    it('re-alerts when status escalates (delayed -> suspended)', () => {
      const prev = new Map<string, AlertedState>([['2', { status: 'delayed' }]]);
      expect(shouldAlert(prev, d('2', 'suspended'))).toBe(true);
    });

    it('does not re-alert on de-escalation (suspended -> delayed)', () => {
      const prev = new Map<string, AlertedState>([['2', { status: 'suspended' }]]);
      expect(shouldAlert(prev, d('2', 'delayed'))).toBe(false);
    });
  });

  describe('nextDedupState', () => {
    it('records active delays keyed by lineId with their status', () => {
      const next = nextDedupState([d('2', 'delayed'), d('4', 'suspended')]);
      expect(next.get('2')).toEqual({ status: 'delayed' });
      expect(next.get('4')).toEqual({ status: 'suspended' });
    });

    it('prunes lines that are no longer active (so a recurrence re-alerts)', () => {
      const prev = nextDedupState([d('2', 'delayed'), d('4', 'suspended')]);
      expect(prev.has('2')).toBe(true);
      const next = nextDedupState([d('4', 'suspended')]);
      expect(next.has('2')).toBe(false);
    });
  });
});
