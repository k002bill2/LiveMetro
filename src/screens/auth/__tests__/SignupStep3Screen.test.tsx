/**
 * SignupStep3Screen — RTL smoke tests covering summary render + CTA flow.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignupStep3Screen } from '../SignupStep3Screen';
import {
  __resetPendingBiometricCredentials,
  consumePendingBiometricCredentials,
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
    firebaseUser: { email: 'gildong@test.com', phoneNumber: '+821012345678' },
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
  it('renders header, greeting, avatar initial, email, verify badge, checklist, and bonus banner', () => {
    const { getByTestId, getByText } = render(<SignupStep3Screen />);

    expect(getByTestId('signup-step3-header')).toBeTruthy();
    expect(getByTestId('signup-step3-title').props.children).toContain('환영해요, ');
    expect(getByText('환영해요, 홍길동님')).toBeTruthy();
    expect(getByTestId('signup-step3-subtitle')).toBeTruthy();
    expect(getByText(/가입이 완료되었어요/)).toBeTruthy();
    expect(getByTestId('signup-step3-avatar-initial').props.children).toBe('홍');
    expect(getByText('gildong@test.com')).toBeTruthy();
    expect(getByTestId('signup-step3-verify-badge')).toBeTruthy();
    expect(getByTestId('signup-step3-checklist-label').props.children).toBe('다음 단계 · 1분이면 끝나요');
    expect(getByTestId('checklist-commute')).toBeTruthy();
    expect(getByTestId('checklist-alerts')).toBeTruthy();
    expect(getByTestId('checklist-favorites')).toBeTruthy();
    expect(getByTestId('signup-step3-bonus')).toBeTruthy();
    expect(getByTestId('signup-step3-cta-secondary')).toBeTruthy();
  });

  it('marks celebration seen and navigates to Onboarding when primary CTA pressed', async () => {
    // No pending credentials → biometric prompt path is skipped silently.
    const { getByTestId } = render(<SignupStep3Screen />);

    fireEvent.press(getByTestId('signup-step3-cta'));

    await waitFor(() => {
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
    });
  });

  it('also routes to Onboarding when the secondary "나중에 할게요" CTA is pressed', async () => {
    const { getByTestId } = render(<SignupStep3Screen />);

    fireEvent.press(getByTestId('signup-step3-cta-secondary'));

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

  it('shows the biometric setup Alert and enables biometric login on "설정하기" — awaiting both Alerts before navigating', async () => {
    setPendingBiometricCredentials({ email: 'a@test.com', password: 'pw123456' });
    mockIsBiometricAvailable.mockResolvedValue(true);
    mockIsBiometricLoginEnabled.mockResolvedValue(false);
    mockGetBiometricTypeName.mockResolvedValue('Face ID');
    mockEnableBiometricLogin.mockResolvedValue(true);

    // Both Alerts (setup prompt + success) must drive their callback before
    // the screen navigates. We pick the first matching button per call.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
      (
        _title: string,
        _message?: string,
        buttons?: readonly { text?: string; onPress?: () => unknown; style?: string }[],
      ) => {
        const setup = buttons?.find((b) => b.text === '설정하기');
        if (setup) {
          setup.onPress?.();
          return;
        }
        const ack = buttons?.find((b) => b.text === '확인');
        ack?.onPress?.();
      },
    );

    const { getByTestId } = render(<SignupStep3Screen />);
    fireEvent.press(getByTestId('signup-step3-cta'));

    await waitFor(() => {
      expect(mockEnableBiometricLogin).toHaveBeenCalledWith('a@test.com', 'pw123456');
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
    });

    // Both Alerts fired (setup prompt + success acknowledgement).
    expect(alertSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    alertSpy.mockRestore();
  });

  it('clears pending biometric credentials when the screen unmounts before CTA', () => {
    // User navigates away from celebration (back gesture, deep link, etc.)
    // without tapping CTA. Stashed credentials must not survive in the
    // module-level ref, otherwise they would silently feed the next prompt.
    setPendingBiometricCredentials({ email: 'a@test.com', password: 'pw123456' });

    const { unmount } = render(<SignupStep3Screen />);
    unmount();

    expect(consumePendingBiometricCredentials()).toBeNull();
  });

  it('substitutes "신규 사용자" when AuthContext leaves the legacy "익명 사용자" fallback', () => {
    // Phone-only users who skip SignupStep2 nickname input get
    // displayName === '익명 사용자' from AuthContext.createOrGetUser-
    // Document. The celebration screen treats that as "no name set" and
    // shows the friendlier '신규 사용자' instead.
    const { useAuth } = require('@/services/auth/AuthContext');
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: { id: 'u1', displayName: '익명 사용자', email: '' },
      firebaseUser: { email: null, phoneNumber: '+821011112222' },
    });

    const { getByTestId, queryByText } = render(<SignupStep3Screen />);

    expect(getByTestId('signup-step3-title').props.children).toEqual([
      '환영해요, ',
      '신규 사용자',
      '님',
    ]);
    expect(queryByText('환영해요, 익명 사용자님')).toBeNull();
  });

  it('falls back to a masked phone number when the user has no email (phone-only)', () => {
    const { useAuth } = require('@/services/auth/AuthContext');
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: { id: 'u1', displayName: '신규 사용자', email: '' },
      firebaseUser: { email: null, phoneNumber: '+821098765432' },
    });

    const { getByTestId, queryByText } = render(<SignupStep3Screen />);

    // Email is absent → contact label should show masked phone (010-****-XXXX).
    const contactRow = getByTestId('signup-step3-contact');
    expect(contactRow.props.children).toBe('010-****-5432');
    // No raw phone or full email leakage.
    expect(queryByText('+821098765432')).toBeNull();
    expect(queryByText('gildong@test.com')).toBeNull();
  });

  it('renders no contact row at all when both email and phoneNumber are absent', () => {
    const { useAuth } = require('@/services/auth/AuthContext');
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: { id: 'u1', displayName: '신규 사용자', email: '' },
      firebaseUser: { email: null, phoneNumber: null },
    });

    const { queryByTestId } = render(<SignupStep3Screen />);
    expect(queryByTestId('signup-step3-contact')).toBeNull();
  });

  it('ignores rapid double-taps on the CTA — markCelebrationSeen runs once', async () => {
    // No biometric available → prompt path is skipped, so we can race the
    // CTA without dealing with Alert callbacks.
    setPendingBiometricCredentials({ email: 'a@test.com', password: 'pw123456' });
    mockIsBiometricAvailable.mockResolvedValue(false);

    const { getByTestId } = render(<SignupStep3Screen />);
    const cta = getByTestId('signup-step3-cta');

    // Two synchronous taps before the first promise chain resolves.
    fireEvent.press(cta);
    fireEvent.press(cta);

    await waitFor(() => {
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });
});
