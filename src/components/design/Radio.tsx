/**
 * Radio — design system atomic radio indicator.
 *
 * Wanted handoff: a tight, subtle radio dot used inside option rows where
 * the surrounding label/card does the heavy lifting. The control itself is
 * intentionally compact (18×18 default) so it doesn't dominate text.
 *
 * Sizes:
 *   - sm (default): 18×18 outer, 8×8 inner — preferred for inline option rows
 *     (e.g. transfer-route picker, delay-report form).
 *   - md: 22×22 outer, 10×10 inner — reserved for low-density picker screens
 *     where each row needs a stronger control affordance.
 *
 * Visual contract:
 *   - Selected: filled primary circle, white inner dot (no border).
 *   - Unselected: 2px neutral border, transparent fill, no inner dot.
 *
 * The component is purely presentational — pressable wrappers belong to the
 * caller (TouchableOpacity/Pressable on the option row), so the radio can
 * be used inline without adding extra hit targets.
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { WANTED_TOKENS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

export type RadioSize = 'sm' | 'md';

interface RadioProps {
  selected: boolean;
  size?: RadioSize;
  disabled?: boolean;
  testID?: string;
}

const SIZE_MAP: Record<RadioSize, { outer: number; inner: number }> = {
  sm: { outer: 18, inner: 8 },
  md: { outer: 22, inner: 10 },
};

export const Radio: React.FC<RadioProps> = ({
  selected,
  size = 'sm',
  disabled = false,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { outer, inner } = SIZE_MAP[size];

  const outerStyle: ViewStyle = selected
    ? {
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        backgroundColor: semantic.primaryNormal,
        borderWidth: 0,
        opacity: disabled ? 0.5 : 1,
      }
    : {
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: disabled
          ? semantic.labelDisabled
          : 'rgba(112,115,124,0.32)',
        opacity: disabled ? 0.6 : 1,
      };

  return (
    <View
      testID={testID}
      style={[styles.outer, outerStyle]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      {selected ? (
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: semantic.labelOnColor,
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

export default Radio;
