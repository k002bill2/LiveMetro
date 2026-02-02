/**
 * Share Service
 * Handles sharing of routes, delays, and app content
 */

import { Share, Platform } from 'react-native';

// Linking 모듈 타입 정의
interface LinkingModule {
  createURL(path: string, options?: { queryParams?: Record<string, string> }): string;
  openURL(url: string): Promise<void>;
}

// Lazy load Linking module
let Linking: LinkingModule | null = null;

function loadLinkingModule(): LinkingModule | null {
  if (Linking) return Linking;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Linking = require('expo-linking') as LinkingModule;
    return Linking;
  } catch {
    console.log('ℹ️ expo-linking not available');
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Shareable content types
 */
export type ShareableContent =
  | RouteShareContent
  | DelayShareContent
  | StationShareContent
  | AppShareContent;

/**
 * Route share content
 */
export interface RouteShareContent {
  type: 'route';
  fromStation: string;
  toStation: string;
  estimatedTime: number;
  transfers: number;
  fare: number;
}

/**
 * Delay share content
 */
export interface DelayShareContent {
  type: 'delay';
  lineName: string;
  stationName: string;
  delayMinutes: number;
  reason?: string;
  timestamp: Date;
}

/**
 * Station share content
 */
export interface StationShareContent {
  type: 'station';
  stationName: string;
  lineNames: string[];
  facilities?: string[];
}

/**
 * App share content
 */
export interface AppShareContent {
  type: 'app';
  referralCode?: string;
}

/**
 * Share result
 */
export interface ShareResult {
  success: boolean;
  action?: 'sharedAction' | 'dismissedAction';
  activityType?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const APP_STORE_URL = 'https://apps.apple.com/app/livemetro/id000000000';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.livemetro';
const WEB_URL = 'https://livemetro.app';

// ============================================================================
// Service
// ============================================================================

class ShareService {
  /**
   * Share content
   */
  async share(content: ShareableContent): Promise<ShareResult> {
    try {
      const message = this.formatContent(content);
      const url = this.generateDeepLink(content);

      const result = await Share.share(
        {
          message,
          url: Platform.OS === 'ios' ? url : undefined,
          title: this.getShareTitle(content),
        },
        {
          subject: this.getShareTitle(content),
          dialogTitle: '공유하기',
        }
      );

      if (result.action === Share.sharedAction) {
        return {
          success: true,
          action: 'sharedAction',
          activityType: result.activityType ?? undefined,
        };
      } else if (result.action === Share.dismissedAction) {
        return {
          success: false,
          action: 'dismissedAction',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Share failed',
      };
    }
  }

  /**
   * Share route
   */
  async shareRoute(
    fromStation: string,
    toStation: string,
    estimatedTime: number,
    transfers: number,
    fare: number
  ): Promise<ShareResult> {
    return this.share({
      type: 'route',
      fromStation,
      toStation,
      estimatedTime,
      transfers,
      fare,
    });
  }

  /**
   * Share delay report
   */
  async shareDelay(
    lineName: string,
    stationName: string,
    delayMinutes: number,
    reason?: string
  ): Promise<ShareResult> {
    return this.share({
      type: 'delay',
      lineName,
      stationName,
      delayMinutes,
      reason,
      timestamp: new Date(),
    });
  }

  /**
   * Share station info
   */
  async shareStation(
    stationName: string,
    lineNames: string[],
    facilities?: string[]
  ): Promise<ShareResult> {
    return this.share({
      type: 'station',
      stationName,
      lineNames,
      facilities,
    });
  }

  /**
   * Share app with referral code
   */
  async shareApp(referralCode?: string): Promise<ShareResult> {
    return this.share({
      type: 'app',
      referralCode,
    });
  }

  /**
   * Get app store URL
   */
  getAppStoreUrl(): string {
    return Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  }

  /**
   * Open app store
   */
  async openAppStore(): Promise<boolean> {
    const linkingModule = loadLinkingModule();
    if (!linkingModule) return false;

    const url = this.getAppStoreUrl();

    try {
      await linkingModule.openURL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create shareable image (placeholder for future implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createShareableImage(_content: ShareableContent): Promise<string | null> {
    // This would use react-native-view-shot or similar
    // For now, return null
    return null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Format content for sharing
   */
  private formatContent(content: ShareableContent): string {
    switch (content.type) {
      case 'route':
        return this.formatRouteContent(content);
      case 'delay':
        return this.formatDelayContent(content);
      case 'station':
        return this.formatStationContent(content);
      case 'app':
        return this.formatAppContent(content);
    }
  }

  /**
   * Format route content
   */
  private formatRouteContent(content: RouteShareContent): string {
    const transferText = content.transfers > 0
      ? `환승 ${content.transfers}회`
      : '환승 없음';

    return `🚇 LiveMetro 경로 안내

📍 ${content.fromStation} → ${content.toStation}
⏱️ 예상 시간: ${content.estimatedTime}분
🔄 ${transferText}
💰 요금: ${content.fare.toLocaleString()}원

LiveMetro 앱에서 실시간 도착 정보를 확인하세요!
${WEB_URL}`;
  }

  /**
   * Format delay content
   */
  private formatDelayContent(content: DelayShareContent): string {
    const timeStr = content.timestamp.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let message = `⚠️ 지하철 지연 알림

🚇 ${content.lineName} - ${content.stationName}
⏱️ 약 ${content.delayMinutes}분 지연
🕐 ${timeStr} 기준`;

    if (content.reason) {
      message += `\n📋 사유: ${content.reason}`;
    }

    message += `\n\nLiveMetro 앱에서 실시간 지연 정보를 확인하세요!
${WEB_URL}`;

    return message;
  }

  /**
   * Format station content
   */
  private formatStationContent(content: StationShareContent): string {
    let message = `🚉 ${content.stationName}역 정보

🚇 노선: ${content.lineNames.join(', ')}`;

    if (content.facilities && content.facilities.length > 0) {
      message += `\n🏢 시설: ${content.facilities.join(', ')}`;
    }

    message += `\n\nLiveMetro 앱에서 더 자세한 정보를 확인하세요!
${WEB_URL}`;

    return message;
  }

  /**
   * Format app content
   */
  private formatAppContent(content: AppShareContent): string {
    let message = `🚇 LiveMetro - 서울 지하철 실시간 도착 정보

실시간 열차 도착, 경로 검색, 혼잡도 예측까지!
서울 지하철 이용을 더 편리하게 해주는 앱입니다.

다운로드: ${this.getAppStoreUrl()}`;

    if (content.referralCode) {
      message += `\n\n🎁 추천 코드: ${content.referralCode}`;
    }

    return message;
  }

  /**
   * Get share title
   */
  private getShareTitle(content: ShareableContent): string {
    switch (content.type) {
      case 'route':
        return `${content.fromStation} → ${content.toStation} 경로`;
      case 'delay':
        return `${content.lineName} 지연 알림`;
      case 'station':
        return `${content.stationName}역 정보`;
      case 'app':
        return 'LiveMetro 앱 추천';
    }
  }

  /**
   * Generate deep link
   */
  private generateDeepLink(content: ShareableContent): string {
    const baseUrl = 'livemetro://';

    switch (content.type) {
      case 'route':
        return `${baseUrl}route?from=${encodeURIComponent(content.fromStation)}&to=${encodeURIComponent(content.toStation)}`;
      case 'delay':
        return `${baseUrl}delay?line=${encodeURIComponent(content.lineName)}`;
      case 'station':
        return `${baseUrl}station/${encodeURIComponent(content.stationName)}`;
      case 'app':
        return content.referralCode
          ? `${WEB_URL}?ref=${content.referralCode}`
          : WEB_URL;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const shareService = new ShareService();
export default shareService;
