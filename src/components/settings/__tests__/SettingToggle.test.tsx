import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Switch } from 'react-native';
import { SettingToggle } from '../SettingToggle';

// Phase 45 — component now consumes useTheme().isDark to pick the
// Wanted Design System semantic theme (light/dark variants of
// WANTED_TOKENS). Force light in tests for stable assertions.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('SettingToggle', () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label text', () => {
    const { getByText } = render(
      <SettingToggle label="알림" value={false} onValueChange={mockOnValueChange} />,
    );
    expect(getByText('알림')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <SettingToggle
        label="알림"
        subtitle="알림을 켜거나 끕니다"
        value={false}
        onValueChange={mockOnValueChange}
      />,
    );
    expect(getByText('알림을 켜거나 끕니다')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    const { queryByText } = render(
      <SettingToggle label="알림" value={false} onValueChange={mockOnValueChange} />,
    );
    expect(queryByText('알림을 켜거나 끕니다')).toBeNull();
  });

  it('calls onValueChange when switch is toggled', () => {
    const { UNSAFE_getByType } = render(
      <SettingToggle label="알림" value={false} onValueChange={mockOnValueChange} />,
    );
    fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it('passes disabled prop to Switch', () => {
    const { UNSAFE_getByType } = render(
      <SettingToggle
        label="알림"
        value={false}
        onValueChange={mockOnValueChange}
        disabled={true}
      />,
    );
    expect(UNSAFE_getByType(Switch).props.disabled).toBe(true);
  });

  it('renders with value true', () => {
    const { UNSAFE_getByType } = render(
      <SettingToggle label="알림" value={true} onValueChange={mockOnValueChange} />,
    );
    expect(UNSAFE_getByType(Switch).props.value).toBe(true);
  });
});
