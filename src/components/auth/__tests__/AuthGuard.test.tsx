jest.mock('../../../services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../common/LoadingScreen', () => ({
  LoadingScreen: ({ message }: { message: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'loading-screen' }, message);
  },
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthGuard } from '../AuthGuard';
import { useAuth } from '../../../services/auth/AuthContext';

const mockUseAuth = useAuth as jest.Mock;

describe('AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading screen while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { getByTestId } = render(
      <AuthGuard>
        <Text>Protected</Text>
      </AuthGuard>,
    );
    expect(getByTestId('loading-screen')).toBeTruthy();
  });

  it('shows loading message text', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { getByText } = render(
      <AuthGuard>
        <Text>Protected</Text>
      </AuthGuard>,
    );
    expect(getByText('인증 상태를 확인하고 있습니다...')).toBeTruthy();
  });

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '1' }, loading: false });
    const { getByText } = render(
      <AuthGuard>
        <Text>Protected Content</Text>
      </AuthGuard>,
    );
    expect(getByText('Protected Content')).toBeTruthy();
  });

  it('renders fallback when user is null and fallback provided', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { getByText } = render(
      <AuthGuard fallback={<Text>로그인 필요</Text>}>
        <Text>Protected</Text>
      </AuthGuard>,
    );
    expect(getByText('로그인 필요')).toBeTruthy();
  });

  it('renders children when no user and no fallback', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { getByText } = render(
      <AuthGuard>
        <Text>Children</Text>
      </AuthGuard>,
    );
    expect(getByText('Children')).toBeTruthy();
  });
});
