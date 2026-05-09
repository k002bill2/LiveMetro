import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TimeChipRow } from '../TimeChipRow';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

describe('TimeChipRow', () => {
  const defaultProps = {
    mode: 'now' as const,
    time: null,
    onChangeMode: jest.fn(),
    onChangeTime: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders three chips', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} />);
    expect(getByTestId('time-chip-now')).toBeTruthy();
    expect(getByTestId('time-chip-depart')).toBeTruthy();
    expect(getByTestId('time-chip-arrive')).toBeTruthy();
  });

  it('marks now chip selected when mode=now', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="now" />);
    expect(getByTestId('time-chip-now').props.accessibilityState?.selected).toBe(true);
  });

  it('marks depart chip selected when mode=depart', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="depart" />);
    expect(getByTestId('time-chip-depart').props.accessibilityState?.selected).toBe(true);
  });

  it('calls onChangeMode("now") when now chip tapped', () => {
    const { getByTestId } = render(<TimeChipRow {...defaultProps} mode="depart" />);
    fireEvent.press(getByTestId('time-chip-now'));
    expect(defaultProps.onChangeMode).toHaveBeenCalledWith('now');
  });

  it('shows formatted time on depart chip when time provided', () => {
    const time = new Date('2026-05-09T08:32:00');
    const { getByText } = render(<TimeChipRow {...defaultProps} mode="depart" time={time} />);
    expect(getByText('8:32')).toBeTruthy();
  });
});
