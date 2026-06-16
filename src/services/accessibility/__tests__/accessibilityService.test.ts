/**
 * Accessibility Service Tests
 */

import { accessibilityService } from '../accessibilityService';

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isScreenReaderEnabled: jest.fn().mockResolvedValue(false),
    isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn(),
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe('AccessibilityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(accessibilityService.initialize()).resolves.not.toThrow();
    });
  });

  describe('getSettings', () => {
    it('should return settings', () => {
      const settings = accessibilityService.getSettings();
      expect(settings).toBeDefined();
      expect(typeof settings.screenReaderEnabled).toBe('boolean');
      expect(typeof settings.hapticFeedbackEnabled).toBe('boolean');
    });
  });

  describe('updateSettings', () => {
    it('should update settings', async () => {
      await expect(
        accessibilityService.updateSettings({ highContrastEnabled: true })
      ).resolves.not.toThrow();
    });
  });

  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const unsubscribe = accessibilityService.subscribe(jest.fn());
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('isScreenReaderActive', () => {
    it('should return boolean', async () => {
      const result = await accessibilityService.isScreenReaderActive();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isReduceMotionEnabled', () => {
    it('should return boolean', async () => {
      const result = await accessibilityService.isReduceMotionEnabled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('announce', () => {
    it('should announce string message', () => {
      expect(() => accessibilityService.announce('테스트 메시지')).not.toThrow();
    });

    it('should announce object message', () => {
      expect(() =>
        accessibilityService.announce({ message: '테스트', queue: true })
      ).not.toThrow();
    });
  });

  describe('getAccessibilityHint', () => {
    it('should return hint text', () => {
      const hint = accessibilityService.getAccessibilityHint('tap');
      expect(typeof hint).toBe('string');
    });
  });

  describe('formatTimeForScreenReader', () => {
    it('should format time string', () => {
      const formatted = accessibilityService.formatTimeForScreenReader('08:30');
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatDurationForScreenReader', () => {
    it('should format minutes', () => {
      const formatted = accessibilityService.formatDurationForScreenReader(5);
      expect(typeof formatted).toBe('string');
    });

    it('should format hours and minutes', () => {
      const formatted = accessibilityService.formatDurationForScreenReader(65);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('getCongestionDescription', () => {
    it('should return description for congestion level', () => {
      const desc = accessibilityService.getCongestionDescription(3);
      expect(typeof desc).toBe('string');
    });
  });

  describe('shouldUseHighContrast', () => {
    it('should return boolean', () => {
      expect(typeof accessibilityService.shouldUseHighContrast()).toBe('boolean');
    });
  });

  describe('getTextScaleFactor', () => {
    it('should return number', () => {
      expect(typeof accessibilityService.getTextScaleFactor()).toBe('number');
    });
  });

  describe('shouldReduceMotion', () => {
    it('should return boolean', () => {
      expect(typeof accessibilityService.shouldReduceMotion()).toBe('boolean');
    });
  });

  describe('shouldUseHapticFeedback', () => {
    it('should return boolean', () => {
      expect(typeof accessibilityService.shouldUseHapticFeedback()).toBe('boolean');
    });
  });

  describe('getCongestionDescription levels', () => {
    it('should return 여유 for level <= 2', () => {
      expect(accessibilityService.getCongestionDescription(2)).toBe('여유');
    });

    it('should return 보통 for level 3-4', () => {
      expect(accessibilityService.getCongestionDescription(4)).toBe('보통');
    });

    it('should return 약간 혼잡 for level 5-6', () => {
      expect(accessibilityService.getCongestionDescription(6)).toBe('약간 혼잡');
    });

    it('should return 혼잡 for level 7-8', () => {
      expect(accessibilityService.getCongestionDescription(8)).toBe('혼잡');
    });

    it('should return 매우 혼잡 for level > 8', () => {
      expect(accessibilityService.getCongestionDescription(9)).toBe('매우 혼잡');
    });
  });

  describe('formatDurationForScreenReader edge cases', () => {
    it('should format minutes-only duration with value', () => {
      expect(accessibilityService.formatDurationForScreenReader(30)).toBe('30분');
    });

    it('should drop minutes when on the hour', () => {
      expect(accessibilityService.formatDurationForScreenReader(60)).toBe('1시간');
      expect(accessibilityService.formatDurationForScreenReader(120)).toBe('2시간');
    });

    it('should include both hours and minutes', () => {
      expect(accessibilityService.formatDurationForScreenReader(90)).toBe('1시간 30분');
    });
  });

  describe('getStationAccessibilityLabel', () => {
    it('should build base label without extras', () => {
      expect(accessibilityService.getStationAccessibilityLabel('강남', '2호선'))
        .toBe('강남역, 2호선');
    });

    it('should append favorite marker', () => {
      expect(
        accessibilityService.getStationAccessibilityLabel('강남', '2호선', { isFavorite: true })
      ).toContain(', 즐겨찾기');
    });

    it('should append transfer marker', () => {
      expect(
        accessibilityService.getStationAccessibilityLabel('강남', '2호선', { hasTransfer: true })
      ).toContain(', 환승역');
    });

    it('should append congestion level', () => {
      expect(
        accessibilityService.getStationAccessibilityLabel('강남', '2호선', { congestionLevel: '보통' })
      ).toContain(', 혼잡도 보통');
    });

    it('should combine all extras in order', () => {
      const label = accessibilityService.getStationAccessibilityLabel('강남', '2호선', {
        isFavorite: true,
        hasTransfer: true,
        congestionLevel: '혼잡',
      });
      expect(label).toBe('강남역, 2호선, 즐겨찾기, 환승역, 혼잡도 혼잡');
    });
  });

  describe('getArrivalAccessibilityLabel', () => {
    it('should format numeric minutes', () => {
      expect(accessibilityService.getArrivalAccessibilityLabel('성수', 3))
        .toBe('성수 방면, 3분 후 도착');
    });

    it('should pass through string minutes', () => {
      expect(accessibilityService.getArrivalAccessibilityLabel('성수', '곧'))
        .toBe('성수 방면, 곧 후 도착');
    });

    it('should append status when provided', () => {
      expect(accessibilityService.getArrivalAccessibilityLabel('성수', 3, '지연'))
        .toBe('성수 방면, 3분 후 도착, 지연');
    });
  });

  describe('getAccessibilityHint when hints disabled', () => {
    it('should return empty string when voiceOverHints is off', async () => {
      await accessibilityService.updateSettings({ voiceOverHints: false });
      try {
        expect(accessibilityService.getAccessibilityHint('탭하여 열기')).toBe('');
      } finally {
        await accessibilityService.updateSettings({ voiceOverHints: true });
      }
    });

    it('should return the action when voiceOverHints is on', () => {
      expect(accessibilityService.getAccessibilityHint('탭하여 열기')).toBe('탭하여 열기');
    });
  });

  describe('announceForAccessibility', () => {
    it('should announce when announceNotifications is enabled', () => {
      const { AccessibilityInfo } = require('react-native');
      accessibilityService.announceForAccessibility('열차가 도착합니다');
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('열차가 도착합니다');
    });

    it('should not announce when announceNotifications is disabled', async () => {
      const { AccessibilityInfo } = require('react-native');
      await accessibilityService.updateSettings({ announceNotifications: false });
      try {
        accessibilityService.announceForAccessibility('열차가 도착합니다');
        expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
      } finally {
        await accessibilityService.updateSettings({ announceNotifications: true });
      }
    });
  });

  describe('setAccessibilityFocus', () => {
    it('should forward the react tag to AccessibilityInfo', () => {
      const { AccessibilityInfo } = require('react-native');
      accessibilityService.setAccessibilityFocus(42);
      expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(42);
    });
  });

  describe('updateSettings storage failure', () => {
    it('should not throw when AsyncStorage write rejects', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        accessibilityService.updateSettings({ boldTextEnabled: true })
      ).resolves.not.toThrow();
    });
  });
});
