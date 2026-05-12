import React from 'react';
import { render } from '@testing-library/react-native';
import { WeeklyTrendChart } from '@/components/prediction/WeeklyTrendChart';

// RNTL v13 auto-extends expect with toHaveTextContent at runtime, but the
// public types only export the matcher interface as `export type *`, which
// does not pull the `declare module '@jest/expect'` augmentation into scope.
// Re-declare the single matcher we use here so TypeScript matches the
// runtime contract.
declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void>, T = unknown> {
    toHaveTextContent(expectedText: string | RegExp, options?: { exact?: boolean }): R;
  }
}

// useTheme — flat contract per src/services/theme/themeContext.tsx.
// Component reads only `isDark` and resolves the WANTED_TOKENS palette itself.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

const mockDays = [
  { dayLabel: '월' as const, durationMin: 32, isToday: false },
  { dayLabel: '화' as const, durationMin: 30, isToday: false },
  { dayLabel: '수' as const, durationMin: 28, isToday: true },
  { dayLabel: '목' as const, durationMin: 31, isToday: false },
  { dayLabel: '금' as const, durationMin: 33, isToday: false },
];

describe('WeeklyTrendChart', () => {
  it('renders 5 day bars', () => {
    const { getByTestId } = render(
      <WeeklyTrendChart days={mockDays} todayIndex={2} averageMin={30.8} />
    );
    for (let i = 0; i < 5; i++) {
      expect(getByTestId(`weekly-bar-${i}`)).toBeTruthy();
    }
  });

  it('highlights today bar (Wed)', () => {
    // Today's column carries two testIDs on different elements: the inner
    // bar View keeps `weekly-bar-${i}` so test 1's index loop still finds it,
    // and the parent column View additionally exposes `weekly-today-bar` so
    // callers can target the highlighted column. RN's `testID` is a single
    // string per element, so these are intentionally separate nodes.
    const { getByTestId } = render(
      <WeeklyTrendChart days={mockDays} todayIndex={2} averageMin={30.8} />
    );
    expect(getByTestId('weekly-today-bar')).toBeTruthy();
    expect(getByTestId('weekly-bar-2')).toBeTruthy();
  });

  it('shows subtitle "평균 대비 오늘 -3분" when today is below avg', () => {
    const { getByTestId } = render(
      <WeeklyTrendChart days={mockDays} todayIndex={2} averageMin={30.8} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(/-3분/);
  });

  it('shows "+N분" when today is above avg', () => {
    const days = mockDays.map((d) => ({ ...d, isToday: d.dayLabel === '월' }));
    const { getByTestId } = render(
      <WeeklyTrendChart days={days} todayIndex={0} averageMin={30.5} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(/\+/);
  });

  it('shows "평소와 같음" when diff is 0', () => {
    const days = [
      { dayLabel: '월' as const, durationMin: 30, isToday: false },
      { dayLabel: '화' as const, durationMin: 30, isToday: false },
      { dayLabel: '수' as const, durationMin: 30, isToday: true },
      { dayLabel: '목' as const, durationMin: 30, isToday: false },
      { dayLabel: '금' as const, durationMin: 30, isToday: false },
    ];
    const { getByTestId } = render(
      <WeeklyTrendChart days={days} todayIndex={2} averageMin={30} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('평소와 같음');
  });

  it('renders without crashing when todayIndex is -1', () => {
    const days = mockDays.map((d) => ({ ...d, isToday: false }));
    const { getByTestId, queryByTestId } = render(
      <WeeklyTrendChart days={days} todayIndex={-1} averageMin={30.8} />
    );
    expect(getByTestId('weekly-bar-0')).toBeTruthy();
    expect(queryByTestId('weekly-today-bar')).toBeNull();
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(/이번 주 평일 예측/);
  });

  it('renders empty state when days is empty', () => {
    const { getByText } = render(
      <WeeklyTrendChart days={[]} todayIndex={-1} averageMin={0} />
    );
    expect(getByText('이번 주 데이터 부족')).toBeTruthy();
  });
});
