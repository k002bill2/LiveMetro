/**
 * TimeFieldBox test — editable opens a native picker and emits "HH:MM";
 * read-only (no onChange) is non-interactive.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TimeFieldBox from '../TimeFieldBox';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light
  ),
}));

// Mock the native picker as a button that fires onChange with a fixed time.
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (e: unknown, d?: Date) => void }) =>
      ReactLocal.createElement(Pressable, {
        testID: 'mock-datetimepicker',
        onPress: () => onChange({ type: 'set' }, new Date(2020, 0, 1, 7, 30)),
      }),
  };
});

describe('TimeFieldBox', () => {
  it('renders the label and value', () => {
    const { getByText } = render(<TimeFieldBox label="시작" value="08:00" />);
    expect(getByText('시작')).toBeTruthy();
    expect(getByText('08:00')).toBeTruthy();
  });

  it('emits HH:MM through the picker when editable', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimeFieldBox label="시작" value="08:00" onChange={onChange} testID="tf" />
    );
    // Tapping the box opens the picker...
    fireEvent.press(getByTestId('tf'));
    // ...and committing the picker emits the formatted time.
    fireEvent.press(getByTestId('mock-datetimepicker'));
    expect(onChange).toHaveBeenCalledWith('07:30');
  });

  it('is non-interactive when read-only (no onChange)', () => {
    const { getByTestId, queryByTestId } = render(
      <TimeFieldBox label="종료" value="10:00" testID="tf" />
    );
    fireEvent.press(getByTestId('tf'));
    // No picker is ever mounted for a read-only box.
    expect(queryByTestId('mock-datetimepicker')).toBeNull();
  });

  it('fires onLockedPress instead of opening the picker when locked', () => {
    const onChange = jest.fn();
    const onLockedPress = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TimeFieldBox
        label="시작"
        value="08:00"
        onChange={onChange}
        locked
        onLockedPress={onLockedPress}
        testID="tf"
      />
    );
    fireEvent.press(getByTestId('tf'));
    expect(onLockedPress).toHaveBeenCalledTimes(1);
    // locked wins over onChange: the picker never opens, no edit emitted.
    expect(queryByTestId('mock-datetimepicker')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
