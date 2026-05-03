/**
 * StationDetailHeader Tests — Wanted Design System hero/top bar.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationDetailHeader } from '../StationDetailHeader';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('StationDetailHeader', () => {
  const baseProps = {
    stationName: '강남',
    subtitle: 'Gangnam · 222 · 신분당 D07',
    lines: ['2', 'sb'] as const,
    isFavorite: false,
    onBack: jest.fn(),
    onShare: jest.fn(),
    onToggleFavorite: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onBack.mockClear();
    baseProps.onShare.mockClear();
    baseProps.onToggleFavorite.mockClear();
  });

  it('renders station name and subtitle', () => {
    const { getByText } = render(<StationDetailHeader {...baseProps} />);
    expect(getByText('강남')).toBeTruthy();
    expect(getByText('Gangnam · 222 · 신분당 D07')).toBeTruthy();
  });

  it('renders one LineBadge per line provided', () => {
    const { getAllByTestId } = render(
      <StationDetailHeader {...baseProps} testID="hdr" />
    );
    const badges = getAllByTestId(/^hdr-line-/);
    expect(badges.length).toBe(2);
  });

  it('invokes onBack when the back affordance is pressed', () => {
    const { getByTestId } = render(
      <StationDetailHeader {...baseProps} testID="hdr" />
    );
    fireEvent.press(getByTestId('hdr-back'));
    expect(baseProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('invokes onShare and onToggleFavorite for the action icons', () => {
    const { getByTestId } = render(
      <StationDetailHeader {...baseProps} testID="hdr" />
    );
    fireEvent.press(getByTestId('hdr-share'));
    fireEvent.press(getByTestId('hdr-favorite'));
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);
    expect(baseProps.onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('reflects favorite state through accessibilityState.selected on the favorite button', () => {
    const { getByTestId, rerender } = render(
      <StationDetailHeader {...baseProps} testID="hdr" />
    );
    expect(getByTestId('hdr-favorite').props.accessibilityState.selected).toBe(false);
    rerender(<StationDetailHeader {...baseProps} isFavorite testID="hdr" />);
    expect(getByTestId('hdr-favorite').props.accessibilityState.selected).toBe(true);
  });
});
