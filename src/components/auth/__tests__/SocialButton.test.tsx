/**
 * SocialButton Tests — Wanted Design System social login button.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SocialButton } from '../SocialButton';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('SocialButton', () => {
  it('renders the provided label', () => {
    const { getByText } = render(
      <SocialButton provider="apple" label="Apple로 계속하기" onPress={jest.fn()} />
    );
    expect(getByText('Apple로 계속하기')).toBeTruthy();
  });

  it('invokes onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SocialButton provider="google" label="Google" onPress={onPress} testID="sb" />
    );
    fireEvent.press(getByTestId('sb'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['apple', 'google', 'kakao'] as const)(
    'renders the %s variant without crashing',
    (provider) => {
      const { getByTestId } = render(
        <SocialButton provider={provider} label={provider} onPress={jest.fn()} testID="sb" />
      );
      expect(getByTestId('sb')).toBeTruthy();
    }
  );

  it('exposes accessibilityRole=button + accessibilityLabel', () => {
    const { getByTestId } = render(
      <SocialButton provider="kakao" label="카카오로 계속하기" onPress={jest.fn()} testID="sb" />
    );
    const node = getByTestId('sb');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityLabel).toBe('카카오로 계속하기');
  });

  it('does not fire onPress when disabled and marks accessibilityState.disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SocialButton provider="google" label="Google" onPress={onPress} disabled testID="sb" />
    );
    const node = getByTestId('sb');
    expect(node.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(node);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire onPress while loading (disabled state)', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SocialButton provider="kakao" label="Kakao" onPress={onPress} loading testID="sb" />
    );
    const node = getByTestId('sb');
    expect(node.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(node);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires onPress when neither loading nor disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <SocialButton
        provider="apple"
        label="Apple"
        onPress={onPress}
        loading={false}
        disabled={false}
        testID="sb"
      />
    );
    const node = getByTestId('sb');
    expect(node.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(node);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
