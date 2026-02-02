/**
 * Topic Subscription Service
 * Manages FCM topic subscriptions for users
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Messaging 타입 정의
interface FirebaseMessaging {
  subscribeToTopic(topic: string): Promise<void>;
  unsubscribeFromTopic(topic: string): Promise<void>;
  getToken(): Promise<string>;
}

// Lazy load messaging module
let messaging: (() => FirebaseMessaging) | null = null;

function loadMessagingModule(): FirebaseMessaging | null {
  if (messaging) return messaging();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    messaging = require('@react-native-firebase/messaging').default as () => FirebaseMessaging;
    return messaging();
  } catch {
    console.log('ℹ️ @react-native-firebase/messaging not available');
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Available topics
 */
export type NotificationTopic =
  | 'all_users'           // All app users
  | 'line_1'             // Line 1 updates
  | 'line_2'             // Line 2 updates
  | 'line_3'             // Line 3 updates
  | 'line_4'             // Line 4 updates
  | 'line_5'             // Line 5 updates
  | 'line_6'             // Line 6 updates
  | 'line_7'             // Line 7 updates
  | 'line_8'             // Line 8 updates
  | 'line_9'             // Line 9 updates
  | 'delay_alerts'       // All delay alerts
  | 'service_updates'    // Service updates
  | 'promotions';        // Promotional content

/**
 * Topic subscription state
 */
export interface TopicSubscription {
  topic: NotificationTopic;
  subscribed: boolean;
  subscribedAt?: Date;
}

/**
 * User subscription preferences
 */
export interface SubscriptionPreferences {
  userId: string;
  subscriptions: readonly TopicSubscription[];
  lastUpdated: Date;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:topic_subscriptions';

const TOPIC_METADATA: Record<NotificationTopic, {
  name: string;
  description: string;
  category: 'line' | 'alert' | 'general';
}> = {
  all_users: {
    name: '전체 알림',
    description: '앱 공지 및 업데이트',
    category: 'general',
  },
  line_1: { name: '1호선', description: '1호선 운행 정보', category: 'line' },
  line_2: { name: '2호선', description: '2호선 운행 정보', category: 'line' },
  line_3: { name: '3호선', description: '3호선 운행 정보', category: 'line' },
  line_4: { name: '4호선', description: '4호선 운행 정보', category: 'line' },
  line_5: { name: '5호선', description: '5호선 운행 정보', category: 'line' },
  line_6: { name: '6호선', description: '6호선 운행 정보', category: 'line' },
  line_7: { name: '7호선', description: '7호선 운행 정보', category: 'line' },
  line_8: { name: '8호선', description: '8호선 운행 정보', category: 'line' },
  line_9: { name: '9호선', description: '9호선 운행 정보', category: 'line' },
  delay_alerts: {
    name: '지연 알림',
    description: '모든 노선 지연 정보',
    category: 'alert',
  },
  service_updates: {
    name: '운행 변경',
    description: '임시 운행 변경 안내',
    category: 'alert',
  },
  promotions: {
    name: '이벤트/프로모션',
    description: '이벤트 및 할인 정보',
    category: 'general',
  },
};

const LINE_TOPICS: NotificationTopic[] = [
  'line_1', 'line_2', 'line_3', 'line_4', 'line_5',
  'line_6', 'line_7', 'line_8', 'line_9',
];

// ============================================================================
// Service
// ============================================================================

class TopicSubscriptionService {
  private subscriptions: Map<NotificationTopic, boolean> = new Map();
  private initialized = false;

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Record<string, boolean>;
        for (const [topic, subscribed] of Object.entries(parsed)) {
          this.subscriptions.set(topic as NotificationTopic, subscribed);
        }
      }
    } catch {
      // Ignore storage errors
    }

    this.initialized = true;
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic: NotificationTopic): Promise<boolean> {
    await this.initialize();

    const messagingModule = loadMessagingModule();
    if (!messagingModule) {
      // Store locally even without Firebase
      this.subscriptions.set(topic, true);
      await this.saveSubscriptions();
      return true;
    }

    try {
      await messagingModule.subscribeToTopic(topic);
      this.subscriptions.set(topic, true);
      await this.saveSubscriptions();
      return true;
    } catch (error) {
      console.error(`Failed to subscribe to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: NotificationTopic): Promise<boolean> {
    await this.initialize();

    const messagingModule = loadMessagingModule();
    if (!messagingModule) {
      // Store locally even without Firebase
      this.subscriptions.set(topic, false);
      await this.saveSubscriptions();
      return true;
    }

    try {
      await messagingModule.unsubscribeFromTopic(topic);
      this.subscriptions.set(topic, false);
      await this.saveSubscriptions();
      return true;
    } catch (error) {
      console.error(`Failed to unsubscribe from topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Toggle topic subscription
   */
  async toggle(topic: NotificationTopic): Promise<boolean> {
    const isSubscribed = this.isSubscribed(topic);
    if (isSubscribed) {
      return this.unsubscribe(topic);
    } else {
      return this.subscribe(topic);
    }
  }

  /**
   * Check if subscribed to a topic
   */
  isSubscribed(topic: NotificationTopic): boolean {
    return this.subscriptions.get(topic) ?? false;
  }

  /**
   * Get all subscriptions
   */
  async getSubscriptions(): Promise<readonly TopicSubscription[]> {
    await this.initialize();

    return Object.keys(TOPIC_METADATA).map(topic => ({
      topic: topic as NotificationTopic,
      subscribed: this.subscriptions.get(topic as NotificationTopic) ?? false,
    }));
  }

  /**
   * Get subscriptions by category
   */
  async getSubscriptionsByCategory(): Promise<Record<string, readonly TopicSubscription[]>> {
    const subscriptions = await this.getSubscriptions();

    const byCategory: Record<string, TopicSubscription[]> = {
      line: [],
      alert: [],
      general: [],
    };

    for (const sub of subscriptions) {
      const category = TOPIC_METADATA[sub.topic].category;
      byCategory[category]?.push(sub);
    }

    return byCategory;
  }

  /**
   * Subscribe to favorite lines
   */
  async subscribeToFavoriteLines(lineIds: string[]): Promise<void> {
    for (const lineId of lineIds) {
      const topic = `line_${lineId}` as NotificationTopic;
      if (LINE_TOPICS.includes(topic)) {
        await this.subscribe(topic);
      }
    }
  }

  /**
   * Subscribe to default topics for new users
   */
  async subscribeToDefaults(): Promise<void> {
    await this.subscribe('all_users');
    await this.subscribe('delay_alerts');
    await this.subscribe('service_updates');
  }

  /**
   * Unsubscribe from all topics
   */
  async unsubscribeFromAll(): Promise<void> {
    await this.initialize();

    for (const topic of Object.keys(TOPIC_METADATA)) {
      if (this.subscriptions.get(topic as NotificationTopic)) {
        await this.unsubscribe(topic as NotificationTopic);
      }
    }
  }

  /**
   * Get topic metadata
   */
  getTopicMetadata(topic: NotificationTopic): {
    name: string;
    description: string;
    category: string;
  } {
    return TOPIC_METADATA[topic];
  }

  /**
   * Get all topic options
   */
  getAllTopics(): readonly {
    topic: NotificationTopic;
    name: string;
    description: string;
    category: string;
  }[] {
    return Object.entries(TOPIC_METADATA).map(([topic, meta]) => ({
      topic: topic as NotificationTopic,
      ...meta,
    }));
  }

  /**
   * Get line topics
   */
  getLineTopics(): readonly NotificationTopic[] {
    return LINE_TOPICS;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Save subscriptions to storage
   */
  private async saveSubscriptions(): Promise<void> {
    try {
      const data = Object.fromEntries(this.subscriptions);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const topicSubscriptionService = new TopicSubscriptionService();
export default topicSubscriptionService;
