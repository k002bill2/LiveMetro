/**
 * Toast Component
 * Non-blocking feedback messages for user actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react-native';

import { SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY, Z_INDEX } from '../../utils/themeUtils';
import { COLORS } from '../../styles/modernTheme';

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

  const hideToast = useCallback((): void => {
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
  }, [fadeAnim, slideAnim, position, onDismiss]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
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

      timer = setTimeout(() => {
        hideToast();
      }, duration);
    } else {
      hideToast();
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, duration, fadeAnim, slideAnim, hideToast]);

  const getToastConfig = (toastType: ToastConfig['type']) => {
    switch (toastType) {
      case 'success':
        return {
          backgroundColor: COLORS.semantic.success,
          Icon: CheckCircle,
          iconColor: COLORS.white,
        };
      case 'error':
        return {
          backgroundColor: COLORS.semantic.error,
          Icon: XCircle,
          iconColor: COLORS.white,
        };
      case 'warning':
        return {
          backgroundColor: COLORS.semantic.warning,
          Icon: AlertTriangle,
          iconColor: COLORS.white,
        };
      case 'info':
        return {
          backgroundColor: COLORS.primary.main,
          Icon: Info,
          iconColor: COLORS.white,
        };
      default:
        return {
          backgroundColor: COLORS.text.secondary,
          Icon: Info,
          iconColor: COLORS.white,
        };
    }
  };

  if (!visible) return null;

  const config = getToastConfig(type);
  const IconComponent = config.Icon;

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
      <IconComponent
        size={20}
        color={config.iconColor}
        style={styles.icon} // Lucide icons accept style prop? Usually they accept common svg props which include style but lucide-react-native icons return Svg which usually accepts style. Wait, lucide-react-native icons pass props to Svg. Svg accepts style? Yes.
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
    color: COLORS.white,
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