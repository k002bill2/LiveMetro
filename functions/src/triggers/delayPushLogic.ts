/**
 * Delay Push Logic (pure)
 *
 * The decision logic for "a delay was verified → push to subscribed users" is
 * isolated here, free of firebase-admin, so it can be unit-tested with
 * injected dependencies. The Cloud Function wrapper in
 * `notificationTriggers.ts` provides the real Firestore / Expo implementations.
 *
 * Input is the server-only `verifiedDelays/{reportId}` marker (Admin SDK
 * writes only). Only `lineId` and `delayMinutes` are read, and both are
 * validated; push copy comes from the server line table (`lineNames.ts`), so
 * no client-written text can reach a push (security finding F-01).
 */

import { getLineDisplayName } from './lineNames';

const MIN_DELAY_MINUTES = 5;
const MAX_DELAY_MINUTES = 180;

/** Validated fields of a `verifiedDelays/{reportId}` marker. */
export interface VerifiedDelayMarker {
  readonly lineId: string;
  readonly lineName: string;
  readonly delayMinutes: number;
}

export interface DelayProcessDeps {
  queryTokensByLine: (lineId: string) => Promise<string[]>;
  alreadySent: (reportId: string) => Promise<boolean>;
  markSent: (reportId: string) => Promise<void>;
  send: (
    tokens: string[],
    message: { title: string; body: string; data?: Record<string, string> },
  ) => Promise<{ invalidTokens: string[] }>;
  invalidate: (token: string) => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parse a raw marker document. Returns null unless `lineId` is in the server
 * line table and `delayMinutes` is an integer in [MIN, MAX]. All other fields
 * are ignored.
 */
export function parseVerifiedDelayMarker(raw: unknown): VerifiedDelayMarker | null {
  if (!isRecord(raw)) return null;
  const { lineId, delayMinutes } = raw;
  if (typeof lineId !== 'string') return null;
  const lineName = getLineDisplayName(lineId);
  if (lineName === null) return null;
  if (
    typeof delayMinutes !== 'number' ||
    !Number.isInteger(delayMinutes) ||
    delayMinutes < MIN_DELAY_MINUTES ||
    delayMinutes > MAX_DELAY_MINUTES
  ) {
    return null;
  }
  return { lineId, lineName, delayMinutes };
}

/**
 * Idempotently push a verified delay to users subscribed to the line.
 * Fires only on marker creation (no `before`, `after` present).
 *
 * An invalid marker (unknown lineId / out-of-range delay) returns before any
 * dep is called — it is NOT marked sent. The marker is server-written, so an
 * invalid one is a server bug; leaving pushDedup untouched lets a corrected
 * re-write under a new doc still go through, and a re-write of the same doc
 * is an update, which never fires anyway.
 */
export async function processDelayReport(
  reportId: string,
  before: unknown,
  after: unknown,
  deps: DelayProcessDeps,
): Promise<void> {
  const created = before === undefined && after !== undefined;
  if (!created) return;

  const marker = parseVerifiedDelayMarker(after);
  if (marker === null) return;

  if (await deps.alreadySent(reportId)) return;

  const tokens = await deps.queryTokensByLine(marker.lineId);
  if (tokens.length === 0) {
    await deps.markSent(reportId);
    return;
  }

  const { invalidTokens } = await deps.send(tokens, {
    title: `⚠️ ${marker.lineName} 지연`,
    body: `약 ${marker.delayMinutes}분 지연이 보고되었습니다`,
    data: {
      type: 'delay_alert',
      reportId,
      lineId: marker.lineId,
      delayMinutes: String(marker.delayMinutes),
    },
  });

  for (const token of invalidTokens) {
    await deps.invalidate(token);
  }
  await deps.markSent(reportId);
}
