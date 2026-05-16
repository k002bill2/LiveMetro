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
