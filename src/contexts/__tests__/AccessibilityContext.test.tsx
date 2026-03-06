/**
 * AccessibilityContext Tests
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccessibilityProvider,
  useAccessibility,
} from '../AccessibilityContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock AccessibilityInfo
const mockScreenReaderListeners: ((enabled: boolean) => void)[] = [];
const mockReduceMotionListeners: ((enabled: boolean) => void)[] = [];

jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
  ((eventName: string, handler: (enabled: boolean) => void) => {
    if (eventName === 'screenReaderChanged') {
      mockScreenReaderListeners.push(handler);
    } else if (eventName === 'reduceMotionChanged') {
      mockReduceMotionListeners.push(handler);
    }
    return { remove: jest.fn() } as any;
  }) as any
);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AccessibilityProvider>{children}</AccessibilityProvider>
);

describe('AccessibilityContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScreenReaderListeners.length = 0;
    mockReduceMotionListeners.length = 0;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  it('should throw when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(() => {
      renderHook(() => useAccessibility());
    }).toThrow('useAccessibility must be used within an AccessibilityProvider');
    consoleSpy.mockRestore();
  });

  it('should initialize with default settings', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    expect(result.current.settings.screenReaderEnabled).toBe(false);
    expect(result.current.settings.reduceMotionEnabled).toBe(false);
    expect(result.current.settings.highContrastEnabled).toBe(false);
    expect(result.current.settings.largeTextEnabled).toBe(false);
    expect(result.current.settings.textScale).toBe(1.0);
    expect(result.current.settings.hapticFeedbackEnabled).toBe(true);
    expect(result.current.settings.autoplayAnimations).toBe(true);
  });

  it('should load saved settings from storage', async () => {
    const savedSettings = JSON.stringify({
      highContrastEnabled: true,
      largeTextEnabled: true,
      textScale: 1.5,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(savedSettings);

    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings.highContrastEnabled).toBe(true);
    });

    expect(result.current.settings.largeTextEnabled).toBe(true);
    expect(result.current.settings.textScale).toBe(1.5);
  });

  it('should detect system accessibility settings', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings.screenReaderEnabled).toBe(true);
    });

    expect(result.current.settings.reduceMotionEnabled).toBe(true);
  });

  it('should update settings', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    await act(async () => {
      await result.current.updateSettings({ highContrastEnabled: true });
    });

    expect(result.current.settings.highContrastEnabled).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('should reset settings to defaults', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    await act(async () => {
      await result.current.updateSettings({ highContrastEnabled: true, textScale: 1.5 });
    });

    await act(async () => {
      await result.current.resetSettings();
    });

    expect(result.current.settings.highContrastEnabled).toBe(false);
    expect(result.current.settings.textScale).toBe(1.0);
  });

  it('should compute isDarkMode from system theme', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    // Default useSystemTheme=true, system is 'light'
    expect(result.current.isDarkMode).toBe(false);
  });

  it('should compute isDarkMode from forceDarkMode when not using system theme', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    await act(async () => {
      await result.current.updateSettings({
        useSystemTheme: false,
        forceDarkMode: true,
      });
    });

    expect(result.current.isDarkMode).toBe(true);
  });

  it('should compute effectiveTextScale', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    expect(result.current.effectiveTextScale).toBe(1.0);

    await act(async () => {
      await result.current.updateSettings({ largeTextEnabled: true });
    });

    expect(result.current.effectiveTextScale).toBe(1.2);
  });

  it('should cap textScale at 2.0', async () => {
    const saved = JSON.stringify({ textScale: 3.0 });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(saved);

    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.effectiveTextScale).toBeLessThanOrEqual(2.0);
    });
  });

  it('should compute shouldReduceMotion', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    // Default: reduceMotionEnabled=false, autoplayAnimations=true
    expect(result.current.shouldReduceMotion).toBe(false);

    await act(async () => {
      await result.current.updateSettings({ autoplayAnimations: false });
    });

    expect(result.current.shouldReduceMotion).toBe(true);
  });

  it('should compute shouldUseHaptics', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    // Default: hapticFeedbackEnabled=true, reduceMotionEnabled=false
    expect(result.current.shouldUseHaptics).toBe(true);
  });

  it('should return contrast color when high contrast enabled', async () => {
    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    // Without high contrast
    expect(result.current.getContrastColor('#007AFF')).toBe('#007AFF');

    await act(async () => {
      await result.current.updateSettings({ highContrastEnabled: true });
    });

    // With high contrast - mapped color
    expect(result.current.getContrastColor('#007AFF')).toBe('#0056B3');
    // Unmapped color returns as-is
    expect(result.current.getContrastColor('#123456')).toBe('#123456');
  });

  it('should handle storage initialization error gracefully', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const { result } = renderHook(() => useAccessibility(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    // Should use defaults
    expect(result.current.settings.highContrastEnabled).toBe(false);
  });
});
