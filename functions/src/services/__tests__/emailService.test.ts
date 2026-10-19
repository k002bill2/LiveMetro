/**
 * emailService template Tests
 *
 * Verifies every interpolated field in all three HTML templates is escaped
 * (F-02: HTML injection via the untyped callable payload). Only the pure
 * template builder is exercised; SendGrid is never called.
 */
import { emailService } from '../emailService';
import { NotificationType } from '../../types';

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<a href=//evil>',
  '"><img src=x onerror=1>',
] as const;

const RAW_MARKERS = ['<script', '<img', '<a href'] as const;

const ALL_TYPES = [
  NotificationType.DELAY_ALERT,
  NotificationType.EMERGENCY_ALERT,
  NotificationType.SERVICE_UPDATE,
] as const;

const hostilePayload = (payload: string): Record<string, unknown> => ({
  lineName: payload,
  stationName: payload,
  delayMinutes: payload,
  reason: payload,
  message: payload,
  affectedLines: [payload, '2호선', payload],
  arrivalTime: payload,
});

describe('emailService.buildEmailContent escaping', () => {
  for (const type of ALL_TYPES) {
    for (const payload of PAYLOADS) {
      it(`${type}: no raw markup from input for ${payload}`, () => {
        const { html, subject } = emailService.buildEmailContent(
          type,
          hostilePayload(payload),
        );
        for (const marker of RAW_MARKERS) {
          expect(html).not.toContain(marker);
        }
        expect(html).not.toContain('"><');
        expect(subject).not.toMatch(/[\r\n]/);
      });
    }
  }

  it('DELAY_ALERT renders escaped text for every field', () => {
    const { html } = emailService.buildEmailContent(NotificationType.DELAY_ALERT, {
      lineName: '<b>2호선</b>',
      stationName: '강남&역삼',
      delayMinutes: 7,
      reason: `'신호' "장애"`,
    });
    expect(html).toContain('&lt;b&gt;2호선&lt;/b&gt;');
    expect(html).toContain('강남&amp;역삼');
    expect(html).toContain('7분');
    expect(html).toContain('&#39;신호&#39; &quot;장애&quot;');
  });

  it('DELAY_ALERT coerces a non-numeric delayMinutes string to 0', () => {
    const { html } = emailService.buildEmailContent(NotificationType.DELAY_ALERT, {
      delayMinutes: '<script>alert(1)</script>',
    });
    expect(html).toContain('0분');
  });

  it('DELAY_ALERT accepts a numeric delayMinutes string', () => {
    const { html } = emailService.buildEmailContent(NotificationType.DELAY_ALERT, {
      delayMinutes: '12',
    });
    expect(html).toContain('12분');
  });

  it('EMERGENCY_ALERT escapes each affected line and drops non-strings', () => {
    const { html } = emailService.buildEmailContent(NotificationType.EMERGENCY_ALERT, {
      message: '운행 중단',
      affectedLines: ['<i>1호선</i>', 42, { toString: () => '<script>' }, '2호선'],
    });
    expect(html).toContain('&lt;i&gt;1호선&lt;/i&gt;, 2호선');
    expect(html).not.toContain('42');
    expect(html).not.toContain('<script');
  });

  it('EMERGENCY_ALERT omits the affected lines block when not an array', () => {
    const { html } = emailService.buildEmailContent(NotificationType.EMERGENCY_ALERT, {
      affectedLines: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('영향 노선');
    expect(html).not.toContain('<script');
  });

  it('falls back to defaults for non-object payloads', () => {
    const { html, subject } = emailService.buildEmailContent(
      NotificationType.DELAY_ALERT,
      '<script>alert(1)</script>',
    );
    expect(subject).toBe('[LiveMetro] 지하철 지연 알림');
    expect(html).not.toContain('<script');
    expect(html).toContain('0분');
  });

  it('strips CR/LF from lineName in the subject (plain text)', () => {
    const { subject } = emailService.buildEmailContent(NotificationType.DELAY_ALERT, {
      lineName: '2호선\r\nBcc: victim@example.com',
    });
    expect(subject).toBe('[LiveMetro] 2호선Bcc: victim@example.com 지연 알림');
  });
});
