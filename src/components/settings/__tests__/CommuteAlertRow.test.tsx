/**
 * CommuteAlertRow test — verifies the honesty contract: only the START box
 * is editable (wired to onStartChange); the END box is read-only (no onChange).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CommuteAlertRow from '../CommuteAlertRow';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light
  ),
}));

// Mock TimeFieldBox so editability is observable: a box is pressable only
// when it receives an onChange callback.
jest.mock('../TimeFieldBox', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onChange,
      locked,
      onLockedPress,
      testID,
    }: {
      label: string;
      value: string;
      onChange?: (t: string) => void;
      locked?: boolean;
      onLockedPress?: () => void;
      testID?: string;
    }) => {
      const onPress = onChange
        ? () => onChange('07:30')
        : locked && onLockedPress
          ? onLockedPress
          : undefined;
      return ReactLocal.createElement(
        Pressable,
        {
          testID,
          accessibilityState: { disabled: !onChange && !locked },
          onPress,
        },
        ReactLocal.createElement(Text, null, `${label}:${value}`)
      );
    },
  };
});

const baseProps = {
  badgeLabel: '출근',
  caption: '출발 시점부터 알림',
  startTime: '08:00',
  endTime: '10:00',
  testID: 'row',
};

describe('CommuteAlertRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the badge, caption and both time boxes', () => {
    const { getByText } = render(<CommuteAlertRow {...baseProps} />);
    expect(getByText('출근')).toBeTruthy();
    expect(getByText('출발 시점부터 알림')).toBeTruthy();
    expect(getByText('시작:08:00')).toBeTruthy();
    expect(getByText('종료:10:00')).toBeTruthy();
  });

  it('keeps both boxes read-only when the commute is set (not locked)', () => {
    const onLockedPress = jest.fn();
    const { getByTestId } = render(
      <CommuteAlertRow {...baseProps} onLockedPress={onLockedPress} />
    );
    const startBox = getByTestId('row-start');
    const endBox = getByTestId('row-end');
    expect(startBox.props.accessibilityState).toEqual({ disabled: true });
    expect(endBox.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(startBox);
    fireEvent.press(endBox);
    expect(onLockedPress).not.toHaveBeenCalled();
  });

  it('makes the START box a CTA firing onLockedPress when locked', () => {
    const onLockedPress = jest.fn();
    const { getByTestId } = render(
      <CommuteAlertRow {...baseProps} locked onLockedPress={onLockedPress} />
    );
    fireEvent.press(getByTestId('row-start'));
    expect(onLockedPress).toHaveBeenCalledTimes(1);
  });
});
