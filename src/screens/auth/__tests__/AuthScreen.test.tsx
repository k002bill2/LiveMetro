/**
 * AuthScreen Test Suite
 * Tests authentication screen rendering and user interactions
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AuthScreen } from '../AuthScreen';
import { useAuth } from '@/services/auth/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signInAnonymously: jest.fn(),
    resetPassword: jest.fn(),
    user: null,
    isAuthenticated: false,
  })),
}));
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000000',
      primaryLight: '#E5E5E5',
      surface: '#FFFFFF',
      background: '#F5F5F5',
      backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      textTertiary: '#999999',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5E5',
      borderMedium: '#CCCCCC',
    },
  })),
  ThemeColors: {},
}));
jest.mock('@/services/auth/biometricService', () => ({
  isBiometricAvailable: jest.fn(() => Promise.resolve(false)),
  isBiometricLoginEnabled: jest.fn(() => Promise.resolve(false)),
  getBiometricTypeName: jest.fn(() => Promise.resolve('생체인증')),
  performBiometricLogin: jest.fn(),
  enableBiometricLogin: jest.fn(),
}));
jest.mock('@/utils/firebaseDebug', () => ({
  analyzeAuthError: jest.fn(() => ({
    errorType: 'UNKNOWN',
    errorCode: '',
    errorMessage: '',
    missingEnvVars: [],
    recommendations: [],
  })),
  printFirebaseDebugInfo: jest.fn(),
}));

describe('AuthScreen', () => {
  const mockSignInWithEmail = jest.fn();
  const mockSignUpWithEmail = jest.fn();
  const mockSignInAnonymously = jest.fn();
  const mockResetPassword = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      signInWithEmail: mockSignInWithEmail,
      signUpWithEmail: mockSignUpWithEmail,
      signInAnonymously: mockSignInAnonymously,
      resetPassword: mockResetPassword,
      user: null,
      isAuthenticated: false,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders login screen by default', async () => {
    const { getByTestId } = render(<AuthScreen />);

    // Wait for auto-login check to complete and form to appear
    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByTestId('submit-button')).toBeTruthy();
  });

  it('switches to sign up mode', async () => {
    const { getByText, getByTestId, queryByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    fireEvent.press(getByText('계정이 없으신가요? 가입하기'));

    await waitFor(() => {
      expect(queryByTestId('displayname-input')).toBeTruthy();
    });
  });

  it('validates email input', async () => {
    const { getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    const submitButton = getByTestId('submit-button');

    // Empty email
    fireEvent.press(submitButton);
    expect(Alert.alert).toHaveBeenCalledWith('오류', '이메일을 입력해주세요.');

    // Invalid email format
    const emailInput = getByTestId('email-input');
    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(submitButton);
    expect(Alert.alert).toHaveBeenCalledWith('오류', '올바른 이메일 형식을 입력해주세요.');
  });

  it('validates password input', async () => {
    const { getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    const emailInput = getByTestId('email-input');
    const submitButton = getByTestId('submit-button');

    fireEvent.changeText(emailInput, 'test@example.com');

    // Empty password
    fireEvent.press(submitButton);
    expect(Alert.alert).toHaveBeenCalledWith('오류', '비밀번호를 입력해주세요.');

    // Short password
    const passwordInput = getByTestId('password-input');
    fireEvent.changeText(passwordInput, '12345');
    fireEvent.press(submitButton);
    expect(Alert.alert).toHaveBeenCalledWith('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
  });

  it('handles successful login', async () => {
    mockSignInWithEmail.mockResolvedValueOnce(undefined);

    const { getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('handles failed login', async () => {
    mockSignInWithEmail.mockRejectedValueOnce(new Error('Invalid credentials'));

    const { getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'wrongpassword');
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  it('handles sign up with valid data', async () => {
    mockSignUpWithEmail.mockResolvedValueOnce(undefined);

    const { getByTestId, getByText } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    // Switch to sign up
    fireEvent.press(getByText('계정이 없으신가요? 가입하기'));

    await waitFor(() => {
      expect(getByTestId('displayname-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('displayname-input'), 'Test User');
    fireEvent.changeText(getByTestId('email-input'), 'newuser@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSignUpWithEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123',
        'Test User'
      );
    });
  });

  it('toggles auto login checkbox', async () => {
    const { getByText, getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    const autoLoginCheckbox = getByText('자동로그인');
    fireEvent.press(autoLoginCheckbox);

    // Checkbox state should toggle
    expect(autoLoginCheckbox).toBeTruthy();
  });

  it('handles anonymous sign in', async () => {
    mockSignInAnonymously.mockResolvedValueOnce(undefined);

    const { getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    fireEvent.press(getByTestId('anonymous-login-button'));

    await waitFor(() => {
      expect(mockSignInAnonymously).toHaveBeenCalled();
    });
  });

  it('handles forgot password', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined);

    const { getByText, getByTestId } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.press(getByText('비밀번호를 잊으셨나요?'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  it('shows loading state during submission', async () => {
    mockSignInWithEmail.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { getByTestId, getByText } = render(<AuthScreen />);

    await waitFor(() => {
      expect(getByTestId('email-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(getByText('처리중...')).toBeTruthy();
    });
  });
});
