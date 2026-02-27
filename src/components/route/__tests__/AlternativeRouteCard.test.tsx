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

jest.mock('@/styles/modernTheme', () => ({
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16 },
  RADIUS: { sm: 4, md: 8, lg: 12 },
  TYPOGRAPHY: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: '500', semibold: '600', bold: '700' },
  },
}));

jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: (lineId: string) => (lineId === '2' ? '#00A84D' : '#0052A4'),
}));

jest.mock('@/models/route', () => ({
  formatTimeDifference: (minutes: number) => {
    if (minutes === 0) return '동일';
    if (minutes > 0) return `+${minutes}분`;
    return `${minutes}분`;
  },
  getTimeDifferenceSeverity: (minutes: number) => {
    if (minutes < 0) return 'faster';
    if (minutes === 0) return 'same';
    if (minutes <= 5) return 'slower';
    return 'much_slower';
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlternativeRouteCard } from '../AlternativeRouteCard';
import { AlternativeRoute } from '@/models/route';

const makeRoute = (overrides = {}) => ({
  segments: [
    {
      fromStationId: 'S1',
      fromStationName: '강남',
      toStationId: 'S2',
      toStationName: '역삼',
      lineId: '2',
      lineName: '2호선',
      estimatedMinutes: 5,
      isTransfer: false,
    },
  ],
  totalMinutes: 25,
  transferCount: 0,
  lineIds: ['2'],
  ...overrides,
});

const baseAlternative: AlternativeRoute = {
  id: 'alt-1',
  originalRoute: makeRoute(),
  alternativeRoute: makeRoute({
    totalMinutes: 30,
    lineIds: ['2', '3'],
    segments: [
      {
        fromStationId: 'S1',
        fromStationName: '강남',
        toStationId: 'S3',
        toStationName: '교대',
        lineId: '3',
        lineName: '3호선',
        estimatedMinutes: 10,
        isTransfer: false,
      },
    ],
    transferCount: 1,
  }),
  timeDifference: -5,
  reason: 'DELAY',
  confidence: 80,
  affectedLineId: '2',
  createdAt: new Date('2026-01-01'),
};

describe('AlternativeRouteCard', () => {
  it('renders route reason text for DELAY', () => {
    const { getByText } = render(
      <AlternativeRouteCard alternative={baseAlternative} />,
    );
    expect(getByText('지연 우회')).toBeTruthy();
  });

  it('renders total minutes and transfer count', () => {
    const { getByText } = render(
      <AlternativeRouteCard alternative={baseAlternative} />,
    );
    expect(getByText('30분')).toBeTruthy();
    expect(getByText('환승 1회')).toBeTruthy();
  });

  it('renders recommended badge when isRecommended is true', () => {
    const { getByText } = render(
      <AlternativeRouteCard alternative={baseAlternative} isRecommended />,
    );
    expect(getByText('추천')).toBeTruthy();
  });

  it('calls onPress callback when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <AlternativeRouteCard alternative={baseAlternative} onPress={onPress} />,
    );
    fireEvent.press(getByText('지연 우회'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hides comparison section when showComparison is false', () => {
    const { queryByText } = render(
      <AlternativeRouteCard alternative={baseAlternative} showComparison={false} />,
    );
    expect(queryByText('기존 경로:')).toBeNull();
  });

  it('shows comparison section by default', () => {
    const { getByText } = render(
      <AlternativeRouteCard alternative={baseAlternative} />,
    );
    expect(getByText('기존 경로:')).toBeTruthy();
    expect(getByText('25분')).toBeTruthy();
  });

  it('renders reason text for CONGESTION', () => {
    const congestionAlt: AlternativeRoute = {
      ...baseAlternative,
      reason: 'CONGESTION',
    };
    const { getByText } = render(
      <AlternativeRouteCard alternative={congestionAlt} />,
    );
    expect(getByText('혼잡 우회')).toBeTruthy();
  });

  it('renders reason text for SUSPENSION', () => {
    const suspensionAlt: AlternativeRoute = {
      ...baseAlternative,
      reason: 'SUSPENSION',
    };
    const { getByText } = render(
      <AlternativeRouteCard alternative={suspensionAlt} />,
    );
    expect(getByText('운행 중단 우회')).toBeTruthy();
  });
});
