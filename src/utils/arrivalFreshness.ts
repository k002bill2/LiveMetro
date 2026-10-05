/**
 * arrivalFreshness — whether a train's (possibly cached) ETA can still be shown.
 *
 * A Train's arrivalTime is fixed at fetch time. If refreshes stop (API quota,
 * network), the cached value drifts into the past and `Math.max(0, …)` pins it
 * to "0분" indefinitely (#360). A train that arrived moments ago may really be
 * at the platform — "도착" dwell ≈ 30s plus one 30s refresh interval — so ETAs
 * up to 60s past stay honest as "0분". Anything older is departed or stale and
 * must not be shown as arriving.
 */

/** How far past its ETA a train may still be shown as "0분". */
export const STALE_ETA_GRACE_SEC = 60;

/** True when the ETA is known and not older than the grace window. */
export const isEtaFresh = (arrivalTime: Date | null, now: number): boolean =>
  arrivalTime !== null && arrivalTime.getTime() >= now - STALE_ETA_GRACE_SEC * 1000;
