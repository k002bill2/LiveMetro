/**
 * Setting Slider Component
 * Reusable slider for numeric settings.
 *
 * Phase 45 — Wanted Design System migration.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import type { LucideIcon } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

interface SettingSliderProps {
  label: string;
  subtitle?: string;
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  unit: string; // e.g., "분"
  onValueChange: (value: number) => void;
  icon?: LucideIcon;
}

export const SettingSlider: React.FC<SettingSliderProps> = ({
  label,
  subtitle,
  value,
  minValue,
  maxValue,
  step,
  unit,
  onValueChange,
  icon: IconComponent,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {IconComponent && (
          <View style={styles.iconContainer}>
            <IconComponent size={20} color={semantic.labelStrong} strokeWidth={2} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.label}>{label}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>
            {value}
            {unit}
          </Text>
        </View>
      </View>

      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={minValue}
          maximumValue={maxValue}
          step={step}
          value={value}
          onValueChange={onValueChange}
          minimumTrackTintColor={WANTED_TOKENS.blue[500]}
          maximumTrackTintColor={semantic.lineNormal}
          thumbTintColor={WANTED_TOKENS.blue[500]}
        />
        <View style={styles.rangeLabels}>
          <Text style={styles.rangeLabel}>
            {minValue}
            {unit}
          </Text>
          <Text style={styles.rangeLabel}>
            {maxValue}
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
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
    subtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    valueContainer: {
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    value: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    sliderContainer: {
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    slider: {
      width: '100%',
      height: 40,
    },
    rangeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: -WANTED_TOKENS.spacing.s2,
    },
    rangeLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });

export default SettingSlider;
