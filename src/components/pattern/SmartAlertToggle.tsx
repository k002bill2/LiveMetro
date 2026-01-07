/**
 * SmartAlertToggle Component
 * Toggle for enabling/disabling smart commute alerts
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Bell, BellOff, ChevronRight, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';

// ============================================================================
// Types
// ============================================================================

interface SmartAlertToggleProps {
  /** Is enabled */
  enabled: boolean;
  /** Called when toggle changes */
  onToggle: (enabled: boolean) => void;
  /** Called when settings button is pressed */
  onSettingsPress?: () => void;
  /** Number of active patterns */
  patternCount?: number;
  /** Loading state */
  loading?: boolean;
  /** Style overrides */
  style?: ViewStyle;
}

// ============================================================================
// Component
// ============================================================================

export const SmartAlertToggle: React.FC<SmartAlertToggleProps> = ({
  enabled,
  onToggle,
  onSettingsPress,
  patternCount = 0,
  loading = false,
  style,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surface : colors.background,
          borderColor: enabled ? colors.primary : colors.borderMedium,
        },
        style,
      ]}
    >
      <View style={styles.mainRow}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: enabled ? colors.primaryLight : colors.borderMedium,
            },
          ]}
        >
          {enabled ? (
            <Bell size={20} color={colors.primary} />
          ) : (
            <BellOff size={20} color={colors.textSecondary} />
          )}
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              스마트 출근 알림
            </Text>
            <View style={[styles.aiBadge, { backgroundColor: colors.primaryLight }]}>
              <Sparkles size={10} color={colors.primary} />
              <Text style={[styles.aiBadgeText, { color: colors.primary }]}>AI</Text>
            </View>
          </View>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {enabled
              ? patternCount > 0
                ? `${patternCount}개 패턴 기반으로 알림 제공`
                : '패턴 분석 중...'
              : '출퇴근 패턴을 학습하여 맞춤 알림을 제공합니다'}
          </Text>
        </View>

        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={loading}
          trackColor={{ false: colors.borderMedium, true: colors.primaryLight }}
          thumbColor={enabled ? colors.primary : colors.textSecondary}
        />
      </View>

      {enabled && onSettingsPress && (
        <TouchableOpacity
          style={[styles.settingsRow, { borderTopColor: colors.borderMedium }]}
          onPress={onSettingsPress}
        >
          <Text style={[styles.settingsText, { color: colors.textSecondary }]}>
            알림 시간 및 설정 변경
          </Text>
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  settingsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default SmartAlertToggle;
