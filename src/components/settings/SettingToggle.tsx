/**
 * Setting Toggle Component
 * Reusable toggle switch for settings screens
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';

interface SettingToggleProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: React.ElementType;
}

export const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  icon: Icon,
}) => {
  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <View style={styles.leftContent}>
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon size={20} color={COLORS.black} />
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
          false: COLORS.gray[300],
          true: COLORS.black,
        }}
        thumbColor={COLORS.white}
        ios_backgroundColor={COLORS.gray[300]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  labelDisabled: {
    color: COLORS.text.disabled,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  subtitleDisabled: {
    color: COLORS.text.disabled,
  },
});

export default SettingToggle;
