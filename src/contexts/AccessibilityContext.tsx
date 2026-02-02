/**
 * Accessibility Context
 * Provides accessibility settings and utilities throughout the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

/**
 * Accessibility settings
 */
export interface AccessibilitySettings {
  // System-detected settings
  screenReaderEnabled: boolean;
  reduceMotionEnabled: boolean;

  // User preferences
  highContrastEnabled: boolean;
  largeTextEnabled: boolean;
  textScale: number; // 1.0 - 2.0
  boldTextEnabled: boolean;

  // Feature toggles
  voiceAnnouncementsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  autoplayAnimations: boolean;

  // Visual preferences
  useSystemTheme: boolean;
  forceDarkMode: boolean;
  increasedSpacing: boolean;
}

/**
 * Accessibility context value
 */
interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => Promise<void>;
  resetSettings: () => Promise<void>;

  // Computed values
  isDarkMode: boolean;
  effectiveTextScale: number;

  // Utility functions
  getContrastColor: (baseColor: string) => string;
  shouldReduceMotion: boolean;
  shouldUseHaptics: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:accessibility_settings';

const DEFAULT_SETTINGS: AccessibilitySettings = {
  screenReaderEnabled: false,
  reduceMotionEnabled: false,
  highContrastEnabled: false,
  largeTextEnabled: false,
  textScale: 1.0,
  boldTextEnabled: false,
  voiceAnnouncementsEnabled: false,
  hapticFeedbackEnabled: true,
  autoplayAnimations: true,
  useSystemTheme: true,
  forceDarkMode: false,
  increasedSpacing: false,
};

// High contrast color mappings
const HIGH_CONTRAST_COLORS: Record<string, string> = {
  '#007AFF': '#0056B3', // Primary blue
  '#4CAF50': '#2E7D32', // Success green
  '#FF9800': '#E65100', // Warning orange
  '#F44336': '#C62828', // Error red
  '#9E9E9E': '#616161', // Gray
  '#E0E0E0': '#BDBDBD', // Light gray
};

// ============================================================================
// Context
// ============================================================================

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize settings
  useEffect(() => {
    const initializeSettings = async (): Promise<void> => {
      try {
        // Load saved settings
        const savedSettings = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        }

        // Detect system accessibility settings
        const [screenReaderEnabled, reduceMotionEnabled] = await Promise.all([
          AccessibilityInfo.isScreenReaderEnabled(),
          AccessibilityInfo.isReduceMotionEnabled(),
        ]);

        setSettings(prev => ({
          ...prev,
          screenReaderEnabled,
          reduceMotionEnabled,
        }));
      } catch {
        // Use defaults
      }

      setIsInitialized(true);
    };

    initializeSettings();
  }, []);

  // Listen for system accessibility changes
  useEffect(() => {
    const screenReaderSubscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled) => {
        setSettings(prev => ({ ...prev, screenReaderEnabled: enabled }));
      }
    );

    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setSettings(prev => ({ ...prev, reduceMotionEnabled: enabled }));
      }
    );

    return () => {
      screenReaderSubscription.remove();
      reduceMotionSubscription.remove();
    };
  }, []);

  // Update settings
  const updateSettings = useCallback(
    async (newSettings: Partial<AccessibilitySettings>): Promise<void> => {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
      } catch {
        // Ignore storage errors
      }
    },
    [settings]
  );

  // Reset settings
  const resetSettings = useCallback(async (): Promise<void> => {
    // Keep system-detected settings
    const resetValue: AccessibilitySettings = {
      ...DEFAULT_SETTINGS,
      screenReaderEnabled: settings.screenReaderEnabled,
      reduceMotionEnabled: settings.reduceMotionEnabled,
    };

    setSettings(resetValue);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resetValue));
    } catch {
      // Ignore storage errors
    }
  }, [settings.screenReaderEnabled, settings.reduceMotionEnabled]);

  // Computed: isDarkMode
  const isDarkMode = useMemo(() => {
    if (!settings.useSystemTheme) {
      return settings.forceDarkMode;
    }
    return systemColorScheme === 'dark';
  }, [settings.useSystemTheme, settings.forceDarkMode, systemColorScheme]);

  // Computed: effectiveTextScale
  const effectiveTextScale = useMemo(() => {
    let scale = settings.textScale;
    if (settings.largeTextEnabled && scale < 1.2) {
      scale = 1.2;
    }
    return Math.min(scale, 2.0);
  }, [settings.textScale, settings.largeTextEnabled]);

  // Computed: shouldReduceMotion
  const shouldReduceMotion = useMemo(() => {
    return settings.reduceMotionEnabled || !settings.autoplayAnimations;
  }, [settings.reduceMotionEnabled, settings.autoplayAnimations]);

  // Computed: shouldUseHaptics
  const shouldUseHaptics = useMemo(() => {
    return settings.hapticFeedbackEnabled && !settings.reduceMotionEnabled;
  }, [settings.hapticFeedbackEnabled, settings.reduceMotionEnabled]);

  // Utility: getContrastColor
  const getContrastColor = useCallback(
    (baseColor: string): string => {
      if (!settings.highContrastEnabled) {
        return baseColor;
      }
      return HIGH_CONTRAST_COLORS[baseColor] ?? baseColor;
    },
    [settings.highContrastEnabled]
  );

  const contextValue = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
      isDarkMode,
      effectiveTextScale,
      getContrastColor,
      shouldReduceMotion,
      shouldUseHaptics,
    }),
    [
      settings,
      updateSettings,
      resetSettings,
      isDarkMode,
      effectiveTextScale,
      getContrastColor,
      shouldReduceMotion,
      shouldUseHaptics,
    ]
  );

  if (!isInitialized) {
    return null; // Or a loading indicator
  }

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export const useAccessibility = (): AccessibilityContextValue => {
  const context = useContext(AccessibilityContext);

  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }

  return context;
};

// ============================================================================
// Export
// ============================================================================

export default AccessibilityContext;
