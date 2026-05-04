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
    });

    it('should handle permanent lockout', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'lockout_permanent',
      });

      const result = await biometricService.authenticateWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('영구 잠금');
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

  describe('isBiometricLoginEnabled', () => {
    it('should return true when enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(true);
    });

    it('should return false when disabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(false);
    });

    it('should return false when not set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result = await biometricService.isBiometricLoginEnabled();

      expect(result).toBe(false);
    });
  });

  describe('enableBiometricLogin', () => {
    it('should enable biometric login and store credentials', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await biometricService.enableBiometricLogin('test@example.com', 'password123');

      expect(result).toBe(true);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'livemetro_biometric_email',
        'test@example.com'
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'livemetro_biometric_password',
        'password123'
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_biometric_enabled',
        'true'
      );
    });

    it('should return false if authentication fails', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: false });

      const result = await biometricService.enableBiometricLogin('test@example.com', 'password123');

      expect(result).toBe(false);
      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should return false on storage error', async () => {
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      const result = await biometricService.enableBiometricLogin('test@example.com', 'password123');

      expect(result).toBe(false);
    });
  });

  describe('reEnableBiometricLogin', () => {
    it('should set flag to true and return true when credentials exist', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_biometric_enabled',
        'true'
      );
    });

    it('should return false and skip setItem when credentials are missing', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(false);
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should return false on storage error', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      const result = await biometricService.reEnableBiometricLogin();

      expect(result).toBe(false);
    });
  });

  describe('disableBiometricLogin', () => {
    it('should disable biometric login and remove credentials', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await biometricService.disableBiometricLogin();

      expect(result).toBe(true);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('livemetro_biometric_email');
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('livemetro_biometric_password');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@livemetro_biometric_enabled',
        'false'
      );
    });

    it('should return false on error', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Delete error'));

      const result = await biometricService.disableBiometricLogin();

      expect(result).toBe(false);
    });
  });

  describe('getStoredCredentials', () => {
    it('should return stored credentials', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');

      const result = await biometricService.getStoredCredentials();

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should return null when email is missing', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

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
    it('should return true when credentials exist', async () => {
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');

      const result = await biometricService.hasStoredCredentials();

      expect(result).toBe(true);
    });

    it('should return false when credentials are missing', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await biometricService.hasStoredCredentials();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Error'));

      const result = await biometricService.hasStoredCredentials();

      expect(result).toBe(false);
    });
  });

  describe('performBiometricLogin', () => {
    it('should perform complete biometric login flow', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123')
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should fail when biometric login not enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toContain('설정되지 않았습니다');
    });

    it('should fail when no credentials stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toContain('저장된 자격 증명이 없습니다');
    });

    it('should fail when authentication fails', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: 'user_cancel',
      });

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      expect(result.error).toBe('취소됨');
    });

    it('should handle exception during login', async () => {
      // Setup initial checks to pass, then fail at credentials
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce('test@example.com')
        .mockResolvedValueOnce('password123');
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
      // Fail when getting credentials the second time
      mockSecureStore.getItemAsync
        .mockRejectedValueOnce(new Error('Get credentials failed'));

      const result = await biometricService.performBiometricLogin();

      expect(result.success).toBe(false);
      // Either shows specific error or generic error message
      expect(result.error).toBeDefined();
    });
  });
});
