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
import { useSemanticTokens } from '@/services/theme';

interface SettingSectionProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Optional node rendered on the right of the title, on the same baseline. */
  trailing?: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  children,
  style,
  trailing,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={[styles.section, style]}>
      {title && (
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {trailing}
        </View>
      )}
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    section: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    titleRow: {
      // Row wrapper so an optional `trailing` node sits on the title's right,
      // sharing the same baseline. Carries the spacing the title used to own
      // (s4 horizontal inset + s2 bottom gap) so the title-only case is
      // visually unchanged.
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: WANTED_TOKENS.spacing.s2,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
    },
    sectionTitle: {
      // Wanted handoff (settings-detail.jsx:25-37 GroupLabel): 12/800/0.04em
      // labelAlt uppercase eyebrow. Stronger weight + smaller size widens the
      // hierarchy gap with the 14/600 row labels inside the card.
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
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
