/**
 * DelayAlertBanner Component
 * Shows active delays in a dismissible banner at the top of the screen
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { AlertTriangle, ChevronRight, X, Route } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';

export interface DelayInfo {
  lineId: string;
  lineName?: string;
  delayMinutes: number;
  reason?: string;
  timestamp?: Date;
}

interface DelayAlertBannerProps {
  /** List of active delays */
  delays: DelayInfo[];
  /** Called when banner is pressed */
  onPress?: () => void;
  /** Called when dismiss button is pressed */
  onDismiss?: () => void;
  /** Called when alternative route button is pressed */
  onAlternativeRoutePress?: () => void;
  /** Show dismiss button */
  dismissible?: boolean;
  /** Show alternative route button */
  showAlternativeRoute?: boolean;
}

export const DelayAlertBanner: React.FC<DelayAlertBannerProps> = ({
  delays,
  onPress,
  onDismiss,
  onAlternativeRoutePress,
  dismissible = true,
  showAlternativeRoute = true,
}) => {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (delays.length > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [delays.length, slideAnim, opacityAnim]);

  if (delays.length === 0) {
    return null;
  }

  // Sort by delay time descending
  const sortedDelays = [...delays].sort((a, b) => b.delayMinutes - a.delayMinutes);

  // Format delay summary
  const delaySummary = sortedDelays
    .slice(0, 3)
    .map((d) => `${d.lineId}호선 +${d.delayMinutes}분`)
    .join(', ');

  const moreCount = sortedDelays.length - 3;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.error,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <AlertTriangle size={20} color="#FFFFFF" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>지연 운행 중</Text>
          <Text style={styles.summary} numberOfLines={1}>
            {delaySummary}
            {moreCount > 0 && ` 외 ${moreCount}개`}
          </Text>
        </View>

        {showAlternativeRoute && onAlternativeRoutePress && (
          <TouchableOpacity
            style={styles.alternativeRouteButton}
            onPress={onAlternativeRoutePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Route size={14} color="#FFFFFF" />
            <Text style={styles.alternativeRouteText}>대체경로</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionContainer}>
          {onPress && (
            <ChevronRight size={20} color="#FFFFFF" />
          )}
        </View>
      </TouchableOpacity>

      {dismissible && onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Line color indicators */}
      <View style={styles.lineIndicators}>
        {sortedDelays.slice(0, 5).map((delay) => (
          <View
            key={delay.lineId}
            style={[
              styles.lineIndicator,
              { backgroundColor: getSubwayLineColor(delay.lineId) },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  summary: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  actionContainer: {
    marginLeft: SPACING.sm,
  },
  dismissButton: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    padding: SPACING.xs,
  },
  lineIndicators: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  lineIndicator: {
    flex: 1,
    height: 3,
  },
  alternativeRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
    gap: 4,
  },
  alternativeRouteText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
  },
});

export default DelayAlertBanner;
