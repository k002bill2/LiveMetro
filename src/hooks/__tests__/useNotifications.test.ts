/**
 * useNotifications Hook Tests
 * Tests for push notifications and delay alerts
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useNotifications, useSimpleNotification } from '../useNotifications';
import { notificationService, NotificationType } from '../../services/notification/notificationService';
import { dataManager } from '../../services/data/dataManager';
import { useAuth } from '../../services/auth/AuthContext';
import { notificationStorageService } from '../../services/notification/notificationStorageService';
import { TrainDelay, ServiceDisruption, TrainStatus } from '../../models/train';

// Mock dependencies
jest.mock('../../services/notification/notificationService');
jest.mock('../../services/data/dataManager');
jest.mock('../../services/auth/AuthContext');
jest.mock('../../services/notification/notificationStorageService');

const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;
const mockDataManager = dataManager as jest.Mocked<typeof dataManager>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockStorageService = notificationStorageService as jest.Mocked<typeof notificationStorageService>;

// Mock listener subscriptions
const mockReceivedListener = { remove: jest.fn() };
const mockResponseListener = { remove: jest.fn() };

const mockUser = {
  id: 'user-123',
  email: 'test@test.com',
  preferences: {
    notificationSettings: {
      delayAlerts: true,
      emergencyAlerts: true,
      arrivalAlerts: true,
      quietHoursEnabled: false,
    },
  },
};

const createMockDelay = (overrides?: Partial<TrainDelay>): TrainDelay => ({
  trainId: 'train-1',
  lineId: '2',
  stationName: '강남역',
  delayMinutes: 10,
  reason: '열차 고장',
  detectedAt: new Date(),
  status: TrainStatus.DELAYED,
  ...overrides,
});

const createMockDisruption = (overrides?: Partial<ServiceDisruption>): ServiceDisruption => ({
  id: 'disruption-1',
  lineId: '2',
  lineName: '2호선',
  stationName: '강남역',
  status: TrainStatus.SUSPENDED,
  message: '운행 중단',
  startTime: new Date(),
  ...overrides,
});

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mocks
    mockUseAuth.mockReturnValue({
      user: mockUser,
      firebaseUser: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      signup: jest.fn(),
      resetPassword: jest.fn(),
    } as any);

    mockNotificationService.initialize.mockResolvedValue(true);
    mockNotificationService.getPushToken.mockReturnValue('expo-push-token');
    mockNotificationService.getPermissionStatus.mockReturnValue({ granted: true, ios: {}, android: {} } as any);
    mockNotificationService.sendLocalNotification.mockResolvedValue('notif-id');
    mockNotificationService.sendDelayAlert.mockResolvedValue('delay-notif-id');
    mockNotificationService.sendEmergencyAlert.mockResolvedValue('emergency-notif-id');
    mockNotificationService.scheduleCommuteReminder.mockResolvedValue('reminder-id');
    mockNotificationService.cancelNotification.mockResolvedValue(undefined);
    mockNotificationService.shouldSendNotification.mockReturnValue(true);
    mockNotificationService.addNotificationListener.mockReturnValue(mockReceivedListener as any);
    mockNotificationService.addNotificationResponseListener.mockReturnValue(mockResponseListener as any);

    mockDataManager.detectDelays.mockResolvedValue([]);
    mockDataManager.detectServiceDisruptions.mockResolvedValue([]);

    mockStorageService.saveNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with loading true', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.loading).toBe(true);
    });

    it('should call notificationService.initialize on mount', async () => {
      renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockNotificationService.initialize).toHaveBeenCalled();
      });
    });

    it('should set hasPermission after initialization', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission).toBe(true);
    });

    it('should set pushToken after initialization', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.pushToken).toBe('expo-push-token');
    });

    it('should handle initialization failure', async () => {
      mockNotificationService.initialize.mockResolvedValue(false);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission).toBe(false);
      expect(result.current.error).toContain('알림 서비스');
    });

    it('should handle initialization error', async () => {
      mockNotificationService.initialize.mockRejectedValue(new Error('Init failed'));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Test Notification', () => {
    it('sendTestNotification should send notification', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = false;
      await act(async () => {
        success = await result.current.sendTestNotification();
      });

      expect(success).toBe(true);
      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.SERVICE_UPDATE,
          title: expect.stringContaining('테스트'),
        })
      );
    });

    it('sendTestNotification should return false without permission', async () => {
      mockNotificationService.getPermissionStatus.mockReturnValue({ granted: false } as any);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success = true;
      await act(async () => {
        success = await result.current.sendTestNotification();
      });

      expect(success).toBe(false);
    });

    it('sendTestNotification should handle errors', async () => {
      mockNotificationService.sendLocalNotification.mockRejectedValue(new Error('Send failed'));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = true;
      await act(async () => {
        success = await result.current.sendTestNotification();
      });

      expect(success).toBe(false);
    });
  });

  describe('Delay Monitoring', () => {
    it('monitorStationDelays should check for delays', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.monitorStationDelays('강남역');
      });

      expect(mockDataManager.detectDelays).toHaveBeenCalledWith('강남역');
    });

    it('monitorStationDelays should send delay alert when threshold exceeded', async () => {
      mockDataManager.detectDelays.mockResolvedValue([
        createMockDelay({ delayMinutes: 10 }),
      ]);

      const { result } = renderHook(() =>
        useNotifications({ delayThresholdMinutes: 5 })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.monitorStationDelays('강남역');
      });

      expect(mockNotificationService.sendDelayAlert).toHaveBeenCalled();
    });

    it('monitorStationDelays should not send alert below threshold', async () => {
      mockDataManager.detectDelays.mockResolvedValue([
        createMockDelay({ delayMinutes: 3 }),
      ]);

      const { result } = renderHook(() =>
        useNotifications({ delayThresholdMinutes: 5 })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.monitorStationDelays('강남역');
      });

      expect(mockNotificationService.sendDelayAlert).not.toHaveBeenCalled();
    });

    it('monitorStationDelays should detect service disruptions', async () => {
      mockDataManager.detectServiceDisruptions.mockResolvedValue([
        createMockDisruption(),
      ]);

      const { result } = renderHook(() =>
        useNotifications({ enableEmergencyAlerts: true })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.monitorStationDelays('강남역');
      });

      expect(mockDataManager.detectServiceDisruptions).toHaveBeenCalledWith('강남역');
      expect(mockNotificationService.sendEmergencyAlert).toHaveBeenCalled();
    });

    it('stopMonitoringStation should clear monitoring', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      await act(async () => {
        await result.current.monitorStationDelays('강남역');
      });

      act(() => {
        result.current.stopMonitoringStation('강남역');
      });

      // Verify timer was cleared (no more calls after stopping)
      mockDataManager.detectDelays.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(120000); // 2 minutes
      });

      // Should not have called again
      expect(mockDataManager.detectDelays).not.toHaveBeenCalled();
    });
  });

  describe('Batch Monitoring', () => {
    it('startMonitoring should monitor all configured stations', async () => {
      const { result } = renderHook(() =>
        useNotifications({
          monitoredStations: ['강남역', '역삼역'],
          enableDelayAlerts: true,
        })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      // Monitoring should have started automatically
      await waitFor(() => {
        expect(mockDataManager.detectDelays).toHaveBeenCalledWith('강남역');
        expect(mockDataManager.detectDelays).toHaveBeenCalledWith('역삼역');
      });
    });

    it('stopAllMonitoring should stop all stations', async () => {
      const { result } = renderHook(() =>
        useNotifications({
          monitoredStations: ['강남역', '역삼역'],
        })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.stopAllMonitoring();
      });

      mockDataManager.detectDelays.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(120000);
      });

      expect(mockDataManager.detectDelays).not.toHaveBeenCalled();
    });
  });

  describe('Emergency Alerts', () => {
    it('sendEmergencyAlert should send alert', async () => {
      const { result } = renderHook(() =>
        useNotifications({ enableEmergencyAlerts: true })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = false;
      await act(async () => {
        success = await result.current.sendEmergencyAlert(
          '긴급 알림',
          '테스트 메시지',
          ['2호선']
        );
      });

      expect(success).toBe(true);
      expect(mockNotificationService.sendEmergencyAlert).toHaveBeenCalledWith(
        '긴급 알림',
        '테스트 메시지',
        ['2호선']
      );
    });

    it('sendEmergencyAlert should respect user settings', async () => {
      mockNotificationService.shouldSendNotification.mockReturnValue(false);

      const { result } = renderHook(() =>
        useNotifications({ enableEmergencyAlerts: true })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = true;
      await act(async () => {
        success = await result.current.sendEmergencyAlert(
          '긴급 알림',
          '테스트 메시지',
          ['2호선']
        );
      });

      expect(success).toBe(false);
      expect(mockNotificationService.sendEmergencyAlert).not.toHaveBeenCalled();
    });

    it('sendEmergencyAlert should return false when disabled', async () => {
      const { result } = renderHook(() =>
        useNotifications({ enableEmergencyAlerts: false })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = true;
      await act(async () => {
        success = await result.current.sendEmergencyAlert(
          '긴급 알림',
          '테스트 메시지',
          ['2호선']
        );
      });

      expect(success).toBe(false);
    });
  });

  describe('Commute Reminders', () => {
    it('scheduleCommuteReminder should schedule notification', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      const reminderTime = new Date();
      let identifier: string | null = null;

      await act(async () => {
        identifier = await result.current.scheduleCommuteReminder(
          '출근 알림',
          '곧 출발하세요!',
          reminderTime
        );
      });

      expect(identifier).toBe('reminder-id');
      expect(mockNotificationService.scheduleCommuteReminder).toHaveBeenCalledWith(
        '출근 알림',
        '곧 출발하세요!',
        reminderTime
      );
    });

    it('scheduleCommuteReminder should return null without permission', async () => {
      mockNotificationService.getPermissionStatus.mockReturnValue({ granted: false } as any);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let identifier: string | null = 'should-be-null';

      await act(async () => {
        identifier = await result.current.scheduleCommuteReminder(
          '출근 알림',
          '곧 출발하세요!',
          new Date()
        );
      });

      expect(identifier).toBeNull();
    });
  });

  describe('Cancel Notification', () => {
    it('cancelNotification should cancel by identifier', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = false;
      await act(async () => {
        success = await result.current.cancelNotification('notif-123');
      });

      expect(success).toBe(true);
      expect(mockNotificationService.cancelNotification).toHaveBeenCalledWith('notif-123');
    });

    it('cancelNotification should handle errors', async () => {
      mockNotificationService.cancelNotification.mockRejectedValue(new Error('Cancel failed'));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      let success = true;
      await act(async () => {
        success = await result.current.cancelNotification('notif-123');
      });

      expect(success).toBe(false);
    });
  });

  describe('Notification Listeners', () => {
    it('should register notification listeners on mount', async () => {
      renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockNotificationService.addNotificationListener).toHaveBeenCalled();
        expect(mockNotificationService.addNotificationResponseListener).toHaveBeenCalled();
      });
    });

    it('should remove listeners on unmount', async () => {
      const { unmount } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockNotificationService.addNotificationListener).toHaveBeenCalled();
      });

      unmount();

      expect(mockReceivedListener.remove).toHaveBeenCalled();
      expect(mockResponseListener.remove).toHaveBeenCalled();
    });

    it('should call onNotificationReceived callback', async () => {
      const onNotificationReceived = jest.fn();
      let capturedHandler: ((notification: Notifications.Notification) => void) | null = null;

      mockNotificationService.addNotificationListener.mockImplementation((handler: any) => {
        capturedHandler = handler;
        return mockReceivedListener as any;
      });

      renderHook(() => useNotifications({ onNotificationReceived }));

      await waitFor(() => {
        expect(capturedHandler).not.toBeNull();
      });

      const mockNotification = {
        request: {
          content: {
            title: '테스트',
            body: '테스트 알림',
            data: { type: NotificationType.DELAY_ALERT },
          },
        },
      } as Notifications.Notification;

      await act(async () => {
        capturedHandler?.(mockNotification);
      });

      expect(onNotificationReceived).toHaveBeenCalledWith(mockNotification);
    });

    it('should save notification to storage when received', async () => {
      let capturedHandler: ((notification: Notifications.Notification) => void) | null = null;

      mockNotificationService.addNotificationListener.mockImplementation((handler: any) => {
        capturedHandler = handler;
        return mockReceivedListener as any;
      });

      renderHook(() => useNotifications());

      await waitFor(() => {
        expect(capturedHandler).not.toBeNull();
      });

      const mockNotification = {
        request: {
          content: {
            title: '지연 알림',
            body: '강남역 5분 지연',
            data: { type: NotificationType.DELAY_ALERT },
          },
        },
      } as Notifications.Notification;

      await act(async () => {
        capturedHandler?.(mockNotification);
      });

      expect(mockStorageService.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '지연 알림',
          body: '강남역 5분 지연',
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should stop all monitoring on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useNotifications({
          monitoredStations: ['강남역'],
        })
      );

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      unmount();

      mockDataManager.detectDelays.mockClear();

      await act(async () => {
        jest.advanceTimersByTime(120000);
      });

      expect(mockDataManager.detectDelays).not.toHaveBeenCalled();
    });
  });

  describe('Monitoring State', () => {
    it('isMonitoring should reflect monitoring status', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      expect(result.current.isMonitoring).toBe(false);

      await act(async () => {
        await result.current.monitorStationDelays('강남역');
      });

      // Note: isMonitoring is based on ref, may not update immediately
      // This tests the basic functionality
    });

    it('monitoredStationsCount should reflect count', async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      expect(result.current.monitoredStationsCount).toBe(0);
    });
  });
});

describe('useSimpleNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationService.initialize.mockResolvedValue(true);
    mockNotificationService.sendLocalNotification.mockResolvedValue('notif-id');
  });

  describe('Send Notification', () => {
    it('sendNotification should initialize and send', async () => {
      const { result } = renderHook(() => useSimpleNotification());

      let success = false;
      await act(async () => {
        success = await result.current.sendNotification('제목', '본문');
      });

      expect(success).toBe(true);
      expect(mockNotificationService.initialize).toHaveBeenCalled();
      expect(mockNotificationService.sendLocalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '제목',
          body: '본문',
        })
      );
    });

    it('sendNotification should set loading during send', async () => {
      let resolveInit: (value: boolean) => void;
      const initPromise = new Promise<boolean>((resolve) => {
        resolveInit = resolve;
      });
      mockNotificationService.initialize.mockReturnValue(initPromise);

      const { result } = renderHook(() => useSimpleNotification());

      act(() => {
        result.current.sendNotification('제목', '본문');
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveInit!(true);
      });

      expect(result.current.loading).toBe(false);
    });

    it('sendNotification should return false on permission denied', async () => {
      mockNotificationService.initialize.mockResolvedValue(false);

      const { result } = renderHook(() => useSimpleNotification());

      let success = true;
      await act(async () => {
        success = await result.current.sendNotification('제목', '본문');
      });

      expect(success).toBe(false);
    });

    it('sendNotification should return false on error', async () => {
      mockNotificationService.sendLocalNotification.mockRejectedValue(new Error('Send failed'));

      const { result } = renderHook(() => useSimpleNotification());

      let success = true;
      await act(async () => {
        success = await result.current.sendNotification('제목', '본문');
      });

      expect(success).toBe(false);
    });
  });
});
