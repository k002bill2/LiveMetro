import { createExpirationDate, REPORT_EXPIRATION_MINUTES } from '@/models/congestion';

describe('createExpirationDate', () => {
  it('adds REPORT_EXPIRATION_MINUTES in absolute milliseconds', () => {
    const timestamp = new Date('2026-03-08T09:55:00Z');
    expect(createExpirationDate(timestamp).getTime() - timestamp.getTime()).toBe(
      REPORT_EXPIRATION_MINUTES * 60_000,
    );
  });

  it('does not mutate the input timestamp', () => {
    const timestamp = new Date('2026-03-08T09:55:00Z');
    createExpirationDate(timestamp);
    expect(timestamp.toISOString()).toBe('2026-03-08T09:55:00.000Z');
  });
});
