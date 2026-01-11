/**
 * WelcomeScreen Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { WelcomeScreen } from '../auth/WelcomeScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock auth context
const mockSignInAnonymously = jest.fn();
jest.mock('../../services/auth/AuthContext', () => ({
  useAuth: () => ({
    signInAnonymously: mockSignInAnonymously,
  }),
}));

// Mock theme
jest.mock('../../services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      primaryLight: '#DBEAFE',
      success: '#22C55E',
      error: '#EF4444',
      backgroundSecondary: '#F3F4F6',
      surface: '#FFFFFF',
      textPrimary: '#1F2937',
      textSecondary: '#6B7280',
      textTertiary: '#9CA3AF',
      textInverse: '#FFFFFF',
      borderMedium: '#D1D5DB',
      black: '#000000',
    },
  }),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render welcome screen', () => {
      const { getByTestId } = render(<WelcomeScreen />);
      expect(getByTestId('welcome-screen')).toBeTruthy();
    });

    it('should display app name', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(getByText('LiveMetro')).toBeTruthy();
    });

    it('should display tagline', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(getByText('실시간 전철 알림')).toBeTruthy();
    });

    it('should display subtitle', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(getByText('지하철 지연, 운행중단 정보를 실시간으로 받아보세요')).toBeTruthy();
    });

    it('should render logo container', () => {
      const { getByTestId } = render(<WelcomeScreen />);
      expect(getByTestId('welcome-logo')).toBeTruthy();
    });
  });

  describe('Features Section', () => {
    it('should display real-time delay notification feature', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(getByText('실시간 지연 알림')).toBeTruthy();
    });

    it('should display nearby station detection feature', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(getByText('주변 역 자동 감지')).toBeTruthy();
    });

    it('should display alternative route suggestion feature', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(getByText('대체 경로 제안')).toBeTruthy();
    });
  });

  describe('Action Buttons', () => {
    it('should render get started button', () => {
      const { getByTestId } = render(<WelcomeScreen />);
      expect(getByTestId('get-started-button')).toBeTruthy();
    });

    it('should render try anonymous button', () => {
      const { getByTestId } = render(<WelcomeScreen />);
      expect(getByTestId('try-anonymous-button')).toBeTruthy();
    });

    it('should navigate to Auth when get started is pressed', () => {
      const { getByTestId } = render(<WelcomeScreen />);
      const button = getByTestId('get-started-button');

      fireEvent.press(button);

      expect(mockNavigate).toHaveBeenCalledWith('Auth');
    });

    it('should call signInAnonymously when try anonymous is pressed', async () => {
      mockSignInAnonymously.mockResolvedValue(undefined);

      const { getByTestId } = render(<WelcomeScreen />);
      const button = getByTestId('try-anonymous-button');

      fireEvent.press(button);

      await waitFor(() => {
        expect(mockSignInAnonymously).toHaveBeenCalled();
      });
    });

    it('should handle anonymous sign in error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSignInAnonymously.mockRejectedValue(new Error('Sign in failed'));

      const { getByTestId } = render(<WelcomeScreen />);
      const button = getByTestId('try-anonymous-button');

      fireEvent.press(button);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Footer', () => {
    it('should display footer text', () => {
      const { getByText } = render(<WelcomeScreen />);
      expect(
        getByText('계정을 만들면 개인화된 알림과 즐겨찾기 기능을 이용할 수 있습니다')
      ).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility label on get started button', () => {
      const { getByLabelText } = render(<WelcomeScreen />);
      expect(getByLabelText('시작하기')).toBeTruthy();
    });

    it('should have accessibility label on try anonymous button', () => {
      const { getByLabelText } = render(<WelcomeScreen />);
      expect(getByLabelText('체험해보기')).toBeTruthy();
    });
  });
});
