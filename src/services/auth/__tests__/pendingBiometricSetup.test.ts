import {
  consumePendingBiometricCredentials,
  setPendingBiometricCredentials,
  __resetPendingBiometricCredentials,
} from '../pendingBiometricSetup';

beforeEach(() => {
  __resetPendingBiometricCredentials();
});

describe('pendingBiometricSetup', () => {
  it('returns null when nothing has been set', () => {
    expect(consumePendingBiometricCredentials()).toBeNull();
  });

  it('returns the credentials once and clears them after consume', () => {
    setPendingBiometricCredentials({ email: 'a@test.com', password: 'pw123456' });

    const first = consumePendingBiometricCredentials();
    expect(first).toEqual({ email: 'a@test.com', password: 'pw123456' });

    const second = consumePendingBiometricCredentials();
    expect(second).toBeNull();
  });

  it('overwrites previous credentials when set is called twice without consuming', () => {
    setPendingBiometricCredentials({ email: 'first@test.com', password: 'first123' });
    setPendingBiometricCredentials({ email: 'second@test.com', password: 'second123' });

    expect(consumePendingBiometricCredentials()).toEqual({
      email: 'second@test.com',
      password: 'second123',
    });
  });
});
