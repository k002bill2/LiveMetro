import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteInsightCard, PatternSummaryCard } from '../CommuteInsightCard';
import { PredictedCommute, CommutePattern } from '@/models/pattern';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_, name) => name }));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      primaryLight: '#E3F2FD',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      errorLight: '#FFEBEE',
      success: '#34C759',
      successLight: '#E8F5E9',
      warning: '#FF9500',
      warningLight: '#FFF3E0',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
    isDark: false,
  }),
}));

jest.mock('@/styles/modernTheme', () => ({
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16 },
  RADIUS: { sm: 4, md: 8, lg: 12 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
  },
}));

jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: () => '#00A84D',
}));

jest.mock('@/models/pattern', () => ({
  DAY_NAMES_SHORT_KO: {
    0: '일',
    1: '월',
    2: '화',
    3: '수',
    4: '목',
    5: '금',
    6: '토',
  },
}));

const baseRoute = {
  departureStationId: 'S1',
  departureStationName: '강남',
  arrivalStationId: 'S2',
  arrivalStationName: '역삼',
  lineIds: ['2'],
};

const basePrediction: PredictedCommute = {
  date: '2026-02-27',
  dayOfWeek: 4,
  predictedDepartureTime: '08:30',
  route: baseRoute,
  confidence: 0.85,
  suggestedAlertTime: '08:15',
};

const basePattern: CommutePattern = {
  userId: 'u1',
  dayOfWeek: 1,
  avgDepartureTime: '08:30',
  stdDevMinutes: 5,
  frequentRoute: baseRoute,
  confidence: 0.8,
  sampleCount: 20,
  lastUpdated: new Date(),
};

describe('CommuteInsightCard', () => {
  it('renders empty state when no prediction and no pattern', () => {
    const { getByText } = render(<CommuteInsightCard />);
    expect(getByText(/출퇴근 패턴을 분석하려면/)).toBeTruthy();
  });

  it('renders prediction with departure time and route', () => {
    const { getByText } = render(
      <CommuteInsightCard prediction={basePrediction} />,
    );
    expect(getByText('오늘의 출근 예측')).toBeTruthy();
    expect(getByText('강남')).toBeTruthy();
    expect(getByText('역삼')).toBeTruthy();
    expect(getByText('예상 출발: 08:30')).toBeTruthy();
  });

  it('renders confidence badge', () => {
    const { getByText } = render(
      <CommuteInsightCard prediction={basePrediction} />,
    );
    expect(getByText('85% 신뢰도')).toBeTruthy();
  });

  it('renders suggested alert time', () => {
    const { getByText } = render(
      <CommuteInsightCard prediction={basePrediction} />,
    );
    expect(getByText('08:15에 알림을 받으세요')).toBeTruthy();
  });

  it('renders delay alert when hasDelays and affectedLines', () => {
    const { getByText } = render(
      <CommuteInsightCard
        prediction={basePrediction}
        hasDelays
        affectedLines={['2', '3']}
      />,
    );
    expect(getByText('2호선, 3호선 지연 발생')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <CommuteInsightCard prediction={basePrediction} onPress={onPress} />,
    );
    fireEvent.press(getByText('오늘의 출근 예측'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders line chips for route', () => {
    const { getByText } = render(
      <CommuteInsightCard prediction={basePrediction} />,
    );
    expect(getByText('2호선')).toBeTruthy();
  });
});

describe('PatternSummaryCard', () => {
  it('returns null when patterns array is empty', () => {
    const { toJSON } = render(<PatternSummaryCard patterns={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders weekday pattern grid', () => {
    const patterns: CommutePattern[] = [
      { ...basePattern, dayOfWeek: 1, avgDepartureTime: '08:30' },
      { ...basePattern, dayOfWeek: 3, avgDepartureTime: '09:00' },
    ];
    const { getByText } = render(
      <PatternSummaryCard patterns={patterns} />,
    );
    expect(getByText('주간 출퇴근 패턴')).toBeTruthy();
    expect(getByText('월')).toBeTruthy();
    expect(getByText('수')).toBeTruthy();
    expect(getByText('08:30')).toBeTruthy();
    expect(getByText('09:00')).toBeTruthy();
  });

  it('shows average confidence and pattern count', () => {
    const patterns: CommutePattern[] = [
      { ...basePattern, dayOfWeek: 1, confidence: 0.8 },
      { ...basePattern, dayOfWeek: 2, confidence: 0.6 },
    ];
    const { getByText } = render(
      <PatternSummaryCard patterns={patterns} />,
    );
    expect(getByText('평균 신뢰도: 70% • 2일 패턴')).toBeTruthy();
  });
});
