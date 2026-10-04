/**
 * ApiKeyManager Factory Tests
 *
 * Focus: createPublicDataApiKeyManager must NOT silently fall back to
 * EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY when the Data Portal key is missing —
 * realtime (swopenapi.seoul.go.kr) and timetable (openapi.seoul.go.kr:8088)
 * use different auth domains and silent cross-host fallback masks 401s.
 */

describe('createPublicDataApiKeyManager', () => {
  const originalEnv = { ...process.env };
  const SUBWAY = 'k1';
  const PORTAL = 'k2';

  beforeEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY;
    delete process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY_2;
    delete process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY;
    delete process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2;
    delete process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_3;
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('logs console.error and produces an empty manager when no Data Portal API key is configured (no silent fallback to subway keys)', () => {
    process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY = SUBWAY;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPublicDataApiKeyManager } = jest.requireActual('../apiKeyManager');

    const manager = createPublicDataApiKeyManager();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('EXPO_PUBLIC_DATA_PORTAL_API_KEY')
    );
    // No cross-fallback: subway key must NOT be injected.
    expect(manager.keyCount).toBe(0);

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('does NOT inject Seoul subway keys into the public-data manager', () => {
    process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY = SUBWAY;
    process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY = PORTAL;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPublicDataApiKeyManager } = jest.requireActual('../apiKeyManager');

    const manager = createPublicDataApiKeyManager();

    // Exactly one key (portal). The subway key must NOT be there.
    expect(manager.keyCount).toBe(1);
  });

  it('accepts EXPO_PUBLIC_DATA_PORTAL_API_KEY when set', () => {
    process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY = PORTAL;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPublicDataApiKeyManager } = jest.requireActual('../apiKeyManager');

    expect(() => createPublicDataApiKeyManager()).not.toThrow();
  });
});

/**
 * A1 (2026-10-04 security review): an auth failure (INFO-100 etc.) means the
 * key itself is invalid. Re-enabling it after the generic 60s cooldown put a
 * permanently-invalid key back into round-robin every minute, causing a
 * periodic failure burst. Auth-disabled keys must stay out for a long TTL;
 * transient/quota disables keep the short cooldown.
 */
describe('ApiKeyManager auth-error handling', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ApiKeyManager } = jest.requireActual('../apiKeyManager');
  const SHORT_MS = 60_000;
  const AUTH_MS = 3_600_000;
  let manager: InstanceType<typeof ApiKeyManager>;
  let now: number;
  let nowSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    now = 1_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    manager = new ApiKeyManager(['good-key-1111', 'bad-key-22222'], {
      disableDurationMs: SHORT_MS,
      errorThreshold: 3,
      authDisableDurationMs: AUTH_MS,
    });
  });

  afterEach(() => {
    manager.dispose();
    nowSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('disables an auth-failed key immediately (no 3-error threshold)', () => {
    manager.reportAuthError('bad-key-22222');
    expect(manager.availableKeyCount).toBe(1);
  });

  it('does NOT re-enable an auth-failed key after the short 60s cooldown', () => {
    manager.reportAuthError('bad-key-22222');
    now += SHORT_MS + 1_000;

    const picked = new Set([manager.getNextKey(), manager.getNextKey(), manager.getNextKey()]);
    expect(picked).toEqual(new Set(['good-key-1111']));
  });

  it('re-enables an auth-failed key only after the long auth TTL', () => {
    manager.reportAuthError('bad-key-22222');
    now += AUTH_MS + 1;

    const picked = new Set([manager.getNextKey(), manager.getNextKey()]);
    expect(picked).toEqual(new Set(['good-key-1111', 'bad-key-22222']));
  });

  it('still re-enables a generic-error key after the short cooldown (unchanged)', () => {
    manager.reportError('bad-key-22222');
    manager.reportError('bad-key-22222');
    manager.reportError('bad-key-22222');
    expect(manager.availableKeyCount).toBe(1);

    now += SHORT_MS + 1;
    const picked = new Set([manager.getNextKey(), manager.getNextKey()]);
    expect(picked).toEqual(new Set(['good-key-1111', 'bad-key-22222']));
  });

  it('returns null (no call) when every key is auth-disabled — never hands out an invalid key', () => {
    manager.reportAuthError('good-key-1111');
    manager.reportAuthError('bad-key-22222');
    expect(manager.getNextKey()).toBeNull();
  });

  it('prefers a recovering rate-limited key over an auth-disabled one when all are disabled', () => {
    manager.reportAuthError('bad-key-22222');
    manager.reportRateLimit('good-key-1111');
    expect(manager.getNextKey()).toBe('good-key-1111');
  });

  it('resetKeyStates() restores every key to available', () => {
    manager.reportAuthError('good-key-1111');
    manager.reportAuthError('bad-key-22222');
    manager.resetKeyStates();
    expect(manager.availableKeyCount).toBe(2);
  });
});

describe('ApiKeyManager daily-quota (ERROR-337) handling', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ApiKeyManager } = jest.requireActual('../apiKeyManager');
  const SHORT_MS = 60_000;
  // 2026-10-04 20:00 KST (11:00Z) → next KST midnight = 2026-10-05 00:00 KST (15:00Z)
  const T_2000_KST = Date.UTC(2026, 9, 4, 11, 0, 0);
  const NEXT_MIDNIGHT_KST = Date.UTC(2026, 9, 4, 15, 0, 0);
  let manager: InstanceType<typeof ApiKeyManager>;
  let now: number;
  let nowSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    now = T_2000_KST;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    manager = new ApiKeyManager(['key-a-11111', 'key-b-22222'], {
      disableDurationMs: SHORT_MS,
      errorThreshold: 3,
    });
  });

  afterEach(() => {
    manager.dispose();
    nowSpy.mockRestore();
    warnSpy.mockRestore();
  });

  const disabledUntilOf = (index: number): number | null =>
    manager.getKeyStats()[index].disabledUntil;

  it('disables a quota-exhausted key until the next KST midnight', () => {
    manager.reportDailyQuotaExceeded('key-a-11111');
    expect(disabledUntilOf(0)).toBe(NEXT_MIDNIGHT_KST);
  });

  it('computes KST midnight from epoch, not the local calendar day (UTC date differs)', () => {
    now = Date.UTC(2026, 9, 3, 23, 0, 0); // 2026-10-04 08:00 KST
    manager.reportDailyQuotaExceeded('key-a-11111');
    expect(disabledUntilOf(0)).toBe(NEXT_MIDNIGHT_KST);
  });

  it('does not re-enable the key after the short cooldown, only after KST midnight', () => {
    manager.reportDailyQuotaExceeded('key-a-11111');
    now += SHORT_MS + 1_000;
    expect(new Set([manager.getNextKey(), manager.getNextKey()])).toEqual(new Set(['key-b-22222']));

    now = NEXT_MIDNIGHT_KST + 1;
    expect(new Set([manager.getNextKey(), manager.getNextKey()])).toEqual(
      new Set(['key-a-11111', 'key-b-22222'])
    );
  });

  it('a later short rate-limit disable does not shorten the quota disable', () => {
    manager.reportDailyQuotaExceeded('key-a-11111');
    manager.reportRateLimit('key-a-11111');
    expect(disabledUntilOf(0)).toBe(NEXT_MIDNIGHT_KST);
  });

  it('returns null (no call) and reports exhaustion when every key is quota-disabled', () => {
    manager.reportDailyQuotaExceeded('key-a-11111');
    manager.reportDailyQuotaExceeded('key-b-22222');
    expect(manager.getNextKey()).toBeNull();
    expect(manager.isDailyQuotaExhausted()).toBe(true);
  });

  it('treats quota + auth disabled keys together as exhausted', () => {
    manager.reportDailyQuotaExceeded('key-a-11111');
    manager.reportAuthError('key-b-22222');
    expect(manager.getNextKey()).toBeNull();
    expect(manager.isDailyQuotaExhausted()).toBe(true);
  });

  it('is not exhausted while any key is still usable', () => {
    manager.reportDailyQuotaExceeded('key-a-11111');
    expect(manager.isDailyQuotaExhausted()).toBe(false);
    expect(manager.getNextKey()).toBe('key-b-22222');
  });

  it('is not "quota exhausted" when keys are only auth-invalid (a different failure)', () => {
    manager.reportAuthError('key-a-11111');
    manager.reportAuthError('key-b-22222');
    expect(manager.isDailyQuotaExhausted()).toBe(false);
  });
});
