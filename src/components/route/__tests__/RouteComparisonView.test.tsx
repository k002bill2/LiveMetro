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
  getLineName: (lineId: string) => `${lineId}호선`,
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import { RouteComparisonView } from '../RouteComparisonView';
import { Route } from '@/models/route';

const makeSegment = (overrides = {}) => ({
  fromStationId: 'S1',
  fromStationName: '강남',
  toStationId: 'S2',
  toStationName: '역삼',
  lineId: '2',
  lineName: '2호선',
  estimatedMinutes: 10,
  isTransfer: false,
  ...overrides,
});

const originalRoute: Route = {
  segments: [makeSegment()],
  totalMinutes: 25,
  transferCount: 0,
  lineIds: ['2'],
};

const alternativeRoute: Route = {
  segments: [
    makeSegment({
      lineId: '3',
      lineName: '3호선',
      fromStationName: '강남',
      toStationName: '교대',
    }),
    makeSegment({
      lineId: '3',
      lineName: '3호선',
      fromStationId: 'S2',
      fromStationName: '교대',
      toStationId: 'S3',
      toStationName: '남부터미널',
      isTransfer: true,
      estimatedMinutes: 3,
    }),
  ],
  totalMinutes: 30,
  transferCount: 1,
  lineIds: ['3'],
};

describe('RouteComparisonView', () => {
  it('renders summary labels for both routes', () => {
    const { getByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={alternativeRoute}
      />,
    );
    expect(getByText('기존 경로')).toBeTruthy();
    expect(getByText('대체 경로')).toBeTruthy();
  });

  it('displays time and transfer counts for both routes', () => {
    const { getByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={alternativeRoute}
      />,
    );
    expect(getByText('25분')).toBeTruthy();
    expect(getByText('30분')).toBeTruthy();
    expect(getByText('환승 0회')).toBeTruthy();
    expect(getByText('환승 1회')).toBeTruthy();
  });

  it('shows time difference text when alternative is slower', () => {
    const { getByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={alternativeRoute}
      />,
    );
    expect(getByText('5분 더 소요')).toBeTruthy();
  });

  it('shows time savings when alternative is faster', () => {
    const fasterRoute: Route = {
      ...alternativeRoute,
      totalMinutes: 20,
    };
    const { getByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={fasterRoute}
      />,
    );
    expect(getByText('5분 단축')).toBeTruthy();
  });

  it('shows equal time text when routes take same time', () => {
    const sameRoute: Route = {
      ...alternativeRoute,
      totalMinutes: 25,
    };
    const { getByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={sameRoute}
      />,
    );
    expect(getByText('동일한 소요 시간')).toBeTruthy();
  });

  it('renders alternative route detail section', () => {
    const { getByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={alternativeRoute}
      />,
    );
    expect(getByText('대체 경로 상세')).toBeTruthy();
  });

  it('renders line name chips in summaries', () => {
    const { getAllByText } = render(
      <RouteComparisonView
        originalRoute={originalRoute}
        alternativeRoute={alternativeRoute}
      />,
    );
    expect(getAllByText('2호선').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('3호선').length).toBeGreaterThanOrEqual(1);
  });
});
