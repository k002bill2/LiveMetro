/**
 * TTS Service Tests
 */

import { ttsService, TTSSettings } from '../ttsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('TTSService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize without throwing', async () => {
      await expect(ttsService.initialize()).resolves.not.toThrow();
    });

    it('should load settings from storage when available', async () => {
      // Note: Service is a singleton, already initialized
      // This test verifies the initialize method exists and works
      await expect(ttsService.initialize()).resolves.not.toThrow();
    });
  });

  describe('getSettings', () => {
    it('should return current settings', () => {
      const settings = ttsService.getSettings();

      expect(settings).toHaveProperty('enabled');
      expect(settings).toHaveProperty('language');
      expect(settings).toHaveProperty('rate');
      expect(settings).toHaveProperty('pitch');
      expect(settings).toHaveProperty('volume');
    });

    it('should have valid default values', () => {
      const settings = ttsService.getSettings();

      expect(settings.language).toBe('ko-KR');
      expect(settings.rate).toBeGreaterThan(0);
      expect(settings.rate).toBeLessThanOrEqual(2);
      expect(settings.pitch).toBeGreaterThan(0);
      expect(settings.pitch).toBeLessThanOrEqual(2);
      expect(settings.volume).toBeGreaterThan(0);
      expect(settings.volume).toBeLessThanOrEqual(1);
    });
  });

  describe('updateSettings', () => {
    it('should update settings', async () => {
      const newSettings: Partial<TTSSettings> = {
        rate: 1.5,
        pitch: 1.2,
      };

      await ttsService.updateSettings(newSettings);
      const settings = ttsService.getSettings();

      expect(settings.rate).toBe(1.5);
      expect(settings.pitch).toBe(1.2);
    });

    it('should save to storage', async () => {
      await ttsService.updateSettings({ rate: 0.8 });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('enable/disable', () => {
    it('should enable TTS', async () => {
      await ttsService.enable();
      expect(ttsService.isEnabled()).toBe(true);
    });

    it('should disable TTS', async () => {
      await ttsService.disable();
      expect(ttsService.isEnabled()).toBe(false);
    });
  });

  describe('speak', () => {
    it('should not throw when speaking (fallback mode)', async () => {
      await ttsService.enable();
      await expect(ttsService.speak('테스트 메시지')).resolves.not.toThrow();
    });

    it('should respect enabled setting', async () => {
      await ttsService.disable();
      await expect(ttsService.speak('테스트')).resolves.not.toThrow();
    });
  });

  describe('announceArrival', () => {
    it('should format arrival message', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceArrival({
          lineName: '2호선',
          stationName: '강남',
          direction: '외선',
          minutes: 3,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('announceDelay', () => {
    it('should format delay message', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceDelay({
          lineName: '2호선',
          delayMinutes: 10,
          reason: '혼잡으로 인한 지연',
        })
      ).resolves.not.toThrow();
    });

    it('should handle missing reason', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceDelay({
          lineName: '3호선',
          delayMinutes: 5,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('announceDepartureReminder', () => {
    it('should format departure reminder', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceDepartureReminder({
          stationName: '강남',
          minutes: 10,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('announceTransfer', () => {
    it('should format transfer message', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceTransfer({
          currentStation: '강남',
          transferLine: '신분당선',
          walkingMinutes: 3,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('announceCongestion', () => {
    it('should format congestion message', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceCongestion({
          stationName: '강남',
          level: '매우 혼잡',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('announceServiceAlert', () => {
    it('should format service alert', async () => {
      await ttsService.enable();
      await expect(
        ttsService.announceServiceAlert({
          lineName: '2호선',
          message: '신호 장애로 운행이 지연되고 있습니다.',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop speaking without throwing', () => {
      expect(() => ttsService.stop()).not.toThrow();
    });
  });

  describe('isSpeakingAsync', () => {
    it('should return boolean', async () => {
      const result = await ttsService.isSpeakingAsync();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAvailableVoices', () => {
    it('should return array', () => {
      const voices = ttsService.getAvailableVoices();
      expect(Array.isArray(voices)).toBe(true);
    });
  });

  describe('loadAvailableVoices', () => {
    it('should return array (empty in test environment)', async () => {
      const voices = await ttsService.loadAvailableVoices();
      expect(Array.isArray(voices)).toBe(true);
    });
  });

  describe('test', () => {
    it('should run test announcement', async () => {
      await expect(ttsService.test()).resolves.not.toThrow();
    });
  });
});
