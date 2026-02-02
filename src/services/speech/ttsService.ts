/**
 * Text-to-Speech Service
 * Provides voice announcements for train arrivals and alerts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Speech 모듈 타입 정의
interface SpeechVoice {
  identifier: string;
  name: string;
  language: string;
  quality: string;
}

interface SpeechModule {
  speak(text: string, options?: {
    language?: string;
    pitch?: number;
    rate?: number;
    voice?: string;
    volume?: number;
    onDone?: () => void;
    onError?: (error: Error) => void;
  }): void;
  stop(): Promise<void>;
  isSpeakingAsync(): Promise<boolean>;
  getAvailableVoicesAsync(): Promise<SpeechVoice[]>;
  VoiceQuality: { Enhanced: string; Default: string };
}

// Lazy load Speech module
let Speech: SpeechModule | null = null;

function loadSpeechModule(): SpeechModule | null {
  if (Speech) return Speech;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Speech = require('expo-speech') as SpeechModule;
    return Speech;
  } catch {
    console.log('ℹ️ expo-speech not available');
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * TTS voice settings
 */
export interface TTSSettings {
  enabled: boolean;
  language: string;
  pitch: number;      // 0.5 - 2.0
  rate: number;       // 0.1 - 2.0
  volume: number;     // 0 - 1.0
  voiceId?: string;
}

/**
 * Available voice
 */
export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  quality: 'default' | 'enhanced';
}

/**
 * Announcement types
 */
export type AnnouncementType =
  | 'arrival'           // Train arrival
  | 'delay'             // Delay alert
  | 'departure_reminder' // Time to leave
  | 'transfer'          // Transfer info
  | 'congestion'        // Congestion warning
  | 'service_alert';    // Service disruption

/**
 * Announcement content
 */
export interface Announcement {
  type: AnnouncementType;
  text: string;
  priority: 'low' | 'normal' | 'high';
  interruptible: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:tts_settings';

const DEFAULT_SETTINGS: TTSSettings = {
  enabled: false,
  language: 'ko-KR',
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
};

const ANNOUNCEMENT_TEMPLATES: Record<AnnouncementType, (data: Record<string, string>) => string> = {
  arrival: (data) =>
    `${data.lineName} ${data.direction} 방면 열차가 ${data.minutes}분 후 ${data.stationName}역에 도착합니다.`,

  delay: (data) =>
    `${data.lineName} 지연 알림. 현재 약 ${data.delayMinutes}분 지연 운행 중입니다. ${data.reason || ''}`,

  departure_reminder: (data) =>
    `출발 시간 알림. ${data.minutes}분 후 ${data.stationName}역에서 출발 예정입니다. 이동을 준비해 주세요.`,

  transfer: (data) =>
    `${data.currentStation}역에서 ${data.transferLine}으로 환승하세요. 환승 시간은 약 ${data.walkingMinutes}분입니다.`,

  congestion: (data) =>
    `혼잡 알림. ${data.stationName}역이 현재 ${data.level}합니다. 우회 경로를 이용해 주세요.`,

  service_alert: (data) =>
    `${data.lineName} 운행 알림. ${data.message}`,
};

// ============================================================================
// Service
// ============================================================================

class TTSService {
  private settings: TTSSettings = DEFAULT_SETTINGS;
  private isSpeaking = false;
  private queue: Announcement[] = [];
  private initialized = false;
  private availableVoices: VoiceOption[] = [];

  /**
   * Initialize TTS service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load saved settings
      const savedSettings = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }

      // Load available voices
      await this.loadAvailableVoices();
    } catch {
      // Use defaults
    }

    this.initialized = true;
  }

  /**
   * Load available voices
   */
  async loadAvailableVoices(): Promise<readonly VoiceOption[]> {
    const speechModule = loadSpeechModule();
    if (!speechModule) {
      return [];
    }

    try {
      const voices = await speechModule.getAvailableVoicesAsync();

      this.availableVoices = voices
        .filter((v: SpeechVoice) => v.language.startsWith('ko'))
        .map((v: SpeechVoice) => ({
          id: v.identifier,
          name: v.name || v.identifier,
          language: v.language,
          quality: v.quality === speechModule.VoiceQuality.Enhanced ? 'enhanced' as const : 'default' as const,
        }));

      // Add other common languages
      const otherVoices = voices
        .filter((v: SpeechVoice) => !v.language.startsWith('ko') &&
          (v.language.startsWith('en') || v.language.startsWith('ja') || v.language.startsWith('zh')))
        .slice(0, 5)
        .map((v: SpeechVoice) => ({
          id: v.identifier,
          name: v.name || v.identifier,
          language: v.language,
          quality: v.quality === speechModule.VoiceQuality.Enhanced ? 'enhanced' as const : 'default' as const,
        }));

      this.availableVoices = [...this.availableVoices, ...otherVoices];

      return this.availableVoices;
    } catch {
      return [];
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): readonly VoiceOption[] {
    return this.availableVoices;
  }

  /**
   * Get current settings
   */
  getSettings(): TTSSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings: Partial<TTSSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }

  /**
   * Enable TTS
   */
  async enable(): Promise<void> {
    await this.updateSettings({ enabled: true });
  }

  /**
   * Disable TTS
   */
  async disable(): Promise<void> {
    await this.updateSettings({ enabled: false });
    this.stop();
  }

  /**
   * Check if TTS is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Speak text
   */
  async speak(text: string, options?: Partial<TTSSettings>): Promise<void> {
    await this.initialize();

    if (!this.settings.enabled) return;

    const speechModule = loadSpeechModule();
    if (!speechModule) return;

    const speechOptions = {
      language: options?.language ?? this.settings.language,
      pitch: options?.pitch ?? this.settings.pitch,
      rate: options?.rate ?? this.settings.rate,
      volume: options?.volume ?? this.settings.volume,
      voice: options?.voiceId ?? this.settings.voiceId,
      onDone: () => {
        this.isSpeaking = false;
        this.processQueue();
      },
      onError: () => {
        this.isSpeaking = false;
        this.processQueue();
      },
    };

    this.isSpeaking = true;
    speechModule.speak(text, speechOptions);
  }

  /**
   * Queue an announcement
   */
  async announce(announcement: Announcement): Promise<void> {
    await this.initialize();

    if (!this.settings.enabled) return;

    // High priority announcements interrupt
    if (announcement.priority === 'high' && !announcement.interruptible) {
      this.stop();
      await this.speak(announcement.text);
      return;
    }

    // Add to queue
    this.queue.push(announcement);

    // Sort by priority
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Process if not speaking
    if (!this.isSpeaking) {
      await this.processQueue();
    }
  }

  /**
   * Announce train arrival
   */
  async announceArrival(data: {
    lineName: string;
    stationName: string;
    direction: string;
    minutes: number;
  }): Promise<void> {
    const text = ANNOUNCEMENT_TEMPLATES.arrival({
      lineName: data.lineName,
      stationName: data.stationName,
      direction: data.direction,
      minutes: data.minutes.toString(),
    });

    await this.announce({
      type: 'arrival',
      text,
      priority: 'normal',
      interruptible: true,
    });
  }

  /**
   * Announce delay
   */
  async announceDelay(data: {
    lineName: string;
    delayMinutes: number;
    reason?: string;
  }): Promise<void> {
    const text = ANNOUNCEMENT_TEMPLATES.delay({
      lineName: data.lineName,
      delayMinutes: data.delayMinutes.toString(),
      reason: data.reason || '',
    });

    await this.announce({
      type: 'delay',
      text,
      priority: 'high',
      interruptible: false,
    });
  }

  /**
   * Announce departure reminder
   */
  async announceDepartureReminder(data: {
    stationName: string;
    minutes: number;
  }): Promise<void> {
    const text = ANNOUNCEMENT_TEMPLATES.departure_reminder({
      stationName: data.stationName,
      minutes: data.minutes.toString(),
    });

    await this.announce({
      type: 'departure_reminder',
      text,
      priority: 'normal',
      interruptible: true,
    });
  }

  /**
   * Announce transfer
   */
  async announceTransfer(data: {
    currentStation: string;
    transferLine: string;
    walkingMinutes: number;
  }): Promise<void> {
    const text = ANNOUNCEMENT_TEMPLATES.transfer({
      currentStation: data.currentStation,
      transferLine: data.transferLine,
      walkingMinutes: data.walkingMinutes.toString(),
    });

    await this.announce({
      type: 'transfer',
      text,
      priority: 'normal',
      interruptible: true,
    });
  }

  /**
   * Announce congestion
   */
  async announceCongestion(data: {
    stationName: string;
    level: string;
  }): Promise<void> {
    const text = ANNOUNCEMENT_TEMPLATES.congestion({
      stationName: data.stationName,
      level: data.level,
    });

    await this.announce({
      type: 'congestion',
      text,
      priority: 'normal',
      interruptible: true,
    });
  }

  /**
   * Announce service alert
   */
  async announceServiceAlert(data: {
    lineName: string;
    message: string;
  }): Promise<void> {
    const text = ANNOUNCEMENT_TEMPLATES.service_alert({
      lineName: data.lineName,
      message: data.message,
    });

    await this.announce({
      type: 'service_alert',
      text,
      priority: 'high',
      interruptible: false,
    });
  }

  /**
   * Stop speaking
   */
  stop(): void {
    const speechModule = loadSpeechModule();
    if (speechModule) {
      void speechModule.stop();
    }
    this.isSpeaking = false;
    this.queue = [];
  }

  /**
   * Check if currently speaking
   */
  async isSpeakingAsync(): Promise<boolean> {
    const speechModule = loadSpeechModule();
    if (!speechModule) return false;
    return speechModule.isSpeakingAsync();
  }

  /**
   * Test TTS with sample text
   */
  async test(): Promise<void> {
    const testText = '음성 테스트입니다. 이 메시지가 들리면 TTS가 정상적으로 작동하는 것입니다.';

    // Temporarily enable for test
    const wasEnabled = this.settings.enabled;
    this.settings.enabled = true;

    await this.speak(testText);

    this.settings.enabled = wasEnabled;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process announcement queue
   */
  private async processQueue(): Promise<void> {
    if (this.isSpeaking || this.queue.length === 0) return;

    const announcement = this.queue.shift();
    if (announcement) {
      await this.speak(announcement.text);
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

export const ttsService = new TTSService();
export default ttsService;
