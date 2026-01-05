/**
 * Setting Slider Component
 * Reusable slider for numeric settings
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';

interface SettingSliderProps {
  label: string;
  subtitle?: string;
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  unit: string; // e.g., "분"
  onValueChange: (value: number) => void;
  icon?: React.ElementType;
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
  icon: Icon,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon size={20} color={COLORS.black} />
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
          minimumTrackTintColor={COLORS.black}
          maximumTrackTintColor={COLORS.gray[300]}
          thumbTintColor={COLORS.black}
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  valueContainer: {
    backgroundColor: COLORS.surface.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  sliderContainer: {
    marginTop: SPACING.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -SPACING.sm,
  },
  rangeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
});

export default SettingSlider;
