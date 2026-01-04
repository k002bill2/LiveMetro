/**
 * Sound Service
 * Handles notification sound playback and vibration patterns
 * Note: Sound playback requires native modules; vibration works everywhere
 */

import { Vibration, Platform, Alert } from 'react-native';
import {
  NotificationSoundId,
  VibrationPatternId,
} from '@/models/user';

// Sound option metadata for UI display
export interface SoundOption {
  readonly id: NotificationSoundId;
  readonly label: string;
  readonly description: string;
}

// Vibration option metadata for UI display
export interface VibrationOption {
  readonly id: VibrationPatternId;
  readonly label: string;
  readonly description: string;
  readonly pattern: number[];
}

// Available notification sounds
export const NOTIFICATION_SOUNDS: readonly SoundOption[] = [
  { id: 'default', label: '기본음', description: '시스템 기본 알림음' },
  { id: 'train_arrival', label: '열차 도착', description: '지하철 도착 안내음' },
  { id: 'subway_chime', label: '지하철 차임', description: '서울 지하철 도어 차임' },
  { id: 'gentle_bell', label: '부드러운 벨', description: '조용한 알림음' },
  { id: 'urgent_alert', label: '긴급 알림', description: '중요 알림용 강조음' },
  { id: 'silent', label: '무음', description: '소리 없이 진동만' },
] as const;

// Available vibration patterns (durations in milliseconds)
export const VIBRATION_PATTERNS: readonly VibrationOption[] = [
  { id: 'default', label: '기본', description: '표준 진동', pattern: [0, 250, 250, 250] },
  { id: 'short', label: '짧게', description: '간단한 진동', pattern: [0, 100] },
  { id: 'long', label: '길게', description: '강한 진동', pattern: [0, 500] },
  { id: 'double', label: '더블', description: '두 번 진동', pattern: [0, 200, 100, 200] },
  { id: 'triple', label: '트리플', description: '세 번 진동', pattern: [0, 150, 100, 150, 100, 150] },
  { id: 'none', label: '없음', description: '진동 없음', pattern: [] },
] as const;

// Default vibration pattern
const DEFAULT_VIBRATION_PATTERN: number[] = [0, 250, 250, 250];

// Get vibration pattern by ID
export const getVibrationPattern = (patternId: VibrationPatternId): number[] => {
  const option = VIBRATION_PATTERNS.find(p => p.id === patternId);
  return option ? [...option.pattern] : DEFAULT_VIBRATION_PATTERN;
};

// Sound URLs for preview
const DEFAULT_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const SOUND_URLS: Record<NotificationSoundId, string> = {
  default: DEFAULT_SOUND_URL,
  train_arrival: 'https://assets.mixkit.co/active_storage/sfx/1900/1900-preview.mp3',
  subway_chime: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  gentle_bell: DEFAULT_SOUND_URL,
  urgent_alert: 'https://assets.mixkit.co/active_storage/sfx/1977/1977-preview.mp3',
  silent: '',
};

class SoundService {
  private isPlaying = false;
  private isInitialized = false;
  private audioAvailable = false;

  /**
   * Initialize audio settings for the app
   * Note: expo-av is not used due to native module requirements in Expo Go
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Audio playback is not available in Expo Go
    // Sound preview will show an informational message
    this.audioAvailable = false;
    this.isInitialized = true;
  }

  /**
   * Check if audio is available
   */
  isAudioAvailable(): boolean {
    return this.audioAvailable;
  }

  /**
   * Preview a notification sound
   * Note: In Expo Go, this shows an info message since native audio is unavailable
   */
  async previewSound(soundId: NotificationSoundId, _volume: number): Promise<void> {
    if (soundId === 'silent') {
      return;
    }

    await this.initialize();

    // Show informational message for Expo Go users
    Alert.alert(
      '알림음 미리듣기',
      `선택한 알림음: ${NOTIFICATION_SOUNDS.find(s => s.id === soundId)?.label || soundId}\n\n` +
      '소리 미리듣기는 개발 빌드(EAS Build)에서만 사용 가능합니다.\n' +
      '실제 알림에서는 시스템 알림음이 재생됩니다.',
      [{ text: '확인' }]
    );
  }

  /**
   * Stop the currently playing sound
   */
  async stopSound(): Promise<void> {
    this.isPlaying = false;
  }

  /**
   * Trigger a vibration pattern
   */
  triggerVibration(patternId: VibrationPatternId): void {
    if (patternId === 'none') {
      return;
    }

    const pattern = getVibrationPattern(patternId);

    if (pattern.length > 0) {
      if (Platform.OS === 'android') {
        // Android supports patterns
        Vibration.vibrate(pattern);
      } else {
        // iOS doesn't support patterns well, use simple vibration
        Vibration.vibrate();
      }
    }
  }

  /**
   * Preview a vibration pattern
   */
  previewVibration(patternId: VibrationPatternId): void {
    this.triggerVibration(patternId);
  }

  /**
   * Check if a sound is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the URL for a sound (useful for notification service)
   */
  getSoundUrl(soundId: NotificationSoundId): string {
    return SOUND_URLS[soundId] || DEFAULT_SOUND_URL;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopSound();
  }
}

// Export singleton instance
export const soundService = new SoundService();

export default soundService;
