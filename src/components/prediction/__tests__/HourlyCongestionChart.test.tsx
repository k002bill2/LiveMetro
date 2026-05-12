import React from 'react';
import { render } from '@testing-library/react-native';
import { HourlyCongestionChart } from '@/components/prediction/HourlyCongestionChart';
import type { HourlySlot } from '@/services/congestion/congestionService';
import { CongestionLevel } from '@/models/train';

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

// CongestionLevel enum values are 'low' | 'moderate' | 'high' | 'crowded'
// (verified from src/models/train.ts). The plan's draft mistakenly used
// 'very-high'; we adapt to the actual enum.
const mockSlots: readonly HourlySlot[] = [
  { slotTime: '08:00', congestionPercent: 75, level: CongestionLevel.HIGH },
  { slotTime: '08:15', congestionPercent: 88, level: CongestionLevel.CROWDED },
  { slotTime: '08:30', congestionPercent: 100, level: CongestionLevel.CROWDED },
  { slotTime: '08:45', congestionPercent: 84, level: CongestionLevel.HIGH },
  { slotTime: '09:00', congestionPercent: 70, level: CongestionLevel.HIGH },
  { slotTime: '09:15', congestionPercent: 55, level: CongestionLevel.MODERATE },
  { slotTime: '09:30', congestionPercent: 42, level: CongestionLevel.LOW },
];

describe('HourlyCongestionChart', () => {
  it('renders 7 bars', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByTestId } = render(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={mockSlots} />
    );
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`hourly-bar-${i}`)).toBeTruthy();
    }
  });

  it('marks the slot matching currentTime as current', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByTestId } = render(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={mockSlots} />
    );
    expect(getByTestId('hourly-current-marker')).toBeTruthy();
  });

  it('shows legend with 4 levels', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByText } = render(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={mockSlots} />
    );
    expect(getByText('여유')).toBeTruthy();
    expect(getByText('보통')).toBeTruthy();
    expect(getByText('혼잡')).toBeTruthy();
    expect(getByText('매우혼잡')).toBeTruthy();
  });

  it('renders empty state when slots is empty', () => {
    const now = new Date('2026-05-12T08:30:00+09:00');
    const { getByText } = render(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={now} slots={[]} />
    );
    expect(getByText('예측 데이터 없음')).toBeTruthy();
  });

  it('does not show current marker when currentTime is outside slot range', () => {
    const farFuture = new Date('2026-05-12T15:00:00+09:00');
    const { queryByTestId } = render(
      <HourlyCongestionChart lineId="2" direction="잠실" currentTime={farFuture} slots={mockSlots} />
    );
    expect(queryByTestId('hourly-current-marker')).toBeNull();
  });
});
