/**
 * VibrationPatternGlyph — a small visual glyph representing a vibration pattern.
 *
 * Renders a rounded square box outlined in the brand blue, containing one or
 * more vertical bars whose count/height encode the pattern. Used inside the
 * VibrationPicker modal rows to preview each pattern at a glance.
 *
 * Visual-only: this glyph carries no semantics of its own — the parent row
 * provides the accessibility label — so it is hidden from assistive tech.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useSemanticTokens } from '@/services/theme';
import type { VibrationPatternId } from '@/models/user';

interface VibrationPatternGlyphProps {
  patternId: VibrationPatternId;
}

/** Bar height variants (keyed into the StyleSheet bar styles). */
type BarVariant = 'tall' | 'medium' | 'short' | 'dot';

/** Per-pattern bar specification: list of bar variants to render left→right. */
const PATTERN_BARS: Record<VibrationPatternId, readonly BarVariant[]> = {
  default: ['medium'],
  short: ['short'],
  long: ['tall'],
  double: ['medium', 'medium'],
  triple: ['medium', 'medium', 'medium'],
  none: ['dot'],
};

const VibrationPatternGlyphComponent: React.FC<VibrationPatternGlyphProps> = ({
  patternId,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // PATTERN_BARS is keyed by the full VibrationPatternId union, so this lookup
  // is always defined — no fallback branch needed.
  const bars = PATTERN_BARS[patternId];

  return (
    <View
      style={styles.box}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {bars.map((variant, index) => (
        <View
          key={`${patternId}-bar-${index}`}
          testID="vib-bar"
          style={[styles.bar, styles[variant]]}
        />
      ))}
    </View>
  );
};

VibrationPatternGlyphComponent.displayName = 'VibrationPatternGlyph';

export const VibrationPatternGlyph = React.memo(VibrationPatternGlyphComponent);

const createStyles = (
  _semantic: WantedSemanticTheme,
): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    box: {
      width: 40,
      height: 44,
      borderWidth: 1.5,
      borderColor: WANTED_TOKENS.blue[500],
      borderRadius: WANTED_TOKENS.radius.r6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    bar: {
      width: 3,
      borderRadius: WANTED_TOKENS.radius.r2,
      backgroundColor: WANTED_TOKENS.blue[500],
    },
    tall: {
      height: 24,
    },
    medium: {
      height: 16,
    },
    short: {
      height: 10,
    },
    dot: {
      height: 4,
    },
  });

export default VibrationPatternGlyph;
