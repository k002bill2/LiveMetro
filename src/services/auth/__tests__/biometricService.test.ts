/**
 * Biometric Service Tests
 * Tests for Face ID / Touch ID authentication
 */

import * as biometricService from '../biometricService';

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  canUseBiometricAuthentication: jest.fn(),
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

const mockLocalAuthentication = require('expo-local-authentication');
const mockSecureStore = require('expo-secure-store');
const mockAsyncStorage = require('@react-native-async-storage/async-storage');

describe('BiometricService', () => {
  // Suppress console.error for expected error handling tests
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('isBiometricSupported', () => {
    it('should return true when device has biometric hardware', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);

      const result = await biometricService.isBiometricSupported();

      expect(result).toBe(true);
      expect(mockLocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });

    it('should return false when device lacks biometric hardware', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(false);

      const result = await biometricService.isBiometricSupported();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockRejectedValue(new Error('Hardware check failed'));

      const result = await biometricService.isBiometricSupported();

      expect(result).toBe(false);
    });
  });

  describe('isBiometricEnrolled', () => {
    it('should return true when user has enrolled biometrics', async () => {
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);

      const result = await biometricService.isBiometricEnrolled();

      expect(result).toBe(true);
    });

    it('should return false when no biometrics enrolled', async () => {
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

      const result = await biometricService.isBiometricEnrolled();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockLocalAuthentication.isEnrolledAsync.mockRejectedValue(new Error('Enrollment check failed'));

      const result = await biometricService.isBiometricEnrolled();

      expect(result).toBe(false);
    });
  });

  describe('isBiometricAvailable', () => {
    it('should return true when supported and enrolled', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);

      const result = await biometricService.isBiometricAvailable();

      expect(result).toBe(true);
    });

    it('should return false when not supported', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(false);

      const result = await biometricService.isBiometricAvailable();

      expect(result).toBe(false);
    });

    it('should return false when supported but not enrolled', async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

      const result = await biometricService.isBiometricAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getBiometricTypes', () => {
    it('should return fingerprint when available', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([1]); // FINGERPRINT

      const result = await biometricService.getBiometricTypes();

      expect(result.fingerprint).toBe(true);
      expect(result.faceId).toBe(false);
      expect(result.iris).toBe(false);
    });

    it('should return faceId when available', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]); // FACIAL_RECOGNITION

      const result = await biometricService.getBiometricTypes();

      expect(result.fingerprint).toBe(false);
      expect(result.faceId).toBe(true);
      expect(result.iris).toBe(false);
    });

    it('should return multiple types when available', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([1, 2]); // FINGERPRINT & FACIAL

      const result = await biometricService.getBiometricTypes();

      expect(result.fingerprint).toBe(true);
      expect(result.faceId).toBe(true);
    });

    it('should return all false on error', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockRejectedValue(
        new Error('Types check failed')
      );

      const result = await biometricService.getBiometricTypes();

      expect(result).toEqual({ fingerprint: false, faceId: false, iris: false });
    });
  });

  describe('getBiometricTypeName', () => {
    it('should return "Face ID" for iOS with facial recognition', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);

      const result = await biometricService.getBiometricTypeName();

      expect(result).toBe('Face ID');
    });

    it('should return "Touch ID" for iOS with fingerprint', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([1]);

      const result = await biometricService.getBiometricTypeName();

      expect(result).toBe('Touch ID');
    });

    it('should return default name on error', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockRejectedValue(new Error('Error'));

      const result = await biometricService.getBiometricTypeName();

      expect(result).toBe('생체인증');
    });
  });

  describe('authenticateWithBiometric', () => {
    it('should return success on successful authentication', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should use custom prompt message', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });

      await biometricService.authenticateWithBiometric('커스텀 메시지');

      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          promptMessage: '커스텀 메시지',
        })
      );
    });

    it('should handle user cancel', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toBe('취소됨');
    });

    it('should handle fallback request', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_fallback',
      });

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toBe('fallback');
    });

    it('should handle lockout', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout',
      });

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('잠겼습니다');
      expect(result.error).toContain('기기 비밀번호');
    });

    it('should handle unknown error', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'unknown_error',
      });

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toBe('인증에 실패했습니다.');
    });

    it('should handle exception during authentication', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockRejectedValue(new Error('Auth error'));

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('오류가 발생했습니다');
    });
  });

  // Key-addressed in-memory SecureStore so tests assert on which keys hold
  // which values (and with which options) instead of call ordering.
  const EMAIL_KEY = 'livemetro_biometric_email';
  const LEGACY_PASSWORD_KEY = 'livemetro_biometric_password';
  const PASSWORD_KEY = 'livemetro_biometric_password_v2';
  const MARKER_KEY = 'livemetro_biometric_credential_version';
  const ENABLED_KEY = '@livemetro_biometric_enabled';
  const SECRET = 'test-secret';

  let secureData: Record<string, string>;
  let asyncData: Record<string, string>;

  const installStores = (
    secure: Record<string, string> = {},
    async: Record<string, string> = {}
  ): void => {
    secureData = { ...secure };
    asyncData = { ...async };
    mockSecureStore.getItemAsync.mockImplementation(
      async (key: string) => secureData[key] ?? null
    );
    mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      secureData[key] = value;
    });
    mockSecureStore.deleteItemAsync.mockImplementation(async (key: string) => {
      delete secureData[key];
    });
    mockAsyncStorage.getItem.mockImplementation(async (key: string) => asyncData[key] ?? null);
    mockAsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      asyncData[key] = value;
    });
  };

  const enrolledV2 = (): void =>
    installStores(
      { [EMAIL_KEY]: 'test@example.com', [PASSWORD_KEY]: SECRET, [MARKER_KEY]: 'v2' },
      { [ENABLED_KEY]: 'true' }
    );

  const legacyOnly = (): void =>
    installStores(
      { [EMAIL_KEY]: 'test@example.com', [LEGACY_PASSWORD_KEY]: SECRET },
      { [ENABLED_KEY]: 'true' }
    );

  const protectedOptions = expect.objectContaining({
    requireAuthentication: true,
    keychainAccessible: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
  });

  /** Calls that read the protected (v2) password key — each one is an OS prompt. */
  const passwordReads = (): unknown[][] =>
    mockSecureStore.getItemAsync.mock.calls.filter(
      (call: unknown[]) => call[0] === PASSWORD_KEY
    );

  const callOrderOf = (mockFn: jest.Mock, key: string): number =>
    mockFn.mock.invocationCallOrder[
      mockFn.mock.calls.findIndex((call: unknown[]) => call[0] === key)
    ] ?? Number.NaN;

  beforeEach(() => {
    mockSecureStore.canUseBiometricAuthentication.mockReturnValue(true);
    mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
    installStores();
  });

  describe('isBiometricLoginEnabled', () => {
    it('should return true when enabled with v2 credentials', async () => {
      enrolledV2();

      await expect(biometricService.isBiometricLoginEnabled()).resolves.toBe(true);
    });

    it('should return false when disabled', async () => {
      installStores({ [MARKER_KEY]: 'v2' }, { [ENABLED_KEY]: 'false' });

      await expect(biometricService.isBiometricLoginEnabled()).resolves.toBe(false);
    });

    it('should return false when not set', async () => {
      await expect(biometricService.isBiometricLoginEnabled()).resolves.toBe(false);
    });

    it('should return false for legacy (unprotected) credentials', async () => {
      legacyOnly();

      await expect(biometricService.isBiometricLoginEnabled()).resolves.toBe(false);
    });

    it('should never read the protected password (no OS prompt)', async () => {
      enrolledV2();

      await biometricService.isBiometricLoginEnabled();

      expect(passwordReads()).toHaveLength(0);
    });

    it('should return false on error', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await expect(biometricService.isBiometricLoginEnabled()).resolves.toBe(false);
    });
  });

  describe('enableBiometricLogin', () => {
    beforeEach(() => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
    });

    it('should store the password under the v2 key with OS authentication options', async () => {
      const result = await biometricService.enableBiometricLogin('test@example.com', SECRET);

      expect(result).toBe(true);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        PASSWORD_KEY,
        SECRET,
        protectedOptions
      );
      expect(secureData[PASSWORD_KEY]).toBe(SECRET);
    });

    it('should store email, version marker and enabled flag', async () => {
      await biometricService.enableBiometricLogin('test@example.com', SECRET);

      expect(secureData[EMAIL_KEY]).toBe('test@example.com');
      expect(secureData[MARKER_KEY]).toBe('v2');
      expect(asyncData[ENABLED_KEY]).toBe('true');
    });

    it('should write the marker only after the protected password is stored', async () => {
      await biometricService.enableBiometricLogin('test@example.com', SECRET);

      expect(callOrderOf(mockSecureStore.setItemAsync, PASSWORD_KEY)).toBeLessThan(
        callOrderOf(mockSecureStore.setItemAsync, MARKER_KEY)
      );
    });

    it('should never write the password to the legacy key and should remove it', async () => {
      legacyOnly();

      await biometricService.enableBiometricLogin('test@example.com', SECRET);

      const legacyWrites = mockSecureStore.setItemAsync.mock.calls.filter(
        (call: unknown[]) => call[0] === LEGACY_PASSWORD_KEY
      );
      expect(legacyWrites).toHaveLength(0);
      expect(secureData[LEGACY_PASSWORD_KEY]).toBeUndefined();
    });

    it('should delete an existing v2 item before writing (avoid iOS update prompt)', async () => {
      enrolledV2();

      await biometricService.enableBiometricLogin('test@example.com', 'new-secret');

      expect(callOrderOf(mockSecureStore.deleteItemAsync, PASSWORD_KEY)).toBeLessThan(
        callOrderOf(mockSecureStore.setItemAsync, PASSWORD_KEY)
      );
      expect(secureData[PASSWORD_KEY]).toBe('new-secret');
    });

    it('should refuse to enable when OS-bound storage is unavailable', async () => {
      mockSecureStore.canUseBiometricAuthentication.mockReturnValue(false);

      const result = await biometricService.enableBiometricLogin('test@example.com', SECRET);

      expect(result).toBe(false);
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(asyncData[ENABLED_KEY]).toBeUndefined();
    });

    it('should return false if authentication fails', async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: false });

      const result = await biometricService.enableBiometricLogin('test@example.com', SECRET);

      expect(result).toBe(false);
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should return false and leave nothing half-stored on storage error', async () => {
      mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
        if (key === PASSWORD_KEY) throw new Error('Storage error');
        secureData[key] = value;
      });

      const result = await biometricService.enableBiometricLogin('test@example.com', SECRET);

      expect(result).toBe(false);
      expect(secureData[MARKER_KEY]).toBeUndefined();
      expect(asyncData[ENABLED_KEY]).not.toBe('true');
    });
  });

  describe('reEnableBiometricLogin', () => {
    it('should set flag to true when v2 credentials exist, without prompting', async () => {
      installStores(
        { [EMAIL_KEY]: 'test@example.com', [PASSWORD_KEY]: SECRET, [MARKER_KEY]: 'v2' },
        { [ENABLED_KEY]: 'false' }
      );

      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(true);
      expect(asyncData[ENABLED_KEY]).toBe('true');
      expect(passwordReads()).toHaveLength(0);
    });

    it('should return false and skip setItem when credentials are missing', async () => {
      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(false);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should return false for legacy-only credentials', async () => {
      installStores(
        { [EMAIL_KEY]: 'test@example.com', [LEGACY_PASSWORD_KEY]: SECRET },
        { [ENABLED_KEY]: 'false' }
      );

      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(false);
      expect(asyncData[ENABLED_KEY]).toBe('false');
    });

    it('should return false on storage error', async () => {
      enrolledV2();
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(false);
    });
  });

  describe('disableBiometricLogin', () => {
    it('should remove v2, legacy, email and marker keys and clear the flag', async () => {
      installStores(
        {
          [EMAIL_KEY]: 'test@example.com',
          [PASSWORD_KEY]: SECRET,
          [LEGACY_PASSWORD_KEY]: SECRET,
          [MARKER_KEY]: 'v2',
        },
        { [ENABLED_KEY]: 'true' }
      );

      const result = await biometricService.disableBiometricLogin();

      expect(result).toBe(true);
      expect(secureData).toEqual({});
      expect(asyncData[ENABLED_KEY]).toBe('false');
    });

    it('should return false on error', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete error'));

      const result = await biometricService.disableBiometricLogin();

      expect(result).toBe(false);
    });
  });

  describe('getStoredCredentials', () => {
    it('should read the password with OS authentication options', async () => {
      enrolledV2();

      const result = await biometricService.getStoredCredentials();

      expect(result).toEqual({ email: 'test@example.com', password: SECRET });
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(PASSWORD_KEY, protectedOptions);
    });

    it('should not fall back to the legacy unprotected password', async () => {
      legacyOnly();

      const result = await biometricService.getStoredCredentials();

      expect(result).toBeNull();
      const legacyReads = mockSecureStore.getItemAsync.mock.calls.filter(
        (call: unknown[]) => call[0] === LEGACY_PASSWORD_KEY
      );
      expect(legacyReads).toHaveLength(0);
    });

    it('should return null when email is missing', async () => {
      const result = await biometricService.getStoredCredentials();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Get error'));

      const result = await biometricService.getStoredCredentials();

      expect(result).toBeNull();
    });
  });

  describe('hasStoredCredentials', () => {
    it('should return true for v2 credentials without reading the password', async () => {
      enrolledV2();

      const result = await biometricService.hasStoredCredentials();

      expect(result).toBe(true);
      expect(passwordReads()).toHaveLength(0);
    });

    it('should return false when credentials are missing', async () => {
      await expect(biometricService.hasStoredCredentials()).resolves.toBe(false);
    });

    it('should return false for legacy-only credentials', async () => {
      legacyOnly();

      await expect(biometricService.hasStoredCredentials()).resolves.toBe(false);
    });

    it('should return false on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Error'));

      await expect(biometricService.hasStoredCredentials()).resolves.toBe(false);
    });
  });

  describe('migrateLegacyBiometricCredentials', () => {
    it('should delete the legacy password and reset the flag so setup is offered again', async () => {
      legacyOnly();

      await biometricService.migrateLegacyBiometricCredentials();

      expect(secureData[LEGACY_PASSWORD_KEY]).toBeUndefined();
      expect(secureData[EMAIL_KEY]).toBeUndefined();
      expect(asyncData[ENABLED_KEY]).toBe('false');
    });

    it('should never read or copy the legacy password into the v2 key', async () => {
      legacyOnly();

      await biometricService.migrateLegacyBiometricCredentials();

      expect(secureData[PASSWORD_KEY]).toBeUndefined();
      const legacyReads = mockSecureStore.getItemAsync.mock.calls.filter(
        (call: unknown[]) => call[0] === LEGACY_PASSWORD_KEY
      );
      expect(legacyReads).toHaveLength(0);
    });

    it('should keep v2 credentials intact and only drop a stray legacy key', async () => {
      installStores(
        {
          [EMAIL_KEY]: 'test@example.com',
          [PASSWORD_KEY]: SECRET,
          [MARKER_KEY]: 'v2',
          [LEGACY_PASSWORD_KEY]: 'old-secret',
        },
        { [ENABLED_KEY]: 'true' }
      );

      await biometricService.migrateLegacyBiometricCredentials();

      expect(secureData[PASSWORD_KEY]).toBe(SECRET);
      expect(secureData[LEGACY_PASSWORD_KEY]).toBeUndefined();
      expect(asyncData[ENABLED_KEY]).toBe('true');
    });

    it('should not throw on storage error', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete error'));

      await expect(biometricService.migrateLegacyBiometricCredentials()).resolves.toBeUndefined();
    });

    it('should keep a v2 enrolment when the marker lookup fails transiently', async () => {
      enrolledV2();
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Keychain unavailable'));

      await biometricService.migrateLegacyBiometricCredentials();

      expect(secureData[EMAIL_KEY]).toBe('test@example.com');
      expect(secureData[PASSWORD_KEY]).toBe(SECRET);
      expect(asyncData[ENABLED_KEY]).toBe('true');
    });
  });

  describe('performBiometricLogin', () => {
    it('should return credentials after a single OS-gated read', async () => {
      enrolledV2();

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual({ email: 'test@example.com', password: SECRET });
      expect(passwordReads()).toEqual([[PASSWORD_KEY, protectedOptions]]);
    });

    it('should not show a separate JS biometric prompt (OS prompt is the gate)', async () => {
      enrolledV2();

      await biometricService.performBiometricLogin();

      expect(mockLocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    });

    it('should pass a localized authentication prompt to the OS', async () => {
      enrolledV2();

      await biometricService.performBiometricLogin();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        PASSWORD_KEY,
        expect.objectContaining({ authenticationPrompt: 'Face ID로 인증하세요' })
      );
    });

    it('should fail when biometric login not enabled', async () => {
      installStores({}, { [ENABLED_KEY]: 'false' });

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toContain('설정되지 않았습니다');
    });

    it('should fail without reading any password for legacy-only credentials', async () => {
      legacyOnly();

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.credentials).toBeUndefined();
      const legacyReads = mockSecureStore.getItemAsync.mock.calls.filter(
        (call: unknown[]) => call[0] === LEGACY_PASSWORD_KEY
      );
      expect(legacyReads).toHaveLength(0);
    });

    it('should fail-secure and wipe credentials when the user cancels the OS prompt', async () => {
      enrolledV2();
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === PASSWORD_KEY) throw new Error('User canceled the operation.');
        return secureData[key] ?? null;
      });

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.credentials).toBeUndefined();
      expect(result.error).toContain('다시 설정');
      expect(secureData).toEqual({});
      expect(asyncData[ENABLED_KEY]).toBe('false');
    });

    it('should fail-secure and wipe credentials when OS authentication fails', async () => {
      enrolledV2();
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === PASSWORD_KEY) throw new Error('Authentication failed');
        return secureData[key] ?? null;
      });

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(secureData).toEqual({});
      expect(asyncData[ENABLED_KEY]).toBe('false');
    });

    it('should fail-secure and wipe credentials when the key was invalidated (biometrics changed)', async () => {
      enrolledV2();
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) =>
        key === PASSWORD_KEY ? null : secureData[key] ?? null
      );

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toContain('다시 설정');
      expect(secureData).toEqual({});
      expect(asyncData[ENABLED_KEY]).toBe('false');
    });
  });
});
