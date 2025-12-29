/**
 * Notification Test Helper
 * Utility functions for testing notification system
 */

import { notificationStorageService } from '../services/notification/notificationStorageService';

/**
 * Add sample test notifications to storage
 */
export const addTestNotifications = async (): Promise<void> => {
  const testNotifications = [
    {
      type: 'DELAY_ALERT',
      title: '2호선 지연',
      body: '강남역 방면 열차가 약 5분 지연되고 있습니다.',
      priority: 'high' as const,
      data: { lineId: '2', stationId: 'gangnam', delayMinutes: 5 },
    },
    {
      type: 'ARRIVAL',
      title: '열차 도착 예정',
      body: '산곡역행 열차가 2분 후 도착합니다.',
      priority: 'normal' as const,
      data: { stationId: 'sangok', arrivalMinutes: 2 },
    },
    {
      type: 'DISRUPTION',
      title: '1호선 운행 장애',
      body: '신호 장애로 인해 일부 구간 운행이 지연되고 있습니다.',
      priority: 'urgent' as const,
      data: { lineId: '1', severity: 'major' },
    },
    {
      type: 'SERVICE_CHANGE',
      title: '서비스 공지',
      body: '오늘 저녁 일부 노선의 막차 시간이 변경되었습니다.',
      priority: 'normal' as const,
      data: { changeType: 'schedule' },
    },
    {
      type: 'FAVORITE',
      title: '즐겨찾기 역 도착',
      body: '저장된 즐겨찾기 역에 곧 도착합니다.',
      priority: 'low' as const,
      data: { favoriteId: 'fav_123' },
    },
  ];

  try {
    for (const notification of testNotifications) {
      await notificationStorageService.saveNotification(notification);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('✅ Test notifications added successfully');
  } catch (error) {
    console.error('Error adding test notifications:', error);
    throw error;
  }
};

/**
 * Clear all test notifications
 */
export const clearTestNotifications = async (): Promise<void> => {
  try {
    await notificationStorageService.clearAll();
    console.log('✅ All notifications cleared');
  } catch (error) {
    console.error('Error clearing notifications:', error);
    throw error;
  }
};

/**
 * Get notification count
 */
export const getNotificationCount = async (): Promise<number> => {
  try {
    const notifications = await notificationStorageService.getAllNotifications();
    return notifications.length;
  } catch (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }
};

/**
 * Add a single random notification
 */
export const addRandomNotification = async (): Promise<void> => {
  const types = ['DELAY_ALERT', 'ARRIVAL', 'DISRUPTION', 'SERVICE_CHANGE', 'FAVORITE'] as const;
  const priorities = ['low', 'normal', 'high', 'urgent'] as const;

  const randomTypeIndex = Math.floor(Math.random() * types.length);
  const randomPriorityIndex = Math.floor(Math.random() * priorities.length);

  const randomType = types[randomTypeIndex]!; // Non-null assertion: array is never empty
  const randomPriority = priorities[randomPriorityIndex]!; // Non-null assertion: array is never empty

  await notificationStorageService.saveNotification({
    type: randomType,
    title: `테스트 알림 ${randomType}`,
    body: `이것은 ${new Date().toLocaleTimeString('ko-KR')}에 생성된 테스트 알림입니다.`,
    priority: randomPriority,
    data: { test: true, timestamp: Date.now() },
  });

  console.log('✅ Random notification added');
};
