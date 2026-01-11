/**
 * AlertBanner Component
 * Displays active subway alerts/disruptions as a banner
 */

import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useTheme } from '@/services/theme/themeContext';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import type { SubwayAlert, AlertType } from '@/models/publicData';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// Types
// ============================================================================

interface AlertBannerProps {
  /** Active alerts to display */
  alerts: SubwayAlert[];
  /** Called when banner is dismissed */
  onDismiss?: () => void;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALERT_TYPE_CONFIG: Record<AlertType, { icon: string; priority: number }> = {
  accident: { icon: '🚨', priority: 1 },
  delay: { icon: '⏰', priority: 2 },
  maintenance: { icon: '🔧', priority: 3 },
  crowded: { icon: '👥', priority: 4 },
  weather: { icon: '🌧️', priority: 5 },
  other: { icon: 'ℹ️', priority: 6 },
};

// ============================================================================
// Main Component
// ============================================================================

export const AlertBanner: React.FC<AlertBannerProps> = memo(
  ({ alerts, onDismiss, testID }) => {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Filter active alerts and sort by priority
    const activeAlerts = useMemo(() => {
      return alerts
        .filter((alert) => alert.isActive)
        .sort((a, b) => {
          const priorityA = ALERT_TYPE_CONFIG[a.alertType]?.priority || 99;
          const priorityB = ALERT_TYPE_CONFIG[b.alertType]?.priority || 99;
          return priorityA - priorityB;
        });
    }, [alerts]);

    // Get banner color based on highest priority alert type
    const bannerColor = useMemo(() => {
      const firstAlert = activeAlerts[0];
      if (!firstAlert) return colors.surface;
      switch (firstAlert.alertType) {
        case 'accident':
          return colors.error;
        case 'delay':
          return colors.warning;
        case 'maintenance':
          return colors.info || colors.primary;
        default:
          return colors.surface;
      }
    }, [activeAlerts, colors]);

    const handleToggleExpand = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded((prev) => !prev);
    }, []);

    const handleDismiss = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDismissed(true);
      onDismiss?.();
    }, [onDismiss]);

    // Don't render if no active alerts or dismissed
    const topAlert = activeAlerts[0];
    if (!topAlert || dismissed) {
      return null;
    }

    const alertConfig = ALERT_TYPE_CONFIG[topAlert.alertType] || ALERT_TYPE_CONFIG.other;

    return (
      <Animated.View
        style={[styles.container, { backgroundColor: bannerColor }]}
        testID={testID}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <TouchableOpacity
          style={styles.mainContent}
          onPress={handleToggleExpand}
          activeOpacity={0.8}
          accessibilityLabel={`운행 알림: ${topAlert.title}`}
          accessibilityHint="탭하여 상세 내용 보기"
        >
          <Text style={styles.icon}>{alertConfig.icon}</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {topAlert.lineName && `[${topAlert.lineName}] `}
              {topAlert.title}
            </Text>
            {expanded && (
              <Text style={styles.content} numberOfLines={3}>
                {topAlert.content}
              </Text>
            )}
          </View>
          {activeAlerts.length > 1 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>+{activeAlerts.length - 1}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="알림 닫기"
          >
            <Text style={styles.dismissIcon}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Expanded view showing all alerts */}
        {expanded && activeAlerts.length > 1 && (
          <View style={styles.expandedList}>
            {activeAlerts.slice(1).map((alert) => {
              const config = ALERT_TYPE_CONFIG[alert.alertType] || ALERT_TYPE_CONFIG.other;
              return (
                <View key={alert.alertId} style={styles.expandedItem}>
                  <Text style={styles.expandedIcon}>{config.icon}</Text>
                  <View style={styles.expandedTextContainer}>
                    <Text style={styles.expandedTitle} numberOfLines={1}>
                      {alert.lineName && `[${alert.lineName}] `}
                      {alert.title}
                    </Text>
                    <Text style={styles.expandedContent} numberOfLines={2}>
                      {alert.content}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    );
  }
);

AlertBanner.displayName = 'AlertBanner';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  icon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  content: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  dismissButton: {
    padding: SPACING.xs,
  },
  dismissIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  expandedList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  expandedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  expandedIcon: {
    fontSize: 14,
    marginRight: SPACING.xs,
    marginTop: 2,
  },
  expandedTextContainer: {
    flex: 1,
  },
  expandedTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  expandedContent: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
});

export default AlertBanner;
