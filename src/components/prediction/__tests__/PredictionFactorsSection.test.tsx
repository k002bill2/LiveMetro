import React from 'react';
import { render } from '@testing-library/react-native';
import { CloudRain, Users, Check, Calendar } from 'lucide-react-native';
import { PredictionFactorsSection } from '@/components/prediction/PredictionFactorsSection';
import type { PredictionFactor } from '@/hooks/usePredictionFactors';

// RNTL v13 auto-extends expect with toHaveTextContent at runtime, but the
// public types only export the matcher interface as `export type *`. Re-declare
// the single matcher we use so TypeScript matches the runtime contract.
declare module 'expect' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void>, T = unknown> {
    toHaveTextContent(expectedText: string | RegExp, options?: { exact?: boolean }): R;
  }
}

// Lucide icons → string-stub Proxy (matches SegmentBreakdownSection.test.tsx).
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

// useTheme — flat contract per src/services/theme/themeContext.tsx.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

const mockFactors: readonly PredictionFactor[] = [
  { id: 'weather', icon: CloudRain, label: '비 예보', value: '+2분', impact: 'negative' },
  { id: 'congestion', icon: Users, label: '평균 혼잡도', value: '평소보다 8% ↑', impact: 'negative' },
  { id: 'delay', icon: Check, label: '지연 없음', value: '정시 운행', impact: 'positive' },
  { id: 'pattern', icon: Calendar, label: '수요일 패턴', value: '평소 28분', impact: 'neutral' },
];

describe('PredictionFactorsSection', () => {
  it('renders all 4 factor rows', () => {
    const { getByTestId } = render(<PredictionFactorsSection factors={mockFactors} />);
    expect(getByTestId('factor-row-weather')).toBeTruthy();
    expect(getByTestId('factor-row-congestion')).toBeTruthy();
    expect(getByTestId('factor-row-delay')).toBeTruthy();
    expect(getByTestId('factor-row-pattern')).toBeTruthy();
  });

  it('displays label and value for each factor', () => {
    const { getByTestId } = render(<PredictionFactorsSection factors={mockFactors} />);
    expect(getByTestId('factor-row-weather')).toHaveTextContent(/비 예보/);
    expect(getByTestId('factor-row-weather')).toHaveTextContent(/\+2분/);
    expect(getByTestId('factor-row-delay')).toHaveTextContent(/정시 운행/);
  });

  it('renders empty when factors is empty', () => {
    const { queryByTestId } = render(<PredictionFactorsSection factors={[]} />);
    expect(queryByTestId('factor-row-weather')).toBeNull();
    expect(queryByTestId('factor-row-pattern')).toBeNull();
  });

  it('renders without crashing with all-positive factors', () => {
    const positive: readonly PredictionFactor[] = mockFactors.map(f => ({
      ...f,
      impact: 'positive' as const,
    }));
    const { getByTestId } = render(<PredictionFactorsSection factors={positive} />);
    expect(getByTestId('factor-row-weather')).toBeTruthy();
  });
});
