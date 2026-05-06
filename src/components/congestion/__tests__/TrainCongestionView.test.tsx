import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TrainCongestionView } from '../TrainCongestionView';
import { TrainCongestionSummary, CongestionLevel } from '@/models/congestion';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
    isDark: false,
  }),
}));

// Phase 51 — legacy modernTheme mock removed (component uses
// WANTED_TOKENS + weightToFontFamily directly).

jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CROWDED: 'crowded',
  },
  getCongestionLevelName: (level: string) => {
    const names: Record<string, string> = {
      low: '여유',
      moderate: '보통',
      high: '혼잡',
      crowded: '매우혼잡',
    };
    return names[level] || level;
  },
  getCongestionLevelColor: (level: string) => {
    const colors: Record<string, string> = {
      low: '#34C759',
      moderate: '#FF9500',
      high: '#FF6B00',
      crowded: '#FF3B30',
    };
    return colors[level] || '#8E8E93';
  },
  MIN_REPORTS_FOR_RELIABILITY: 3,
  createEmptyCarCongestions: () =>
    Array.from({ length: 10 }, (_, i) => ({
      carNumber: i + 1,
      congestionLevel: 'low',
      reportCount: 0,
      lastUpdated: new Date(),
    })),
}));

const makeCongestionSummary = (
  overrides: Partial<TrainCongestionSummary> = {},
): TrainCongestionSummary => ({
  id: 'cs-1',
  trainId: 'T001',
  lineId: '2',
  direction: 'up',
  cars: Array.from({ length: 10 }, (_, i) => ({
    carNumber: i + 1,
    congestionLevel: CongestionLevel.MODERATE,
    reportCount: 5,
    lastUpdated: new Date(),
  })),
  overallLevel: CongestionLevel.MODERATE,
  reportCount: 50,
  lastUpdated: new Date(),
  ...overrides,
});

describe('TrainCongestionView', () => {
  it('renders header text', () => {
    const { getByText } = render(
      <TrainCongestionView congestion={null} />,
    );
    expect(getByText('칸별 혼잡도')).toBeTruthy();
  });

  it('shows no data message when congestion is null', () => {
    const { getByText } = render(
      <TrainCongestionView congestion={null} />,
    );
    expect(getByText('아직 제보된 혼잡도 정보가 없습니다')).toBeTruthy();
  });

  it('renders car numbers when congestion data is provided', () => {
    const summary = makeCongestionSummary();
    const { getAllByText } = render(
      <TrainCongestionView congestion={summary} />,
    );
    // Car numbers 1-10 appear as text; some may appear multiple times (car number + report count)
    expect(getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('10').length).toBeGreaterThanOrEqual(1);
  });

  it('shows report count + long-press hint when data exists', () => {
    const summary = makeCongestionSummary({ reportCount: 42 });
    const { getByText } = render(
      <TrainCongestionView congestion={summary} />,
    );
    // Phase 53: report count line now includes the long-press affordance
    // hint so users discover the tooltip surface.
    expect(getByText('42건의 제보 기반 · 칸 길게 눌러 상세 보기')).toBeTruthy();
  });

  it('shows overall level badge when data exists', () => {
    const summary = makeCongestionSummary();
    const { getAllByText } = render(
      <TrainCongestionView congestion={summary} />,
    );
    // '보통' appears in badge and legend
    expect(getAllByText('보통').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onCarPress with car number when car is pressed', () => {
    const onCarPress = jest.fn();
    // Use report count 3 so it doesn't collide with car number 10
    const summary = makeCongestionSummary({
      cars: Array.from({ length: 10 }, (_, i) => ({
        carNumber: i + 1,
        congestionLevel: CongestionLevel.MODERATE,
        reportCount: 3,
        lastUpdated: new Date(),
      })),
    });
    const { getByText } = render(
      <TrainCongestionView congestion={summary} onCarPress={onCarPress} />,
    );
    // '10' only appears as car number 10 (not as report count)
    fireEvent.press(getByText('10'));
    expect(onCarPress).toHaveBeenCalledWith(10);
  });

  it('hides legend when showLegend is false', () => {
    const { queryByText } = render(
      <TrainCongestionView congestion={null} showLegend={false} />,
    );
    expect(queryByText('여유')).toBeNull();
  });

  it('shows legend by default', () => {
    const { getByText } = render(
      <TrainCongestionView congestion={null} />,
    );
    expect(getByText('여유')).toBeTruthy();
    expect(getByText('매우혼잡')).toBeTruthy();
  });
});
