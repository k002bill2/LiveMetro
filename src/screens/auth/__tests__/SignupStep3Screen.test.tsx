/**
 * SignupStep3Screen — RTL smoke tests covering summary render + CTA flow.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignupStep3Screen } from '../SignupStep3Screen';

const mockNavigate = jest.fn();
const mockMarkCelebrationSeen = jest.fn(() => Promise.resolve());

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
    const { getByTestId } = render(<SignupStep3Screen />);

    fireEvent.press(getByTestId('signup-step3-cta'));

    await waitFor(() => {
      expect(mockMarkCelebrationSeen).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
    });
  });
});
