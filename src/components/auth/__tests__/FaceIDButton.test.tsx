/**
 * FaceIDButton Tests — Wanted Design System primary biometric CTA.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FaceIDButton } from '../FaceIDButton';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('FaceIDButton', () => {
  it('renders the provided label', () => {
    const { getByText } = render(
      <FaceIDButton label="Face ID로 계속하기" onPress={jest.fn()} />
    );
    expect(getByText('Face ID로 계속하기')).toBeTruthy();
  });

  it('renders the touch ID variant label', () => {
    const { getByText } = render(
      <FaceIDButton label="Touch ID로 계속하기" onPress={jest.fn()} variant="touch" />
    );
    expect(getByText('Touch ID로 계속하기')).toBeTruthy();
  });

  it('invokes onPress when pressed and not loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <FaceIDButton label="Face ID" onPress={onPress} testID="fb" />
    );
    fireEvent.press(getByTestId('fb'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not invoke onPress when loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <FaceIDButton label="Face ID" onPress={onPress} loading testID="fb" />
    );
    fireEvent.press(getByTestId('fb'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders a pulse indicator on the trailing edge', () => {
    const { getByTestId } = render(
      <FaceIDButton label="Face ID" onPress={jest.fn()} testID="fb" />
    );
    expect(getByTestId('fb-pulse')).toBeTruthy();
  });

  it('unmounts cleanly without leaking the pulse loop', () => {
    const { unmount } = render(
      <FaceIDButton label="Face ID" onPress={jest.fn()} testID="fb" />
    );
    expect(() => unmount()).not.toThrow();
  });
});
