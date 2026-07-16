/**
 * AuthScreen Test Suite (Phase 8 — Wanted Design System rewrite).
 *
 * Covers the orchestrator-only behavior. Sub-component visuals (Hero, Face ID
 * button, social buttons, divider, terms) are exercised in
 *   src/components/auth/__tests__/.
 *
 * The legacy email/password flow lives in EmailLoginScreen / SignUpScreen now
 * and has its own test scope.
 */
import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AuthScreen } from '../AuthScreen';
import { useAuth } from '@/services/auth/AuthContext';
import {
  isBiometricAvailable,
  isBiometricLoginEnabled,
  performBiometricLogin,
  getBiometricTypeName,
} from '@/services/auth/biometricService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppleAuthAvailability } from '@/hooks/useAppleAuthAvailability';
import { SocialAuthError, type SocialSignInResult } from '@/services/auth/social/types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: jest.fn(() => true),
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useAppleAuthAvailability', () => ({
  useAppleAuthAvailability: jest.fn(),
}));

// The real AppleSignInButton lazily imports expo-apple-authentication and would
// render null in tests; stub it to a touchable that keeps the 'social-apple'
// testID contract and mirrors the disabled prop.
jest.mock('@/components/auth/AppleSignInButton', () => {
  const { TouchableOpacity, Text } = jest.requireActual('react-native');
  return {
    AppleSignInButton: ({
      onPress,
      disabled,
      testID,
    }: {
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text>Apple로 계속하기</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/services/auth/biometricService', () => ({
  isBiometricAvailable: jest.fn(),
  isBiometricLoginEnabled: jest.fn(),
  performBiometricLogin: jest.fn(),
  getBiometricTypeName: jest.fn(),
  enableBiometricLogin: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const passthrough = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <View testID={testID}>{children}</View>
  );
  return {
    __esModule: true,
    default: passthrough,
    Svg: passthrough,
    Path: passthrough,
    Circle: passthrough,
    G: passthrough,
    Defs: passthrough,
    RadialGradient: passthrough,
    Stop: passthrough,
    Rect: passthrough,
  };
});

// lucide-react-native uses react-native-svg internally; with the mock above
// some icons resolve to undefined. Replace every icon export with a stub View.
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
    }
  );
});

const mockedUseAuth = useAuth as jest.Mock;
const mockedAppleAvailability = useAppleAuthAvailability as jest.Mock;
const mockedAsyncStorage = AsyncStorage as unknown as { getItem: jest.Mock };

// Base auth context with the three social delegates resolving to success;
// individual tests override specific fields (e.g. a rejecting google fn).
const authContextValue = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  signInWithEmail: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithGoogle: jest.fn().mockResolvedValue({ status: 'success' }),
  signInWithApple: jest.fn().mockResolvedValue({ status: 'success' }),
  signInWithKakao: jest.fn().mockResolvedValue({ status: 'success' }),
  ...overrides,
});
const mockedBiometricAvailable = isBiometricAvailable as jest.Mock;
const mockedBiometricEnabled = isBiometricLoginEnabled as jest.Mock;
const mockedBiometricLogin = performBiometricLogin as jest.Mock;
const mockedBiometricTypeName = getBiometricTypeName as jest.Mock;

const flushBootstrap = async () => {
  // Allow the bootstrap effect (3 awaits) to settle.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue(authContextValue());
    mockedAppleAvailability.mockReturnValue(true);
    mockedAsyncStorage.getItem.mockResolvedValue('false');
    mockedBiometricAvailable.mockResolvedValue(true);
    mockedBiometricEnabled.mockResolvedValue(false);
    mockedBiometricTypeName.mockResolvedValue('Face ID');
    mockedBiometricLogin.mockResolvedValue({ success: false });
  });

  it('shows the auto-login state on mount, then transitions to the entry UI', async () => {
    const { getByTestId, queryByTestId } = render(<AuthScreen />);
    expect(getByTestId('auth-autologin')).toBeTruthy();
    await flushBootstrap();
    expect(queryByTestId('auth-autologin')).toBeNull();
    expect(getByTestId('face-cta')).toBeTruthy();
  });

  it('renders the title, hero, social, divider, and terms', async () => {
    const { getByText, getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    expect(getByText('출퇴근, 1초도 낭비 없이.')).toBeTruthy();
    expect(getByTestId('auth-hero')).toBeTruthy();
    expect(getByTestId('social-apple')).toBeTruthy();
    expect(getByTestId('social-google')).toBeTruthy();
    expect(getByTestId('social-kakao')).toBeTruthy();
    expect(getByTestId('auth-divider')).toBeTruthy();
    expect(getByTestId('auth-terms')).toBeTruthy();
  });

  it('navigates to EmailLogin when the email CTA is pressed', async () => {
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    fireEvent.press(getByTestId('email-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('EmailLogin');
  });

  it('hides the Apple button when Apple sign-in is unavailable, keeping Google/Kakao', async () => {
    mockedAppleAvailability.mockReturnValue(false);
    const { getByTestId, queryByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    expect(queryByTestId('social-apple')).toBeNull();
    expect(getByTestId('social-google')).toBeTruthy();
    expect(getByTestId('social-kakao')).toBeTruthy();
  });

  it('shows the Apple button when Apple sign-in is available', async () => {
    mockedAppleAvailability.mockReturnValue(true);
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    expect(getByTestId('social-apple')).toBeTruthy();
  });

  it('calls signInWithGoogle when the Google button is pressed', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue({ status: 'success' });
    mockedUseAuth.mockReturnValue(authContextValue({ signInWithGoogle }));
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    await act(async () => {
      fireEvent.press(getByTestId('social-google'));
    });
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('does not alert when a social login resolves to cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const signInWithGoogle = jest.fn().mockResolvedValue({ status: 'cancelled' });
    mockedUseAuth.mockReturnValue(authContextValue({ signInWithGoogle }));
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    await act(async () => {
      fireEvent.press(getByTestId('social-google'));
    });
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('alerts with the SocialAuthError userMessage when a social login rejects', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const signInWithKakao = jest
      .fn()
      .mockRejectedValue(new SocialAuthError('server', '카카오 인증에 실패했습니다.'));
    mockedUseAuth.mockReturnValue(authContextValue({ signInWithKakao }));
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    await act(async () => {
      fireEvent.press(getByTestId('social-kakao'));
    });
    expect(alertSpy).toHaveBeenCalledWith('로그인 실패', '카카오 인증에 실패했습니다.');
    alertSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('alerts with a generic message when a non-SocialAuthError is thrown', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const signInWithGoogle = jest.fn().mockRejectedValue(new Error('boom'));
    mockedUseAuth.mockReturnValue(authContextValue({ signInWithGoogle }));
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    await act(async () => {
      fireEvent.press(getByTestId('social-google'));
    });
    expect(alertSpy).toHaveBeenCalledWith(
      '로그인 실패',
      '로그인 중 문제가 발생했습니다. 다시 시도해주세요.',
    );
    alertSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('ignores presses on other social buttons while one login is in progress', async () => {
    let resolveGoogle: (value: SocialSignInResult) => void = () => {};
    const signInWithGoogle = jest.fn(
      (): Promise<SocialSignInResult> =>
        new Promise((resolve) => {
          resolveGoogle = resolve;
        }),
    );
    const signInWithKakao = jest.fn().mockResolvedValue({ status: 'success' });
    mockedUseAuth.mockReturnValue(
      authContextValue({ signInWithGoogle, signInWithKakao }),
    );
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();

    fireEvent.press(getByTestId('social-google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));

    // Kakao is now disabled (socialLoading === 'google'); its press is a no-op.
    fireEvent.press(getByTestId('social-kakao'));
    expect(signInWithKakao).not.toHaveBeenCalled();

    // Resolve the in-flight login so the finally/setState runs inside act().
    await act(async () => {
      resolveGoogle({ status: 'success' });
    });
  });

  it('disables the email and browse CTAs while a social login is in progress (busy)', async () => {
    let resolveGoogle: (value: SocialSignInResult) => void = () => {};
    const signInWithGoogle = jest.fn(
      (): Promise<SocialSignInResult> =>
        new Promise((resolve) => {
          resolveGoogle = resolve;
        }),
    );
    mockedUseAuth.mockReturnValue(authContextValue({ signInWithGoogle }));
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();

    await act(async () => {
      fireEvent.press(getByTestId('social-google'));
    });

    // busy === true → non-active entry points are disabled.
    expect(getByTestId('email-cta').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('browse-cta').props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      resolveGoogle({ status: 'success' });
    });

    // Once the login settles, the CTAs are enabled again.
    expect(getByTestId('email-cta').props.accessibilityState.disabled).toBe(false);
    expect(getByTestId('browse-cta').props.accessibilityState.disabled).toBe(false);
  });

  it('invokes signInAnonymously when the browse-as-guest CTA is pressed', async () => {
    const signInAnonymously = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      signInWithEmail: jest.fn(),
      signInAnonymously,
    });
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    fireEvent.press(getByTestId('browse-cta'));
    await waitFor(() => expect(signInAnonymously).toHaveBeenCalled());
  });

  it('opens external URLs when terms / privacy links are pressed', async () => {
    const linkingSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    fireEvent.press(getByTestId('auth-terms-tos'));
    fireEvent.press(getByTestId('auth-terms-privacy'));
    expect(linkingSpy).toHaveBeenCalledTimes(2);
    linkingSpy.mockRestore();
  });

  it('falls back with an alert when biometric login is not available', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedBiometricAvailable.mockResolvedValue(false);
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    fireEvent.press(getByTestId('face-cta'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '생체인증 사용 불가',
        expect.any(String)
      )
    );
    alertSpy.mockRestore();
  });

  it('falls back with an alert when biometric login is not enabled yet', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockedBiometricAvailable.mockResolvedValue(true);
    mockedBiometricEnabled.mockResolvedValue(false);
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    fireEvent.press(getByTestId('face-cta'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('생체인증 미설정', expect.any(String))
    );
    alertSpy.mockRestore();
  });

  it('signs in via stored credentials when biometric login succeeds', async () => {
    const signInWithEmail = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      signInWithEmail,
      signInAnonymously: jest.fn(),
    });
    mockedBiometricEnabled.mockResolvedValue(true);
    mockedBiometricLogin.mockResolvedValue({
      success: true,
      credentials: { email: 'a@b.com', password: 'pw' },
    });
    const { getByTestId } = render(<AuthScreen />);
    await flushBootstrap();
    fireEvent.press(getByTestId('face-cta'));
    await waitFor(() => expect(signInWithEmail).toHaveBeenCalledWith('a@b.com', 'pw'));
  });
});
