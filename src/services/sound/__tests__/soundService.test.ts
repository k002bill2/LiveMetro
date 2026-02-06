/**
 * Sound Service Tests
 */

import { Vibration, Platform, Alert } from 'react-native';

import {
  soundService,
  NOTIFICATION_SOUNDS,
  VIBRATION_PATTERNS,
  getVibrationPattern,
} from '../soundService';

// Mock react-native
jest.mock('react-native', () => ({
  Vibration: { vibrate: jest.fn() },
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
}));

jest.mock('@/models/user', () => ({
  // types only, no runtime values needed
}));

describe('SoundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('NOTIFICATION_SOUNDS', () => {
    it('should have 6 sound options', () => {
      expect(NOTIFICATION_SOUNDS).toHaveLength(6);
    });

    it('should include silent option', () => {
      const silent = NOTIFICATION_SOUNDS.find(s => s.id === 'silent');
      expect(silent).toBeDefined();
      expect(silent?.label).toBe('무음');
    });

    it('should include default option', () => {
      const def = NOTIFICATION_SOUNDS.find(s => s.id === 'default');
      expect(def).toBeDefined();
    });
  });

  describe('VIBRATION_PATTERNS', () => {
    it('should have 6 vibration options', () => {
      expect(VIBRATION_PATTERNS).toHaveLength(6);
    });

    it('should include none pattern with empty array', () => {
      const none = VIBRATION_PATTERNS.find(p => p.id === 'none');
      expect(none).toBeDefined();
      expect(none?.pattern).toEqual([]);
    });
  });

  describe('getVibrationPattern', () => {
    it('should return pattern for known ID', () => {
      const pattern = getVibrationPattern('short');
      expect(pattern).toEqual([0, 100]);
    });

    it('should return default pattern for unknown ID', () => {
      const pattern = getVibrationPattern('unknown_id' as 'default');
      expect(pattern).toEqual([0, 250, 250, 250]);
    });

    it('should return copy of pattern, not reference', () => {
      const p1 = getVibrationPattern('double');
      const p2 = getVibrationPattern('double');
      expect(p1).toEqual(p2);
      expect(p1).not.toBe(p2);
    });
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(soundService.initialize()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await soundService.initialize();
      await soundService.initialize();
      expect(soundService.isAudioAvailable()).toBe(false);
    });
  });

  describe('isAudioAvailable', () => {
    it('should return false (Expo Go limitation)', () => {
      expect(soundService.isAudioAvailable()).toBe(false);
    });
  });

  describe('previewSound', () => {
    it('should show alert for non-silent sound', async () => {
      await soundService.previewSound('default', 0.5);
      expect(Alert.alert).toHaveBeenCalledWith(
        '알림음 미리듣기',
        expect.stringContaining('기본음'),
        expect.any(Array)
      );
    });

    it('should not show alert for silent sound', async () => {
      await soundService.previewSound('silent', 0.5);
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('stopSound', () => {
    it('should resolve without error', async () => {
      await expect(soundService.stopSound()).resolves.not.toThrow();
    });
  });

  describe('triggerVibration', () => {
    it('should not vibrate for none pattern', () => {
      soundService.triggerVibration('none');
      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });

    it('should vibrate on iOS with simple vibration', () => {
      (Platform as { OS: string }).OS = 'ios';
      soundService.triggerVibration('default');
      expect(Vibration.vibrate).toHaveBeenCalled();
    });

    it('should vibrate on Android with pattern', () => {
      (Platform as { OS: string }).OS = 'android';
      soundService.triggerVibration('double');
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);
    });
  });

  describe('previewVibration', () => {
    it('should trigger vibration', () => {
      (Platform as { OS: string }).OS = 'android';
      soundService.previewVibration('short');
      expect(Vibration.vibrate).toHaveBeenCalled();
    });
  });

  describe('getIsPlaying', () => {
    it('should return false initially', () => {
      expect(soundService.getIsPlaying()).toBe(false);
    });
  });

  describe('getSoundUrl', () => {
    it('should return URL for known sound', () => {
      const url = soundService.getSoundUrl('default');
      expect(url).toContain('http');
    });

    it('should return default URL for silent (fallback)', () => {
      const url = soundService.getSoundUrl('silent');
      // Silent maps to '' but getSoundUrl has || DEFAULT fallback
      expect(typeof url).toBe('string');
    });
  });

  describe('cleanup', () => {
    it('should resolve without error', async () => {
      await expect(soundService.cleanup()).resolves.not.toThrow();
    });
  });
});
