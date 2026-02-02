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
    // In production, this would call the actual Seoul Metro API
    // For now, we simulate with mock data that occasionally has delays

    const now = new Date();
    const hour = now.getHours();

    // Simulate occasional delays during peak hours
    const delays: OfficialDelay[] = [];

    for (const [lineId, lineName] of Object.entries(LINE_NAMES)) {
      // Random chance of delay (higher during peak hours)
      const delayChance = (hour >= 8 && hour <= 9) || (hour >= 18 && hour <= 19)
        ? 0.15 : 0.05;

      const hasDelay = Math.random() < delayChance;

      if (hasDelay) {
        const delayMinutes = Math.floor(Math.random() * 15) + 5;
        delays.push({
          lineId,
          lineName,
          status: 'delayed',
          delayMinutes,
          reason: this.getRandomDelayReason(),
          updatedAt: now,
          source: 'seoul_metro',
        });
      } else {
        delays.push({
          lineId,
          lineName,
          status: 'normal',
          updatedAt: now,
          source: 'seoul_metro',
        });
      }
    }

    return delays;
  }

  /**
   * Get random delay reason
   */
  private getRandomDelayReason(): string {
    const reasons = [
      '혼잡으로 인한 지연',
      '차량 점검 중',
      '신호 장애',
      '승객 안전 확인',
      '선로 점검',
      '열차 간격 조정',
    ];
    return reasons[Math.floor(Math.random() * reasons.length)] ?? reasons[0]!;
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
