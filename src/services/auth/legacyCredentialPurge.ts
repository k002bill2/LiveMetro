/**
 * legacyCredentialPurge — removes plaintext passwords left by older versions.
 *
 * Older builds wrote the password to SecureStore with no options, readable
 * without any user authentication:
 * - auto-login: no longer written at all — the signed-in session is kept by
 *   Firebase Auth persistence.
 * - biometric login (v1 key): replaced by an OS-authentication-bound v2 key;
 *   see biometricService.migrateLegacyBiometricCredentials.
 *
 * Runs on every app start (AuthProvider mount) so devices that stay signed in
 * and never revisit the login screens are cleaned up too. Never reads the
 * plaintext values and never throws.
 */
import * as SecureStore from 'expo-secure-store';
import { migrateLegacyBiometricCredentials } from '@/services/auth/biometricService';

/** SecureStore key the legacy auto-login stored the plaintext password under. */
export const LEGACY_AUTO_LOGIN_CREDENTIAL_KEY = 'livemetro_auto_login_password';

export const purgeLegacyPlaintextCredentials = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(LEGACY_AUTO_LOGIN_CREDENTIAL_KEY);
  } catch (error) {
    console.error('Error purging legacy auto-login credential:', error);
  }
  try {
    await migrateLegacyBiometricCredentials();
  } catch (error) {
    console.error('Error migrating legacy biometric credentials:', error);
  }
};
