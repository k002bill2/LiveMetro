/**
 * Setting Section Component
 * Reusable section wrapper for settings screens
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

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
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.section, style]}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    section: {
      marginBottom: SPACING.xl,
    },
    sectionTitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: SPACING.md,
      marginHorizontal: SPACING.lg,
      letterSpacing: TYPOGRAPHY.letterSpacing.wide,
      textTransform: 'uppercase',
    },
    sectionContent: {
      backgroundColor: colors.surface,
      marginHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
  });

export default SettingSection;
