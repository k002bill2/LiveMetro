/**
 * DelayFeedScreen Test Suite
 * Tests delay feed screen rendering, filtering, and report modal
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { DelayFeedScreen } from '../DelayFeedScreen';
import { delayReportService } from '@/services/delay/delayReportService';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  MessageSquare: 'MessageSquare',
  ThumbsUp: 'ThumbsUp',
  Plus: 'Plus',
  Clock: 'Clock',
  CheckCircle: 'CheckCircle',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
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
  })),
  ThemeColors: {},
}));
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', displayName: 'Test User' },
  })),
}));
jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    getActiveReports: jest.fn(() => Promise.resolve([])),
    subscribeToActiveReports: jest.fn((callback: (reports: unknown[]) => void) => {
      callback([]);
      return jest.fn(); // unsubscribe
    }),
    upvoteReport: jest.fn(() => Promise.resolve()),
    removeUpvote: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(() => '#00A84D'),
}));
jest.mock('@/components/delays/DelayReportForm', () => ({
  DelayReportForm: () => 'DelayReportForm',
}));

describe('DelayFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
      (callback: (reports: unknown[]) => void) => {
        callback([]);
        return jest.fn();
      }
    );
  });

  it('renders header with title', () => {
    const { getByText } = render(<DelayFeedScreen />);
    expect(getByText('실시간 제보')).toBeTruthy();
    expect(getByText('승객들의 실시간 지연 정보')).toBeTruthy();
  });

  it('shows line filter buttons', () => {
    const { getByText } = render(<DelayFeedScreen />);
    expect(getByText('전체')).toBeTruthy();
  });

  it('shows report count bar', () => {
    const { getByText } = render(<DelayFeedScreen />);
    expect(getByText('0개의 활성 제보')).toBeTruthy();
  });

  it('shows empty state when no reports', () => {
    const { getByText } = render(<DelayFeedScreen />);
    expect(getByText('제보가 없습니다')).toBeTruthy();
  });

  it('renders reports when data is available', async () => {
    const mockReports = [
      {
        id: 'report-1',
        lineId: '2',
        stationName: '강남',
        reportType: 'delay',
        severity: 'medium',
        description: '열차 지연 발생',
        timestamp: new Date().toISOString(),
        userId: 'other-user',
        userDisplayName: '승객A',
        upvotes: 3,
        upvotedBy: [],
        verified: false,
        estimatedDelayMinutes: 10,
        status: 'active',
      },
    ];

    (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
      (callback: (reports: typeof mockReports) => void) => {
        callback(mockReports);
        return jest.fn();
      }
    );

    const { getByText } = render(<DelayFeedScreen />);

    await waitFor(() => {
      expect(getByText('강남역')).toBeTruthy();
    });
    expect(getByText('승객A')).toBeTruthy();
    expect(getByText('1개의 활성 제보')).toBeTruthy();
  });

  it('cleans up subscription on unmount', () => {
    const unsubscribe = jest.fn();
    (delayReportService.subscribeToActiveReports as jest.Mock).mockReturnValue(
      unsubscribe
    );

    const { unmount } = render(<DelayFeedScreen />);
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
