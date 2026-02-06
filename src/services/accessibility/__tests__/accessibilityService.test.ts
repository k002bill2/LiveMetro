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
});
