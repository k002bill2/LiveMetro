/**
 * SignUpScreen — RTL smoke tests for the v6 hand-off form (email + nickname
 * + password w/ strength meter + password confirm + agreement box).
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignUpScreen } from '../SignUpScreen';

const mockSignUp = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockLink = jest.fn((..._args: unknown[]) => Promise.resolve());
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
    goBack: mockGoBack,
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    signUpWithEmail: (...args: unknown[]) => mockSignUp(...args),
    linkEmailToCurrentUser: (...args: unknown[]) => mockLink(...args),
  })),
}));

jest.mock('@/utils/firebaseDebug', () => ({
  analyzeAuthError: jest.fn(() => ({ errorType: 'OTHER' })),
  printFirebaseDebugInfo: jest.fn(),
}));

jest.mock('@/services/auth/pendingBiometricSetup', () => ({
  setPendingBiometricCredentials: jest.fn(),
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

beforeEach(() => {
  mockSignUp.mockClear();
  mockLink.mockClear();
  mockGoBack.mockClear();
});

type RenderAPI = ReturnType<typeof render>;

const fillValid = (api: RenderAPI): void => {
  fireEvent.changeText(api.getByTestId('email-input'), 'jisoo@livemetro.app');
  fireEvent.changeText(api.getByTestId('nickname-input'), '지수');
  // 8+ chars · letter · number · symbol → all 4 strength criteria met
  fireEvent.changeText(api.getByTestId('password-input'), 'Pass1234!');
  fireEvent.changeText(api.getByTestId('password-confirm-input'), 'Pass1234!');
};

describe('SignUpScreen', () => {
  it('renders header, title, all input fields, agreement box, submit, and login link', () => {
    const { getByTestId, getByText } = render(<SignUpScreen />);

    expect(getByTestId('signup-step2-header')).toBeTruthy();
    expect(getByTestId('signup-step2-title').props.children).toBe('계정 만들기');
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('nickname-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByTestId('password-confirm-input')).toBeTruthy();
    expect(getByTestId('agreements-box')).toBeTruthy();
    expect(getByTestId('agreement-all')).toBeTruthy();
    expect(getByTestId('agreement-terms')).toBeTruthy();
    expect(getByTestId('agreement-privacy')).toBeTruthy();
    expect(getByTestId('agreement-age')).toBeTruthy();
    expect(getByTestId('agreement-marketing')).toBeTruthy();
    expect(getByTestId('submit-button')).toBeTruthy();
    expect(getByText(/로그인/)).toBeTruthy();
  });

  it('shows password strength bars and "안전" label when all 4 criteria are met', () => {
    const { getByTestId, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByTestId('password-input'), 'Pass1234!');
    expect(getByTestId('password-strength')).toBeTruthy();
    expect(getByText('안전')).toBeTruthy();
  });

  it('renders the match badge only when password and password-confirm are identical', () => {
    const { getByTestId, queryByTestId } = render(<SignUpScreen />);
    fireEvent.changeText(getByTestId('password-input'), 'Pass1234!');
    fireEvent.changeText(getByTestId('password-confirm-input'), 'Pass1234');
    expect(queryByTestId('password-confirm-match')).toBeNull();

    fireEvent.changeText(getByTestId('password-confirm-input'), 'Pass1234!');
    expect(queryByTestId('password-confirm-match')).not.toBeNull();
  });

  it('toggles all 4 agreement rows when "전체 동의" is pressed', () => {
    const { getByTestId } = render(<SignUpScreen />);
    fireEvent.press(getByTestId('agreement-all'));

    // After all-agree, individual rows reflect checked state via accessibilityState
    expect(getByTestId('agreement-terms').props.accessibilityState).toEqual({ checked: true });
    expect(getByTestId('agreement-privacy').props.accessibilityState).toEqual({ checked: true });
    expect(getByTestId('agreement-age').props.accessibilityState).toEqual({ checked: true });
    expect(getByTestId('agreement-marketing').props.accessibilityState).toEqual({ checked: true });
  });

  it('does NOT call signUpWithEmail when required agreements are missing', async () => {
    const { getByTestId } = render(<SignUpScreen />);
    fillValid({ getByTestId } as RenderAPI);
    // No agreements → submit disabled
    fireEvent.press(getByTestId('submit-button'));
    await waitFor(() => {
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  it('calls signUpWithEmail with trimmed email + nickname when all conditions met (create mode)', async () => {
    const { getByTestId } = render(<SignUpScreen />);
    fillValid({ getByTestId } as RenderAPI);
    fireEvent.press(getByTestId('agreement-terms'));
    fireEvent.press(getByTestId('agreement-privacy'));
    fireEvent.press(getByTestId('agreement-age'));

    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('jisoo@livemetro.app', 'Pass1234!', '지수');
    });
    expect(mockLink).not.toHaveBeenCalled();
  });

  it('calls linkEmailToCurrentUser when in link mode', async () => {
    const { getByTestId } = render(<SignUpScreen mode="link" />);
    fillValid({ getByTestId } as RenderAPI);
    fireEvent.press(getByTestId('agreement-terms'));
    fireEvent.press(getByTestId('agreement-privacy'));
    fireEvent.press(getByTestId('agreement-age'));

    fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockLink).toHaveBeenCalledWith('jisoo@livemetro.app', 'Pass1234!', '지수');
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});
