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
const CREDENTIALS_PASSWORD_KEY = 'livemetro_biometric_password';

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
    return enrolled;
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
      return { success: false, error: '너무 많은 시도로 잠겼습니다. 잠시 후 다시 시도하세요.' };
    } else if (result.error === 'lockout_permanent') {
      return { success: false, error: '영구 잠금. 기기 비밀번호로 해제하세요.' };
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
    return enabled === 'true';
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
    // First authenticate to confirm user identity
    const authResult = await authenticateWithBiometric('생체인증 로그인을 설정합니다');
    if (!authResult.success) {
      console.log('Biometric authentication failed during setup');
      return false;
    }

    // Store credentials securely
    await SecureStore.setItemAsync(CREDENTIALS_EMAIL_KEY, email);
    await SecureStore.setItemAsync(CREDENTIALS_PASSWORD_KEY, password);

    // Mark biometric as enabled
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');

    return true;
  } catch (error) {
    console.error('Error enabling biometric login:', error);
    return false;
  }
};

/**
 * Disable biometric login and remove stored credentials
 */
export const disableBiometricLogin = async (): Promise<boolean> => {
  try {
    // Remove stored credentials
    await SecureStore.deleteItemAsync(CREDENTIALS_EMAIL_KEY);
    await SecureStore.deleteItemAsync(CREDENTIALS_PASSWORD_KEY);

    // Mark biometric as disabled
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');

    return true;
  } catch (error) {
    console.error('Error disabling biometric login:', error);
    return false;
  }
};

/**
 * Get stored credentials after successful biometric authentication
 */
export const getStoredCredentials = async (): Promise<StoredCredentials | null> => {
  try {
    const email = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(CREDENTIALS_PASSWORD_KEY);

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
 * Check if credentials are stored
 */
export const hasStoredCredentials = async (): Promise<boolean> => {
  try {
    const email = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(CREDENTIALS_PASSWORD_KEY);
    return !!(email && password);
  } catch (error) {
    console.error('Error checking stored credentials:', error);
    return false;
  }
};

/**
 * Perform biometric login - authenticate and return credentials
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

    // Perform biometric authentication
    const authResult = await authenticateWithBiometric();
    if (!authResult.success) {
      return { success: false, error: authResult.error };
    }

    // Get stored credentials
    const credentials = await getStoredCredentials();
    if (!credentials) {
      return { success: false, error: '자격 증명을 가져올 수 없습니다.' };
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
  disableBiometricLogin,
  getStoredCredentials,
  hasStoredCredentials,
  performBiometricLogin,
};
