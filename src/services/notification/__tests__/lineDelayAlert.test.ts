/**
 * lineDelayAlert tests — line-level official-delay notification payload builder.
 * Verifies status-accurate copy (지연 vs 운행 중단 vs 운행 변경) so a suspension
 * never renders as "N분 지연". Pure builder — no expo dependency exercised here.
 */
import { NotificationType } from '@services/notification/notificationService';
import { buildLineStatusPayload } from '../lineDelayAlert';

const base = {
  lineId: '2',
  lineName: '2호선',
  updatedAt: new Date(0),
  source: 'seoul_metro' as const,
};

describe('buildLineStatusPayload', () => {
  it('delayed -> 지연 title with minutes and reason in body', () => {
    const p = buildLineStatusPayload({ ...base, status: 'delayed', delayMinutes: 8, reason: '신호 장애' });
    expect(p.type).toBe(NotificationType.DELAY_ALERT);
    expect(p.title).toContain('2호선');
    expect(p.title).toContain('지연');
    expect(p.body).toContain('8분');
    expect(p.body).toContain('신호 장애');
  });

  it('suspended -> 운행 중단 copy without a false "N분 지연"', () => {
    const p = buildLineStatusPayload({ ...base, status: 'suspended', reason: '사고' });
    expect(p.title).toContain('운행 중단');
    expect(p.body).not.toContain('분 지연');
    expect(p.body).toContain('사고');
  });

  it('modified -> 운행 변경 copy', () => {
    const p = buildLineStatusPayload({ ...base, status: 'modified' });
    expect(p.title).toContain('운행 변경');
  });

  it('delayed without delayMinutes omits the minutes phrase (no "undefined")', () => {
    const p = buildLineStatusPayload({ ...base, status: 'delayed' });
    expect(p.body).not.toContain('undefined');
  });

  it('routes through the delay_alerts channel at high priority', () => {
    const p = buildLineStatusPayload({ ...base, status: 'delayed', delayMinutes: 5 });
    expect(p.channelId).toBe('delay_alerts');
    expect(p.priority).toBe('high');
  });
});
