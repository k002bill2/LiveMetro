jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
    isDark: false,
  }),
  ThemeColors: {},
}));

jest.mock('@/styles/modernTheme', () => ({
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16 },
  RADIUS: { sm: 4, md: 8, lg: 12, base: 8, full: 9999 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
  },
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FavoriteEditForm } from '../FavoriteEditForm';
import { FavoriteWithDetails } from '@/hooks/useFavorites';

const baseFavorite: FavoriteWithDetails = {
  id: 'fav-1',
  stationId: 'ST001',
  lineId: '2',
  alias: '집',
  direction: 'up' as const,
  isCommuteStation: false,
  addedAt: new Date('2026-01-01'),
  station: null,
};

describe('FavoriteEditForm', () => {
  const defaultProps = {
    favorite: baseFavorite,
    isExpanded: true,
    onSave: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders alias input with current value', () => {
    const { getByDisplayValue } = render(
      <FavoriteEditForm {...defaultProps} />,
    );
    expect(getByDisplayValue('집')).toBeTruthy();
  });

  it('renders direction selector buttons', () => {
    const { getByText } = render(
      <FavoriteEditForm {...defaultProps} />,
    );
    expect(getByText('상행')).toBeTruthy();
    expect(getByText('양방향')).toBeTruthy();
    expect(getByText('하행')).toBeTruthy();
  });

  it('renders commute toggle and helper text', () => {
    const { getByText } = render(
      <FavoriteEditForm {...defaultProps} />,
    );
    expect(getByText('출퇴근 역으로 설정')).toBeTruthy();
    expect(
      getByText('출퇴근 역으로 설정하면 알림 설정에서 활용할 수 있습니다'),
    ).toBeTruthy();
  });

  it('calls onSave with updated values on save button press', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByDisplayValue } = render(
      <FavoriteEditForm {...defaultProps} onSave={onSave} />,
    );
    fireEvent.changeText(getByDisplayValue('집'), '회사');
    fireEvent.press(getByText('하행'));
    fireEvent.press(getByText('저장'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        alias: '회사',
        direction: 'down',
        isCommuteStation: false,
      });
    });
  });

  it('calls onCancel and resets form on cancel button press', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <FavoriteEditForm {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByText('취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('sends null alias when input is empty', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByDisplayValue } = render(
      <FavoriteEditForm {...defaultProps} onSave={onSave} />,
    );
    fireEvent.changeText(getByDisplayValue('집'), '  ');
    fireEvent.press(getByText('저장'));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ alias: null }),
      );
    });
  });

  it('renders character count for alias', () => {
    const { getByText } = render(
      <FavoriteEditForm {...defaultProps} />,
    );
    expect(getByText('1/20')).toBeTruthy();
  });
});
