/**
 * Toast Component
 * Non-blocking feedback messages for user actions
 */

import React, { useState, useEffect } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, Z_INDEX } from '../../utils/themeUtils';

const { width } = Dimensions.get('window');

export interface ToastConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  position?: 'top' | 'bottom';
}

interface ToastProps extends ToastConfig {
  visible: boolean;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  type,
  message,
  duration = 3000,
  position = 'bottom',
  onDismiss,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(position === 'bottom' ? 100 : -100));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
      return undefined;
    }
  }, [visible, duration]);

  const hideToast = (): void => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: position === 'bottom' ? 100 : -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const getToastConfig = (toastType: ToastConfig['type']) => {
    switch (toastType) {
      case 'success':
        return {
          backgroundColor: '#10b981',
          icon: 'checkmark-circle' as const,
          iconColor: '#ffffff',
        };
      case 'error':
        return {
          backgroundColor: '#ef4444',
          icon: 'close-circle' as const,
          iconColor: '#ffffff',
        };
      case 'warning':
        return {
          backgroundColor: '#f59e0b',
          icon: 'warning' as const,
          iconColor: '#ffffff',
        };
      case 'info':
        return {
          backgroundColor: '#3b82f6',
          icon: 'information-circle' as const,
          iconColor: '#ffffff',
        };
      default:
        return {
          backgroundColor: '#6b7280',
          icon: 'information-circle' as const,
          iconColor: '#ffffff',
        };
    }
  };

  if (!visible) return null;

  const config = getToastConfig(type);

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.topPosition : styles.bottomPosition,
        { backgroundColor: config.backgroundColor },
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={config.icon}
        size={20}
        color={config.iconColor}
        style={styles.icon}
      />
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    zIndex: Z_INDEX.toast,
    maxWidth: width - (SPACING.md * 2),
    ...SHADOWS.lg,
  },
  topPosition: {
    top: 60, // Below status bar
  },
  bottomPosition: {
    bottom: 100, // Above bottom navigation
  },
  icon: {
    marginRight: SPACING.sm,
  },
  message: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: '#ffffff',
    lineHeight: TYPOGRAPHY.lineHeights.normal * TYPOGRAPHY.sizes.sm,
  },
});

/**
 * Toast Manager Hook
 */
export const useToast = () => {
  const [toastConfig, setToastConfig] = useState<ToastConfig & { visible: boolean }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const showToast = (config: ToastConfig): void => {
    setToastConfig({
      ...config,
      visible: true,
    });
  };

  const hideToast = (): void => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  const showSuccess = (message: string, duration?: number): void => {
    showToast({ type: 'success', message, ...(duration !== undefined && { duration }) });
  };

  const showError = (message: string, duration?: number): void => {
    showToast({ type: 'error', message, ...(duration !== undefined && { duration }) });
  };

  const showWarning = (message: string, duration?: number): void => {
    showToast({ type: 'warning', message, ...(duration !== undefined && { duration }) });
  };

  const showInfo = (message: string, duration?: number): void => {
    showToast({ type: 'info', message, ...(duration !== undefined && { duration }) });
  };

  const ToastComponent = () => (
    <Toast
      {...toastConfig}
      onDismiss={hideToast}
    />
  );

  return {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
    ToastComponent,
  };
};