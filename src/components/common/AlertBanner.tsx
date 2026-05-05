/**
 * AlertBanner Component
 * Displays active subway alerts/disruptions as a banner.
 *
 * Phase 51 — migrated to Wanted Design System tokens. Banner color
 * (accident/delay/maintenance) resolves through WANTED_TOKENS.status
 * palette + brand blue. Text on color always white.
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
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import type { SubwayAlert, AlertType } from '@/models/publicData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AlertBannerProps {
  alerts: SubwayAlert[];
  onDismiss?: () => void;
  testID?: string;
}

const ALERT_TYPE_CONFIG: Record<AlertType, { icon: string; priority: number }> = {
  accident: { icon: '🚨', priority: 1 },
  delay: { icon: '⏰', priority: 2 },
  maintenance: { icon: '🔧', priority: 3 },
  crowded: { icon: '👥', priority: 4 },
  weather: { icon: '🌧️', priority: 5 },
  other: { icon: 'ℹ️', priority: 6 },
};

const getBannerColor = (type: AlertType, semantic: WantedSemanticTheme): string => {
  switch (type) {
    case 'accident':
      return WANTED_TOKENS.status.red500;
    case 'delay':
      return WANTED_TOKENS.status.yellow500;
    case 'maintenance':
      return WANTED_TOKENS.blue[500];
    default:
      return semantic.bgSubtle;
  }
};

export const AlertBanner: React.FC<AlertBannerProps> = memo(
  ({ alerts, onDismiss, testID }) => {
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const activeAlerts = useMemo(() => {
      return alerts
        .filter((alert) => alert.isActive)
        .sort((a, b) => {
          const priorityA = ALERT_TYPE_CONFIG[a.alertType]?.priority || 99;
          const priorityB = ALERT_TYPE_CONFIG[b.alertType]?.priority || 99;
          return priorityA - priorityB;
        });
    }, [alerts]);

    const bannerColor = useMemo(() => {
      const firstAlert = activeAlerts[0];
      if (!firstAlert) return semantic.bgSubtle;
      return getBannerColor(firstAlert.alertType, semantic);
    }, [activeAlerts, semantic]);

    const handleToggleExpand = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded((prev) => !prev);
    }, []);

    const handleDismiss = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDismissed(true);
      onDismiss?.();
    }, [onDismiss]);

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

const styles = StyleSheet.create({
  container: {
    marginHorizontal: WANTED_TOKENS.spacing.s3,
    marginVertical: WANTED_TOKENS.spacing.s2,
    borderRadius: WANTED_TOKENS.radius.r8,
    overflow: 'hidden',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s3,
  },
  icon: {
    fontSize: 20,
    marginRight: WANTED_TOKENS.spacing.s2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: weightToFontFamily('600'),
  },
  content: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    marginTop: WANTED_TOKENS.spacing.s1,
    lineHeight: 18,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: WANTED_TOKENS.spacing.s1,
    paddingVertical: 2,
    borderRadius: WANTED_TOKENS.radius.r4,
    marginRight: WANTED_TOKENS.spacing.s2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
  },
  dismissButton: {
    padding: WANTED_TOKENS.spacing.s1,
  },
  dismissIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: weightToFontFamily('700'),
  },
  expandedList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: WANTED_TOKENS.spacing.s2,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  expandedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  expandedIcon: {
    fontSize: 14,
    marginRight: WANTED_TOKENS.spacing.s1,
    marginTop: 2,
  },
  expandedTextContainer: {
    flex: 1,
  },
  expandedTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
  },
  expandedContent: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
    marginTop: 2,
    lineHeight: 16,
  },
});

export default AlertBanner;
