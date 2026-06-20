/**
 * delayPushLogic (processDelayReport) Tests — pure handler logic, no admin SDK.
 */
import { processDelayReport, DelayReportData } from '../delayPushLogic';

const verified: DelayReportData = {
  status: 'verified',
  delayMinutes: 8,
  lineId: '2',
  lineName: '2호선',
  stationName: '강남',
};

const makeDeps = () => ({
  queryTokensByLine: jest.fn(async (_lineId: string) => ['ExponentPushToken[a]'] as string[]),
  alreadySent: jest.fn(async (_reportId: string) => false),
  markSent: jest.fn(async (_reportId: string) => undefined),
  send: jest.fn(
    async (
      _tokens: string[],
      _msg: { title: string; body: string; data?: Record<string, string> },
    ) => ({ invalidTokens: [] as string[] }),
  ),
  invalidate: jest.fn(async (_token: string) => undefined),
});

describe('processDelayReport', () => {
  it('sends to line subscribers when newly verified and >= 5min, then marks sent', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', { status: 'pending' } as DelayReportData, verified, deps);
    expect(deps.queryTokensByLine).toHaveBeenCalledWith('2');
    expect(deps.send).toHaveBeenCalled();
    expect(deps.markSent).toHaveBeenCalledWith('r1');
  });

  it('is idempotent — skips send when already sent', async () => {
    const deps = makeDeps();
    deps.alreadySent.mockResolvedValue(true);
    await processDelayReport('r1', { status: 'pending' } as DelayReportData, verified, deps);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('skips when delay < 5min', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', { status: 'pending' } as DelayReportData, { ...verified, delayMinutes: 3 }, deps);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('skips when status did not transition to verified', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', verified, verified, deps);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('skips (no send) when there are no subscriber tokens, but still marks sent', async () => {
    const deps = makeDeps();
    deps.queryTokensByLine.mockResolvedValue([]);
    await processDelayReport('r1', { status: 'pending' } as DelayReportData, verified, deps);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.markSent).toHaveBeenCalledWith('r1');
  });

  it('invalidates tokens Expo rejected', async () => {
    const deps = makeDeps();
    deps.send.mockResolvedValue({ invalidTokens: ['ExponentPushToken[dead]'] });
    await processDelayReport('r1', { status: 'pending' } as DelayReportData, verified, deps);
    expect(deps.invalidate).toHaveBeenCalledWith('ExponentPushToken[dead]');
  });

  it('skips when the document was deleted (after is undefined)', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', verified, undefined, deps);
    expect(deps.send).not.toHaveBeenCalled();
  });
});
