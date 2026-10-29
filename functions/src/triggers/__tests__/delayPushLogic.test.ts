/**
 * delayPushLogic (processDelayReport) Tests — pure handler logic, no admin SDK.
 *
 * Input is the server-only `verifiedDelays/{reportId}` marker. Only `lineId`
 * and `delayMinutes` are read; push copy comes from the server line table.
 */
import { processDelayReport } from '../delayPushLogic';

const marker = { lineId: '2', delayMinutes: 8 };

/**
 * Fields a forging client would add to satisfy the legacy trigger
 * (`status: 'verified'`) and to inject push text. Included in the rejection
 * cases so they fail against the old status-transition logic.
 */
const attackerFields = {
  status: 'verified',
  lineName: 'EVIL-lineName',
  stationName: 'EVIL-stationName',
  reason: 'EVIL-reason',
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

type Deps = ReturnType<typeof makeDeps>;

const expectNoDepCalled = (deps: Deps): void => {
  expect(deps.alreadySent).not.toHaveBeenCalled();
  expect(deps.queryTokensByLine).not.toHaveBeenCalled();
  expect(deps.send).not.toHaveBeenCalled();
  expect(deps.markSent).not.toHaveBeenCalled();
  expect(deps.invalidate).not.toHaveBeenCalled();
};

describe('processDelayReport — happy path', () => {
  it('sends to line subscribers on marker creation, then marks sent', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', undefined, marker, deps);
    expect(deps.queryTokensByLine).toHaveBeenCalledWith('2');
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.markSent).toHaveBeenCalledWith('r1');
  });

  it('builds title/body only from the server line table and the number', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', undefined, { lineId: '수인분당선', delayMinutes: 12 }, deps);
    const [tokens, msg] = deps.send.mock.calls[0]!;
    expect(tokens).toEqual(['ExponentPushToken[a]']);
    expect(msg.title).toBe('⚠️ 수인분당선 지연');
    expect(msg.body).toBe('약 12분 지연이 보고되었습니다');
    expect(msg.data).toEqual({
      type: 'delay_alert',
      reportId: 'r1',
      lineId: '수인분당선',
      delayMinutes: '12',
    });
  });

  it('never leaks client-controlled extra fields into the push', async () => {
    const deps = makeDeps();
    const forged = {
      lineId: '2',
      delayMinutes: 8,
      status: 'verified',
      lineName: 'EVIL-lineName',
      stationName: 'EVIL-stationName',
      reason: 'EVIL-reason',
    };
    await processDelayReport('r1', undefined, forged, deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(deps.send.mock.calls)).not.toContain('EVIL');
    const [, msg] = deps.send.mock.calls[0]!;
    expect(msg.title).toBe('⚠️ 2호선 지연');
    expect(msg.body).toBe('약 8분 지연이 보고되었습니다');
    expect(Object.keys(msg.data ?? {}).sort()).toEqual(
      ['delayMinutes', 'lineId', 'reportId', 'type'],
    );
  });

  it('accepts the boundary values 5 and 180 minutes', async () => {
    for (const delayMinutes of [5, 180]) {
      const deps = makeDeps();
      await processDelayReport('r1', undefined, { lineId: '1', delayMinutes }, deps);
      expect(deps.send).toHaveBeenCalledTimes(1);
    }
  });
});

describe('processDelayReport — idempotency & lifecycle', () => {
  it('is idempotent — skips send when already sent', async () => {
    const deps = makeDeps();
    deps.alreadySent.mockResolvedValue(true);
    await processDelayReport('r1', undefined, marker, deps);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.markSent).not.toHaveBeenCalled();
  });

  it('fires only on creation — an update (before present) sends nothing', async () => {
    const deps = makeDeps();
    await processDelayReport(
      'r1',
      { ...attackerFields, status: 'pending', lineId: '2', delayMinutes: 6 },
      { ...attackerFields, ...marker },
      deps,
    );
    expectNoDepCalled(deps);
  });

  it('skips when the document was deleted (after is undefined)', async () => {
    const deps = makeDeps();
    await processDelayReport('r1', marker, undefined, deps);
    expectNoDepCalled(deps);
  });

  it('skips (no send) when there are no subscriber tokens, but still marks sent', async () => {
    const deps = makeDeps();
    deps.queryTokensByLine.mockResolvedValue([]);
    await processDelayReport('r1', undefined, marker, deps);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.markSent).toHaveBeenCalledWith('r1');
  });

  it('invalidates tokens Expo rejected', async () => {
    const deps = makeDeps();
    deps.send.mockResolvedValue({ invalidTokens: ['ExponentPushToken[dead]'] });
    await processDelayReport('r1', undefined, marker, deps);
    expect(deps.invalidate).toHaveBeenCalledWith('ExponentPushToken[dead]');
  });
});

describe('processDelayReport — rejects forged / invalid markers (touches no dep)', () => {
  it.each([
    ['constructor'],
    ['__proto__'],
    ['toString'],
    ['hasOwnProperty'],
    ['evil'],
    [''],
    [2],
    [null],
    [undefined],
  ])('unknown lineId %p sends nothing', async (lineId) => {
    const deps = makeDeps();
    await processDelayReport('r1', undefined, { ...attackerFields, lineId, delayMinutes: 8 }, deps);
    expectNoDepCalled(deps);
  });

  it.each([
    [3],
    [4.9],
    [5.5],
    [181],
    [100000],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [-10],
    ['8'],
    [null],
    [undefined],
  ])('invalid delayMinutes %p sends nothing', async (delayMinutes) => {
    const deps = makeDeps();
    await processDelayReport('r1', undefined, { ...attackerFields, lineId: '2', delayMinutes }, deps);
    expectNoDepCalled(deps);
  });

  it.each([[null], ['string'], [42], [['2', 8]]])(
    'non-object marker %p sends nothing',
    async (after) => {
      const deps = makeDeps();
      await processDelayReport('r1', undefined, after, deps);
      expectNoDepCalled(deps);
    },
  );
});
