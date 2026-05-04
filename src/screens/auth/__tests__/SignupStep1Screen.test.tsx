/**
 * SignupStep1Screen — RTL smoke tests.
 *
 * Covers: input field gating, phase transition (input → OTP), and the
 * Firebase Phone Auth wiring (requestPhoneVerification + confirmPhoneCode).
 */
import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { SignupStep1Screen } from '../SignupStep1Screen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRequestPhoneVerification = jest.fn();
const mockConfirmPhoneCode = jest.fn();

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
  useAuth: jest.fn(() => ({
    requestPhoneVerification: mockRequestPhoneVerification,
    confirmPhoneCode: mockConfirmPhoneCode,
  })),
}));

jest.mock('@/services/firebase/config', () => ({
  firebaseConfig: {
    apiKey: 'mock',
    authDomain: 'mock',
    projectId: 'mock',
    storageBucket: 'mock',
    messagingSenderId: 'mock',
    appId: 'mock',
  },
}));

// expo-firebase-recaptcha — replace the modal with a forwardRef View whose
// instance exposes a stub `verify()` method (Phone Auth requires
// ApplicationVerifier; the AuthContext mock never calls verify() because
// signInWithPhoneNumber is itself mocked, but the screen still passes the
// ref through).
jest.mock('expo-firebase-recaptcha', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const ModalStub = React.forwardRef((props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ verify: jest.fn(() => Promise.resolve('token')) }));
    return <View {...(props as object)} />;
  });
  return { FirebaseRecaptchaVerifierModal: ModalStub };
});

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const passthrough = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <View testID={testID}>{children}</View>
  );
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
  mockGoBack.mockClear();
  mockRequestPhoneVerification.mockReset();
  mockConfirmPhoneCode.mockReset();
});

describe('SignupStep1Screen', () => {
  it('renders input phase with disabled "인증 요청" button when fields incomplete', () => {
    const { getByTestId, getByText } = render(<SignupStep1Screen />);
    expect(getByTestId('signup-step1-title')).toBeTruthy();
    expect(getByText('본인 인증')).toBeTruthy();
    const button = getByTestId('request-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables "인증 요청" after filling all required fields, then transitions to OTP phase on success', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId, queryByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    const button = getByTestId('request-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => {
      expect(mockRequestPhoneVerification).toHaveBeenCalledWith('+821012345678', expect.anything());
      expect(queryByTestId('otp-title')).toBeTruthy();
      expect(queryByTestId('otp-cell-0')).toBeTruthy();
    });
  });

  it('confirms the OTP code via confirmPhoneCode when "인증" is pressed', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    mockConfirmPhoneCode.mockResolvedValue(undefined);
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      [0, 1, 2, 3, 4, 5].forEach((i) => {
        fireEvent.changeText(getByTestId(`otp-cell-${i}`), String(i + 1));
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId('verify-button'));
    });

    await waitFor(() => {
      expect(mockConfirmPhoneCode).toHaveBeenCalledWith('vid-123', '123456');
    });
    // No navigate('SignUp') anymore — RootNavigator handles routing via auth state.
    expect(mockNavigate).not.toHaveBeenCalledWith('SignUp');
  });
});
