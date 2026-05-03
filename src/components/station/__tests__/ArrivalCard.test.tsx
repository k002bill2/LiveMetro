/**
 * ArrivalCard Tests — Wanted Design System single arrival card.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ArrivalCard } from '../ArrivalCard';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('ArrivalCard', () => {
  // Use line "9" so the badge text doesn't collide with the minutes value.
  const base = {
    line: '9',
    destination: '잠실',
    minutes: 4,
    seconds: 30,
  } as const;

  it('renders destination with "행" suffix', () => {
    const { getByText } = render(<ArrivalCard {...base} />);
    expect(getByText('잠실행')).toBeTruthy();
  });

  it('renders the minute and second values separately', () => {
    const { getByText } = render(<ArrivalCard {...base} />);
    expect(getByText('4')).toBeTruthy();
    expect(getByText('분')).toBeTruthy();
    // seconds always padded to 2 digits + 초 unit
    expect(getByText('30초')).toBeTruthy();
  });

  it('shows "곧 도착" Pill only when isFirst is true', () => {
    const { queryByText, rerender } = render(<ArrivalCard {...base} />);
    expect(queryByText('곧 도착')).toBeNull();
    rerender(<ArrivalCard {...base} isFirst />);
    expect(queryByText('곧 도착')).toBeTruthy();
  });

  it('omits seconds row when totalSeconds is 0 — shows "곧 도착" placeholder', () => {
    const { getByText, queryByText } = render(
      <ArrivalCard {...base} minutes={0} seconds={0} isFirst />
    );
    expect(getByText('곧 도착')).toBeTruthy();
    expect(queryByText('분')).toBeNull();
  });

  it('renders the per-car congestion strip when carCongestion is provided', () => {
    const { getByTestId, getAllByTestId } = render(
      <ArrivalCard
        {...base}
        carCongestion={[10, 30, 50, 70, 90, 60, 40, 20, 80, 95]}
        testID="arr"
      />
    );
    expect(getByTestId('arr-congestion')).toBeTruthy();
    const bars = getAllByTestId(/^arr-car-bar-/);
    expect(bars.length).toBe(10);
  });

  it('hides congestion strip when carCongestion is omitted', () => {
    const { queryByTestId } = render(<ArrivalCard {...base} testID="arr" />);
    expect(queryByTestId('arr-congestion')).toBeNull();
  });

  it('shows delay subtitle when delayMinutes > 0', () => {
    const { getByText } = render(<ArrivalCard {...base} delayMinutes={3} />);
    expect(getByText(/지연 3분/)).toBeTruthy();
  });
});
