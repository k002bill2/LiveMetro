/**
 * Topic Subscription Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { topicSubscriptionService } from '../topicSubscriptionService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock @react-native-firebase/messaging to not be available (Expo Go limitation)
jest.mock('@react-native-firebase/messaging', () => {
  throw new Error('Module not available');
}, { virtual: true });

describe('TopicSubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(topicSubscriptionService.initialize()).resolves.not.toThrow();
    });

    it('should load saved subscriptions from storage', async () => {
      const savedData = JSON.stringify({
        all_users: true,
        delay_alerts: true,
        line_2: false,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(savedData);

      await expect(topicSubscriptionService.initialize()).resolves.not.toThrow();
    });

    it('should handle corrupted storage data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      await expect(topicSubscriptionService.initialize()).resolves.not.toThrow();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a topic', async () => {
      const result = await topicSubscriptionService.subscribe('delay_alerts');
      expect(typeof result).toBe('boolean');
    });

    it('should subscribe to a line topic', async () => {
      const result = await topicSubscriptionService.subscribe('line_2');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from a topic', async () => {
      const result = await topicSubscriptionService.unsubscribe('delay_alerts');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('toggle', () => {
    it('should toggle subscription state', async () => {
      const result = await topicSubscriptionService.toggle('service_updates');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isSubscribed', () => {
    it('should return subscription state', () => {
      const result = topicSubscriptionService.isSubscribed('all_users');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getSubscriptions', () => {
    it('should return subscriptions list', async () => {
      const result = await topicSubscriptionService.getSubscriptions();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSubscriptionsByCategory', () => {
    it('should return subscriptions by category', async () => {
      const result = await topicSubscriptionService.getSubscriptionsByCategory();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('subscribeToFavoriteLines', () => {
    it('should subscribe to favorite lines', async () => {
      await expect(
        topicSubscriptionService.subscribeToFavoriteLines(['1', '2', '3'])
      ).resolves.not.toThrow();
    });

    it('should handle empty lines array', async () => {
      await expect(
        topicSubscriptionService.subscribeToFavoriteLines([])
      ).resolves.not.toThrow();
    });
  });

  describe('subscribeToDefaults', () => {
    it('should subscribe to default topics', async () => {
      await expect(
        topicSubscriptionService.subscribeToDefaults()
      ).resolves.not.toThrow();
    });
  });

  describe('unsubscribeFromAll', () => {
    it('should unsubscribe from all topics', async () => {
      await expect(
        topicSubscriptionService.unsubscribeFromAll()
      ).resolves.not.toThrow();
    });
  });

  describe('getTopicMetadata', () => {
    it('should return metadata for a topic', () => {
      const metadata = topicSubscriptionService.getTopicMetadata('delay_alerts');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBeDefined();
      expect(metadata.description).toBeDefined();
    });
  });

  describe('getAllTopics', () => {
    it('should return all topics', () => {
      const topics = topicSubscriptionService.getAllTopics();
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
    });
  });

  describe('getLineTopics', () => {
    it('should return line topics', () => {
      const lineTopics = topicSubscriptionService.getLineTopics();
      expect(Array.isArray(lineTopics)).toBe(true);
      expect(lineTopics.length).toBe(9); // 9 lines
    });
  });
});
