/**
 * Setting Section Component
 * Reusable section wrapper for settings screens
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';

interface SettingSectionProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  children,
  style,
}) => {
  return (
    <View style={[styles.section, style]}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.lg,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  sectionContent: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    overflow: 'hidden',
  },
});

export default SettingSection;
