/**
 * EditProfileScreen Test Suite
 * Tests profile editing and password change functionality
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { EditProfileScreen } from '../EditProfileScreen';
import { useAuth } from '@/services/auth/AuthContext';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackScreenProps: {},
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      isAnonymous: false,
    },
    updateUserProfile: jest.fn(() => Promise.resolve()),
    changePassword: jest.fn(() => Promise.resolve()),
  })),
}));

const mockGoBack = jest.fn();
const defaultProps = {
  navigation: {
    navigate: jest.fn(),
    goBack: mockGoBack,
    setOptions: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    reset: jest.fn(),
    isFocused: jest.fn(),
    canGoBack: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(),
    dispatch: jest.fn(),
    getId: jest.fn(),
  } as unknown as Parameters<typeof EditProfileScreen>[0]['navigation'],
  route: {
    key: 'EditProfile',
    name: 'EditProfile' as const,
    params: undefined,
  },
};

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders profile form with user data', () => {
    const { getByText, getByDisplayValue } = render(
      <EditProfileScreen {...defaultProps} />,
    );

    expect(getByText('프로필 정보')).toBeTruthy();
    expect(getByDisplayValue('Test User')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('renders email as read-only with helper text', () => {
    const { getByText } = render(<EditProfileScreen {...defaultProps} />);

    expect(getByText('이메일은 변경할 수 없습니다.')).toBeTruthy();
  });

  it('renders password change section for non-anonymous users', () => {
    const { getAllByText } = render(<EditProfileScreen {...defaultProps} />);

    // '비밀번호 변경' appears as both section title and button text
    const elements = getAllByText('비밀번호 변경');
    expect(elements.length).toBeGreaterThanOrEqual(2);
  });

  it('hides password change section for anonymous users', () => {
    (useAuth as jest.Mock).mockReturnValueOnce({
      user: {
        uid: 'anon-uid',
        displayName: 'Anonymous',
        email: null,
        isAnonymous: true,
      },
      updateUserProfile: jest.fn(),
      changePassword: jest.fn(),
    });

    const { queryByText } = render(<EditProfileScreen {...defaultProps} />);
    expect(queryByText('비밀번호 변경')).toBeNull();
  });

  it('shows error when saving empty name', async () => {
    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen {...defaultProps} />,
    );

    const nameInput = getByDisplayValue('Test User');
    fireEvent.changeText(nameInput, '');
    fireEvent.press(getByText('프로필 저장'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('입력 오류', '이름을 입력해주세요.');
    });
  });

  it('calls updateUserProfile on save with new name', async () => {
    const mockUpdateProfile = jest.fn(() => Promise.resolve());
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'test-uid',
        displayName: 'Test User',
        email: 'test@example.com',
        isAnonymous: false,
      },
      updateUserProfile: mockUpdateProfile,
      changePassword: jest.fn(),
    });

    const { getByDisplayValue, getByText } = render(
      <EditProfileScreen {...defaultProps} />,
    );

    const nameInput = getByDisplayValue('Test User');
    fireEvent.changeText(nameInput, 'New Name');
    fireEvent.press(getByText('프로필 저장'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'New Name' });
    });
  });

  it('goes back when saving unchanged name', async () => {
    const { getByText } = render(<EditProfileScreen {...defaultProps} />);

    fireEvent.press(getByText('프로필 저장'));

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('shows error when changing password without current password', async () => {
    const { getAllByText, getByPlaceholderText } = render(
      <EditProfileScreen {...defaultProps} />,
    );

    // Fill new password but not current
    fireEvent.changeText(getByPlaceholderText('새 비밀번호 (6자 이상)'), 'newpass123');
    fireEvent.changeText(getByPlaceholderText('새 비밀번호 다시 입력'), 'newpass123');

    // '비밀번호 변경' appears as section title and button - last one is the button
    const changeButtons = getAllByText('비밀번호 변경');
    fireEvent.press(changeButtons[changeButtons.length - 1]);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('입력 오류', '현재 비밀번호를 입력해주세요.');
    });
  });
});
