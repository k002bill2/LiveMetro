/**
 * Setting Section Component
 * Reusable section wrapper for settings screens.
 *
 * Phase 45 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens (WANTED_TOKENS + weightToFontFamily +
 * isDark-driven semantic theme). Visual rules match the bundle's
 * uppercase caption header + rounded card pattern (audit SE2 ✅ Phase 40).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={[styles.section, style]}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    section: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    sectionTitle: {
      // Wanted handoff (settings-detail.jsx:25-37 GroupLabel): 12/800/0.04em
      // labelAlt uppercase eyebrow. Stronger weight + smaller size widens the
      // hierarchy gap with the 14/600 row labels inside the card.
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s2,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    sectionContent: {
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      overflow: 'hidden',
    },
  });

export default SettingSection;
