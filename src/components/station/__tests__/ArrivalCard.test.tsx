/**
 * ArrivalCard Tests — Wanted Design System single arrival card.
 */
import React from 'react';
import { fireEvent, render, act } from '@testing-library/react-native';
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

  describe('empty congestion placeholder (Phase 55)', () => {
    it('hides placeholder by default when carCongestion is omitted', () => {
      const { queryByTestId } = render(<ArrivalCard {...base} testID="arr" />);
      expect(queryByTestId('arr-congestion')).toBeNull();
      expect(queryByTestId('arr-congestion-empty')).toBeNull();
    });

    it('shows empty placeholder when showEmptyCongestion is true and no data', () => {
      const { getByTestId, getByText, queryByTestId } = render(
        <ArrivalCard {...base} showEmptyCongestion testID="arr" />
      );
      expect(getByTestId('arr-congestion-empty')).toBeTruthy();
      expect(getByText('혼잡도 정보 준비 중')).toBeTruthy();
      expect(getByText('사용자 제보가 쌓이면 표시돼요')).toBeTruthy();
      // Bars section should NOT render in empty state
      expect(queryByTestId('arr-congestion')).toBeNull();
    });

    it('shows bars (not placeholder) when carCongestion is provided', () => {
      const { getByTestId, queryByTestId } = render(
        <ArrivalCard
          {...base}
          showEmptyCongestion
          carCongestion={[10, 30, 50, 70, 90, 60, 40, 20, 80, 95]}
          testID="arr"
        />
      );
      expect(getByTestId('arr-congestion')).toBeTruthy();
      expect(queryByTestId('arr-congestion-empty')).toBeNull();
    });
  });

  describe('long-press tooltip (Phase 53b)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows tooltip with car number, level, and percentage on long-press', () => {
      // Bar 9 has pct=80 → "혼잡" band per congFromPct (<88 high)
      const { getByTestId, queryByTestId, getByText } = render(
        <ArrivalCard
          {...base}
          carCongestion={[10, 30, 50, 70, 90, 60, 40, 20, 80, 95]}
          testID="arr"
        />
      );
      // Tooltip not visible before interaction
      expect(queryByTestId('arr-car-tooltip')).toBeNull();
      fireEvent(getByTestId('arr-car-bar-9'), 'longPress');
      expect(getByTestId('arr-car-tooltip')).toBeTruthy();
      expect(getByText('9호차 · 혼잡 · 80%')).toBeTruthy();
    });

    it('auto-dismisses tooltip after 2.5s', () => {
      const { getByTestId, queryByTestId } = render(
        <ArrivalCard
          {...base}
          carCongestion={[10, 20, 30, 40, 50, 60, 70, 80, 90, 95]}
          testID="arr"
        />
      );
      fireEvent(getByTestId('arr-car-bar-1'), 'longPress');
      expect(queryByTestId('arr-car-tooltip')).toBeTruthy();
      // Advance past TOOLTIP_DISMISS_MS (2500ms)
      act(() => {
        jest.advanceTimersByTime(2600);
      });
      expect(queryByTestId('arr-car-tooltip')).toBeNull();
    });

    it('replaces tooltip when another bar is long-pressed (re-trigger resets timer)', () => {
      const { getByTestId, getByText } = render(
        <ArrivalCard
          {...base}
          carCongestion={[10, 20, 30, 40, 50, 60, 70, 80, 90, 95]}
          testID="arr"
        />
      );
      fireEvent(getByTestId('arr-car-bar-1'), 'longPress');
      expect(getByText('1호차 · 여유 · 10%')).toBeTruthy();
      fireEvent(getByTestId('arr-car-bar-10'), 'longPress');
      // pct=95 → vhigh "매우혼잡"
      expect(getByText('10호차 · 매우혼잡 · 95%')).toBeTruthy();
    });
  });
});
