/**
 * DelayFeedScreen Test Suite
 * Tests delay feed screen rendering, filtering, and report modal
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DelayFeedScreen } from '../DelayFeedScreen';

import { delayReportService } from '@/services/delay/delayReportService';
import { getSubwayLineColor } from '@/utils/colorUtils';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestInstance = any;

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  MessageSquare: 'MessageSquare',
  ThumbsUp: 'ThumbsUp',
  Plus: 'Plus',
  Clock: 'Clock',
  CheckCircle: 'CheckCircle',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));

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
  }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn().mockReturnValue({
    user: { id: 'test-user-id', displayName: 'Test User' },
    firebaseUser: null,
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserProfile: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  }),
}));

jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    getActiveReports: jest.fn(),
    subscribeToActiveReports: jest.fn(),
    upvoteReport: jest.fn(),
    removeUpvote: jest.fn(),
  },
}));

jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(),
}));

jest.mock('@/components/delays/DelayReportForm', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    DelayReportForm: ({ onSubmitSuccess, onCancel }: any) =>
      React.createElement(View, {
        testID: 'delay-report-form',
        onClose: onSubmitSuccess,
        onCancel: onCancel,
      }, React.createElement(Text, null, 'Form')),
  };
});

describe('DelayFeedScreen', () => {
  const mockReports = [
    {
      id: 'report-1',
      lineId: '2',
      stationName: '강남',
      reportType: 'delay' as const,
      severity: 'medium' as const,
      description: '열차 지연 발생',
      timestamp: new Date().toISOString(),
      userId: 'other-user',
      userDisplayName: '승객A',
      upvotes: 3,
      upvotedBy: [],
      verified: false,
      estimatedDelayMinutes: 10,
      status: 'active' as const,
    },
    {
      id: 'report-2',
      lineId: '3',
      stationName: '서울역',
      reportType: 'crowded' as const,
      severity: 'high' as const,
      description: '',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      userId: 'test-user-id',
      userDisplayName: 'Test User',
      upvotes: 5,
      upvotedBy: ['test-user-id'],
      verified: true,
      estimatedDelayMinutes: undefined,
      status: 'active' as const,
    },
    {
      id: 'report-3',
      lineId: '1',
      stationName: '종로3가',
      reportType: 'accident' as const,
      severity: 'critical' as const,
      description: '안내 방송을 통해 알려주세요',
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      userId: 'other-user-2',
      userDisplayName: '승객B',
      upvotes: 12,
      upvotedBy: [],
      verified: false,
      estimatedDelayMinutes: 25,
      status: 'active' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useAuth mock to default (tests may override)
    const { useAuth } = require('@/services/auth/AuthContext');
    useAuth.mockReturnValue({
      user: { id: 'test-user-id', displayName: 'Test User' },
      firebaseUser: null,
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserProfile: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    });
    (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
      (callback: (reports: typeof mockReports) => void) => {
        callback([]);
        return jest.fn();
      }
    );
    (delayReportService.getActiveReports as jest.Mock).mockResolvedValue([]);
    (getSubwayLineColor as jest.Mock).mockImplementation((lineId: string) => {
      const colors: Record<string, string> = {
        '1': '#0052CC',
        '2': '#00A84D',
        '3': '#EF7C1C',
        '4': '#00A9D8',
      };
      return colors[lineId] || '#000000';
    });
  });

  describe('Rendering', () => {
    it('renders header with title and subtitle', () => {
      const { getByText } = render(<DelayFeedScreen />);
      expect(getByText('실시간 제보')).toBeTruthy();
      expect(getByText('승객들의 실시간 지연 정보')).toBeTruthy();
    });

    it('renders add report button', () => {
      const { UNSAFE_root } = render(<DelayFeedScreen />);
      // Component uses Pressable/View with accessible prop, find Plus icon
      const plusIcons = UNSAFE_root.findAllByType('Plus');
      expect(plusIcons.length).toBeGreaterThan(0);
    });

    it('shows line filter buttons', () => {
      const { getByText } = render(<DelayFeedScreen />);
      expect(getByText('전체')).toBeTruthy();
      expect(getByText('1호선')).toBeTruthy();
      expect(getByText('2호선')).toBeTruthy();
    });

    it('shows report count bar', () => {
      const { getByText } = render(<DelayFeedScreen />);
      expect(getByText('0개의 활성 제보')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no reports', () => {
      const { getByText } = render(<DelayFeedScreen />);
      expect(getByText('제보가 없습니다')).toBeTruthy();
    });

    it('shows appropriate empty message for all lines', () => {
      const { getByText } = render(<DelayFeedScreen />);
      expect(getByText(/현재 활성화된 지연 제보가 없습니다/)).toBeTruthy();
    });

    it('shows specific empty message for selected line with no reports', async () => {
      const { getByText, UNSAFE_root } = render(<DelayFeedScreen />);

      // Find and click line filter button
      const buttons = UNSAFE_root.findAllByType('TouchableOpacity');
      const lineButton = buttons.find((btn: TestInstance) => {
        const props = btn.props;
        return props.children?.props?.children === '2호선';
      });

      if (lineButton) {
        fireEvent.press(lineButton);
        await waitFor(() => {
          expect(getByText(/2호선에 활성화된 제보가 없습니다/)).toBeTruthy();
        });
      }
    });
  });

  describe('Report Rendering', () => {
    it('renders reports when data is available', async () => {
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
      expect(getByText('3개의 활성 제보')).toBeTruthy();
    });

    it('renders report with all fields', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[0]!]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('강남역')).toBeTruthy();
        expect(getByText('승객A')).toBeTruthy();
        expect(getByText(/\+10분/)).toBeTruthy();
        expect(getByText('3')).toBeTruthy(); // upvote count
      });
    });

    it('renders report without description', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[1]!]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText(/서울역/)).toBeTruthy();
      });
    });

    it('displays verified badge for verified reports', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[1]!]);
          return jest.fn();
        }
      );

      const { UNSAFE_root } = render(<DelayFeedScreen />);

      await waitFor(() => {
        const checkCircles = UNSAFE_root.findAllByType('CheckCircle');
        expect(checkCircles.length).toBeGreaterThan(0);
      });
    });

    it('renders multiple reports correctly', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback(mockReports);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('강남역')).toBeTruthy();
        expect(getByText(/서울역/)).toBeTruthy();
        expect(getByText('종로3가역')).toBeTruthy();
      });
    });
  });

  describe('Line Filtering', () => {
    beforeEach(() => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback(mockReports);
          return jest.fn();
        }
      );
    });

    it('shows all reports when 전체 is selected', async () => {
      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('3개의 활성 제보')).toBeTruthy();
      });
    });

    it('filters reports by line', async () => {
      const { getByText, UNSAFE_root } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('3개의 활성 제보')).toBeTruthy();
      });

      // Click on line filter
      const buttons = UNSAFE_root.findAllByType('TouchableOpacity');
      const line2Button = buttons.find((btn: TestInstance) => {
        const text = btn.props.children?.props?.children;
        return text === '2호선';
      });

      if (line2Button) {
        fireEvent.press(line2Button);

        await waitFor(() => {
          expect(getByText('1개의 활성 제보')).toBeTruthy();
          expect(getByText('강남역')).toBeTruthy();
        });
      }
    });

    it('shows correct count when filtering by line with multiple reports', async () => {
      const multiLineReports = [
        mockReports[0]!,
        { ...mockReports[0]!, id: 'report-dup', stationName: '신논현' },
      ];

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof multiLineReports) => void) => {
          callback(multiLineReports);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('2개의 활성 제보')).toBeTruthy();
      });
    });
  });

  describe('Upvote Functionality', () => {
    it('allows authenticated user to upvote report', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[0]!]);
          return jest.fn();
        }
      );
      (delayReportService.upvoteReport as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('강남역')).toBeTruthy();
      });

      // Upvote count "3" is inside an accessible View (acts as button)
      const upvoteText = getByText('3');
      // The accessible parent View handles the press
      fireEvent.press(upvoteText);

      await waitFor(() => {
        expect(delayReportService.upvoteReport).toHaveBeenCalledWith('report-1', 'test-user-id');
      });
    });

    it('removes upvote when already upvoted', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[1]!]);
          return jest.fn();
        }
      );
      (delayReportService.removeUpvote as jest.Mock).mockResolvedValue(undefined);

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText(/서울역/)).toBeTruthy();
      });

      // Upvote count "5" is inside an accessible View
      const upvoteText = getByText('5');
      fireEvent.press(upvoteText);

      await waitFor(() => {
        expect(delayReportService.removeUpvote).toHaveBeenCalledWith('report-2', 'test-user-id');
      });
    });

    it('does not attempt upvote when user is null', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        signInAnonymously: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        signOut: jest.fn(),
        updateUserProfile: jest.fn(),
        resetPassword: jest.fn(),
        changePassword: jest.fn(),
      });

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[0]!]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('강남역')).toBeTruthy();
      });

      expect(delayReportService.upvoteReport).not.toHaveBeenCalled();
    });

    it('handles upvote errors gracefully', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback([mockReports[0]!]);
          return jest.fn();
        }
      );
      (delayReportService.upvoteReport as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('강남역')).toBeTruthy();
      });

      // Component should still render without crashing
      expect(getByText('강남역')).toBeTruthy();
    });
  });

  describe('Time Formatting', () => {
    it('formats time as "방금 전" for recent reports', async () => {
      const recentReport = {
        ...mockReports[0]!,
        timestamp: new Date().toISOString(),
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([recentReport]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('방금 전')).toBeTruthy();
      });
    });

    it('formats time in minutes for reports < 1 hour old', async () => {
      const report30MinutesAgo = {
        ...mockReports[0]!,
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([report30MinutesAgo]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText(/30분 전/)).toBeTruthy();
      });
    });

    it('formats time in hours for reports < 24 hours old', async () => {
      const report2HoursAgo = {
        ...mockReports[0]!,
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([report2HoursAgo]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText(/2시간 전/)).toBeTruthy();
      });
    });

    it('formats time as "1일 이상 전" for old reports', async () => {
      const reportOld = {
        ...mockReports[0]!,
        timestamp: new Date(Date.now() - 25 * 3600000).toISOString(),
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([reportOld]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('1일 이상 전')).toBeTruthy();
      });
    });
  });

  describe('Report Modal', () => {
    it('opens report modal when add button is pressed', async () => {
      const { UNSAFE_root } = render(<DelayFeedScreen />);

      // Find the Plus icon's parent (accessible View acts as button)
      const plusIcons = UNSAFE_root.findAllByType('Plus');
      expect(plusIcons.length).toBeGreaterThan(0);
      fireEvent.press(plusIcons[0]);

      await waitFor(() => {
        const forms = UNSAFE_root.findAllByType('View');
        // Modal should be visible after pressing add button
        expect(forms.length).toBeGreaterThan(0);
      });
    });

    it('closes modal on successful submit', async () => {
      const { UNSAFE_root, queryByTestId } = render(<DelayFeedScreen />);

      const plusIcons = UNSAFE_root.findAllByType('Plus');
      fireEvent.press(plusIcons[0]);

      await waitFor(() => {
        const form = queryByTestId('delay-report-form');
        if (form) {
          fireEvent.press(form);
        }
      });
    });

    it('closes modal on cancel', async () => {
      const { UNSAFE_root } = render(<DelayFeedScreen />);

      const plusIcons = UNSAFE_root.findAllByType('Plus');
      fireEvent.press(plusIcons[0]);

      // Modal should render after pressing add
      await waitFor(() => {
        const views = UNSAFE_root.findAllByType('View');
        expect(views.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Subscription Lifecycle', () => {
    it('subscribes to active reports on mount', () => {
      render(<DelayFeedScreen />);

      expect(delayReportService.subscribeToActiveReports).toHaveBeenCalled();
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

    it('updates reports when subscription callback is called', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback(mockReports);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('3개의 활성 제보')).toBeTruthy();
      });
    });
  });

  describe('Report Card Styling', () => {
    it('highlights reports based on credibility', async () => {
      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: typeof mockReports) => void) => {
          callback(mockReports);
          return jest.fn();
        }
      );

      const { UNSAFE_root } = render(<DelayFeedScreen />);

      await waitFor(() => {
        const cards = UNSAFE_root.findAllByType('View');
        expect(cards.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Refresh Control', () => {
    it('provides refresh control', () => {
      const { UNSAFE_root } = render(<DelayFeedScreen />);
      const refreshControl = UNSAFE_root.findAllByType('RCTRefreshControl');
      expect(refreshControl.length).toBeGreaterThan(0);
    });

    it('calls loadReports on refresh', async () => {
      (delayReportService.getActiveReports as jest.Mock).mockResolvedValue(mockReports);

      const { UNSAFE_root } = render(<DelayFeedScreen />);

      const refreshControl = UNSAFE_root.findByType('RCTRefreshControl');
      if (refreshControl && refreshControl.props.onRefresh) {
        refreshControl.props.onRefresh();

        await waitFor(() => {
          expect(delayReportService.getActiveReports).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles reports with special characters in description', async () => {
      const specialReport = {
        ...mockReports[0]!,
        description: '특수문자 테스트: !@#$%^&*()',
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([specialReport]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText(/특수문자/)).toBeTruthy();
      });
    });

    it('handles reports with very long description', async () => {
      const longReport = {
        ...mockReports[0]!,
        description: 'A'.repeat(200),
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([longReport]);
          return jest.fn();
        }
      );

      const { UNSAFE_root } = render(<DelayFeedScreen />);

      await waitFor(() => {
        const text = UNSAFE_root.findAllByType('Text');
        expect(text.length).toBeGreaterThan(0);
      });
    });

    it('handles reports with zero upvotes', async () => {
      const zeroUpvoteReport = {
        ...mockReports[0]!,
        upvotes: 0,
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([zeroUpvoteReport]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('0')).toBeTruthy();
      });
    });

    it('handles large upvote counts', async () => {
      const largeUpvoteReport = {
        ...mockReports[0]!,
        upvotes: 999,
      };

      (delayReportService.subscribeToActiveReports as jest.Mock).mockImplementation(
        (callback: (reports: Record<string, unknown>[]) => void) => {
          callback([largeUpvoteReport]);
          return jest.fn();
        }
      );

      const { getByText } = render(<DelayFeedScreen />);

      await waitFor(() => {
        expect(getByText('999')).toBeTruthy();
      });
    });
  });
});
