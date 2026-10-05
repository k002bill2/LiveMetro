/**
 * Arrival Service
 * Real-time subway arrival information service with caching, rate limiting, and retry logic
 * Wraps seoulSubwayApi with additional reliability features
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { seoulSubwayApi, SeoulRealtimeArrival } from '@/services/api/seoulSubwayApi';
import type { TrainType } from '@/models/train';
import { normalizeSeoulLineId } from '@/utils/formatUtils';

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
  readonly trainType?: TrainType;
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
}

/**
 * Per-call options for `getArrivals` / `subscribe`.
 *
 * Separate from {@link ArrivalServiceOptions} (service-level config). These
 * apply per fetch and control error-handling shape — useful for callers that
 * want category-aware error UI (e.g. ErrorFallback) instead of silent cache
 * fallback.
 */
export interface GetArrivalsOptions {
  /**
   * If `true`, `getArrivals` re-throws the underlying error after retries
   * exhaust, even when a cached result is available. Subscription consumers
   * receive the error via the second callback argument. Default `false`
   * preserves the legacy behavior — cache fallback + empty-info — so
   * existing callers are unaffected.
   *
   * Use this when the caller routes errors to a category-aware UI like
   * `ErrorFallback`, where seeing `SeoulApiError` instance directly is
   * preferable to silently degrading to stale cache. Note: when `true`,
   * seoulSubwayApi still runs its full retry chain — `throwOnError`
   * controls only the cache fallback layer.
   */
  throwOnError?: boolean;
  /**
   * Subscription only: keep polling this station while the app is in the
   * background. Default `false` — polling pauses on `background` and resumes
   * (with one immediate poll) on `active`, so a backgrounded app stops burning
   * the shared daily Seoul API quota. Route guidance opts in because departure
   * detection keeps running behind the lock screen during a guidance session.
   */
  keepPollingInBackground?: boolean;
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
 * - One network chain per station at a time (retries are owned by
 *   seoulSubwayApi, which caps one logical request at 3 fetches)
 * - Caching: AsyncStorage-based with TTL
 * - Subscription pattern: For continuous updates
 */
class ArrivalService {
  private readonly options: Required<ArrivalServiceOptions>;
  private lastFetchTime: Map<string, number> = new Map();
  private activeSubscriptions: Map<string, Set<ArrivalCallback>> = new Map();
  private pollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  // 역명별 "진행 중인 초기 fetch"를 추적해, 같은 역명의 후속 구독자가 새 fetch를
  // 트리거하지 않고 같은 Promise를 재사용하게 한다. (subscribe 참고)
  private initialFetches: Map<string, Promise<ArrivalInfo>> = new Map();
  // 역명별 진행 중인 네트워크 요청. 느린 재시도 체인이 폴링 주기(30초)를 넘겨도
  // 다음 interval 틱·foreground 복귀·재구독이 새 체인을 만들지 않고 합류한다.
  private inflightFetches: Map<string, Promise<ArrivalInfo>> = new Map();
  // Per-station interval + options captured at first subscribe, so polling can
  // be restarted identically after a background pause.
  private pollingConfigs: Map<string, { intervalMs: number; options?: GetArrivalsOptions }> = new Map();
  // Subscribers that asked to keep polling in the background (see
  // GetArrivalsOptions.keepPollingInBackground).
  private keepAliveCallbacks: Map<string, Set<ArrivalCallback>> = new Map();
  private pausedStations: Set<string> = new Set();
  private isInBackground = false;
  private appStateSubscription: { remove: () => void } | null = null;

  constructor(options?: ArrivalServiceOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Get real-time arrival information for a station
   * Respects rate limiting and uses cache when within polling interval
   *
   * @param options.throwOnError — if `true`, propagates errors instead of
   *   silently falling back to cache/empty. Default `false` preserves legacy
   *   behavior. See {@link GetArrivalsOptions.throwOnError}.
   */
  async getArrivals(
    stationName: string,
    options?: GetArrivalsOptions,
  ): Promise<ArrivalInfo> {
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

    try {
      return await this.fetchShared(trimmedName);
    } catch (error) {
      // Caller wants categorized error UI — skip cache fallback, propagate the
      // original error (e.g. SeoulApiError) so downstream can branch on category.
      // The retry chain in seoulSubwayApi already ran; this just controls
      // whether the cache layer masks the final failure.
      if (options?.throwOnError) {
        throw error;
      }

      // Legacy path: try cache first, then empty fallback.
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
   *
   * @param options.throwOnError — propagates errors to subscriber's second
   *   callback argument instead of swallowing via cache fallback. Applies to
   *   both the initial fetch and recurring polls. See
   *   {@link GetArrivalsOptions.throwOnError}.
   */
  subscribe(
    stationName: string,
    callback: ArrivalCallback,
    intervalMs?: number,
    options?: GetArrivalsOptions,
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

    // Register subscriber. Capture "첫 구독자 여부" BEFORE adding — 초기 fetch를
    // 첫 구독자만 트리거하기 위함.
    const isFirstSubscriber = !this.activeSubscriptions.has(trimmedName);
    if (!this.activeSubscriptions.has(trimmedName)) {
      this.activeSubscriptions.set(trimmedName, new Set());
    }
    this.activeSubscriptions.get(trimmedName)!.add(callback);

    if (options?.keepPollingInBackground) {
      if (!this.keepAliveCallbacks.has(trimmedName)) {
        this.keepAliveCallbacks.set(trimmedName, new Set());
      }
      this.keepAliveCallbacks.get(trimmedName)!.add(callback);
    }

    // Start polling if not already active. The interval captures `options` so
    // every poll honors the caller's error-handling preference. While the app
    // is backgrounded, a station without a keep-alive subscriber starts paused.
    if (!this.pollingConfigs.has(trimmedName)) {
      this.pollingConfigs.set(trimmedName, { intervalMs: pollInterval, options });
    }
    this.ensureAppStateListener();
    if (!this.pollingIntervals.has(trimmedName)) {
      if (this.isInBackground && !this.isKeepAlive(trimmedName)) {
        this.pausedStations.add(trimmedName);
      } else {
        this.pausedStations.delete(trimmedName);
        this.startPolling(trimmedName);
      }
    }

    // Send initial data.
    //
    // 첫 구독자만 fetch를 트리거하고 그 Promise를 `initialFetches`에 공유한다.
    // 같은 역명의 후속 구독자(예: 같은 역 즐겨찾기 2행)는 진행 중 fetch를 재사용하고,
    // 없으면 캐시 값을 받는다 — 갱신은 공유 폴링 interval에 맡긴다.
    //
    // 무조건 getArrivals를 호출하면, 빠르게 연속된 두 구독이 getArrivals의
    // lastFetchTime 가드가 설정되기 전(첫 fetch 완료 전)에 둘 다 캐시 미스로 통과해
    // per-station throttle 큐(최대 ~30초 대기)를 쌓는 회귀가 발생한다.
    // 콜백이 여전히 활성 구독자일 때만 호출한다. subscribe 직후 즉시 unsubscribe하면
    // 비행 중이던 초기 fetch가 늦게 resolve되며 죽은 콜백(예: unmount된 컴포넌트의
    // setState)을 깨우는 race가 생긴다. unsubscribe가 activeSubscriptions Set에서
    // 콜백을 제거하므로(아래 unsubscribe 참고) 그 멤버십을 호출 직전에 확인한다.
    const notifyIfActive = (info: ArrivalInfo | null, error?: Error): void => {
      if (!this.activeSubscriptions.get(trimmedName)?.has(callback)) {
        return;
      }
      // 호출 시그니처 보존: 정상 경로는 단일 인자(callback(info)), 에러 경로만
      // 두 번째 인자를 전달한다. undefined를 명시적으로 넘기면 인자 개수가 달라져
      // 기존 소비자/테스트의 정확 매칭이 깨진다.
      if (error !== undefined) {
        callback(info, error);
      } else {
        callback(info);
      }
    };

    // 에러 핸들러는 `.then(onFulfilled, onRejected)` 2-인자 형태로 전달한다.
    // `.then(...).catch(...)`였다면 onFulfilled(콜백) 내부에서 throw된 에러까지
    // catch가 삼켜 callback(null, error)로 잘못 재호출했을 것 — 여기서는 fetch
    // rejection(네트워크/API 실패)만 에러 경로로 보낸다.
    if (isFirstSubscriber) {
      const initial = this.getArrivals(trimmedName, options);
      this.initialFetches.set(trimmedName, initial);
      initial
        .then(
          (arrivals) => notifyIfActive(arrivals),
          (error) => notifyIfActive(null, error as Error),
        )
        .finally(() => {
          // 이 Promise가 여전히 등록된 것일 때만 삭제 (이후 사이클 덮어쓰기 보호).
          if (this.initialFetches.get(trimmedName) === initial) {
            this.initialFetches.delete(trimmedName);
          }
        });
    } else {
      const pending = this.initialFetches.get(trimmedName);
      if (pending) {
        pending.then(
          (arrivals) => notifyIfActive(arrivals),
          (error) => notifyIfActive(null, error as Error),
        );
      } else {
        this.getCachedArrivals(trimmedName).then(
          (cached) => {
            if (cached) notifyIfActive(cached);
          },
          () => {
            // 캐시 미스/오류는 무시 — 다음 폴링 주기가 데이터를 채운다.
          },
        );
      }
    }

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

    // Background-pause bookkeeping + AppState listener
    this.pollingConfigs.clear();
    this.keepAliveCallbacks.clear();
    this.pausedStations.clear();
    this.isInBackground = false;
    this.removeAppStateListener();

    // Clear subscriptions
    this.activeSubscriptions.clear();

    // Clear in-flight initial fetches and network requests
    this.initialFetches.clear();
    this.inflightFetches.clear();

    // Clear fetch timestamps
    this.lastFetchTime.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * One network request per station at a time: concurrent callers join the
   * in-flight one. No retry here — seoulSubwayApi owns retries (network,
   * timeout, quota fallback, auth key swap) within a 3-fetch budget, and a
   * second retry layer on top multiplied it (3 × 3 = 9 fetches per poll).
   */
  private fetchShared(stationName: string): Promise<ArrivalInfo> {
    const inflight = this.inflightFetches.get(stationName);
    if (inflight) {
      return inflight;
    }

    const request = this.fetchArrivals(stationName);
    this.inflightFetches.set(stationName, request);
    const clear = (): void => {
      if (this.inflightFetches.get(stationName) === request) {
        this.inflightFetches.delete(stationName);
      }
    };
    request.then(clear, clear);
    return request;
  }

  private async fetchArrivals(stationName: string): Promise<ArrivalInfo> {
    const startedAt = Date.now();
    const seoulData = await seoulSubwayApi.getRealtimeArrival(stationName);
    const arrivals = this.convertToArrivalInfo(stationName, seoulData);
    this.lastFetchTime.set(stationName, startedAt);

    // Cache the result — but skip empty arrivals so the next call re-fetches
    // immediately instead of returning an empty cache for the polling window.
    // An empty result usually means transient API hiccup or rate-limit; caching
    // it would freeze the UI for 30-60s on a stale empty state.
    if (arrivals.arrivals.length > 0) {
      await this.setCachedArrivals(stationName, arrivals);
    }

    return arrivals;
  }

  /**
   * Convert Seoul API response to ArrivalInfo.
   *
   * Filters:
   * - arvlCd === '2' (당역 출발): the train just left this station and no longer
   *   has a meaningful arrival time. Including it leaves a "no info" row in the UI
   *   that confuses users. Drop it.
   *
   * Stable trainId: derived from btrainNo + statnId so that the same train across
   * repeated polls gets the same React key. Including Date.now() invalidates keys
   * on every poll and forces full FlatList re-render (frame drops on long lists).
   */
  private convertToArrivalInfo(
    stationName: string,
    seoulData: SeoulRealtimeArrival[]
  ): ArrivalInfo {
    const arrivals: TrainArrival[] = seoulData
      .filter((arrival) => arrival.arvlCd !== '2')
      .map((arrival, index) => {
        const converted = seoulSubwayApi.convertToAppTrain(arrival);
        // Stable key matching dataManager.convertSeoulToTrain so both legacy
        // one-shot fetches and arrivalService subscriptions produce the same
        // trainId for the same train.
        //
        // Fallback chain rationale:
        //   1. btrainNo: present in 100% of well-formed Seoul API responses.
        //   2. ordkey: also present in 100% of well-formed responses.
        //   3. statnId + index: only reached for truly malformed rows missing
        //      both above. statnId alone collides (every row shares the same
        //      statnId), so we append index. List-shift instability in this
        //      branch is accepted because at this point the data is malformed
        //      anyway — any stable identity would be fabricated.
        const stableKey =
          arrival.btrainNo || arrival.ordkey || `${arrival.statnId}_${index}`;
        return {
          trainId: `train_${stableKey}_${arrival.statnId}`,
          lineId: this.normalizeLineId(converted.lineId),
          direction: converted.direction as 'up' | 'down',
          destination: converted.destinationStation,
          arrivalSeconds: converted.arrivalTime,
          arrivalMessage: converted.arrivalMessage,
          trainNumber: converted.trainNumber,
          trainType: converted.trainType,
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
    return normalizeSeoulLineId(lineId);
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
  private async pollAndNotify(
    stationName: string,
    options?: GetArrivalsOptions,
  ): Promise<void> {
    try {
      const arrivals = await this.getArrivals(stationName, options);
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
      this.keepAliveCallbacks.get(stationName)?.delete(callback);

      // If no more subscribers, stop polling
      if (subscribers.size === 0) {
        const interval = this.pollingIntervals.get(stationName);
        if (interval) {
          clearInterval(interval);
          this.pollingIntervals.delete(stationName);
        }
        this.activeSubscriptions.delete(stationName);
        this.pollingConfigs.delete(stationName);
        this.keepAliveCallbacks.delete(stationName);
        this.pausedStations.delete(stationName);
      } else if (this.isInBackground && !this.isKeepAlive(stationName)) {
        // The last keep-alive subscriber left while backgrounded — pause now.
        this.pauseStation(stationName);
      }
    }

    if (this.activeSubscriptions.size === 0) {
      this.removeAppStateListener();
    }
  }

  // ==========================================================================
  // Background pause (AppState)
  // ==========================================================================

  private startPolling(stationName: string): void {
    const config = this.pollingConfigs.get(stationName);
    if (!config || this.pollingIntervals.has(stationName)) return;

    const interval = setInterval(async () => {
      await this.pollAndNotify(stationName, config.options);
    }, config.intervalMs);

    // 폴링 타이머가 Node/Jest 프로세스 종료를 막지 않도록 unref (구독 후
    // unsubscribe 없는 테스트의 open handle 누수 방어). RN의 setInterval은
    // number 반환이라 unref가 없어 가드로 프로덕션 동작은 보존된다.
    (interval as { unref?: () => void }).unref?.();

    this.pollingIntervals.set(stationName, interval);
  }

  private pauseStation(stationName: string): void {
    const interval = this.pollingIntervals.get(stationName);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(stationName);
    }
    this.pausedStations.add(stationName);
  }

  private isKeepAlive(stationName: string): boolean {
    return (this.keepAliveCallbacks.get(stationName)?.size ?? 0) > 0;
  }

  private ensureAppStateListener(): void {
    if (this.appStateSubscription) return;
    // The listener is removed while no station is subscribed, so transitions
    // in that gap are missed — resync from the current state before use.
    this.isInBackground = AppState.currentState === 'background';
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private removeAppStateListener(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  // 'inactive' (iOS transient: control center, app switcher peek) is ignored —
  // pausing on it would churn intervals. Only a real background pauses.
  private handleAppStateChange = (next: AppStateStatus): void => {
    if (next === 'background') {
      this.isInBackground = true;
      Array.from(this.pollingIntervals.keys()).forEach((station) => {
        if (!this.isKeepAlive(station)) this.pauseStation(station);
      });
    } else if (next === 'active' && this.isInBackground) {
      this.isInBackground = false;
      const resumed = Array.from(this.pausedStations);
      this.pausedStations.clear();
      resumed.forEach((station) => {
        if (!this.activeSubscriptions.has(station)) return;
        this.startPolling(station);
        // Refresh right away — the data is stale after the pause. getArrivals
        // still honors the min polling interval / cache.
        void this.pollAndNotify(station, this.pollingConfigs.get(station)?.options);
      });
    }
  };

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
}

// ============================================================================
// Export
// ============================================================================

/** Singleton instance */
export const arrivalService = new ArrivalService();

/** Export class for custom instances */
export { ArrivalService };
