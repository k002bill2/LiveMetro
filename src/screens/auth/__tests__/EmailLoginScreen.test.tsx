/**
 * EmailLoginScreen — auto-login persistence.
 *
 * The auto-login option must never persist the plaintext password: the
 * signed-in session is kept by Firebase Auth persistence instead.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmailLoginScreen } from '../EmailLoginScreen';

const mockSignIn = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    signInWithEmail: (...args: unknown[]) => mockSignIn(...args),
    resetPassword: jest.fn(),
  })),
}));

jest.mock('@/services/auth/biometricService', () => ({
  isBiometricAvailable: jest.fn(() => Promise.resolve(false)),
  isBiometricLoginEnabled: jest.fn(() => Promise.resolve(false)),
  getBiometricTypeName: jest.fn(() => Promise.resolve('Face ID')),
  enableBiometricLogin: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/utils/firebaseDebug', () => ({
  analyzeAuthError: jest.fn(() => ({ errorType: 'OTHER' })),
  printFirebaseDebugInfo: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const stub = () => <View />;
  return new Proxy(
    { __esModule: true },
    {
      get: (_t, prop) => (prop === '__esModule' ? true : stub),
    },
  );
});

const PASSWORD_KEY = 'livemetro_auto_login_password';
const TYPED_SECRET = 'typed-secret';
const mockedSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;
const mockedAsyncSetItem = AsyncStorage.setItem as jest.Mock;

const submitLogin = async (): Promise<void> => {
  const api = render(<EmailLoginScreen />);
  fireEvent.changeText(api.getByTestId('email-input'), 'user@example.com');
  fireEvent.changeText(api.getByTestId('password-input'), TYPED_SECRET);
  fireEvent.press(api.getByTestId('submit-button'));
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('user@example.com', TYPED_SECRET));
  await waitFor(() => expect(mockedAsyncSetItem).toHaveBeenCalled());
};

describe('EmailLoginScreen auto-login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('never stores the password in SecureStore', async () => {
    await submitLogin();

    const passwordWrites = mockedSetItemAsync.mock.calls.filter(
      (call: unknown[]) => call[0] === PASSWORD_KEY || call[1] === TYPED_SECRET
    );
    expect(passwordWrites).toHaveLength(0);
  });

  it('removes any password left by older versions', async () => {
    await submitLogin();

    await waitFor(() => expect(mockedDeleteItemAsync).toHaveBeenCalledWith(PASSWORD_KEY));
  });

  it('still records the auto-login preference', async () => {
    await submitLogin();

    expect(mockedAsyncSetItem).toHaveBeenCalledWith('@livemetro_auto_login_enabled', 'true');
  });
});
