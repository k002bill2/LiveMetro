import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { TimePickerCard } from '../TimePickerCard';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  const { Pressable } = require('react-native');

  return {
    __esModule: true,
    default: ({
      testID,
      onChange,
    }: {
      testID?: string;
      onChange: (event: { type: 'set' }, selectedDate?: Date) => void;
    }) =>
      ReactLocal.createElement(Pressable, {
        testID,
        onPress: () => onChange({ type: 'set' }, new Date(2020, 0, 1, 8, 1)),
      }),
  };
});

describe('TimePickerCard', () => {
  const defaultProps = {
    title: '출근 시간',
    subtitle: '평일 기준',
    value: '08:00',
    options: ['07:30', '08:00', '08:30'],
    onChange: jest.fn(),
    testID: 'time',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders hour and minute from the selected value', () => {
    const { getByTestId } = render(
      <TimePickerCard {...defaultProps} value="08:17" />,
    );

    expect(getByTestId('time-hh')).toHaveTextContent('08');
    expect(getByTestId('time-mm')).toHaveTextContent('17');
  });

  it('opens the native time picker from the display and applies the selected minute', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePickerCard {...defaultProps} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('time-display'));
    fireEvent.press(getByTestId('time-native-picker'));
    expect(onChange).toHaveBeenCalledWith('08:01');
  });

  it('keeps preset chips as quick picks', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePickerCard {...defaultProps} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('time-chip-08:30'));
    expect(onChange).toHaveBeenCalledWith('08:30');
  });

  it('does not change time while disabled', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TimePickerCard {...defaultProps} disabled onChange={onChange} />,
    );

    fireEvent.press(getByTestId('time-display'));

    expect(queryByTestId('time-native-picker')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
