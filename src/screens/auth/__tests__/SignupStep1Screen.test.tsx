/**
 * SignupStep1Screen — RTL smoke tests covering phase transition + OTP nav.
 */
import React from 'react';
import { fireEvent, render, act } from '@testing-library/react-native';
import { SignupStep1Screen } from '../SignupStep1Screen';

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
});

describe('SignupStep1Screen', () => {
  it('renders input phase with disabled "인증 요청" button when fields incomplete', () => {
    const { getByTestId, getByText } = render(<SignupStep1Screen />);
    expect(getByTestId('signup-step1-title')).toBeTruthy();
    expect(getByText('본인 인증')).toBeTruthy();
    const button = getByTestId('request-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables "인증 요청" after filling carrier + name + phone + birth, then transitions to OTP phase', () => {
    const { getByTestId, queryByTestId } = render(<SignupStep1Screen />);

    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');

    const button = getByTestId('request-otp-button');
    expect(button.props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(button);

    expect(queryByTestId('otp-title')).toBeTruthy();
    expect(queryByTestId('otp-row')).toBeTruthy();
    expect(queryByTestId('otp-cell-0')).toBeTruthy();
  });

  it('navigates to SignUp once all 6 OTP digits are entered and "인증" pressed', () => {
    const { getByTestId } = render(<SignupStep1Screen />);

    // Enter input phase data and advance
    fireEvent.press(getByTestId('carrier-skt'));
    fireEvent.changeText(getByTestId('name-input'), '홍길동');
    fireEvent.changeText(getByTestId('phone-input'), '01012345678');
    fireEvent.changeText(getByTestId('birth-input'), '900101');
    fireEvent.press(getByTestId('request-otp-button'));

    // Fill OTP (act wraps animation start side-effects)
    act(() => {
      [0, 1, 2, 3, 4, 5].forEach((i) => {
        fireEvent.changeText(getByTestId(`otp-cell-${i}`), String(i + 1));
      });
    });

    const verifyButton = getByTestId('verify-button');
    expect(verifyButton.props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(verifyButton);
    expect(mockNavigate).toHaveBeenCalledWith('SignUp');
  });
});
