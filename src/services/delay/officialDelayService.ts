/**
 * Official Delay Service
 * 공식 지연 정보를 data.go.kr 서울교통공사 지하철알림(ntce)에서 받아 OfficialDelay로
 * 정규화한다. 분류/매핑은 아래 순수 헬퍼(classifyAlertStatus / lineNameToLineId /
 * mergeWithBaseline)가 담당하고, fetch·rate-limit·timeout은 publicDataApi가 소유한다.
 */

import { Platform } from 'react-native';
import { publicDataApi } from '@/services/api';
import type { AlertType } from '@/models/publicData';

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

/** `"2호선" → "2"` 역매핑 (1~9호선 한정, 본 서비스 도메인). */
const LINE_NAME_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(LINE_NAMES).map(([lineId, lineName]) => [lineName, lineId])
);

// ============================================================================
// Pure mapping helpers (data.go.kr 알림 → OfficialDelay)
// ============================================================================

/**
 * 알림 타입을 지연 상태로 분류한다.
 * `delay`/`accident`만 장애로 본다(`integratedAlertService`의 `['delay','accident']`
 * SoT와 정합). accident는 MAJOR(운행 지속)이라 `suspended`(운행 중단=SEVERE)로 올리지
 * 않는다 — free-text 미파싱 상태에서 정지는 과단정이므로 `delayed`로 보수 분류한다.
 * maintenance(계획 공사)·crowded(별개 축)·weather·other는 장애 아님(`null`).
 */
export function classifyAlertStatus(alertType: AlertType): DelayStatus | null {
  switch (alertType) {
    case 'delay':
    case 'accident':
      return 'delayed';
    default:
      return null;
  }
}

/** 알림 노선명을 lineId로 역매핑. 1~9호선만 매핑, 그 외(경의중앙선 등)는 `null`. */
export function lineNameToLineId(lineName: string): string | null {
  return LINE_NAME_TO_ID[lineName] ?? null;
}

/**
 * 1~9호선 all-normal 기준선에 장애를 오버레이한다. 동일 노선 다중 장애는 첫 항목 유지
 * (현재 status는 `delayed` 단일이라 동일). 비-1~9 lineId는 무시된다.
 */
export function mergeWithBaseline(
  disruptions: readonly OfficialDelay[]
): OfficialDelay[] {
  const byLine = new Map<string, OfficialDelay>();
  for (const disruption of disruptions) {
    if (!byLine.has(disruption.lineId)) {
      byLine.set(disruption.lineId, disruption);
    }
  }
  return Object.entries(LINE_NAMES).map(
    ([lineId, lineName]): OfficialDelay =>
      byLine.get(lineId) ?? {
        lineId,
        lineName,
        status: 'normal',
        updatedAt: new Date(),
        source: 'internal',
      }
  );
}

// ============================================================================
// Service
// ============================================================================

export class OfficialDelayService {
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
    // 웹/비지원 플랫폼: data.go.kr ntce API는 CORS 미지원이라 getActiveAlerts가 조용히
    // []를 반환한다. 그 []를 "전 노선 정상"으로 굳히면 거짓 realtime-normal(정직성 위반)이
    // 된다. 실데이터를 받을 수 없는 플랫폼에서는 throw해 caller가 isRealtime:false로 폴백한다.
    if (Platform.OS === 'web') {
      throw new Error('Official delay source unavailable on web (CORS)');
    }

    const alerts = await publicDataApi.getActiveAlerts();
    const disruptions: OfficialDelay[] = [];
    for (const alert of alerts) {
      const status = classifyAlertStatus(alert.alertType);
      const lineId = lineNameToLineId(alert.lineName);
      if (status === null || lineId === null) {
        continue; // 장애 아님(maintenance 등) 또는 1~9호선 밖 → drop
      }
      disruptions.push({
        lineId,
        lineName: LINE_NAMES[lineId] ?? alert.lineName,
        status,
        // delayMinutes는 의도적으로 미설정(undefined): SubwayAlert에 구조화된 분이 없고
        // free-text content에서 분을 파싱하면 "거짓 5분"(#252 제거 버그) 재발.
        reason: alert.title || alert.content || undefined,
        affectedStations: alert.affectedStations,
        startTime: alert.startTime,
        estimatedEndTime: alert.endTime ?? undefined,
        updatedAt: new Date(),
        source: 'seoul_metro',
      });
    }
    return mergeWithBaseline(disruptions);
  }

  /**
   * Get default line statuses
   */
  private getDefaultLineStatuses(): OfficialDelay[] {
    return mergeWithBaseline([]);
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
