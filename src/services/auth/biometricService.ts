/**
 * Biometric Authentication Service
 * Handles Face ID / Touch ID authentication for quick login
 *
 * Uses expo-local-authentication for biometric auth
 * Uses expo-secure-store for secure credential storage
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys
const BIOMETRIC_ENABLED_KEY = '@livemetro_biometric_enabled';
const CREDENTIALS_EMAIL_KEY = 'livemetro_biometric_email';
// v1 stored the password with no SecureStore options, so any code path that
// could call getItemAsync (rooted/jailbroken device, tampered JS) read it
// without biometrics. Never read it again — only delete it.
const LEGACY_CREDENTIALS_PASSWORD_KEY = 'livemetro_biometric_password';
// v2 is bound to OS authentication. A separate key is required: iOS
// SecureStore.get() returns an unauthenticated item under the same key before
// trying the authenticated one, so mixing both under one key would keep
// serving the legacy plaintext.
const CREDENTIALS_PASSWORD_KEY = 'livemetro_biometric_password_v2';
// Unprotected presence marker. Reading the v2 password triggers the OS
// prompt, so "are credentials set up?" checks must look here instead.
const CREDENTIALS_VERSION_KEY = 'livemetro_biometric_credential_version';
const CREDENTIALS_VERSION = 'v2';

const RESETUP_REQUIRED_MESSAGE =
  '생체인증 정보를 확인할 수 없어 생체인증 로그인이 해제되었습니다. 이메일로 로그인한 뒤 다시 설정해주세요.';

/**
 * Options that bind the stored password to device authentication:
 * iOS biometryCurrentSet (invalidated when biometrics change) + this-device-only
 * accessibility; Android Keystore key with setUserAuthenticationRequired.
 */
const protectedPasswordOptions = (
  authenticationPrompt: string
): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  authenticationPrompt,
});

export interface BiometricType {
  fingerprint: boolean;
  faceId: boolean;
  iris: boolean;
}

export interface StoredCredentials {
  email: string;
  password: string;
}

/**
 * Check if device supports biometric authentication
 */
export const isBiometricSupported = async (): Promise<boolean> => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    return compatible;
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return false;
  }
};

/**
 * Check if user has enrolled biometrics on device
 */
export const isBiometricEnrolled = async (): Promise<boolean> => {
  try {
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    console.error('Error checking biometric enrollment:', error);
    return false;
  }
};

/**
 * Check if biometric is available (supported + enrolled)
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    const supported = await isBiometricSupported();
    if (!supported) return false;

    const enrolled = await isBiometricEnrolled();
    if (!enrolled) return false;

    // Biometric login needs an OS-bound key (Android: BIOMETRIC_STRONG).
    // Without it setup would silently fail, so don't offer the feature.
    return SecureStore.canUseBiometricAuthentication();
  } catch (error) {
    console.error('Error checking biometric availability:', error);
    return false;
  }
};

/**
 * Get available biometric types
 */
export const getBiometricTypes = async (): Promise<BiometricType> => {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return {
      fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
      faceId: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      iris: types.includes(LocalAuthentication.AuthenticationType.IRIS),
    };
  } catch (error) {
    console.error('Error getting biometric types:', error);
    return { fingerprint: false, faceId: false, iris: false };
  }
};

/**
 * Get biometric type name for display
 */
export const getBiometricTypeName = async (): Promise<string> => {
  try {
    const types = await getBiometricTypes();

    if (Platform.OS === 'ios') {
      if (types.faceId) return 'Face ID';
      if (types.fingerprint) return 'Touch ID';
    } else {
      if (types.faceId) return '얼굴 인식';
      if (types.fingerprint) return '지문 인식';
      if (types.iris) return '홍채 인식';
    }

    return '생체인증';
  } catch (error) {
    console.error('Error getting biometric type name:', error);
    return '생체인증';
  }
};

/**
 * Authenticate user with biometrics
 */
export const authenticateWithBiometric = async (
  promptMessage?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const biometricTypeName = await getBiometricTypeName();
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || `${biometricTypeName}로 인증하세요`,
      cancelLabel: '취소',
      fallbackLabel: '비밀번호 사용',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    // Handle different error cases
    if (result.error === 'user_cancel') {
      return { success: false, error: '취소됨' };
    } else if (result.error === 'user_fallback') {
      return { success: false, error: 'fallback' };
    } else if (result.error === 'lockout') {
      // expo-local-authentication 16 reports temporary and permanent lockout
      // both as 'lockout' (Android ERROR_LOCKOUT_PERMANENT included).
      return {
        success: false,
        error: '너무 많은 시도로 잠겼습니다. 잠시 후 다시 시도하거나 기기 비밀번호로 해제하세요.',
      };
    }

    return { success: false, error: '인증에 실패했습니다.' };
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return { success: false, error: '인증 중 오류가 발생했습니다.' };
  }
};

/**
 * Check if biometric login is enabled for this user
 */
export const isBiometricLoginEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    if (enabled !== 'true') return false;
    // Legacy (v1) enrolments count as not enabled so the next email login
    // offers setup again instead of using the unprotected password.
    const version = await SecureStore.getItemAsync(CREDENTIALS_VERSION_KEY);
    return version === CREDENTIALS_VERSION;
  } catch (error) {
    console.error('Error checking biometric login status:', error);
    return false;
  }
};

/**
 * Enable biometric login and save credentials securely
 */
export const enableBiometricLogin = async (
  email: string,
  password: string
): Promise<boolean> => {
  try {
    // Never fall back to unprotected storage: no OS-bound key, no feature.
    if (!SecureStore.canUseBiometricAuthentication()) {
      return false;
    }

    // First authenticate to confirm user identity
    const authResult = await authenticateWithBiometric('생체인증 로그인을 설정합니다');
    if (!authResult.success) {
      return false;
    }

    // Clear previous state first. Deleting the v2 item also makes the write
    // below a fresh create — on iOS updating an auth-bound item prompts again.
    await clearStoredCredentials();

    await SecureStore.setItemAsync(CREDENTIALS_EMAIL_KEY, email);
    await SecureStore.setItemAsync(
      CREDENTIALS_PASSWORD_KEY,
      password,
      protectedPasswordOptions('생체인증 로그인을 설정합니다')
    );
    // Marker last: it is what declares the credentials usable.
    await SecureStore.setItemAsync(CREDENTIALS_VERSION_KEY, CREDENTIALS_VERSION);

    // Mark biometric as enabled
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');

    return true;
  } catch (error) {
    console.error('Error enabling biometric login:', error);
    try {
      await clearStoredCredentials();
    } catch (cleanupError) {
      console.error('Error cleaning up partial biometric credentials:', cleanupError);
    }
    return false;
  }
};

/**
 * Re-enable biometric login when credentials are already stored.
 *
 * Password-less reactivation for the SettingsScreen toggle scenario:
 * user previously called enableBiometricLogin(email, password), then
 * disabled, and now wants to flip the flag back without re-typing the
 * password. Returns false if no credentials are present so the caller
 * cannot accidentally enable biometric login against an empty SecureStore.
 */
export const reEnableBiometricLogin = async (): Promise<boolean> => {
  try {
    const hasCredentials = await hasStoredCredentials();
    if (!hasCredentials) return false;
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
  } catch (error) {
    console.error('Error re-enabling biometric login:', error);
    return false;
  }
};

/**
 * Disable biometric login and remove stored credentials
 */
export const disableBiometricLogin = async (): Promise<boolean> => {
  try {
    // Remove stored credentials (v2 + legacy)
    await clearStoredCredentials();

    // Mark biometric as disabled
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');

    return true;
  } catch (error) {
    console.error('Error disabling biometric login:', error);
    return false;
  }
};

/**
 * Delete every stored credential key (v2, legacy, email, marker).
 * Throws on storage failure so callers can report it.
 */
const clearStoredCredentials = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(CREDENTIALS_VERSION_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_PASSWORD_KEY);
  await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_PASSWORD_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_EMAIL_KEY);
};

/**
 * Get stored credentials. Reading the password shows the OS biometric/device
 * prompt; returns null on cancel, auth failure, invalidated key or error.
 */
export const getStoredCredentials = async (
  authenticationPrompt = '생체인증으로 인증하세요'
): Promise<StoredCredentials | null> => {
  try {
    const email = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
    if (!email) return null;
    const password = await SecureStore.getItemAsync(
      CREDENTIALS_PASSWORD_KEY,
      protectedPasswordOptions(authenticationPrompt)
    );

    if (email && password) {
      return { email, password };
    }

    return null;
  } catch (error) {
    console.error('Error getting stored credentials:', error);
    return null;
  }
};

/**
 * Check if v2 credentials are stored. Never reads the protected password
 * (that would trigger the OS prompt).
 */
export const hasStoredCredentials = async (): Promise<boolean> => {
  try {
    const email = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
    const version = await SecureStore.getItemAsync(CREDENTIALS_VERSION_KEY);
    return !!email && version === CREDENTIALS_VERSION;
  } catch (error) {
    console.error('Error checking stored credentials:', error);
    return false;
  }
};

/**
 * Remove v1 (unprotected) biometric credentials. Never reads or copies the
 * legacy password. If no v2 credentials exist, biometric login is turned off
 * so the next email login offers setup again. Never throws.
 */
export const migrateLegacyBiometricCredentials = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_PASSWORD_KEY);
    // Read the marker directly (not hasStoredCredentials, which maps errors
    // to false): a transient lookup failure must abort, not wipe a valid
    // v2 enrolment.
    const version = await SecureStore.getItemAsync(CREDENTIALS_VERSION_KEY);
    if (version === CREDENTIALS_VERSION) return;
    await SecureStore.deleteItemAsync(CREDENTIALS_EMAIL_KEY);
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    if (enabled === 'true') {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
    }
  } catch (error) {
    console.error('Error migrating legacy biometric credentials:', error);
  }
};

/**
 * Perform biometric login - the OS prompt shown while reading the protected
 * password is the authentication gate.
 */
export const performBiometricLogin = async (): Promise<{
  success: boolean;
  credentials?: StoredCredentials;
  error?: string;
}> => {
  try {
    // Check if biometric login is enabled
    const enabled = await isBiometricLoginEnabled();
    if (!enabled) {
      return { success: false, error: '생체인증 로그인이 설정되지 않았습니다.' };
    }

    // Check if credentials exist
    const hasCredentials = await hasStoredCredentials();
    if (!hasCredentials) {
      return { success: false, error: '저장된 자격 증명이 없습니다.' };
    }

    // Reading the password shows the OS prompt (single prompt, no JS gate).
    const biometricTypeName = await getBiometricTypeName();
    const credentials = await getStoredCredentials(`${biometricTypeName}로 인증하세요`);
    if (!credentials) {
      // Fail-secure: cancel, auth failure and invalidated keys (biometrics
      // changed) all end with the credentials wiped. Error strings differ by
      // platform, so they are deliberately not parsed.
      await disableBiometricLogin();
      return { success: false, error: RESETUP_REQUIRED_MESSAGE };
    }

    return { success: true, credentials };
  } catch (error) {
    console.error('Biometric login error:', error);
    return { success: false, error: '생체인증 로그인 중 오류가 발생했습니다.' };
  }
};

export default {
  isBiometricSupported,
  isBiometricEnrolled,
  isBiometricAvailable,
  getBiometricTypes,
  getBiometricTypeName,
  authenticateWithBiometric,
  isBiometricLoginEnabled,
  enableBiometricLogin,
  reEnableBiometricLogin,
  disableBiometricLogin,
  getStoredCredentials,
  hasStoredCredentials,
  migrateLegacyBiometricCredentials,
  performBiometricLogin,
};
