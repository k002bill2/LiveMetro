/**
 * Seoul Subway API Integration Service
 * Real-time subway data from Seoul Open API
 */

import { createSeoulApiKeyManager, createPublicDataApiKeyManager, ApiKeyManager } from './apiKeyManager';

/**
 * Rate Limiter for Seoul API (30-second minimum interval per endpoint)
 * Required by CLAUDE.md: "Seoul API - 30s minimum polling interval"
 */
class RateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private readonly minInterval: number;

  constructor(minIntervalMs: number = 30000) {
    this.minInterval = minIntervalMs;
  }

  /**
   * Throttle requests to ensure minimum interval between calls
   * @param key Unique key for the endpoint (e.g., 'realtime:강남')
   * @returns Time waited in ms (0 if no wait needed)
   */
  async throttle(key: string): Promise<number> {
    const lastTime = this.lastRequestTime.get(key) || 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed < this.minInterval) {
      const waitTime = this.minInterval - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.lastRequestTime.set(key, Date.now());
      return waitTime;
    }

    this.lastRequestTime.set(key, Date.now());
    return 0;
  }

  /**
   * Check if a request can be made without waiting
   */
  canRequest(key: string): boolean {
    const lastTime = this.lastRequestTime.get(key) || 0;
    return Date.now() - lastTime >= this.minInterval;
  }

  /**
   * Get remaining cooldown time in ms
   */
  getRemainingCooldown(key: string): number {
    const lastTime = this.lastRequestTime.get(key) || 0;
    const remaining = this.minInterval - (Date.now() - lastTime);
    return Math.max(0, remaining);
  }

  /**
   * Clear rate limit for a specific key (for testing)
   */
  clear(key?: string): void {
    if (key) {
      this.lastRequestTime.delete(key);
    } else {
      this.lastRequestTime.clear();
    }
  }
}

/**
 * Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (lastError.message.includes('API 요청 시간이 초과')) {
        // Timeout - retry with backoff
      } else if (lastError.message.includes('Seoul API Error')) {
        // API error - don't retry
        throw lastError;
      }

      if (attempt < maxAttempts) {
        console.warn(`API call failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Thrown by getStationTimetable when called on a web platform.
 *
 * Seoul Open Data Portal's timetable endpoint is HTTP-only (port 8088, no HTTPS).
 * Browsers block mixed-content fetch from HTTPS pages, so the call cannot succeed.
 * Native (iOS/Android) clients are unaffected. Callers should translate this
 * into a user-facing message rather than treating it as a generic failure.
 */
export class TimetableUnsupportedOnWebError extends Error {
  constructor() {
    super('Timetable API is not supported on web (HTTP-only endpoint)');
    this.name = 'TimetableUnsupportedOnWebError';
  }
}

interface SeoulApiResponse<T> {
  errorMessage?: {
    status: number;
    code: string;
    message: string;
    link?: string;
    developerMessage?: string;
    total?: number;
  };
  realtimeArrivalList?: T[];
  SearchInfoBySubwayNameService?: {
    list_total_count: number;
    RESULT: {
      CODE: string;
      MESSAGE: string;
    };
    row?: T[];
  };
}

interface SeoulRealtimeArrival {
  rowNum: string;
  selectedCount: string;
  totalCount: string;
  subwayId: string;
  updnLine: string;
  trainLineNm: string;
  subwayHeading: string;
  statnFid: string;
  statnTid: string;
  statnId: string;
  statnNm: string;
  trainCo: string;
  ordkey: string;
  subwayList: string;
  statnList: string;
  btrainSttus: string;
  barvlDt: string;
  btrainNo: string;
  bstatnId: string;
  bstatnNm: string;
  recptnDt: string;
  arvlMsg2: string;
  arvlMsg3: string;
  arvlCd: string;
}

interface SeoulStationInfo {
  STATION_CD: string;
  STATION_NM: string;
  LINE_NUM: string;
  FR_CODE: string;
  XPOS: string;
  YPOS: string;
}

interface SeoulTimetableRow {
  STATION_CD: string;
  STATION_NM: string;
  TRAIN_NO: string;
  ARRIVETIME: string;
  LEFTTIME: string;
  ORIGIN_STATION_NM: string;
  DEST_STATION_NM: string;
  SUBWAYSNAME: string;
  WEEK_TAG: string;
  INOUT_TAG: string;
  FLAG: string;
  STATION_NM_ENG?: string;
  TYPE?: string; // 급행 여부 등
}

interface SeoulTimetableResponse {
  SearchSTNTimeTableByIDService?: {
    list_total_count: number;
    RESULT: {
      CODE: string;
      MESSAGE: string;
    };
    row: SeoulTimetableRow[];
  };
}

class SeoulSubwayApiService {
  private readonly baseUrl: string;
  private readonly timeout: number = 10000;
  private readonly rateLimiter: RateLimiter;
  private readonly keyManager: ApiKeyManager;
  private readonly timetableKeyManager: ApiKeyManager;
  /** In-flight request cache for deduplication */
  private readonly inflightRequests: Map<string, Promise<SeoulRealtimeArrival[]>> = new Map();

  /**
   * Clear in-flight request cache (for testing)
   */
  clearInflightRequests(): void {
    this.inflightRequests.clear();
  }

  constructor() {
    this.baseUrl = process.env.SEOUL_SUBWAY_API_BASE_URL || 'http://swopenapi.seoul.go.kr/api/subway';
    this.rateLimiter = new RateLimiter(30000); // 30-second minimum interval
    this.keyManager = createSeoulApiKeyManager({
      disableDurationMs: 60000, // 1분간 비활성화
      errorThreshold: 3, // 연속 3회 에러 시 비활성화
    });
    this.timetableKeyManager = createPublicDataApiKeyManager({
      disableDurationMs: 60000,
      errorThreshold: 3,
    });

    if (this.keyManager.keyCount === 0) {
      console.warn('Seoul Subway API key not found. Please set EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY environment variable.');
    } else {
      console.info(`Seoul Subway API: ${this.keyManager.keyCount} key(s) loaded`);
    }

    if (this.timetableKeyManager.keyCount === 0) {
      console.warn('Data Portal API key not found. Please set EXPO_PUBLIC_DATA_PORTAL_API_KEY environment variable.');
    } else {
      console.info(`Timetable API: ${this.timetableKeyManager.keyCount} key(s) loaded`);
    }
  }

  /**
   * API 키 상태 조회 (디버깅/모니터링용)
   */
  getKeyStats(): { realtime: ReturnType<ApiKeyManager['getKeyStats']>; timetable: ReturnType<ApiKeyManager['getKeyStats']> } {
    return {
      realtime: this.keyManager.getKeyStats(),
      timetable: this.timetableKeyManager.getKeyStats(),
    };
  }

  /**
   * Get the rate limiter instance (for testing or status checks)
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get real-time arrival information for a station
   * Rate limited to 30-second minimum interval per station
   * Uses ApiKeyManager for automatic key rotation and failover
   */
  async getRealtimeArrival(stationName: string): Promise<SeoulRealtimeArrival[]> {
    // Request deduplication: reuse in-flight request for same station
    const dedupKey = `arrival:${stationName}`;
    const inflight = this.inflightRequests.get(dedupKey);
    if (inflight) {
      return inflight;
    }

    const promise = this.fetchRealtimeArrival(stationName);

    this.inflightRequests.set(dedupKey, promise);
    // Use .then with both handlers to avoid unhandled rejection from .finally()
    promise.then(
      () => { this.inflightRequests.delete(dedupKey); },
      () => { this.inflightRequests.delete(dedupKey); }
    );

    return promise;
  }

  /**
   * Internal: actual fetch logic for realtime arrival (separated for dedup)
   */
  private async fetchRealtimeArrival(stationName: string): Promise<SeoulRealtimeArrival[]> {
    const rateLimitKey = `realtime:${stationName}`;

    // Apply rate limiting (30-second minimum interval)
    const waitedMs = await this.rateLimiter.throttle(rateLimitKey);
    if (waitedMs > 0) {
      console.debug(`Rate limited: waited ${waitedMs}ms before fetching ${stationName}`);
    }

    return withRetry(async () => {
      const apiKey = this.keyManager.getNextKey();
      if (!apiKey) {
        throw new Error('사용 가능한 API 키가 없습니다. 잠시 후 다시 시도해주세요.');
      }

      try {
        const url = `${this.baseUrl}/${apiKey}/json/realtimeStationArrival/0/10/${encodeURIComponent(stationName)}`;

        const response = await this.fetchWithTimeout(url);
        const data: SeoulApiResponse<SeoulRealtimeArrival> = await response.json();

        // Check for API errors
        if (data.errorMessage) {
          const errorCode = data.errorMessage.code;

          // INFO-000 means success - return data if available
          if (errorCode === 'INFO-000') {
            this.keyManager.reportSuccess(apiKey);
            return data.realtimeArrivalList || [];
          }

          // Rate limit error - immediately switch to another key
          if (errorCode === 'ERROR-500' || errorCode === 'ERROR-501') {
            const fallbackKey = this.keyManager.reportRateLimit(apiKey);
            if (fallbackKey) {
              console.warn(`Rate limit hit, switching to backup key`);
            }
          } else {
            this.keyManager.reportError(apiKey);
          }

          throw new Error(`Seoul API Error: ${data.errorMessage.message} (Code: ${errorCode})`);
        }

        // Success - report to key manager
        this.keyManager.reportSuccess(apiKey);
        return data.realtimeArrivalList || [];
      } catch (error) {
        throw new Error(`실시간 도착정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    });
  }

  /**
   * Get station information by subway line
   * Rate limited to 30-second minimum interval per line
   */
  async getStationsByLine(lineNumber: string): Promise<SeoulStationInfo[]> {
    const rateLimitKey = `stations:line:${lineNumber}`;

    // Apply rate limiting
    await this.rateLimiter.throttle(rateLimitKey);

    return withRetry(async () => {
      const apiKey = this.keyManager.getNextKey();
      if (!apiKey) {
        throw new Error('사용 가능한 API 키가 없습니다.');
      }

      try {
        const url = `${this.baseUrl}/${apiKey}/json/SearchInfoBySubwayNameService/1/1000/${encodeURIComponent(lineNumber)}호선`;

        const response = await this.fetchWithTimeout(url);
        const data: SeoulApiResponse<SeoulStationInfo> = await response.json();

        // Check for API errors
        if (data.errorMessage) {
          this.keyManager.reportError(apiKey);
          throw new Error(`Seoul API Error: ${data.errorMessage.message} (Code: ${data.errorMessage.code})`);
        }

        if (data.SearchInfoBySubwayNameService?.RESULT.CODE !== 'INFO-000') {
          throw new Error(`API Error: ${data.SearchInfoBySubwayNameService?.RESULT.MESSAGE}`);
        }

        this.keyManager.reportSuccess(apiKey);
        return data.SearchInfoBySubwayNameService?.row || [];
      } catch (error) {
        console.error('Error fetching stations by line:', error);
        throw new Error(`역 정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    });
  }

  /**
   * Get all Seoul subway stations with coordinates
   */
  async getAllStations(): Promise<SeoulStationInfo[]> {
    const allStations: SeoulStationInfo[] = [];
    const lines = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    try {
      const stationPromises = lines.map(line => this.getStationsByLine(line));
      const results = await Promise.allSettled(stationPromises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allStations.push(...result.value);
        } else {
          console.warn(`Failed to fetch stations for line ${lines[index]}:`, result.reason);
        }
      });

      // Remove duplicates (transfer stations appear in multiple lines)
      const uniqueStations = allStations.filter((station, index, self) => 
        index === self.findIndex(s => s.STATION_NM === station.STATION_NM)
      );

      return uniqueStations;
    } catch (error) {
      console.error('Error fetching all stations:', error);
      throw new Error(`전체 역 정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * Check service status and API connectivity
   */
  async checkServiceStatus(): Promise<boolean> {
    try {
      // Test with a common station like '강남역'
      await this.getRealtimeArrival('강남');
      return true;
    } catch (error) {
      console.error('Seoul Subway API service check failed:', error);
      return false;
    }
  }

  /**
   * Get station timetable (schedule)
   * Rate limited to 30-second minimum interval per station/weekTag/inoutTag combo
   * NOTE: Uses HTTP API (openapi.seoul.go.kr) - may not work on web due to mixed content
   * @param stationCode Station code (e.g., '0222' for Gangnam)
   * @param weekTag '1': Weekday, '2': Saturday, '3': Holiday/Sunday
   * @param inoutTag '1': Up/Inner, '2': Down/Outer
   */
  async getStationTimetable(
    stationCode: string,
    weekTag: '1' | '2' | '3' = '1',
    inoutTag: '1' | '2' = '1'
  ): Promise<SeoulTimetableRow[]> {
    // Skip API call on web platform — HTTP-only endpoint is blocked by mixed-content
    // policy. Throw a typed error so callers can render an informative message
    // instead of an empty schedule that looks like a bug.
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      console.debug('[SeoulSubwayApi] Timetable API not supported on web');
      throw new TimetableUnsupportedOnWebError();
    }

    const rateLimitKey = `timetable:${stationCode}:${weekTag}:${inoutTag}`;

    // Apply rate limiting
    await this.rateLimiter.throttle(rateLimitKey);

    return withRetry(async () => {
      const apiKey = this.timetableKeyManager.getNextKey();
      if (!apiKey) {
        throw new Error('사용 가능한 Data Portal API 키가 없습니다. EXPO_PUBLIC_DATA_PORTAL_API_KEY를 설정해주세요.');
      }

      try {
        // Note: Timetable API uses HTTP (not HTTPS) - only works on native platforms
        const generalBaseUrl = process.env.SEOUL_OPEN_API_BASE_URL || 'http://openapi.seoul.go.kr:8088';
        const url = `${generalBaseUrl}/${apiKey}/json/SearchSTNTimeTableByIDService/1/30/${stationCode}/${weekTag}/${inoutTag}/`;

        const response = await this.fetchWithTimeout(url);
        const data: SeoulTimetableResponse = await response.json();

        // Handle empty or invalid response structure
        if (!data || !data.SearchSTNTimeTableByIDService) {
          console.warn('[SeoulSubwayApi] Empty or invalid timetable response');
          this.timetableKeyManager.reportSuccess(apiKey);
          return [];
        }

        const resultCode = data.SearchSTNTimeTableByIDService.RESULT?.CODE;
        const resultMessage = data.SearchSTNTimeTableByIDService.RESULT?.MESSAGE || 'Unknown error';

        if (resultCode !== 'INFO-000') {
          // INFO-200 means no data found, which is valid for empty schedules
          if (resultCode === 'INFO-200') {
            this.timetableKeyManager.reportSuccess(apiKey);
            return [];
          }
          this.timetableKeyManager.reportError(apiKey);
          throw new Error(`API Error: ${resultMessage}`);
        }

        this.timetableKeyManager.reportSuccess(apiKey);
        return data.SearchSTNTimeTableByIDService.row || [];
      } catch (error) {
        console.error('Error fetching station timetable:', error);
        throw new Error(`시간표 정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    });
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LiveMetro/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API 요청 시간이 초과되었습니다.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert Seoul API arrival data to app Train model
   */
  convertToAppTrain(seoulData: SeoulRealtimeArrival): {
    lineId: string;
    stationId: string;
    stationName: string;
    direction: string;
    arrivalMessage: string;
    arrivalTime: number | null;
    trainNumber: string;
    destinationStation: string;
    lastUpdated: Date;
  } {
    // Primary: use barvlDt (exact remaining seconds from Seoul API)
    let arrivalTime: number | null = null;

    if (seoulData.barvlDt) {
      const seconds = parseInt(seoulData.barvlDt, 10);
      if (!isNaN(seconds) && seconds >= 0) {
        arrivalTime = seconds;
      }
    }

    // Fallback: parse arrival message text when barvlDt is unavailable
    if (arrivalTime === null) {
      const arrivalMsg = seoulData.arvlMsg2 || seoulData.arvlMsg3 || '';

      // "X분 Y초후" pattern (e.g., "3분 20초후")
      const minSecMatch = arrivalMsg.match(/(\d+)분\s*(\d+)초/);
      if (minSecMatch?.[1] && minSecMatch[2]) {
        arrivalTime = parseInt(minSecMatch[1], 10) * 60 + parseInt(minSecMatch[2], 10);
      }

      // "X분후" pattern (e.g., "2분후[1번째전]")
      if (arrivalTime === null) {
        const minuteMatch = arrivalMsg.match(/(\d+)분후/);
        if (minuteMatch?.[1]) {
          arrivalTime = parseInt(minuteMatch[1], 10) * 60;
        }
      }

      // Station proximity patterns
      if (arrivalTime === null) {
        if (arrivalMsg.includes('곧 도착') || arrivalMsg.includes('진입')) {
          arrivalTime = 30;
        } else if (arrivalMsg.includes('도착') || arrivalMsg.includes('출발')) {
          arrivalTime = 0;
        }
      }
    }

    // arvlCd fallback: 0=진입, 1=도착, 2=출발, 3=전역출발, 4=전역진입, 5=전역도착
    // 전역(前驛) = 이전 역. 순서: 전역진입→전역도착→전역출발→당역진입→당역도착→당역출발
    if (arrivalTime === null && seoulData.arvlCd) {
      const code = seoulData.arvlCd;
      if (code === '0') {
        arrivalTime = 30;  // 당역 진입 → 곧 도착
      } else if (code === '1') {
        arrivalTime = 0;   // 당역 도착
      } else if (code === '2') {
        arrivalTime = null; // 당역 출발 → 이미 지남, 표시 제외
      } else if (code === '3') {
        arrivalTime = 120; // 전역 출발 → 약 2분 (이동 중)
      } else if (code === '4') {
        arrivalTime = 180; // 전역 진입 → 약 3분 (가장 먼 상태)
      } else if (code === '5') {
        arrivalTime = 150; // 전역 도착 → 약 2.5분 (정차 중)
      }
    }

    // Direction: handle Line 2 circular (내선/외선)
    const updnLine = seoulData.updnLine;
    const direction = (updnLine === '상행' || updnLine === '내선') ? 'up' : 'down';

    return {
      lineId: seoulData.subwayId || seoulData.trainLineNm,
      stationId: seoulData.statnId,
      stationName: seoulData.statnNm,
      direction,
      arrivalMessage: seoulData.arvlMsg2 || seoulData.arvlMsg3 || '',
      arrivalTime,
      trainNumber: seoulData.btrainNo || '',
      destinationStation: seoulData.bstatnNm || seoulData.subwayHeading || '',
      lastUpdated: new Date()
    };
  }
}

// Export singleton instance
export const seoulSubwayApi = new SeoulSubwayApiService();

// Export utilities for external use
export { RateLimiter, withRetry };
export type { SeoulRealtimeArrival, SeoulStationInfo, SeoulTimetableRow, SeoulTimetableResponse };