/**
 * arrivalService → real seoulSubwayApi integration (only `fetch` is mocked).
 *
 * Pins the per-logical-request network budget: one getArrivals call may make
 * at most 3 fetches in total, whatever fails (network, timeout, quota, auth).
 * Unit tests mock one layer each, which is how an outer×inner retry product
 * (3×3 = 9 fetches) went unnoticed.
 */

// Env must be set before the modules below are loaded (key manager reads it
// at construction) — hence require() instead of hoisted imports. Fake keys.
['', '_2', '_3'].forEach((suffix, i) => {
  process.env[`EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY${suffix}`] = `it-key-${i + 1}`;
});
process.env[`EXPO_PUBLIC_DATA_PORTAL_API_KEY`] = 'it-data-portal';

jest.unmock('@/services/api/seoulSubwayApi');

const mockFetch = jest.fn();
global.fetch = mockFetch;

/* eslint-disable @typescript-eslint/no-var-requires */
const AsyncStorage = require('@react-native-async-storage/async-storage');
const { seoulSubwayApi } = require('@/services/api/seoulSubwayApi');
const { arrivalService } = require('@/services/arrival/arrivalService');
/* eslint-enable @typescript-eslint/no-var-requires */

const MAX_FETCHES_PER_REQUEST = 3;

const okBody = {
  errorMessage: { status: 200, code: 'INFO-000', message: '정상 처리되었습니다.' },
  realtimeArrivalList: [
    {
      subwayId: '1002',
      updnLine: '상행',
      trainLineNm: '성수행 - 역삼방면',
      statnId: '1002000222',
      statnNm: '강남',
      btrainSttus: '일반',
      barvlDt: '120',
      btrainNo: '2345',
      bstatnNm: '성수',
      recptnDt: '',
      arvlMsg2: '2분 후',
      arvlMsg3: '역삼',
      arvlCd: '99',
      ordkey: '01000강남0',
    },
  ],
};
const apiErrorBody = (code: string): Record<string, unknown> => ({
  status: 500, code, message: `msg-${code}`,
});
const jsonResponse = (body: unknown): Record<string, unknown> => ({
  ok: true,
  json: () => Promise.resolve(body),
});
const keyOf = (url: string): string => (url.match(/it-key-\d/) ?? ['?'])[0];
const usedKeys = (): string[] => mockFetch.mock.calls.map((c) => keyOf(String(c[0])));

/** Starts getArrivals(throwOnError) and drains every timer (backoff, throttle, timeout). */
const settle = async (station = '강남'): Promise<{ value?: unknown; error?: unknown }> => {
  const outcome = arrivalService.getArrivals(station, { throwOnError: true }).then(
    (value: unknown) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await jest.runAllTimersAsync();
  return outcome;
};

describe('arrivalService + seoulSubwayApi — network budget per logical request', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    // 2026-10-05 20:00 KST — far from KST midnight unless a test moves the clock.
    jest.setSystemTime(Date.UTC(2026, 9, 5, 11, 0, 0));
    mockFetch.mockReset();
    arrivalService.destroy();
    seoulSubwayApi.getRateLimiter().clear();
    seoulSubwayApi.clearInflightRequests();
    seoulSubwayApi.resetKeyStates();
    await AsyncStorage.clear();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    arrivalService.destroy();
    jest.useRealTimers();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('caps a persistent network failure at 3 fetches (was outer 3 × inner 3 = 9)', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    const { error } = await settle();

    expect(error).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(MAX_FETCHES_PER_REQUEST);
  });

  it('caps a persistent 10s timeout at 3 fetches and aborts each one', async () => {
    const signals: AbortSignal[] = [];
    mockFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      signals.push(init.signal);
      return new Promise(() => undefined);
    });

    const { error } = await settle();

    expect((error as Error).message).toContain('시간이 초과');
    expect(mockFetch).toHaveBeenCalledTimes(MAX_FETCHES_PER_REQUEST);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('keeps a persistent non-daily quota error (ERROR-500) within 3 fetches', async () => {
    mockFetch.mockResolvedValue(jsonResponse(apiErrorBody('ERROR-500')));

    const { error } = await settle();

    expect(error).toMatchObject({ errorCode: 'ERROR-500' });
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(MAX_FETCHES_PER_REQUEST);
  });

  it('falls back from a quota error to a backup key and succeeds within the budget', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(apiErrorBody('ERROR-500')))
      .mockResolvedValue(jsonResponse(okBody));

    const { value } = await settle();

    expect(value).toMatchObject({ source: 'api' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(usedKeys()[1]).not.toBe(usedKeys()[0]);
  });

  it('switches past two invalid (INFO-100) keys to the healthy one within 3 fetches', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        keyOf(url) === 'it-key-3' ? jsonResponse(okBody) : jsonResponse(apiErrorBody('INFO-100'))
      )
    );

    const { value } = await settle();

    expect(value).toMatchObject({ source: 'api' });
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(MAX_FETCHES_PER_REQUEST);
    expect(new Set(usedKeys()).size).toBe(usedKeys().length); // never re-uses an invalid key
  });

  it('gives up within 3 fetches when every key is invalid (INFO-100)', async () => {
    mockFetch.mockResolvedValue(jsonResponse(apiErrorBody('INFO-100')));

    const { error } = await settle();

    expect(error).toMatchObject({ errorCode: 'INFO-100' });
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(MAX_FETCHES_PER_REQUEST);
  });

  it('makes no network call once every key hit the daily cap, and resumes after KST midnight', async () => {
    mockFetch.mockResolvedValue(jsonResponse(apiErrorBody('ERROR-337')));

    // Polls until every key is exhausted (each logical request stays in budget).
    let last: { value?: unknown; error?: unknown } = {};
    for (let poll = 0; poll < 3; poll++) {
      const before = mockFetch.mock.calls.length;
      last = await settle(`역${poll}`);
      expect(mockFetch.mock.calls.length - before).toBeLessThanOrEqual(MAX_FETCHES_PER_REQUEST);
      if ((last.error as { dailyQuotaExhausted?: boolean })?.dailyQuotaExhausted) break;
    }
    expect(last.error).toMatchObject({ errorCode: 'ERROR-337', dailyQuotaExhausted: true });
    const afterExhaustion = mockFetch.mock.calls.length;

    // Later polls the same evening: zero fetches.
    jest.setSystemTime(Date.UTC(2026, 9, 5, 14, 59, 0)); // 23:59 KST
    const later = await settle('역삼');
    expect(later.error).toMatchObject({ errorCode: 'ERROR-337' });
    expect(mockFetch).toHaveBeenCalledTimes(afterExhaustion);

    // Just past KST midnight the keys re-enable and the network is used again.
    mockFetch.mockResolvedValue(jsonResponse(okBody));
    jest.setSystemTime(Date.UTC(2026, 9, 5, 15, 0, 1)); // 00:00:01 KST
    const nextDay = await settle('선릉');
    expect(nextDay.value).toMatchObject({ source: 'api' });
    expect(mockFetch).toHaveBeenCalledTimes(afterExhaustion + 1);
  });

  it('keeps the 30s per-station rate limit after a failed chain (retries do not reopen it)', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    const chainStart = Date.now();
    await settle();
    const afterChain = mockFetch.mock.calls.length;

    // A follow-up request for the same station waits for the limiter: no fetch
    // goes out until 30s after the previous logical request started.
    mockFetch.mockResolvedValue(jsonResponse(okBody));
    const next = arrivalService.getArrivals('강남', { throwOnError: true });
    const remaining = chainStart + 30_000 - Date.now();
    if (remaining > 1) {
      await jest.advanceTimersByTimeAsync(remaining - 1);
      expect(mockFetch).toHaveBeenCalledTimes(afterChain);
    }
    await jest.runAllTimersAsync();
    await expect(next).resolves.toMatchObject({ source: 'api' });
    expect(mockFetch).toHaveBeenCalledTimes(afterChain + 1);
  });
});
