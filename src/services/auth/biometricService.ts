/**
 * Biometric Authentication Service
 * Handles Face ID / Touch ID authentication for quick login
 *
 * NOTE: This is a stub implementation for Expo Go compatibility.
 * Biometric features require a development build (expo run:ios/android).
 * All functions return "unavailable" status in Expo Go.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const BIOMETRIC_ENABLED_KEY = '@livemetro_biometric_enabled';

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
 * Check if native modules are available (not in Expo Go)
 * Always returns false in Expo Go - requires development build
 */
export const isNativeModulesAvailable = (): boolean => {
  // Native modules not available in Expo Go
  // Requires: npx expo run:ios or npx expo run:android
  return false;
};

/**
 * Check if device supports biometric authentication
 */
export const isBiometricSupported = async (): Promise<boolean> => {
  return false;
};

/**
 * Check if user has enrolled biometrics on device
 */
export const isBiometricEnrolled = async (): Promise<boolean> => {
  return false;
};

/**
 * Check if biometric is available (supported + enrolled)
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
  return false;
};

/**
 * Get available biometric types
 */
export const getBiometricTypes = async (): Promise<BiometricType> => {
  return { fingerprint: false, faceId: false, iris: false };
};

/**
 * Get biometric type name for display
 */
export const getBiometricTypeName = async (): Promise<string> => {
  return '생체인증';
};

/**
 * Authenticate user with biometrics
 */
export const authenticateWithBiometric = async (
  _promptMessage?: string
): Promise<{ success: boolean; error?: string }> => {
  return {
    success: false,
    error: 'Development build가 필요합니다. npx expo run:ios 또는 npx expo run:android를 실행하세요.'
  };
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
  _email: string,
  _password: string
): Promise<boolean> => {
  console.warn('Biometric login requires development build');
  return false;
};

/**
 * Disable biometric login and remove stored credentials
 */
export const disableBiometricLogin = async (): Promise<boolean> => {
  try {
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
  return null;
};

/**
 * Check if credentials are stored
 */
export const hasStoredCredentials = async (): Promise<boolean> => {
  return false;
};

/**
 * Perform biometric login - authenticate and return credentials
 */
export const performBiometricLogin = async (): Promise<{
  success: boolean;
  credentials?: StoredCredentials;
  error?: string;
}> => {
  return {
    success: false,
    error: 'Development build가 필요합니다'
  };
};

export default {
  isNativeModulesAvailable,
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
