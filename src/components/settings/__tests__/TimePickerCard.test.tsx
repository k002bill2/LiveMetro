import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { TimePickerCard } from '../TimePickerCard';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

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

  it('increments and decrements minutes by one minute', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePickerCard {...defaultProps} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('time-minute-increment'));
    expect(onChange).toHaveBeenLastCalledWith('08:01');

    fireEvent.press(getByTestId('time-minute-decrement'));
    expect(onChange).toHaveBeenLastCalledWith('07:59');
  });

  it('increments and decrements hours by one hour', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePickerCard {...defaultProps} value="00:15" onChange={onChange} />,
    );

    fireEvent.press(getByTestId('time-hour-increment'));
    expect(onChange).toHaveBeenLastCalledWith('01:15');

    fireEvent.press(getByTestId('time-hour-decrement'));
    expect(onChange).toHaveBeenLastCalledWith('23:15');
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
    const { getByTestId } = render(
      <TimePickerCard {...defaultProps} disabled onChange={onChange} />,
    );

    fireEvent.press(getByTestId('time-minute-increment'));
    fireEvent.press(getByTestId('time-hour-increment'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
