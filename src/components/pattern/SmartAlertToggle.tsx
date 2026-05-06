/**
 * SmartAlertToggle Component
 * Toggle for enabling/disabling smart commute alerts.
 *
 * Phase 50 — migrated to Wanted Design System tokens.
 */

import React, { useMemo } from 'react';
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
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';

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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: enabled ? WANTED_TOKENS.blue[500] : semantic.lineNormal,
        },
        style,
      ]}
    >
      <View style={styles.mainRow}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: enabled
                ? 'rgba(0,102,255,0.10)'
                : semantic.bgSubtle,
            },
          ]}
        >
          {enabled ? (
            <Bell size={20} color={WANTED_TOKENS.blue[500]} />
          ) : (
            <BellOff size={20} color={semantic.labelNeutral} />
          )}
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              스마트 출근 알림
            </Text>
            <View style={styles.aiBadge}>
              <Sparkles size={10} color={WANTED_TOKENS.blue[500]} />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>
          <Text style={styles.description}>
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
          trackColor={{ false: semantic.lineNormal, true: 'rgba(0,102,255,0.30)' }}
          thumbColor={enabled ? WANTED_TOKENS.blue[500] : '#FFFFFF'}
        />
      </View>

      {enabled && onSettingsPress && (
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={onSettingsPress}
        >
          <Text style={styles.settingsText}>
            알림 시간 및 설정 변경
          </Text>
          <ChevronRight size={16} color={semantic.labelNeutral} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      overflow: 'hidden',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
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
      gap: WANTED_TOKENS.spacing.s1,
    },
    title: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
      backgroundColor: 'rgba(0,102,255,0.10)',
    },
    aiBadgeText: {
      fontSize: 10,
      fontFamily: weightToFontFamily('700'),
      color: WANTED_TOKENS.blue[500],
    },
    description: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    settingsText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
  });

export default SmartAlertToggle;
