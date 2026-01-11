/**
 * Arrival Service
 * Real-time subway arrival information service with caching, rate limiting, and retry logic
 * Wraps seoulSubwayApi with additional reliability features
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { seoulSubwayApi, SeoulRealtimeArrival } from '@/services/api/seoulSubwayApi';

// ============================================================================
// Types
// ============================================================================

/**
 * Individual train arrival information
 */
export interface TrainArrival {
  readonly trainId: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly destination: string;
  readonly arrivalSeconds: number | null;
  readonly arrivalMessage: string;
  readonly trainNumber: string;
}

/**
 * Arrival information result
 */
export interface ArrivalInfo {
  readonly stationName: string;
  readonly stationId: string;
  readonly arrivals: readonly TrainArrival[];
  readonly lastUpdated: Date;
  readonly source: 'api' | 'cache';
}

/**
 * Service configuration options
 */
export interface ArrivalServiceOptions {
  /** Minimum polling interval in ms (default: 30000 - Seoul API requirement) */
  minPollingInterval?: number;
  /** Cache TTL in ms (default: 60000) */
  cacheTTL?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
}

/**
 * Callback type for arrival subscriptions
 */
export type ArrivalCallback = (
  arrival: ArrivalInfo | null,
  error?: Error
) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<ArrivalServiceOptions> = {
  minPollingInterval: 30000, // 30 seconds (Seoul API requirement)
  cacheTTL: 60000, // 1 minute
  maxRetries: 3,
  retryDelay: 1000,
};

const CACHE_PREFIX = '@livemetro_arrival_';

// ============================================================================
// ArrivalService Class
// ============================================================================

/**
 * ArrivalService - Reliable real-time arrival information service
 *
 * Features:
 * - Rate limiting: Enforces 30-second minimum polling interval
 * - Retry logic: Exponential backoff on failures
 * - Caching: AsyncStorage-based with TTL
 * - Subscription pattern: For continuous updates
 */
class ArrivalService {
  private readonly options: Required<ArrivalServiceOptions>;
  private lastFetchTime: Map<string, number> = new Map();
  private activeSubscriptions: Map<string, Set<ArrivalCallback>> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(options?: ArrivalServiceOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Get real-time arrival information for a station
   * Respects rate limiting and uses cache when within polling interval
   */
  async getArrivals(stationName: string): Promise<ArrivalInfo> {
    const trimmedName = stationName.trim();
    if (!trimmedName) {
      return this.createEmptyArrivalInfo(stationName);
    }

    const now = Date.now();
    const lastFetch = this.lastFetchTime.get(trimmedName) ?? 0;

    // Rate limiting: Return cached data if within polling interval
    if (now - lastFetch < this.options.minPollingInterval) {
      const cached = await this.getCachedArrivals(trimmedName);
      if (cached) {
        return cached;
      }
    }

    // Fetch with retry logic
    try {
      const arrivals = await this.fetchWithRetry(trimmedName);
      this.lastFetchTime.set(trimmedName, now);

      // Cache the result
      await this.setCachedArrivals(trimmedName, arrivals);

      return arrivals;
    } catch (error) {
      // On failure, try to return cached data
      const cached = await this.getCachedArrivals(trimmedName);
      if (cached) {
        return { ...cached, source: 'cache' };
      }

      // If no cache, return empty result instead of throwing
      console.error('Failed to get arrivals:', error);
      return this.createEmptyArrivalInfo(trimmedName);
    }
  }

  /**
   * Subscribe to real-time arrival updates
   * Returns an unsubscribe function
   */
  subscribe(
    stationName: string,
    callback: ArrivalCallback,
    intervalMs?: number
  ): () => void {
    const trimmedName = stationName.trim();
    if (!trimmedName) {
      callback(null, new Error('Station name is required'));
      return () => {};
    }

    const pollInterval = Math.max(
      intervalMs ?? this.options.minPollingInterval,
      this.options.minPollingInterval
    );

    // Register subscriber
    if (!this.activeSubscriptions.has(trimmedName)) {
      this.activeSubscriptions.set(trimmedName, new Set());
    }
    this.activeSubscriptions.get(trimmedName)!.add(callback);

    // Start polling if not already active
    if (!this.pollingIntervals.has(trimmedName)) {
      const interval = setInterval(async () => {
        await this.pollAndNotify(trimmedName);
      }, pollInterval);

      this.pollingIntervals.set(trimmedName, interval);
    }

    // Send initial data
    this.getArrivals(trimmedName)
      .then((arrivals) => callback(arrivals))
      .catch((error) => callback(null, error as Error));

    // Return unsubscribe function
    return () => this.unsubscribe(trimmedName, callback);
  }

  /**
   * Clear cache for a specific station or all stations
   */
  async clearCache(stationName?: string): Promise<void> {
    try {
      if (stationName) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${stationName.trim()}`);
        this.lastFetchTime.delete(stationName.trim());
      } else {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
        await AsyncStorage.multiRemove(cacheKeys);
        this.lastFetchTime.clear();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    // Clear all polling intervals
    this.pollingIntervals.forEach((interval) => clearInterval(interval));
    this.pollingIntervals.clear();

    // Clear subscriptions
    this.activeSubscriptions.clear();

    // Clear fetch timestamps
    this.lastFetchTime.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Fetch arrivals with retry logic
   */
  private async fetchWithRetry(
    stationName: string,
    attempt: number = 0
  ): Promise<ArrivalInfo> {
    try {
      const seoulData = await seoulSubwayApi.getRealtimeArrival(stationName);
      return this.convertToArrivalInfo(stationName, seoulData);
    } catch (error) {
      if (attempt < this.options.maxRetries - 1) {
        // Exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt);
        await this.delay(delay);
        return this.fetchWithRetry(stationName, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Convert Seoul API response to ArrivalInfo
   */
  private convertToArrivalInfo(
    stationName: string,
    seoulData: SeoulRealtimeArrival[]
  ): ArrivalInfo {
    const arrivals: TrainArrival[] = seoulData.map((arrival, index) => {
      const converted = seoulSubwayApi.convertToAppTrain(arrival);
      return {
        trainId: `train_${arrival.btrainNo || index}_${Date.now()}`,
        lineId: this.normalizeLineId(converted.lineId),
        direction: converted.direction as 'up' | 'down',
        destination: converted.destinationStation,
        arrivalSeconds: converted.arrivalTime,
        arrivalMessage: converted.arrivalMessage,
        trainNumber: converted.trainNumber,
      };
    });

    return {
      stationName,
      stationId: seoulData[0]?.statnId ?? stationName,
      arrivals,
      lastUpdated: new Date(),
      source: 'api',
    };
  }

  /**
   * Normalize line ID to standard format
   */
  private normalizeLineId(lineId: string): string {
    // Extract line number from formats like "1001" (line 1), "1002" (line 2)
    const match = lineId.match(/100(\d)/);
    if (match?.[1]) {
      return match[1];
    }

    // Handle direct line numbers
    const directMatch = lineId.match(/^(\d)$/);
    if (directMatch?.[1]) {
      return directMatch[1];
    }

    return lineId;
  }

  /**
   * Create empty arrival info
   */
  private createEmptyArrivalInfo(stationName: string): ArrivalInfo {
    return {
      stationName,
      stationId: stationName,
      arrivals: [],
      lastUpdated: new Date(),
      source: 'cache',
    };
  }

  /**
   * Poll arrivals and notify all subscribers
   */
  private async pollAndNotify(stationName: string): Promise<void> {
    try {
      const arrivals = await this.getArrivals(stationName);
      this.notifySubscribers(stationName, arrivals);
    } catch (error) {
      this.notifySubscribers(stationName, null, error as Error);
    }
  }

  /**
   * Notify all subscribers for a station
   */
  private notifySubscribers(
    stationName: string,
    arrivals: ArrivalInfo | null,
    error?: Error
  ): void {
    const subscribers = this.activeSubscriptions.get(stationName);
    subscribers?.forEach((callback) => callback(arrivals, error));
  }

  /**
   * Unsubscribe a callback from updates
   */
  private unsubscribe(stationName: string, callback: ArrivalCallback): void {
    const subscribers = this.activeSubscriptions.get(stationName);
    if (subscribers) {
      subscribers.delete(callback);

      // If no more subscribers, stop polling
      if (subscribers.size === 0) {
        const interval = this.pollingIntervals.get(stationName);
        if (interval) {
          clearInterval(interval);
          this.pollingIntervals.delete(stationName);
        }
        this.activeSubscriptions.delete(stationName);
      }
    }
  }

  // ==========================================================================
  // Cache Methods
  // ==========================================================================

  /**
   * Get cached arrivals for a station
   */
  private async getCachedArrivals(
    stationName: string
  ): Promise<ArrivalInfo | null> {
    try {
      const key = `${CACHE_PREFIX}${stationName}`;
      const cached = await AsyncStorage.getItem(key);

      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached) as {
        data: ArrivalInfo;
        expiry: number;
      };

      // Check if cache is expired
      if (Date.now() > parsed.expiry) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      // Reconstruct Date object and mark as cache
      return {
        ...parsed.data,
        lastUpdated: new Date(parsed.data.lastUpdated),
        source: 'cache',
      };
    } catch (error) {
      console.error('Failed to read cache:', error);
      return null;
    }
  }

  /**
   * Cache arrivals for a station
   */
  private async setCachedArrivals(
    stationName: string,
    data: ArrivalInfo
  ): Promise<void> {
    try {
      const key = `${CACHE_PREFIX}${stationName}`;
      const cached = {
        data,
        expiry: Date.now() + this.options.cacheTTL,
      };
      await AsyncStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      // Cache failures are non-critical
      console.warn('Failed to cache arrivals:', error);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Export
// ============================================================================

/** Singleton instance */
export const arrivalService = new ArrivalService();

/** Export class for custom instances */
export { ArrivalService };
