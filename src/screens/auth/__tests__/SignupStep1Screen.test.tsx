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

// RecaptchaVerifierModal — forwardRef View 로 대체하고 verify() 스텁을 노출한다
// (signInWithPhoneNumber 자체가 mock 이라 verify 는 호출되지 않지만 화면은 ref 를 넘긴다).
jest.mock('@/components/auth/recaptcha/RecaptchaVerifierModal', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const RecaptchaVerifierModal = React.forwardRef(function MockRecaptchaVerifierModal(
    props: unknown,
    ref: React.Ref<unknown>,
  ) {
    React.useImperativeHandle(ref, () => ({
      type: 'recaptcha',
      verify: jest.fn(() => Promise.resolve('token')),
      _reset: jest.fn(),
    }));
    return <View {...(props as object)} />;
  });
  return { RecaptchaVerifierModal };
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
      // 화면이 넘기는 verifier 는 RecaptchaVerifierModal(위 mock) 의 핸들이어야 한다 —
      // Firebase 가 내부에서 호출하는 _reset 까지 포함한 ApplicationVerifier 계약.
      const verifier = mockRequestPhoneVerification.mock.calls[0][1];
      expect(jest.isMockFunction(verifier._reset)).toBe(true);
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

  it('distributes an SMS-autofilled 6-digit code across all OTP cells', async () => {
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

    // 키패드 위 "메시지에서" 제안을 탭하면 포커스된 첫 칸에 6자리가 한 번에 들어온다.
    const firstCell = getByTestId('otp-cell-0');
    expect(firstCell.props.maxLength).not.toBe(1);
    expect(firstCell.props.textContentType).toBe('oneTimeCode');
    expect(firstCell.props.autoComplete).toBe('sms-otp');
    act(() => {
      fireEvent.changeText(firstCell, '987654');
    });

    ['9', '8', '7', '6', '5', '4'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });

    await act(async () => {
      fireEvent.press(getByTestId('verify-button'));
    });
    await waitFor(() => {
      expect(mockConfirmPhoneCode).toHaveBeenCalledWith('vid-123', '987654');
    });
  });

  it('replaces only the current cell when typing into an already-filled cell', async () => {
    mockRequestPhoneVerification.mockResolvedValue('vid-123');
    const { getByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    await act(async () => {
      fireEvent.press(getByTestId('request-otp-button'));
    });

    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-0'), '123456');
    });
    // 세 번째 칸("3") 끝에 9 입력 → onChangeText 에는 "39" 가 온다.
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), '39');
    });

    ['1', '2', '9', '4', '5', '6'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });

    // 채워진 칸("9") 끝에 새 전체 코드 붙여넣기 → "9"+"987654" 7자리가 온다.
    act(() => {
      fireEvent.changeText(getByTestId('otp-cell-2'), '9987654');
    });
    ['9', '8', '7', '6', '5', '4'].forEach((d, i) => {
      expect(getByTestId(`otp-cell-${i}`).props.value).toBe(d);
    });
  });
});
