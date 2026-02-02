/**
 * Accessibility Service
 * Manages accessibility features and screen reader support
 */

import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

/**
 * Accessibility settings
 */
export interface AccessibilitySettings {
  screenReaderEnabled: boolean;
  reduceMotionEnabled: boolean;
  highContrastEnabled: boolean;
  boldTextEnabled: boolean;
  largeTextScale: number;
  announceNotifications: boolean;
  hapticFeedbackEnabled: boolean;
  voiceOverHints: boolean;
}

/**
 * Accessibility announcement
 */
export interface AccessibilityAnnouncement {
  message: string;
  queue?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:accessibility_settings';

const DEFAULT_SETTINGS: AccessibilitySettings = {
  screenReaderEnabled: false,
  reduceMotionEnabled: false,
  highContrastEnabled: false,
  boldTextEnabled: false,
  largeTextScale: 1.0,
  announceNotifications: true,
  hapticFeedbackEnabled: true,
  voiceOverHints: true,
};

// ============================================================================
// Service
// ============================================================================

class AccessibilityService {
  private settings: AccessibilitySettings = DEFAULT_SETTINGS;
  private listeners: ((settings: AccessibilitySettings) => void)[] = [];
  private initialized = false;

  /**
   * Initialize accessibility service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load saved settings
      const savedSettings = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }

      // Detect system accessibility settings
      await this.detectSystemSettings();

      // Listen for system changes
      this.setupSystemListeners();
    } catch {
      // Use defaults
    }

    this.initialized = true;
  }

  /**
   * Get current settings
   */
  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings: Partial<AccessibilitySettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(callback: (settings: AccessibilitySettings) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Check if screen reader is active
   */
  async isScreenReaderActive(): Promise<boolean> {
    return AccessibilityInfo.isScreenReaderEnabled();
  }

  /**
   * Check if reduce motion is enabled
   */
  async isReduceMotionEnabled(): Promise<boolean> {
    return AccessibilityInfo.isReduceMotionEnabled();
  }

  /**
   * Announce to screen reader
   */
  announce(announcement: string | AccessibilityAnnouncement): void {
    const message = typeof announcement === 'string'
      ? announcement
      : announcement.message;

    AccessibilityInfo.announceForAccessibility(message);
  }

  /**
   * Announce for accessibility with custom options
   */
  announceForAccessibility(
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: { priority?: 'low' | 'normal' | 'high' }
  ): void {
    if (!this.settings.announceNotifications) return;

    // On iOS, we can potentially use different announcement priorities
    // For now, just announce
    AccessibilityInfo.announceForAccessibility(message);
  }

  /**
   * Set accessibility focus
   */
  setAccessibilityFocus(reactTag: number): void {
    AccessibilityInfo.setAccessibilityFocus(reactTag);
  }

  /**
   * Get accessibility label for station
   */
  getStationAccessibilityLabel(
    stationName: string,
    lineName: string,
    extras?: {
      isFavorite?: boolean;
      hasTransfer?: boolean;
      congestionLevel?: string;
    }
  ): string {
    let label = `${stationName}역, ${lineName}`;

    if (extras?.isFavorite) {
      label += ', 즐겨찾기';
    }

    if (extras?.hasTransfer) {
      label += ', 환승역';
    }

    if (extras?.congestionLevel) {
      label += `, 혼잡도 ${extras.congestionLevel}`;
    }

    return label;
  }

  /**
   * Get accessibility label for arrival info
   */
  getArrivalAccessibilityLabel(
    destination: string,
    minutes: number | string,
    status?: string
  ): string {
    const minutesStr = typeof minutes === 'number'
      ? `${minutes}분`
      : minutes;

    let label = `${destination} 방면, ${minutesStr} 후 도착`;

    if (status) {
      label += `, ${status}`;
    }

    return label;
  }

  /**
   * Get accessibility hint
   */
  getAccessibilityHint(action: string): string {
    if (!this.settings.voiceOverHints) return '';
    return action;
  }

  /**
   * Format time for screen reader
   */
  formatTimeForScreenReader(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    return `${hours}시 ${minutes}분`;
  }

  /**
   * Format duration for screen reader
   */
  formatDurationForScreenReader(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}분`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours}시간`;
    }

    return `${hours}시간 ${remainingMinutes}분`;
  }

  /**
   * Get congestion level description
   */
  getCongestionDescription(level: number): string {
    if (level <= 2) return '여유';
    if (level <= 4) return '보통';
    if (level <= 6) return '약간 혼잡';
    if (level <= 8) return '혼잡';
    return '매우 혼잡';
  }

  /**
   * Check if high contrast should be used
   */
  shouldUseHighContrast(): boolean {
    return this.settings.highContrastEnabled;
  }

  /**
   * Get text scale factor
   */
  getTextScaleFactor(): number {
    return this.settings.largeTextScale;
  }

  /**
   * Check if animations should be reduced
   */
  shouldReduceMotion(): boolean {
    return this.settings.reduceMotionEnabled;
  }

  /**
   * Check if haptic feedback should be used
   */
  shouldUseHapticFeedback(): boolean {
    return this.settings.hapticFeedbackEnabled;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Detect system accessibility settings
   */
  private async detectSystemSettings(): Promise<void> {
    try {
      const [screenReaderEnabled, reduceMotionEnabled] = await Promise.all([
        AccessibilityInfo.isScreenReaderEnabled(),
        AccessibilityInfo.isReduceMotionEnabled(),
      ]);

      this.settings = {
        ...this.settings,
        screenReaderEnabled,
        reduceMotionEnabled,
      };
    } catch {
      // Ignore errors
    }
  }

  /**
   * Setup system accessibility listeners
   */
  private setupSystemListeners(): void {
    // Screen reader changes
    AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled) => {
        this.settings = { ...this.settings, screenReaderEnabled: enabled };
        this.notifyListeners();
      }
    );

    // Reduce motion changes
    AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        this.settings = { ...this.settings, reduceMotionEnabled: enabled };
        this.notifyListeners();
      }
    );
  }

  /**
   * Notify listeners of settings changes
   */
  private notifyListeners(): void {
    const currentSettings = this.getSettings();
    for (const listener of this.listeners) {
      listener(currentSettings);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const accessibilityService = new AccessibilityService();
export default accessibilityService;
