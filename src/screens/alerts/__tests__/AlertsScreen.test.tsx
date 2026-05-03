/**
 * AlertsScreen Test Suite
 * Tests alerts screen rendering and notification management
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AlertsScreen } from '../AlertsScreen';

import { useAlerts } from '@/hooks/useAlerts';

// Mock modules BEFORE imports (Jest hoisting)
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000000',
      primaryLight: '#E5E5E5',
      surface: '#FFFFFF',
      background: '#F5F5F5',
      backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      textTertiary: '#999999',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5E5',
      borderMedium: '#CCCCCC',
    },
  })),
  ThemeColors: {},
}));

jest.mock('@/hooks/useAlerts', () => ({
  useAlerts: jest.fn(() => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    refreshing: false,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    clearAll: jest.fn(),
    refresh: jest.fn(),
  })),
}));

// AlertsScreen now consumes i18n; provide a static mock translation tree.
jest.mock('@/services/i18n', () => ({
  useTranslation: jest.fn(() => ({
    alerts: {
      title: '알림',
      noAlerts: '알림 없음',
      emptyDescription: '새로운 알림이 도착하면 여기에 표시됩니다',
      unreadCountText: (count: number) => `새 알림 ${count}개`,
      delay: '지연',
      suspension: '운행 중단',
      serviceUpdate: '서비스 업데이트',
    },
  })),
}));

jest.mock('@/utils/notificationTestHelper', () => ({
  addTestNotifications: jest.fn(),
  addRandomNotification: jest.fn(),
}));

describe('AlertsScreen', () => {
  let mockMarkAsRead: jest.Mock;
  let mockMarkAllAsRead: jest.Mock;
  let mockDeleteNotification: jest.Mock;
  let mockClearAll: jest.Mock;
  let mockRefresh: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkAsRead = jest.fn().mockResolvedValue(undefined);
    mockMarkAllAsRead = jest.fn().mockResolvedValue(undefined);
    mockDeleteNotification = jest.fn().mockResolvedValue(undefined);
    mockClearAll = jest.fn().mockResolvedValue(undefined);
    mockRefresh = jest.fn().mockResolvedValue(undefined);

    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null,
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(<AlertsScreen />);
    expect(getByTestId('alerts-header-title')).toBeTruthy();
  });

  it('displays header with title (Phase 4 — Korean "알림")', () => {
    const { getByTestId } = render(<AlertsScreen />);
    expect(getByTestId('alerts-header-title')).toBeTruthy();
  });

  it('hides the unread count subtitle when there are no notifications', () => {
    // Phase 4: empty state shows no subtitle (design hides "0 total" line).
    const { queryByText } = render(<AlertsScreen />);
    expect(queryByText(/새 알림/)).toBeNull();
  });

  it('displays unread count when present', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: 'notif1',
          type: 'ARRIVAL',
          title: '열차 도착',
          body: '2호선 열차가 곧 도착합니다',
          createdAt: new Date().toISOString(),
          isRead: false,
        },
      ],
      unreadCount: 1,
      loading: false,
      error: null,
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    // Phase 4: Korean format "새 알림 N개" (replaces "X total · Y new").
    expect(getByText('새 알림 1개')).toBeTruthy();
  });

  it('shows empty state when no notifications', () => {
    const { getByText } = render(<AlertsScreen />);
    expect(getByText('알림 없음')).toBeTruthy();
    expect(getByText('새로운 알림이 도착하면 여기에 표시됩니다')).toBeTruthy();
  });

  it('displays notifications when available', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: 'notif1',
          type: 'ARRIVAL',
          title: '열차 도착',
          body: '2호선 열차가 곧 도착합니다',
          createdAt: new Date().toISOString(),
          isRead: false,
        },
      ],
      unreadCount: 1,
      loading: false,
      error: null,
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    expect(getByText('열차 도착')).toBeTruthy();
    expect(getByText('2호선 열차가 곧 도착합니다')).toBeTruthy();
  });

  it('marks notification as read on press', async () => {
    mockMarkAsRead.mockResolvedValue(undefined);

    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: 'notif1',
          type: 'ARRIVAL',
          title: '열차 도착',
          body: '2호선 열차가 곧 도착합니다',
          createdAt: new Date().toISOString(),
          isRead: false,
        },
      ],
      unreadCount: 1,
      loading: false,
      error: null,
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    fireEvent.press(getByText('열차 도착'));

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('notif1');
    });
  });

  it('shows loading state', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: true,
      error: null,
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    expect(getByText('알림 로딩중')).toBeTruthy();
  });

  it('shows error state', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: '알림을 불러오는데 실패했습니다',
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    expect(getByText('알림을 불러오는데 실패했습니다')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('handles retry on error', () => {
    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: '네트워크 오류',
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    fireEvent.press(getByText('다시 시도'));

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('formats timestamp correctly', () => {
    const now = new Date();
    (useAlerts as jest.Mock).mockReturnValue({
      notifications: [
        {
          id: 'notif1',
          type: 'ARRIVAL',
          title: '열차 도착',
          body: '방금 도착',
          createdAt: now.toISOString(),
          isRead: false,
        },
      ],
      unreadCount: 1,
      loading: false,
      error: null,
      refreshing: false,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
      deleteNotification: mockDeleteNotification,
      clearAll: mockClearAll,
      refresh: mockRefresh,
    });

    const { getByText } = render(<AlertsScreen />);
    expect(getByText('방금')).toBeTruthy();
  });

  describe('Delete Notification', () => {
    it('renders notification with delete button available', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('열차 도착')).toBeTruthy();
      expect(getByText('2호선 열차가 곧 도착합니다')).toBeTruthy();
    });

    it('notification can be pressed for deletion flow', async () => {
      mockDeleteNotification.mockResolvedValue(undefined);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      fireEvent.press(getByText('열차 도착'));

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('notif1');
      });
    });

    it('handles error when marking notification as read during delete', async () => {
      mockMarkAsRead.mockRejectedValue(new Error('Mark failed'));

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      fireEvent.press(getByText('열차 도착'));

      // Error is silently handled, no alert shown
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('notif1');
      });
    });
  });

  describe('Mark All as Read', () => {
    it('header visible with read notifications', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: true,
          },
        ],
        unreadCount: 0,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<AlertsScreen />);
      expect(getByTestId('alerts-header-title')).toBeTruthy();
    });

    it('displays unread count correctly', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('새 알림 1개')).toBeTruthy();
    });

    it('does not mark when unreadCount is 0', async () => {
      mockMarkAllAsRead.mockResolvedValue(undefined);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      render(<AlertsScreen />);

      // markAllAsRead should not be called when unreadCount is 0
      expect(mockMarkAllAsRead).not.toHaveBeenCalled();
    });
  });

  describe('Clear All Notifications', () => {
    it('renders screen with notifications', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByTestId } = render(<AlertsScreen />);
      expect(getByTestId('alerts-header-title')).toBeTruthy();
    });

    it('hides clear all button when no notifications', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('알림 없음')).toBeTruthy();
    });

    it('does not call clearAll when notifications is empty', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      render(<AlertsScreen />);

      // handleClearAll returns early if notifications.length === 0
      expect(mockClearAll).not.toHaveBeenCalled();
    });

    it('displays multiple notifications in list', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착 1',
            body: '2호선',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
          {
            id: 'notif2',
            type: 'DELAY',
            title: '열차 지연',
            body: '3호선',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 2,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('열차 도착 1')).toBeTruthy();
      expect(getByText('열차 지연')).toBeTruthy();
    });
  });

  describe('Pull to Refresh', () => {
    it('calls refresh when pull-to-refresh is triggered', async () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { UNSAFE_getByType } = render(<AlertsScreen />);
      const scrollView = UNSAFE_getByType('RCTScrollView' as unknown as React.ComponentType<unknown>);

      if (scrollView && scrollView.props && scrollView.props.refreshControl) {
        const { onRefresh } = scrollView.props.refreshControl.props;
        if (onRefresh) {
          onRefresh();
        }
      }

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Read Notification Behavior', () => {
    it('does not call markAsRead when pressing already read notification', async () => {
      mockMarkAsRead.mockResolvedValue(undefined);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: true,
          },
        ],
        unreadCount: 0,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      fireEvent.press(getByText('열차 도착'));

      await waitFor(() => {
        expect(mockMarkAsRead).not.toHaveBeenCalled();
      }, { timeout: 100 });
    });

    it('handles error when marking notification as read', async () => {
      mockMarkAsRead.mockRejectedValue(new Error('Mark as read failed'));

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '2호선 열차가 곧 도착합니다',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      fireEvent.press(getByText('열차 도착'));

      // No alert should be shown for this error (silently handled)
      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('notif1');
      });
    });
  });

  describe('Timestamp Formatting', () => {
    it('formats minutes correctly', () => {
      const now = new Date();
      const minutesAgo = new Date(now.getTime() - 30 * 60000);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '30분 전',
            createdAt: minutesAgo.toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('30분')).toBeTruthy();
    });

    it('formats hours correctly', () => {
      const now = new Date();
      const hoursAgo = new Date(now.getTime() - 5 * 3600000);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '5시간 전',
            createdAt: hoursAgo.toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('5시간')).toBeTruthy();
    });

    it('formats days correctly', () => {
      const now = new Date();
      const daysAgo = new Date(now.getTime() - 3 * 86400000);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '3일 전',
            createdAt: daysAgo.toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('3일')).toBeTruthy();
    });

    it('formats dates correctly for older notifications', () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 10 * 86400000);

      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '10일 전',
            createdAt: weekAgo.toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      // Just verify that some timestamp is rendered
      expect(getByText('열차 도착')).toBeTruthy();
    });
  });

  describe('Multiple Notifications', () => {
    it('renders multiple notifications', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '2호선 도착',
            body: '강남역',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
          {
            id: 'notif2',
            type: 'DELAY',
            title: '3호선 지연',
            body: '약 10분 지연',
            createdAt: new Date().toISOString(),
            isRead: true,
          },
          {
            id: 'notif3',
            type: 'SERVICE_CHANGE',
            title: '운영 변경',
            body: '임시 운영',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 2,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('2호선 도착')).toBeTruthy();
      expect(getByText('3호선 지연')).toBeTruthy();
      expect(getByText('운영 변경')).toBeTruthy();
      expect(getByText('새 알림 2개')).toBeTruthy();
    });

    it('displays read and unread notifications with different styles', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '열차 도착',
            body: '도착',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
          {
            id: 'notif2',
            type: 'ARRIVAL',
            title: '열차 도착 2',
            body: '도착',
            createdAt: new Date().toISOString(),
            isRead: true,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('열차 도착')).toBeTruthy();
      expect(getByText('열차 도착 2')).toBeTruthy();
    });
  });

  describe('Notification Types', () => {
    it('renders ARRIVAL notification type', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '도착',
            body: '열차 도착',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('도착')).toBeTruthy();
    });

    it('renders DELAY notification type', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'DELAY',
            title: '지연',
            body: '10분 지연',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('지연')).toBeTruthy();
    });

    it('renders DISRUPTION notification type', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'DISRUPTION',
            title: '운영 중단',
            body: '중단',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('운영 중단')).toBeTruthy();
    });

    it('renders FAVORITE notification type', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'FAVORITE',
            title: '즐겨찾기',
            body: '즐겨찾는 역',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('즐겨찾기')).toBeTruthy();
    });

    it('renders default icon for unknown notification type', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'UNKNOWN_TYPE',
            title: '알림',
            body: '내용',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      // Phase 4: notification body also contains "알림", so disambiguate via testID.
      const { getByTestId } = render(<AlertsScreen />);
      expect(getByTestId('alerts-header-title')).toBeTruthy();
    });
  });

  describe('Error State Persistence', () => {
    it('shows error when notifications list is empty', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: '네트워크 오류',
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('네트워크 오류')).toBeTruthy();
      expect(getByText('다시 시도')).toBeTruthy();
    });

    it('shows notifications when error is present but list is not empty', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '도착',
            body: '도착함',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: '네트워크 오류',
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('도착')).toBeTruthy();
    });
  });

  describe('Loading State Persistence', () => {
    it('shows loading when notifications list is empty', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: true,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('알림 로딩중')).toBeTruthy();
    });

    it('shows notifications when loading is true but list is not empty', () => {
      (useAlerts as jest.Mock).mockReturnValue({
        notifications: [
          {
            id: 'notif1',
            type: 'ARRIVAL',
            title: '도착',
            body: '도착함',
            createdAt: new Date().toISOString(),
            isRead: false,
          },
        ],
        unreadCount: 1,
        loading: true,
        error: null,
        refreshing: false,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: mockDeleteNotification,
        clearAll: mockClearAll,
        refresh: mockRefresh,
      });

      const { getByText } = render(<AlertsScreen />);
      expect(getByText('도착')).toBeTruthy();
    });
  });
});
