/**
 * FaceIDButton Tests — Wanted Design System primary biometric CTA.
 */
import React from 'react';
import { Animated } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { FaceIDButton } from '../FaceIDButton';
import { useShouldReduceMotion } from '@/contexts/AccessibilityContext';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));
jest.mock('@/contexts/AccessibilityContext', () => ({
  useShouldReduceMotion: jest.fn(),
}));

const mockReduceMotion = useShouldReduceMotion as jest.Mock;

describe('FaceIDButton', () => {
  beforeEach(() => {
    mockReduceMotion.mockReturnValue(false);
  });

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

  it('starts the pulse loop when motion is allowed', () => {
    mockReduceMotion.mockReturnValue(false);
    const loopSpy = jest.spyOn(Animated, 'loop');
    render(<FaceIDButton label="Face ID" onPress={jest.fn()} testID="fb" />);
    expect(loopSpy).toHaveBeenCalled();
    loopSpy.mockRestore();
  });

  it('does not start the pulse loop when reduce-motion is enabled, but keeps the indicator visible', () => {
    mockReduceMotion.mockReturnValue(true);
    const loopSpy = jest.spyOn(Animated, 'loop');
    const { getByTestId } = render(
      <FaceIDButton label="Face ID" onPress={jest.fn()} testID="fb" />
    );
    expect(loopSpy).not.toHaveBeenCalled();
    // The glow indicator is held static (visible), not removed.
    expect(getByTestId('fb-pulse')).toBeTruthy();
    loopSpy.mockRestore();
  });
});
