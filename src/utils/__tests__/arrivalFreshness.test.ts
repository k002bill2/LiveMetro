/**
 * arrivalFreshness — when a cached ETA is still trustworthy (#360).
 */
import { isEtaFresh, STALE_ETA_GRACE_SEC } from '@/utils/arrivalFreshness';

describe('isEtaFresh', () => {
  const now = new Date('2026-10-05T07:00:00.000Z').getTime();

  it('is false for an unknown ETA', () => {
    expect(isEtaFresh(null, now)).toBe(false);
  });

  it('is true for a future arrival', () => {
    expect(isEtaFresh(new Date(now + 90_000), now)).toBe(true);
  });

  it('is true for a train that arrived within the grace window', () => {
    expect(isEtaFresh(new Date(now - (STALE_ETA_GRACE_SEC - 1) * 1000), now)).toBe(true);
  });

  it('is true exactly at the grace boundary', () => {
    expect(isEtaFresh(new Date(now - STALE_ETA_GRACE_SEC * 1000), now)).toBe(true);
  });

  it('is false once the ETA is older than the grace window (stale cache)', () => {
    expect(isEtaFresh(new Date(now - (STALE_ETA_GRACE_SEC + 1) * 1000), now)).toBe(false);
  });

  it('uses a 60-second grace window', () => {
    expect(STALE_ETA_GRACE_SEC).toBe(60);
  });
});
