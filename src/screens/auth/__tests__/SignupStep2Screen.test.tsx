/**
 * SignupStep2Screen — RTL smoke tests for the 폼 + 약관 hybrid screen.
 *
 * Critical invariants under test:
 *   1. Required agreements ALWAYS gate the CTA (compliance with 정통망법 +
 *      개인정보보호법 §22-2).
 *   2. Empty form + agreed → phone-only path (markTermsAgreed only,
 *      linkEmailToCurrentUser NOT called).
 *   3. Filled form + agreed → email link path (linkEmailToCurrentUser
 *      called with trimmed email + nickname).
 *   4. Pre-fill from firebaseUser when email/displayName already exist.
 *   5. Forward navigation only — never goBack to SignupStep1.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignupStep2Screen } from '../SignupStep2Screen';

const mockNavigate = jest.fn();
const mockMarkTermsAgreed = jest.fn(() => Promise.resolve());
const mockLinkEmailToCurrentUser = jest.fn((..._args: unknown[]) => Promise.resolve());

let mockFirebaseUser: { email?: string | null; displayName?: string | null } | null = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    canGoBack: jest.fn(() => false),
  })),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    firebaseUser: mockFirebaseUser,
    linkEmailToCurrentUser: (...args: unknown[]) => mockLinkEmailToCurrentUser(...args),
  })),
}));

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: jest.fn(() => ({
    markTermsAgreed: mockMarkTermsAgreed,
  })),
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
  mockNavigate.mockClear();
  mockMarkTermsAgreed.mockClear();
  mockLinkEmailToCurrentUser.mockClear();
  mockFirebaseUser = null;
});

describe('SignupStep2Screen', () => {
  it('renders header, title, all input fields, and agreement box', () => {
    const { getByTestId } = render(<SignupStep2Screen />);

    expect(getByTestId('signup-step2-header')).toBeTruthy();
    expect(getByTestId('signup-step2-title').props.children).toBe('계정 만들기');
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('nickname-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByTestId('password-confirm-input')).toBeTruthy();
    expect(getByTestId('agreements-box')).toBeTruthy();
    expect(getByTestId('agreement-all')).toBeTruthy();
    expect(getByTestId('signup-step2-cta')).toBeTruthy();
  });

  it('pre-fills email and nickname from firebaseUser when present', () => {
    mockFirebaseUser = { email: 'jisoo@livemetro.app', displayName: '지수' };
    const { getByTestId } = render(<SignupStep2Screen />);

    expect(getByTestId('email-input').props.value).toBe('jisoo@livemetro.app');
    expect(getByTestId('nickname-input').props.value).toBe('지수');
    // Password fields must NEVER be pre-filled, regardless of firebaseUser.
    expect(getByTestId('password-input').props.value).toBe('');
    expect(getByTestId('password-confirm-input').props.value).toBe('');
  });

  it('starts with empty fields when firebaseUser has no email/displayName', () => {
    mockFirebaseUser = { email: null, displayName: null };
    const { getByTestId } = render(<SignupStep2Screen />);

    expect(getByTestId('email-input').props.value).toBe('');
    expect(getByTestId('nickname-input').props.value).toBe('');
  });

  it('blocks submit when required agreements are missing (form empty)', async () => {
    const { getByTestId } = render(<SignupStep2Screen />);
    fireEvent.press(getByTestId('signup-step2-cta'));
    await waitFor(() => {
      expect(mockMarkTermsAgreed).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('proceeds phone-only (linkEmailToCurrentUser NOT called) when form empty + required agreements met', async () => {
    const { getByTestId } = render(<SignupStep2Screen />);
    fireEvent.press(getByTestId('agreement-terms'));
    fireEvent.press(getByTestId('agreement-privacy'));
    fireEvent.press(getByTestId('agreement-age'));

    fireEvent.press(getByTestId('signup-step2-cta'));

    await waitFor(() => {
      expect(mockMarkTermsAgreed).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('SignupStep3');
    });
    expect(mockLinkEmailToCurrentUser).not.toHaveBeenCalled();
  });

  it('calls linkEmailToCurrentUser when form is fully filled + agreements met', async () => {
    const { getByTestId } = render(<SignupStep2Screen />);

    fireEvent.changeText(getByTestId('email-input'), 'jisoo@livemetro.app');
    fireEvent.changeText(getByTestId('nickname-input'), '지수');
    fireEvent.changeText(getByTestId('password-input'), 'Pass1234!');
    fireEvent.changeText(getByTestId('password-confirm-input'), 'Pass1234!');
    fireEvent.press(getByTestId('agreement-terms'));
    fireEvent.press(getByTestId('agreement-privacy'));
    fireEvent.press(getByTestId('agreement-age'));

    fireEvent.press(getByTestId('signup-step2-cta'));

    await waitFor(() => {
      expect(mockLinkEmailToCurrentUser).toHaveBeenCalledWith(
        'jisoo@livemetro.app',
        'Pass1234!',
        '지수',
      );
      expect(mockMarkTermsAgreed).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('SignupStep3');
    });
  });

  it('blocks submit when only email is filled but password is empty (incomplete email-link form)', async () => {
    const { getByTestId } = render(<SignupStep2Screen />);

    fireEvent.changeText(getByTestId('email-input'), 'jisoo@livemetro.app');
    fireEvent.press(getByTestId('agreement-terms'));
    fireEvent.press(getByTestId('agreement-privacy'));
    fireEvent.press(getByTestId('agreement-age'));

    fireEvent.press(getByTestId('signup-step2-cta'));

    await waitFor(() => {
      expect(mockMarkTermsAgreed).not.toHaveBeenCalled();
      expect(mockLinkEmailToCurrentUser).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('toggles all 4 rows when "전체 동의" is pressed', () => {
    const { getByTestId } = render(<SignupStep2Screen />);
    fireEvent.press(getByTestId('agreement-all'));

    expect(getByTestId('agreement-terms').props.accessibilityState).toEqual({ checked: true });
    expect(getByTestId('agreement-privacy').props.accessibilityState).toEqual({ checked: true });
    expect(getByTestId('agreement-age').props.accessibilityState).toEqual({ checked: true });
    expect(getByTestId('agreement-marketing').props.accessibilityState).toEqual({ checked: true });
  });

  it('shows password match badge only when password and confirm are identical', () => {
    const { getByTestId, queryByTestId } = render(<SignupStep2Screen />);
    fireEvent.changeText(getByTestId('password-input'), 'Pass1234!');
    fireEvent.changeText(getByTestId('password-confirm-input'), 'Pass1234');
    expect(queryByTestId('password-confirm-match')).toBeNull();

    fireEvent.changeText(getByTestId('password-confirm-input'), 'Pass1234!');
    expect(queryByTestId('password-confirm-match')).not.toBeNull();
  });
});
