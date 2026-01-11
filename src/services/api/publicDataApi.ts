/**
 * Public Data Portal API Service
 * 공공데이터포털 API 통합 서비스
 *
 * APIs:
 * 1. 서울교통공사_지하철혼잡도정보 (api.odcloud.kr - 15071311)
 * 2. 서울교통공사_교통약자이용정보 (apis.data.go.kr - B553766/wksn)
 * 3. 서울교통공사_지하철알림정보 (apis.data.go.kr - B553766/ntce)
 * 4. 국가철도공단_출구별주요장소 (api.odcloud.kr - 15073460)
 */

import {
  PublicDataResponse,
  DataGoKrResponse,
  CongestionRawData,
  CongestionInfo,
  CurrentCongestion,
  AccessibilityRawData,
  AccessibilityInfo,
  AlertRawData,
  SubwayAlert,
  ExitLandmarkRawData,
  ExitLandmark,
  ExitInfo,
  TrainSchedule,
  DayTypeCode,
  DirectionCode,
  getCongestionLevel,
  parseAlertType,
  parseLandmarkCategory,
} from '@/models/publicData';

// ============================================================================
// Constants
// ============================================================================

const API_KEY = process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY || '';
const API_TIMEOUT = 10000;

// NOTE: apis.data.go.kr endpoints don't support CORS (browser access blocked)
// These APIs work on native platforms (iOS/Android) but NOT on web
const ENDPOINTS = {
  CONGESTION: 'https://api.odcloud.kr/api/15071311/v1/uddi:f5381f71-5c8a-4a78-9773-1327922dc657',
  ACCESSIBILITY: 'https://apis.data.go.kr/B553766/wksn/stnInfoList',
  ALERTS: 'https://apis.data.go.kr/B553766/ntce/ntceList',
  EXIT_LANDMARKS: 'https://api.odcloud.kr/api/15073460/v1/uddi:5e336c4a-7f38-4429-b815-e1c31c0a6c46',
  // SCHEDULE endpoint removed - use seoulSubwayApi.getStationTimetable instead
} as const;

/**
 * Check if running in web environment (CORS restrictions apply)
 */
const isWebPlatform = (): boolean => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

// ============================================================================
// Rate Limiter (재사용)
// ============================================================================

class RateLimiter {
  private lastRequestTimes: Map<string, number> = new Map();
  private minIntervalMs: number;

  constructor(minIntervalMs: number = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  async throttle(key: string): Promise<void> {
    const lastRequest = this.lastRequestTimes.get(key) || 0;
    const elapsed = Date.now() - lastRequest;

    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }

    this.lastRequestTimes.set(key, Date.now());
  }
}

// ============================================================================
// Retry 메커니즘
// ============================================================================

interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2 }
): Promise<T> {
  let lastError: Error | null = null;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= options.backoffMultiplier;
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Service
// ============================================================================

class PublicDataApiService {
  private rateLimiter = new RateLimiter(1000);

  // ==========================================================================
  // 1. 혼잡도 정보
  // ==========================================================================

  /**
   * 역별 혼잡도 정보 조회
   */
  async getCongestionInfo(stationName: string): Promise<CongestionInfo[]> {
    return withRetry(async () => {
      await this.rateLimiter.throttle('congestion');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      try {
        const url = new URL(ENDPOINTS.CONGESTION);
        url.searchParams.append('serviceKey', decodeURIComponent(API_KEY));
        url.searchParams.append('page', '1');
        url.searchParams.append('perPage', '100');
        url.searchParams.append('cond[역명::EQ]', stationName);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: PublicDataResponse<CongestionRawData> = await response.json();
        return this.convertCongestionData(data.data);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * 현재 시간대 혼잡도 조회
   */
  async getCurrentCongestion(stationName: string, direction: 'up' | 'down'): Promise<CurrentCongestion | null> {
    try {
      const congestionList = await this.getCongestionInfo(stationName);
      const now = new Date();
      const currentTimeSlot = this.getCurrentTimeSlot(now);
      const dayType = this.getDayType(now);

      const matching = congestionList.find(
        (c) => c.direction === direction && c.dayType === dayType
      );

      if (!matching) {
        return null;
      }

      const percentage = matching.timeSlots.get(currentTimeSlot) || 0;

      return {
        stationName,
        lineNum: matching.lineNum,
        direction,
        level: getCongestionLevel(percentage),
        percentage,
        updatedAt: now,
      };
    } catch (error) {
      console.error('Error getting current congestion:', error);
      return null;
    }
  }

  // ==========================================================================
  // 2. 교통약자 이용 정보
  // ==========================================================================

  /**
   * 교통약자 편의시설 정보 조회
   * NOTE: apis.data.go.kr doesn't support CORS - returns null on web platform
   */
  async getAccessibilityInfo(stationName: string): Promise<AccessibilityInfo | null> {
    // Skip API call on web platform (CORS not supported)
    if (isWebPlatform()) {
      console.debug('[PublicDataApi] Skipping accessibility API on web (CORS not supported)');
      return null;
    }

    return withRetry(async () => {
      await this.rateLimiter.throttle('accessibility');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      try {
        const url = new URL(ENDPOINTS.ACCESSIBILITY);
        url.searchParams.append('serviceKey', decodeURIComponent(API_KEY));
        url.searchParams.append('numOfRows', '10');
        url.searchParams.append('pageNo', '1');
        url.searchParams.append('stinNm', stationName);
        url.searchParams.append('type', 'json');

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: DataGoKrResponse<AccessibilityRawData> = await response.json();
        const firstItem = data.response.body.items[0];

        if (!firstItem) {
          return null;
        }

        return this.convertAccessibilityData(firstItem);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  // ==========================================================================
  // 3. 지하철 알림 정보
  // ==========================================================================

  /**
   * 전체 알림 목록 조회
   * NOTE: apis.data.go.kr doesn't support CORS - returns empty array on web platform
   */
  async getAlerts(): Promise<SubwayAlert[]> {
    // Skip API call on web platform (CORS not supported)
    if (isWebPlatform()) {
      console.debug('[PublicDataApi] Skipping alerts API on web (CORS not supported)');
      return [];
    }

    return withRetry(async () => {
      await this.rateLimiter.throttle('alerts');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      try {
        const url = new URL(ENDPOINTS.ALERTS);
        url.searchParams.append('serviceKey', decodeURIComponent(API_KEY));
        url.searchParams.append('numOfRows', '50');
        url.searchParams.append('pageNo', '1');
        url.searchParams.append('type', 'json');

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: DataGoKrResponse<AlertRawData> = await response.json();
        return this.convertAlertData(data.response.body.items);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * 활성 알림만 조회
   */
  async getActiveAlerts(): Promise<SubwayAlert[]> {
    const alerts = await this.getAlerts();
    return alerts.filter((alert) => alert.isActive);
  }

  /**
   * 특정 노선 알림 조회
   */
  async getAlertsByLine(lineName: string): Promise<SubwayAlert[]> {
    const alerts = await this.getAlerts();
    return alerts.filter((alert) => alert.lineName.includes(lineName));
  }

  // ==========================================================================
  // 4. 출구별 주요 장소
  // ==========================================================================

  /**
   * 역 출구별 주요 장소 조회
   * NOTE: api.odcloud.kr may have CORS issues - returns empty array on web platform
   */
  async getExitLandmarks(stationName: string): Promise<ExitLandmark[]> {
    // Skip API call on web platform (CORS not reliably supported)
    if (isWebPlatform()) {
      console.debug('[PublicDataApi] Skipping exit landmarks API on web (CORS not supported)');
      return [];
    }

    return withRetry(async () => {
      await this.rateLimiter.throttle('exits');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      try {
        const url = new URL(ENDPOINTS.EXIT_LANDMARKS);
        url.searchParams.append('serviceKey', decodeURIComponent(API_KEY));
        url.searchParams.append('page', '1');
        url.searchParams.append('perPage', '100');
        url.searchParams.append('cond[역명::EQ]', stationName);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: PublicDataResponse<ExitLandmarkRawData> = await response.json();
        return this.convertExitLandmarkData(data.data);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * 출구별로 그룹화된 장소 정보 조회
   */
  async getExitInfoGrouped(stationName: string): Promise<ExitInfo[]> {
    const landmarks = await this.getExitLandmarks(stationName);

    const grouped = new Map<string, ExitLandmark[]>();
    for (const landmark of landmarks) {
      const existing = grouped.get(landmark.exitNumber) || [];
      existing.push(landmark);
      grouped.set(landmark.exitNumber, existing);
    }

    return Array.from(grouped.entries())
      .map(([exitNumber, landmarks]) => ({ exitNumber, landmarks }))
      .sort((a, b) => {
        const numA = parseInt(a.exitNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.exitNumber.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
  }

  // ==========================================================================
  // 5. 열차시간표 정보 (DEPRECATED)
  // ==========================================================================
  // NOTE: 이 API들은 더 이상 사용되지 않습니다.
  // 대신 seoulSubwayApi.getStationTimetable() 또는 useTrainSchedule 훅을 사용하세요.
  // ==========================================================================

  /**
   * @deprecated Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead
   */
  async getTrainSchedule(
    _stationName: string,
    _lineNumber: string,
    _dayType?: DayTypeCode,
    _direction?: DirectionCode
  ): Promise<TrainSchedule[]> {
    console.warn(
      '[PublicDataApi] getTrainSchedule is deprecated. ' +
      'Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead.'
    );
    return [];
  }

  /**
   * @deprecated Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead
   */
  async getTodaySchedule(
    _stationName: string,
    _lineNumber: string,
    _direction?: DirectionCode
  ): Promise<TrainSchedule[]> {
    console.warn(
      '[PublicDataApi] getTodaySchedule is deprecated. ' +
      'Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead.'
    );
    return [];
  }

  /**
   * @deprecated Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead
   */
  async getUpcomingTrains(
    _stationName: string,
    _lineNumber: string,
    _direction: DirectionCode,
    _minutesAhead: number = 30
  ): Promise<TrainSchedule[]> {
    console.warn(
      '[PublicDataApi] getUpcomingTrains is deprecated. ' +
      'Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead.'
    );
    return [];
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private convertCongestionData(rawData: readonly CongestionRawData[]): CongestionInfo[] {
    return rawData.map((raw) => {
      const timeSlots = new Map<string, number>();

      // 시간대별 혼잡도 매핑
      const rawRecord = raw as unknown as Record<string, string>;
      const timeKeys = Object.keys(rawRecord).filter((key) => key.includes('시'));
      for (const key of timeKeys) {
        const value = parseFloat(rawRecord[key] || '0');
        timeSlots.set(key, value);
      }

      return {
        lineNum: raw.호선,
        stationName: raw.역명,
        direction: raw.상하구분 === '상선' ? 'up' : 'down',
        dayType: this.parseDayType(raw.요일구분),
        timeSlots,
      };
    });
  }

  private convertAccessibilityData(raw: AccessibilityRawData): AccessibilityInfo {
    return {
      stationCode: raw.stinCd,
      stationName: raw.stinNm,
      lineName: raw.routNm,
      elevator: {
        available: raw.elvtrSttus !== '0' && raw.elvtrSttus !== '',
        count: parseInt(raw.elvtrSttus) || 0,
        status: 'normal',
      },
      escalator: {
        available: raw.esltrSttus !== '0' && raw.esltrSttus !== '',
        count: parseInt(raw.esltrSttus) || 0,
        status: 'normal',
      },
      wheelchairLift: raw.wlchUseYn === 'Y',
      tactilePaving: raw.tctlPvmtYn === 'Y',
      accessibleRestroom: raw.bndFreeYn === 'Y',
    };
  }

  private convertAlertData(rawData: readonly AlertRawData[]): SubwayAlert[] {
    const now = new Date();

    return rawData.map((raw) => {
      const startTime = new Date(raw.ntceSdt);
      const endTime = raw.ntceEdt ? new Date(raw.ntceEdt) : null;
      const isActive = startTime <= now && (!endTime || endTime >= now);

      return {
        alertId: raw.ntceId,
        title: raw.ntceTtl,
        content: raw.ntceCn,
        lineName: raw.routNm,
        alertType: parseAlertType(raw.ntceTp),
        startTime,
        endTime,
        isActive,
        affectedStations: [],
      };
    });
  }

  private convertExitLandmarkData(rawData: readonly ExitLandmarkRawData[]): ExitLandmark[] {
    return rawData.map((raw) => ({
      stationCode: raw.역번호,
      stationName: raw.역명,
      lineNum: raw.호선,
      exitNumber: raw.출구번호,
      landmarkName: raw.주요장소,
      category: parseLandmarkCategory(raw.장소분류 || ''),
    }));
  }

  private parseDayType(dayStr: string): 'weekday' | 'saturday' | 'holiday' {
    if (dayStr.includes('토')) return 'saturday';
    if (dayStr.includes('일') || dayStr.includes('공휴')) return 'holiday';
    return 'weekday';
  }

  private getCurrentTimeSlot(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const slot = minutes < 30 ? '00분' : '30분';
    return `${hours}시${slot}`;
  }

  private getDayType(date: Date): 'weekday' | 'saturday' | 'holiday' {
    const day = date.getDay();
    if (day === 0) return 'holiday';
    if (day === 6) return 'saturday';
    return 'weekday';
  }

  // Removed deprecated train schedule helper methods
  // Use seoulSubwayApi.getStationTimetable() or useTrainSchedule hook instead
}

// ============================================================================
// Export
// ============================================================================

export const publicDataApi = new PublicDataApiService();
export default publicDataApi;
