/**
 * SignupStep3Screen — RTL smoke tests covering summary render + CTA flow.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignupStep3Screen } from '../SignupStep3Screen';
import {
  __resetPendingBiometricCredentials,
  setPendingBiometricCredentials,
} from '@/services/auth/pendingBiometricSetup';

const mockNavigate = jest.fn();
const mockMarkCelebrationSeen = jest.fn(() => Promise.resolve());
const mockIsBiometricAvailable = jest.fn();
const mockIsBiometricLoginEnabled = jest.fn();
const mockGetBiometricTypeName = jest.fn();
const mockEnableBiometricLogin = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    canGoBack: jest.fn(() => true),
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'u1', displayName: '홍길동', email: 'gildong@test.com' },
  })),
}));

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: jest.fn(() => ({
    markCelebrationSeen: mockMarkCelebrationSeen,
  })),
}));

jest.mock('@/services/auth/biometricService', () => ({
  isBiometricAvailable: (...args: unknown[]) => mockIsBiometricAvailable(...args),
  isBiometricLoginEnabled: (...args: unknown[]) => mockIsBiometricLoginEnabled(...args),
  getBiometricTypeName: (...args: unknown[]) => mockGetBiometricTypeName(...args),
  enableBiometricLogin: (...args: unknown[]) => mockEnableBiometricLogin(...args),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return {
    LinearGradient: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
  };
});

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const passthrough = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: passthrough, Svg: passthrough, Path: passthrough };
});

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native');
  const stub = () => <View />;
  return new Proxy(
    { __esModule: true },
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        return stub;
      },
    },
  );
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockMarkCelebrationSeen.mockClear();
  mockIsBiometricAvailable.mockReset();
  mockIsBiometricLoginEnabled.mockReset();
  mockGetBiometricTypeName.mockReset();
  mockEnableBiometricLogin.mockReset();
  __resetPendingBiometricCredentials();
});

describe('SignupStep3Screen', () => {
  it('renders display name, email, verify badge, checklist, and bonus banner', () => {
    const { getByTestId, getByText } = render(<SignupStep3Screen />);

    expect(getByTestId('signup-step3-title')).toBeTruthy();
    expect(getByText('홍길동님, LiveMetro에 오신 것을 환영합니다')).toBeTruthy();
    expect(getByText('gildong@test.com')).toBeTruthy();
    expect(getByTestId('signup-step3-verify-badge')).toBeTruthy();
    expect(getByTestId('checklist-commute')).toBeTruthy();
    expect(getByTestId('checklist-alerts')).toBeTruthy();
    expect(getByTestId('checklist-favorites')).toBeTruthy();
    expect(getByTestId('signup-step3-bonus')).toBeTruthy();
  });

  it('marks celebration seen and navigates to Onboarding when CTA pressed', async () => {
    // No pending credentials → biometric prompt path is skipped silently.
    const { getByTestId } = render(<SignupStep3Screen />);

    fireEvent.press(getByTestId('signup-step3-cta'));

    await waitFor(() => {
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
    });
  });

  it('skips the biometric prompt when the device does not support it', async () => {
    setPendingBiometricCredentials({ email: 'a@test.com', password: 'pw123456' });
    mockIsBiometricAvailable.mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId } = render(<SignupStep3Screen />);
    fireEvent.press(getByTestId('signup-step3-cta'));

    await waitFor(() => {
      expect(mockIsBiometricAvailable).toHaveBeenCalled();
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows the biometric setup Alert and enables biometric login on "설정하기"', async () => {
    setPendingBiometricCredentials({ email: 'a@test.com', password: 'pw123456' });
    mockIsBiometricAvailable.mockResolvedValue(true);
    mockIsBiometricLoginEnabled.mockResolvedValue(false);
    mockGetBiometricTypeName.mockResolvedValue('Face ID');
    mockEnableBiometricLogin.mockResolvedValue(true);

    // Auto-confirm the first Alert by invoking the "설정하기" button onPress.
    // The follow-up "완료" Alert has no buttons callback in the screen, so we
    // ignore it after the first.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
      (
        _title: string,
        _message?: string,
        buttons?: readonly { text?: string; onPress?: () => unknown; style?: string }[],
      ) => {
        const setupButton = buttons?.find((b) => b.text === '설정하기');
        setupButton?.onPress?.();
      },
    );

    const { getByTestId } = render(<SignupStep3Screen />);
    fireEvent.press(getByTestId('signup-step3-cta'));

    await waitFor(() => {
      expect(mockEnableBiometricLogin).toHaveBeenCalledWith('a@test.com', 'pw123456');
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
    });

    alertSpy.mockRestore();
  });
});
