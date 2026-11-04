/**
 * socialSdkSessions tests — native Google/Kakao SDK session cleanup on
 * sign-out / account deletion.
 *
 * Both SDKs are loaded via dynamic `await import()`; under jest,
 * babel-plugin-dynamic-import-node lowers that to a lazy require so jest.mock
 * intercepts it. The module-unavailable branch is simulated with toggled
 * factories + resetModules (same pattern as googleSignIn.test.ts).
 */
import { Platform } from 'react-native';

import {
  clearSocialSdkSessions,
  getSocialRevocationTargets,
  SOCIAL_SDK_CLEANUP_TIMEOUT_MS,
} from '@/services/auth/social/socialSdkSessions';

const mockGoogleConfigure = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockGoogleRevokeAccess = jest.fn();
let mockGoogleImportThrows = false;

jest.mock('@react-native-google-signin/google-signin', () => {
  if (mockGoogleImportThrows) {
    throw new Error('native module missing');
  }
  return {
    __esModule: true,
    GoogleSignin: {
      configure: (...args: unknown[]) => mockGoogleConfigure(...args),
      signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
      revokeAccess: (...args: unknown[]) => mockGoogleRevokeAccess(...args),
    },
  };
});

const mockKakaoLogout = jest.fn();
const mockKakaoUnlink = jest.fn();
let mockKakaoImportThrows = false;

jest.mock('@react-native-seoul/kakao-login', () => {
  if (mockKakaoImportThrows) {
    throw new Error('native module missing');
  }
  return {
    __esModule: true,
    logout: (...args: unknown[]) => mockKakaoLogout(...args),
    unlink: (...args: unknown[]) => mockKakaoUnlink(...args),
  };
});

const ORIGINAL_OS = Platform.OS;
const ORIGINAL_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

const setOS = (os: string): void => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

describe('socialSdkSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleImportThrows = false;
    mockKakaoImportThrows = false;
    setOS('android');
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    mockGoogleSignOut.mockResolvedValue(null);
    mockGoogleRevokeAccess.mockResolvedValue(null);
    mockKakaoLogout.mockResolvedValue('ok');
    mockKakaoUnlink.mockResolvedValue('ok');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    setOS(ORIGINAL_OS);
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = ORIGINAL_WEB_CLIENT_ID;
  });

  describe('clearSocialSdkSessions (sign-out)', () => {
    it('configures Google before signOut so a cold-started app can clear the cached account', async () => {
      await clearSocialSdkSessions();

      expect(mockGoogleConfigure).toHaveBeenCalledWith({ webClientId: 'web-client-id' });
      expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
      expect(mockGoogleConfigure.mock.invocationCallOrder[0]).toBeLessThan(
        mockGoogleSignOut.mock.invocationCallOrder[0] as number,
      );
    });

    it('logs out of the Kakao SDK', async () => {
      await clearSocialSdkSessions();

      expect(mockKakaoLogout).toHaveBeenCalledTimes(1);
    });

    it('does not revoke Google access or unlink Kakao on plain sign-out', async () => {
      await clearSocialSdkSessions();

      expect(mockGoogleRevokeAccess).not.toHaveBeenCalled();
      expect(mockKakaoUnlink).not.toHaveBeenCalled();
    });

    it('still calls Google signOut when the web client id is missing', async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

      await clearSocialSdkSessions();

      expect(mockGoogleConfigure).not.toHaveBeenCalled();
      expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    });

    it('resolves when both SDK calls reject (not signed in to either)', async () => {
      mockGoogleSignOut.mockRejectedValue(new Error('apiClient is null'));
      mockKakaoLogout.mockRejectedValue(new Error('not logged in'));

      await expect(clearSocialSdkSessions()).resolves.toBeUndefined();
    });

    it('resolves when configure throws synchronously', async () => {
      mockGoogleConfigure.mockImplementation(() => {
        throw new Error('configure failed');
      });

      await expect(clearSocialSdkSessions()).resolves.toBeUndefined();
      expect(mockKakaoLogout).toHaveBeenCalledTimes(1);
    });

    it('is a no-op on web', async () => {
      setOS('web');

      await clearSocialSdkSessions();

      expect(mockGoogleSignOut).not.toHaveBeenCalled();
      expect(mockKakaoLogout).not.toHaveBeenCalled();
    });

    it('gives up after the timeout when an SDK call never settles', async () => {
      jest.useFakeTimers();
      mockGoogleSignOut.mockReturnValue(new Promise(() => undefined));
      mockKakaoLogout.mockReturnValue(new Promise(() => undefined));

      let settled = false;
      const pending = clearSocialSdkSessions().then(() => {
        settled = true;
      });

      await jest.advanceTimersByTimeAsync(SOCIAL_SDK_CLEANUP_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toBe(true);
    });
  });

  describe('clearSocialSdkSessions (account deletion)', () => {
    it('revokes Google access before signing out of the Google SDK', async () => {
      await clearSocialSdkSessions({ google: true, kakao: false });

      expect(mockGoogleRevokeAccess).toHaveBeenCalledTimes(1);
      expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
      expect(mockGoogleRevokeAccess.mock.invocationCallOrder[0]).toBeLessThan(
        mockGoogleSignOut.mock.invocationCallOrder[0] as number,
      );
      expect(mockKakaoUnlink).not.toHaveBeenCalled();
      expect(mockKakaoLogout).toHaveBeenCalledTimes(1);
    });

    it('unlinks Kakao and skips logout when unlink succeeds', async () => {
      await clearSocialSdkSessions({ google: false, kakao: true });

      expect(mockKakaoUnlink).toHaveBeenCalledTimes(1);
      expect(mockKakaoLogout).not.toHaveBeenCalled();
      expect(mockGoogleRevokeAccess).not.toHaveBeenCalled();
      expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    });

    it('falls back to Kakao logout when unlink fails (e.g. offline)', async () => {
      mockKakaoUnlink.mockRejectedValue(new Error('network'));

      await clearSocialSdkSessions({ google: false, kakao: true });

      expect(mockKakaoLogout).toHaveBeenCalledTimes(1);
    });

    it('still signs out of Google when revokeAccess fails', async () => {
      mockGoogleRevokeAccess.mockRejectedValue(new Error('network'));

      await expect(
        clearSocialSdkSessions({ google: true, kakao: false }),
      ).resolves.toBeUndefined();
      expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('module unavailable (old OTA binary / Expo Go)', () => {
    it('resolves silently when both native modules are missing', async () => {
      mockGoogleImportThrows = true;
      mockKakaoImportThrows = true;
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('@/services/auth/social/socialSdkSessions') as typeof import('@/services/auth/social/socialSdkSessions');

      await expect(fresh.clearSocialSdkSessions()).resolves.toBeUndefined();
      expect(mockGoogleSignOut).not.toHaveBeenCalled();
      expect(mockKakaoLogout).not.toHaveBeenCalled();
    });
  });

  describe('getSocialRevocationTargets', () => {
    it('targets Google when the account has a google.com provider', () => {
      expect(
        getSocialRevocationTargets({ uid: 'abc', providerData: [{ providerId: 'google.com' }] }),
      ).toEqual({ google: true, kakao: false });
    });

    it('targets Kakao for a kakao:{id} custom-token uid', () => {
      expect(getSocialRevocationTargets({ uid: 'kakao:123', providerData: [] })).toEqual({
        google: false,
        kakao: true,
      });
    });

    it('targets nothing for email/anonymous accounts', () => {
      expect(
        getSocialRevocationTargets({ uid: 'abc', providerData: [{ providerId: 'password' }] }),
      ).toEqual({ google: false, kakao: false });
    });

    it('targets nothing when there is no user', () => {
      expect(getSocialRevocationTargets(null)).toEqual({ google: false, kakao: false });
    });
  });
});
