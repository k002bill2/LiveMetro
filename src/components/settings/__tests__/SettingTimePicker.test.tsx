jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('@/styles/modernTheme', () => ({
  COLORS: {
    black: '#000000',
    white: '#FFFFFF',
    gray: { 400: '#999999' },
    border: { light: '#E5E5EA', medium: '#D1D1D6' },
    surface: { card: '#F2F2F7' },
    text: { primary: '#000000', tertiary: '#C7C7CC' },
  },
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16 },
  RADIUS: { sm: 4, md: 8, base: 8, full: 9999 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
  },
}));

import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingTimePicker } from '../SettingTimePicker';

describe('SettingTimePicker', () => {
  const defaultProps = {
    label: '출발 시간',
    value: '08:30',
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label text', () => {
    const { getByText } = render(
      <SettingTimePicker {...defaultProps} />,
    );
    expect(getByText('출발 시간')).toBeTruthy();
  });

  it('displays formatted time in 12-hour format', () => {
    const { getByText } = render(
      <SettingTimePicker {...defaultProps} value="14:00" />,
    );
    expect(getByText('2:00 PM')).toBeTruthy();
  });

  it('displays AM for morning times', () => {
    const { getByText } = render(
      <SettingTimePicker {...defaultProps} value="08:30" />,
    );
    expect(getByText('8:30 AM')).toBeTruthy();
  });

  it('displays 12:00 PM for noon', () => {
    const { getByText } = render(
      <SettingTimePicker {...defaultProps} value="12:00" />,
    );
    expect(getByText('12:00 PM')).toBeTruthy();
  });

  it('shows picker on press (iOS)', () => {
    Platform.OS = 'ios';
    const { getByText, queryByText } = render(
      <SettingTimePicker {...defaultProps} />,
    );
    // Before press, no 완료 button
    expect(queryByText('완료')).toBeNull();
    // After press, 완료 button shows
    fireEvent.press(getByText('출발 시간'));
    expect(getByText('완료')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const { toJSON } = render(
      <SettingTimePicker {...defaultProps} icon="time-outline" />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
