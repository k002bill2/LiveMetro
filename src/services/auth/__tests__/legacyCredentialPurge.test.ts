/**
 * legacyCredentialPurge Tests
 * Removes plaintext passwords written by older app versions.
 */

import * as SecureStore from 'expo-secure-store';
import { migrateLegacyBiometricCredentials } from '@/services/auth/biometricService';
import {
  LEGACY_AUTO_LOGIN_CREDENTIAL_KEY,
  purgeLegacyPlaintextCredentials,
} from '../legacyCredentialPurge';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/services/auth/biometricService', () => ({
  migrateLegacyBiometricCredentials: jest.fn(),
}));

const mockedDelete = SecureStore.deleteItemAsync as jest.Mock;
const mockedGet = SecureStore.getItemAsync as jest.Mock;
const mockedMigrateBiometric = migrateLegacyBiometricCredentials as jest.Mock;

describe('purgeLegacyPlaintextCredentials', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    mockedDelete.mockResolvedValue(undefined);
    mockedMigrateBiometric.mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('targets the auto-login password key used by older versions', () => {
    expect(LEGACY_AUTO_LOGIN_CREDENTIAL_KEY).toBe('livemetro_auto_login_password');
  });

  it('deletes the auto-login plaintext password', async () => {
    await purgeLegacyPlaintextCredentials();

    expect(mockedDelete).toHaveBeenCalledWith(LEGACY_AUTO_LOGIN_CREDENTIAL_KEY);
  });

  it('never reads the plaintext password', async () => {
    await purgeLegacyPlaintextCredentials();

    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('migrates legacy biometric credentials', async () => {
    await purgeLegacyPlaintextCredentials();

    expect(mockedMigrateBiometric).toHaveBeenCalledTimes(1);
  });

  it('still migrates biometric credentials when the auto-login delete fails', async () => {
    mockedDelete.mockRejectedValue(new Error('Delete error'));

    await expect(purgeLegacyPlaintextCredentials()).resolves.toBeUndefined();
    expect(mockedMigrateBiometric).toHaveBeenCalledTimes(1);
  });

  it('does not throw when biometric migration rejects', async () => {
    mockedMigrateBiometric.mockRejectedValue(new Error('Migrate error'));

    await expect(purgeLegacyPlaintextCredentials()).resolves.toBeUndefined();
  });
});
