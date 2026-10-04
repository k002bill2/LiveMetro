/**
 * EmailLoginScreen — session persistence.
 *
 * The signed-in session is kept by Firebase Auth persistence, so the screen
 * shows a note instead of an auto-login checkbox and persists no credentials.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBiometricAvailable } from '@/services/auth/biometricService';
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

const TYPED_SECRET = 'typed-secret';
const mockedSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockedAsyncSetItem = AsyncStorage.setItem as jest.Mock;

const submitLogin = async (): Promise<void> => {
  const api = render(<EmailLoginScreen />);
  fireEvent.changeText(api.getByTestId('email-input'), 'user@example.com');
  fireEvent.changeText(api.getByTestId('password-input'), TYPED_SECRET);
  fireEvent.press(api.getByTestId('submit-button'));
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('user@example.com', TYPED_SECRET));
  // The biometric setup check runs last in the submit flow.
  await waitFor(() => expect(isBiometricAvailable).toHaveBeenCalled());
};

describe('EmailLoginScreen session persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a session-persistence note instead of an auto-login checkbox', () => {
    const { getByTestId, queryByTestId, queryByText } = render(<EmailLoginScreen />);

    expect(queryByTestId('auto-login-toggle')).toBeNull();
    expect(queryByText('자동로그인')).toBeNull();
    expect(getByTestId('session-persist-note')).toHaveTextContent(
      '로그아웃하기 전까지 로그인 상태가 유지됩니다'
    );
  });

  it('never stores credentials in SecureStore on login', async () => {
    await submitLogin();

    expect(mockedSetItemAsync).not.toHaveBeenCalled();
  });

  it('no longer writes an auto-login flag', async () => {
    await submitLogin();

    expect(mockedAsyncSetItem).not.toHaveBeenCalledWith(
      '@livemetro_auto_login_enabled',
      expect.anything()
    );
  });
});
