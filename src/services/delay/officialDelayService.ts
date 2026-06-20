/**
 * Official Delay Service
 * Fetches official delay information from Seoul Metro API
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Official delay information
 */
export interface OfficialDelay {
  readonly lineId: string;
  readonly lineName: string;
  readonly status: DelayStatus;
  readonly delayMinutes?: number;
  readonly reason?: string;
  readonly affectedStations?: readonly string[];
  readonly startTime?: Date;
  readonly estimatedEndTime?: Date;
  readonly updatedAt: Date;
  readonly source: 'seoul_metro' | 'korail' | 'internal';
}

/**
 * Delay status
 */
export type DelayStatus = 'normal' | 'delayed' | 'suspended' | 'modified';

/**
 * Line status response
 */
export interface LineStatusResponse {
  readonly lines: readonly OfficialDelay[];
  readonly timestamp: Date;
  readonly isRealtime: boolean;
}

/**
 * Delay alert
 */
export interface DelayAlert {
  readonly id: string;
  readonly lineId: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly title: string;
  readonly message: string;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

// ============================================================================
// Constants
// ============================================================================

// Seoul Metro API endpoints (would be actual API in production)
export const API_BASE_URL = 'http://swopenapi.seoul.go.kr/api/subway';
const CACHE_DURATION_MS = 60 * 1000; // 1 minute

const LINE_NAMES: Record<string, string> = {
  '1': '1호선',
  '2': '2호선',
  '3': '3호선',
  '4': '4호선',
  '5': '5호선',
  '6': '6호선',
  '7': '7호선',
  '8': '8호선',
  '9': '9호선',
};

// ============================================================================
// Service
// ============================================================================

class OfficialDelayService {
  private cache: {
    data: LineStatusResponse | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };

  /**
   * Get all line statuses
   */
  async getAllLineStatuses(): Promise<LineStatusResponse> {
    // Check cache
    if (this.isCacheValid()) {
      return this.cache.data!;
    }

    try {
      const delays = await this.fetchOfficialDelays();

      const response: LineStatusResponse = {
        lines: delays,
        timestamp: new Date(),
        isRealtime: true,
      };

      this.cache = {
        data: response,
        timestamp: Date.now(),
      };

      return response;
    } catch {
      // Return cached data or default
      if (this.cache.data) {
        return {
          ...this.cache.data,
          isRealtime: false,
        };
      }

      return {
        lines: this.getDefaultLineStatuses(),
        timestamp: new Date(),
        isRealtime: false,
      };
    }
  }

  /**
   * Get status for a specific line
   */
  async getLineStatus(lineId: string): Promise<OfficialDelay | null> {
    const statuses = await this.getAllLineStatuses();
    return statuses.lines.find(l => l.lineId === lineId) ?? null;
  }

  /**
   * Get active delays
   */
  async getActiveDelays(): Promise<readonly OfficialDelay[]> {
    const statuses = await this.getAllLineStatuses();
    return statuses.lines.filter(
      l => l.status === 'delayed' || l.status === 'suspended'
    );
  }

  /**
   * Check if a line has active delay
   */
  async hasActiveDelay(lineId: string): Promise<boolean> {
    const status = await this.getLineStatus(lineId);
    return status !== null && status.status !== 'normal';
  }

  /**
   * Get delay alerts
   */
  async getDelayAlerts(): Promise<readonly DelayAlert[]> {
    const delays = await this.getActiveDelays();

    return delays.map(delay => ({
      id: `alert_${delay.lineId}_${Date.now()}`,
      lineId: delay.lineId,
      severity: delay.status === 'suspended' ? 'critical' : 'warning',
      title: `${delay.lineName} ${this.getStatusLabel(delay.status)}`,
      message: delay.reason ?? '운행에 차질이 있습니다',
      createdAt: delay.updatedAt,
      expiresAt: delay.estimatedEndTime,
    }));
  }

  /**
   * Verify user-reported delay against official data
   */
  async verifyReportedDelay(
    lineId: string,
    reportedMinutes: number
  ): Promise<{
    verified: boolean;
    officialDelay?: OfficialDelay;
    confidence: number;
    reason: string;
  }> {
    const officialDelay = await this.getLineStatus(lineId);

    if (!officialDelay) {
      return {
        verified: false,
        confidence: 0.3,
        reason: '공식 데이터를 확인할 수 없습니다',
      };
    }

    if (officialDelay.status === 'normal') {
      return {
        verified: false,
        officialDelay,
        confidence: 0.2,
        reason: '공식 데이터에 지연 정보가 없습니다',
      };
    }

    // Check if reported delay matches official data
    if (officialDelay.delayMinutes) {
      const diff = Math.abs(reportedMinutes - officialDelay.delayMinutes);

      if (diff <= 5) {
        return {
          verified: true,
          officialDelay,
          confidence: 0.95,
          reason: '공식 데이터와 일치합니다',
        };
      } else if (diff <= 10) {
        return {
          verified: true,
          officialDelay,
          confidence: 0.7,
          reason: '공식 데이터와 유사합니다',
        };
      } else {
        return {
          verified: false,
          officialDelay,
          confidence: 0.4,
          reason: '공식 데이터와 차이가 있습니다',
        };
      }
    }

    // Has delay but no specific minutes
    return {
      verified: true,
      officialDelay,
      confidence: 0.6,
      reason: '지연이 확인되었으나 정확한 시간은 미확인',
    };
  }

  /**
   * Get status label in Korean
   */
  getStatusLabel(status: DelayStatus): string {
    const labels: Record<DelayStatus, string> = {
      normal: '정상 운행',
      delayed: '지연 운행',
      suspended: '운행 중단',
      modified: '우회 운행',
    };
    return labels[status];
  }

  /**
   * Get status color
   */
  getStatusColor(status: DelayStatus): string {
    const colors: Record<DelayStatus, string> = {
      normal: '#4CAF50',
      delayed: '#FF9800',
      suspended: '#F44336',
      modified: '#2196F3',
    };
    return colors[status];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch official delays from API
   */
  private async fetchOfficialDelays(): Promise<OfficialDelay[]> {
    // 공식 지연 실소스(서울교통공사 공식 지연 API)는 아직 통합되지 않았다.
    // 이전 구현은 Math.random()으로 가짜 지연을 생성해 ML 예측 UI에 허구 공식
    // 지연을 노출했다(정확성 위반). 실소스 통합 전까지는 날조 없이 전 노선 정상을
    // 반환한다. 실데이터(data.go.kr ntceList → 장애 분류) 통합 시 이 메서드를 교체한다.
    return this.getDefaultLineStatuses();
  }

  /**
   * Get default line statuses
   */
  private getDefaultLineStatuses(): OfficialDelay[] {
    return Object.entries(LINE_NAMES).map(([lineId, lineName]) => ({
      lineId,
      lineName,
      status: 'normal' as DelayStatus,
      updatedAt: new Date(),
      source: 'internal' as const,
    }));
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache.data) return false;
    return Date.now() - this.cache.timestamp < CACHE_DURATION_MS;
  }
}

// ============================================================================
// Export
// ============================================================================

export const officialDelayService = new OfficialDelayService();
export default officialDelayService;
