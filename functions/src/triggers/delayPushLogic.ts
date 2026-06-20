/**
 * Delay Push Logic (pure)
 *
 * The decision logic for "a delay report was verified → push to subscribed
 * users" is isolated here, free of firebase-admin, so it can be unit-tested
 * with injected dependencies. The Cloud Function wrapper in
 * `notificationTriggers.ts` provides the real Firestore / Expo implementations.
 */

const MIN_DELAY_MINUTES = 5;

export interface DelayReportData {
  status: string;
  delayMinutes: number;
  lineId: string;
  lineName: string;
  stationName: string;
  reason?: string;
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

/**
 * Idempotently push a verified delay report to users subscribed to the line.
 * Fires only on the pending→verified transition with a delay >= 5 min.
 */
export async function processDelayReport(
  reportId: string,
  before: DelayReportData | undefined,
  after: DelayReportData | undefined,
  deps: DelayProcessDeps,
): Promise<void> {
  if (!after) return;
  const transitioned = before?.status !== 'verified' && after.status === 'verified';
  if (!transitioned || after.delayMinutes < MIN_DELAY_MINUTES) return;

  if (await deps.alreadySent(reportId)) return;

  const tokens = await deps.queryTokensByLine(after.lineId);
  if (tokens.length === 0) {
    await deps.markSent(reportId);
    return;
  }

  const { invalidTokens } = await deps.send(tokens, {
    title: `⚠️ ${after.lineName} 지연`,
    body: `${after.stationName} 부근 약 ${after.delayMinutes}분 지연${after.reason ? ` (${after.reason})` : ''}`,
    data: {
      type: 'delay_alert',
      reportId,
      lineId: after.lineId,
      delayMinutes: String(after.delayMinutes),
    },
  });

  for (const token of invalidTokens) {
    await deps.invalidate(token);
  }
  await deps.markSent(reportId);
}
