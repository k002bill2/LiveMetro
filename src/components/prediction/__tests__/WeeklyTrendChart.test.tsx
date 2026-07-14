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
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

const mockDays = [
  { dayLabel: '월' as const, durationMin: 32, isToday: false, hasData: true },
  { dayLabel: '화' as const, durationMin: 30, isToday: false, hasData: true },
  { dayLabel: '수' as const, durationMin: 28, isToday: true, hasData: true },
  { dayLabel: '목' as const, durationMin: 31, isToday: false, hasData: true },
  { dayLabel: '금' as const, durationMin: 33, isToday: false, hasData: true },
];

describe('WeeklyTrendChart', () => {
  it('renders 5 day bars', () => {
    const { getByTestId } = render(
      <WeeklyTrendChart days={mockDays} todayIndex={2} />
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
      <WeeklyTrendChart days={mockDays} todayIndex={2} />
    );
    expect(getByTestId('weekly-today-bar')).toBeTruthy();
    expect(getByTestId('weekly-bar-2')).toBeTruthy();
  });

  it('shows subtitle "평균 대비 오늘 -3분" when today is below avg', () => {
    const { getByTestId } = render(
      <WeeklyTrendChart days={mockDays} todayIndex={2} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(/-3분/);
  });

  it('shows "+N분" when today is above avg', () => {
    const days = mockDays.map((d) => ({ ...d, isToday: d.dayLabel === '월' }));
    const { getByTestId } = render(
      <WeeklyTrendChart days={days} todayIndex={0} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(/\+/);
  });

  it('shows "평소와 같음" when diff is 0', () => {
    const days = [
      { dayLabel: '월' as const, durationMin: 30, isToday: false, hasData: true },
      { dayLabel: '화' as const, durationMin: 30, isToday: false, hasData: true },
      { dayLabel: '수' as const, durationMin: 30, isToday: true, hasData: true },
      { dayLabel: '목' as const, durationMin: 30, isToday: false, hasData: true },
      { dayLabel: '금' as const, durationMin: 30, isToday: false, hasData: true },
    ];
    const { getByTestId } = render(
      <WeeklyTrendChart days={days} todayIndex={2} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('평소와 같음');
  });

  it('renders without crashing when todayIndex is -1', () => {
    const days = mockDays.map((d) => ({ ...d, isToday: false }));
    const { getByTestId, queryByTestId } = render(
      <WeeklyTrendChart days={days} todayIndex={-1} />
    );
    expect(getByTestId('weekly-bar-0')).toBeTruthy();
    expect(queryByTestId('weekly-today-bar')).toBeNull();
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(/이번 주 평일 예측/);
  });

  it('renders empty state when days is empty', () => {
    const { getByText } = render(
      <WeeklyTrendChart days={[]} todayIndex={-1} />
    );
    expect(getByText('이번 주 데이터 부족')).toBeTruthy();
  });

  // Task 1: no-data weekdays render as honest ghost placeholders (not dropped),
  // so all five Mon–Fri columns are always visible.
  it('renders placeholder columns for weekdays without data (mixed week)', () => {
    const mixedDays = [
      { dayLabel: '월' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '화' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '수' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '목' as const, durationMin: 31, isToday: true, hasData: true },
      { dayLabel: '금' as const, durationMin: 33, isToday: false, hasData: true },
    ];
    const { getByTestId, queryByTestId, getAllByText } = render(
      <WeeklyTrendChart days={mixedDays} todayIndex={3} />
    );
    // No-data columns expose the placeholder testID (not the data testID).
    for (const i of [0, 1, 2]) {
      expect(getByTestId(`weekly-bar-placeholder-${i}`)).toBeTruthy();
      expect(queryByTestId(`weekly-bar-${i}`)).toBeNull();
    }
    // Data columns keep the data testID (not the placeholder one).
    for (const i of [3, 4]) {
      expect(getByTestId(`weekly-bar-${i}`)).toBeTruthy();
      expect(queryByTestId(`weekly-bar-placeholder-${i}`)).toBeNull();
    }
    // Each placeholder shows an em-dash instead of a fabricated minute label.
    expect(getAllByText('—')).toHaveLength(3);
  });

  it('renders the "이번 주 데이터 부족" empty state when every weekday lacks data', () => {
    const allEmpty = [
      { dayLabel: '월' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '화' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '수' as const, durationMin: 0, isToday: true, hasData: false },
      { dayLabel: '목' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '금' as const, durationMin: 0, isToday: false, hasData: false },
    ];
    const { getByText, queryByTestId } = render(
      <WeeklyTrendChart days={allEmpty} todayIndex={2} />
    );
    expect(getByText('이번 주 데이터 부족')).toBeTruthy();
    // Falls back to the empty state — no bars/placeholders rendered.
    expect(queryByTestId('weekly-bar-placeholder-0')).toBeNull();
    expect(queryByTestId('weekly-bar-0')).toBeNull();
  });

  it('shows the "기록이 쌓이면" subtitle when today has no data but other days do', () => {
    const todayNoData = [
      { dayLabel: '월' as const, durationMin: 32, isToday: false, hasData: true },
      { dayLabel: '화' as const, durationMin: 30, isToday: false, hasData: true },
      { dayLabel: '수' as const, durationMin: 0, isToday: true, hasData: false },
      { dayLabel: '목' as const, durationMin: 31, isToday: false, hasData: true },
      { dayLabel: '금' as const, durationMin: 33, isToday: false, hasData: true },
    ];
    const { getByTestId } = render(
      <WeeklyTrendChart days={todayNoData} todayIndex={2} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent(
      '기록이 쌓이면 요일별 예측이 채워져요',
    );
    // Today's column is a placeholder (no fabricated highlight).
    expect(getByTestId('weekly-bar-placeholder-2')).toBeTruthy();
  });

  it('computes the average from data-only days (ignores placeholders)', () => {
    // 목(today)=31; the only other data day is 금=33 → avg 33 → diff -2.
    // If placeholders (durationMin 0) leaked into the average it would skew.
    const mixedDays = [
      { dayLabel: '월' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '화' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '수' as const, durationMin: 0, isToday: false, hasData: false },
      { dayLabel: '목' as const, durationMin: 31, isToday: true, hasData: true },
      { dayLabel: '금' as const, durationMin: 33, isToday: false, hasData: true },
    ];
    const { getByTestId } = render(
      <WeeklyTrendChart days={mixedDays} todayIndex={3} />
    );
    expect(getByTestId('weekly-trend-subtitle')).toHaveTextContent('평균 대비 오늘 -2분');
  });
});
