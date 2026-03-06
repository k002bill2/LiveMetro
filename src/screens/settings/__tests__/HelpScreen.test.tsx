/**
 * HelpScreen Test Suite
 * Tests FAQ display, search, and contact support
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HelpScreen } from '../HelpScreen';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      primaryLight: '#E5F0FF',
      background: '#FFFFFF',
      backgroundSecondary: '#F2F2F7',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      textDisabled: '#D1D1D6',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      success: '#34C759',
    },
  }),
  ThemeColors: {},
}));

jest.mock('@/utils/helpContent', () => ({
  FAQ_DATA: [
    {
      id: 'notification-1',
      category: '알림',
      question: '알림이 오지 않아요',
      answer: '알림 설정을 확인해주세요.',
    },
    {
      id: 'favorites-1',
      category: '즐겨찾기',
      question: '즐겨찾기 추가 방법',
      answer: '역 상세에서 별 아이콘을 탭하세요.',
    },
    {
      id: 'account-1',
      category: '계정',
      question: '계정 삭제 방법',
      answer: 'support@livemetro.app로 문의하세요.',
    },
  ],
  FAQ_CATEGORIES: ['알림', '즐겨찾기', '계정'],
  SUPPORT_EMAIL: 'support@livemetro.app',
  SUPPORT_PHONE: '1234-5678',
}));

describe('HelpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('renders search bar', () => {
    const { getByPlaceholderText } = render(<HelpScreen />);

    expect(getByPlaceholderText('질문 검색...')).toBeTruthy();
  });

  it('renders FAQ categories', () => {
    const { getByText } = render(<HelpScreen />);

    expect(getByText('알림')).toBeTruthy();
    expect(getByText('즐겨찾기')).toBeTruthy();
    expect(getByText('계정')).toBeTruthy();
  });

  it('renders FAQ questions', () => {
    const { getByText } = render(<HelpScreen />);

    expect(getByText('알림이 오지 않아요')).toBeTruthy();
    expect(getByText('즐겨찾기 추가 방법')).toBeTruthy();
    expect(getByText('계정 삭제 방법')).toBeTruthy();
  });

  it('expands FAQ item when tapped', () => {
    const { getByText, queryByText } = render(<HelpScreen />);

    // Answer should not be visible initially
    expect(queryByText('알림 설정을 확인해주세요.')).toBeNull();

    // Tap question to expand
    fireEvent.press(getByText('알림이 오지 않아요'));

    // Answer should now be visible
    expect(getByText('알림 설정을 확인해주세요.')).toBeTruthy();
  });

  it('collapses expanded FAQ item when tapped again', () => {
    const { getByText, queryByText } = render(<HelpScreen />);

    // Expand
    fireEvent.press(getByText('알림이 오지 않아요'));
    expect(getByText('알림 설정을 확인해주세요.')).toBeTruthy();

    // Collapse
    fireEvent.press(getByText('알림이 오지 않아요'));
    expect(queryByText('알림 설정을 확인해주세요.')).toBeNull();
  });

  it('filters FAQ items based on search query', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<HelpScreen />);

    const searchInput = getByPlaceholderText('질문 검색...');
    fireEvent.changeText(searchInput, '알림');

    expect(getByText('알림이 오지 않아요')).toBeTruthy();
    expect(queryByText('즐겨찾기 추가 방법')).toBeNull();
    expect(queryByText('계정 삭제 방법')).toBeNull();
  });

  it('shows no results message for unmatched search', () => {
    const { getByPlaceholderText, getByText } = render(<HelpScreen />);

    const searchInput = getByPlaceholderText('질문 검색...');
    fireEvent.changeText(searchInput, 'nonexistent query xyz');

    expect(getByText('검색 결과가 없습니다')).toBeTruthy();
  });

  it('renders contact support section', () => {
    const { getByText } = render(<HelpScreen />);

    expect(getByText('문제가 해결되지 않았나요?')).toBeTruthy();
    expect(getByText('고객 지원 문의')).toBeTruthy();
    expect(getByText('support@livemetro.app')).toBeTruthy();
    expect(getByText('1234-5678')).toBeTruthy();
  });

  it('shows contact support alert when button pressed', () => {
    const { getByText } = render(<HelpScreen />);

    fireEvent.press(getByText('고객 지원 문의'));

    expect(Alert.alert).toHaveBeenCalledWith(
      '고객 지원',
      '어떤 방법으로 연락하시겠습니까?',
      expect.any(Array),
    );
  });
});
