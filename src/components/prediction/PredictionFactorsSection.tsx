/**
 * PredictionFactorsSection — Section 8 of the weekly prediction screen.
 *
 * Renders the list of prediction factors (weather, congestion, delay, pattern)
 * produced by usePredictionFactors as a vertical stack of icon + label + value
 * rows. Each row's icon and value text are colored according to the factor's
 * impact (negative / positive / neutral) using the WANTED_TOKENS semantic
 * palette via useTheme().isDark — same theming pattern as
 * SegmentBreakdownSection.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import type { PredictionFactor, FactorImpact } from '@/hooks/usePredictionFactors';

// ============================================================================
// Types
// ============================================================================

export interface PredictionFactorsSectionProps {
  readonly factors: readonly PredictionFactor[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a FactorImpact to a WANTED_TOKENS semantic color.
 * Negative → statusNegative, positive → statusPositive, neutral → labelAlt.
 */
const impactColor = (semantic: WantedSemanticTheme, impact: FactorImpact): string => {
  if (impact === 'negative') return semantic.statusNegative;
  if (impact === 'positive') return semantic.statusPositive;
  return semantic.labelAlt;
};

const ICON_SIZE = 20;
const SECTION_TITLE = '예측에 반영된 요소';

// ============================================================================
// Component
// ============================================================================

const PredictionFactorsSectionComponent: React.FC<PredictionFactorsSectionProps> = ({
  factors,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{SECTION_TITLE}</Text>
      {factors.map(f => {
        const color = impactColor(semantic, f.impact);
        const Icon = f.icon;
        return (
          <View key={f.id} style={styles.row} testID={`factor-row-${f.id}`}>
            <Icon size={ICON_SIZE} color={color} />
            <Text style={styles.label}>{f.label}</Text>
            <Text style={[styles.value, { color }]}>{f.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme): {
  container: ViewStyle;
  title: TextStyle;
  row: ViewStyle;
  label: TextStyle;
  value: TextStyle;
} =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgElevated,
      borderRadius: WANTED_TOKENS.radius.r8,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s1,
    },
    title: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNormal,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s3,
    },
    label: {
      flex: 1,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNormal,
    },
    value: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
    },
  });

export const PredictionFactorsSection = memo(PredictionFactorsSectionComponent);
PredictionFactorsSection.displayName = 'PredictionFactorsSection';
