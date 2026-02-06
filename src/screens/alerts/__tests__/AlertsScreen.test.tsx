/**
 * AlertsScreen Test Suite
 * Tests alerts screen rendering and notification management
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AlertsScreen } from '../AlertsScreen';
import { useAlerts } from '@/hooks/useAlerts';

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
jest.mock('@/utils/notificationTestHelper', () => ({
  addTestNotifications: jest.fn(),
  addRandomNotification: jest.fn(),
}));

describe('AlertsScreen', () => {
  const mockMarkAsRead = jest.fn();
  const mockMarkAllAsRead = jest.fn();
  const mockDeleteNotification = jest.fn();
  const mockClearAll = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
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
    const { getByText } = render(<AlertsScreen />);
    expect(getByText('Notifications')).toBeTruthy();
  });

  it('displays header with title', () => {
    const { getByText } = render(<AlertsScreen />);
    expect(getByText('Notifications')).toBeTruthy();
  });

  it('shows notification count in subtitle', () => {
    const { getByText } = render(<AlertsScreen />);
    expect(getByText('0 total')).toBeTruthy();
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
    expect(getByText('1 total · 1 new')).toBeTruthy();
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
});
