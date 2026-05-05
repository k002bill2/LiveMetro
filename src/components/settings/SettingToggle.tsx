/**
 * Setting Toggle Component
 * Reusable toggle switch for settings screens.
 *
 * Phase 45 — Wanted Design System migration. Uses RN's <Switch> per
 * Settings audit SE3 ✅ closure (OS-standard toggle is intentional).
 */

import React, { useMemo } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

interface SettingToggleProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: LucideIcon;
}

export const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  icon: IconComponent,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <View style={styles.leftContent}>
        {IconComponent && (
          <View style={styles.iconContainer}>
            <IconComponent size={20} color={semantic.labelStrong} strokeWidth={2} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>
            {label}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, disabled && styles.subtitleDisabled]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: semantic.lineNormal,
          true: WANTED_TOKENS.blue[500],
        }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={semantic.lineNormal}
      />
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    containerDisabled: {
      opacity: 0.5,
    },
    leftContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    iconContainer: {
      width: 36,
      height: 36,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    textContainer: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    labelDisabled: {
      color: semantic.labelDisabled,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    subtitleDisabled: {
      color: semantic.labelDisabled,
    },
  });

export default SettingToggle;
