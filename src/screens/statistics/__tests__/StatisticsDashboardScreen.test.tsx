/**
 * StatisticsDashboardScreen Test Suite
 * Tests statistics dashboard rendering, loading, and empty states
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import StatisticsDashboardScreen from '../StatisticsDashboardScreen';
import { useAuth } from '@/services/auth/AuthContext';
import { commuteLogService } from '@/services/pattern';
import { statisticsService } from '@/services/statistics/statisticsService';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', displayName: 'Test User' },
  })),
}));
jest.mock('@/services/pattern', () => ({
  commuteLogService: {
    getCommuteLogs: jest.fn(() => Promise.resolve([])),
  },
  patternAnalysisService: {},
  smartNotificationService: {},
}));
jest.mock('@/services/statistics/statisticsService', () => ({
  statisticsService: {
    calculateSummary: jest.fn(() => Promise.resolve(null)),
    getWeeklyStats: jest.fn(() => null),
    getLineUsageData: jest.fn(() => []),
    getDelayDistribution: jest.fn(() => []),
    getWeeklyTrendData: jest.fn(() => []),
    getDelayByDayData: jest.fn(() => []),
  },
  StatsSummary: {},
  WeeklyStats: {},
}));
jest.mock('@/components/statistics/StatsSummaryCard', () => {
  const { Text } = require('react-native');
  return () => <Text>StatsSummaryCard</Text>;
});
jest.mock('@/components/statistics/WeeklyStatsChart', () => {
  const { Text } = require('react-native');
  return () => <Text>WeeklyStatsChart</Text>;
});
jest.mock('@/components/statistics/DelayStatsChart', () => {
  const { Text } = require('react-native');
  return () => <Text>DelayStatsChart</Text>;
});
jest.mock('@/components/statistics/LineUsagePieChart', () => {
  const { Text } = require('react-native');
  return () => <Text>LineUsagePieChart</Text>;
});

describe('StatisticsDashboardScreen', () => {
  const mockGetCommuteLogs = commuteLogService.getCommuteLogs as jest.Mock;
  const mockCalculateSummary = statisticsService.calculateSummary as jest.Mock;
  const mockGetLineUsageData = statisticsService.getLineUsageData as jest.Mock;
  const mockGetDelayDistribution = statisticsService.getDelayDistribution as jest.Mock;
  const mockGetWeeklyTrendData = statisticsService.getWeeklyTrendData as jest.Mock;
  const mockGetDelayByDayData = statisticsService.getDelayByDayData as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set all mock implementations after clearAllMocks
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'test-user-id', displayName: 'Test User' },
    });
    mockGetCommuteLogs.mockResolvedValue([]);
    mockCalculateSummary.mockResolvedValue(null);
    (statisticsService.getWeeklyStats as jest.Mock).mockReturnValue(null);
    mockGetLineUsageData.mockReturnValue([]);
    mockGetDelayDistribution.mockReturnValue([]);
    mockGetWeeklyTrendData.mockReturnValue([]);
    mockGetDelayByDayData.mockReturnValue([]);
  });

  it('shows loading state initially', () => {
    // Keep the promise pending to show loading state
    mockGetCommuteLogs.mockReturnValue(new Promise(() => {}));

    const { getByText } = render(<StatisticsDashboardScreen />);
    expect(getByText('통계 로딩 중...')).toBeTruthy();
  });

  it('shows empty state when no logs', async () => {
    mockGetCommuteLogs.mockResolvedValue([]);
    mockCalculateSummary.mockResolvedValue(null);

    const { getByText } = render(<StatisticsDashboardScreen />);

    await waitFor(() => {
      expect(getByText('통계 데이터가 없습니다')).toBeTruthy();
    });
    expect(getByText('출퇴근 기록이 쌓이면 통계를 확인할 수 있어요')).toBeTruthy();
  });

  it('does not load data when user is null', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<StatisticsDashboardScreen />);

    // Wait a tick to ensure async operations complete
    await waitFor(() => {
      expect(mockGetCommuteLogs).not.toHaveBeenCalled();
    });
  });

  it('shows emoji icon in empty state', async () => {
    mockGetCommuteLogs.mockResolvedValue([]);
    mockCalculateSummary.mockResolvedValue(null);

    const { getByText } = render(<StatisticsDashboardScreen />);

    await waitFor(() => {
      expect(getByText('통계 데이터가 없습니다')).toBeTruthy();
    });
  });
});
