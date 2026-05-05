import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingTimePicker } from '../SettingTimePicker';

import { Clock } from 'lucide-react-native';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// Phase 45 — Wanted DS migration: legacy COLORS/SPACING/RADIUS/TYPOGRAPHY
// mock removed because the component no longer imports them. useTheme is
// what now needs to be mocked (drives WANTED_TOKENS light/dark selection).
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

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
      <SettingTimePicker {...defaultProps} icon={Clock} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
