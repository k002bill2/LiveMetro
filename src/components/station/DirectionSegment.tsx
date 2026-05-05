/**
 * DirectionSegment — 상행/하행 segmented control (Wanted Design System).
 *
 * Mirrors the design handoff: rounded 12 surface (`bg-subtle`), inner active
 * pill on `bg-base` with subtle shadow.
 */
import React, { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

export type DirectionValue = 'up' | 'down';

interface DirectionSegmentProps {
  value: DirectionValue;
  upLabel: string;
  downLabel: string;
  onChange: (next: DirectionValue) => void;
  testID?: string;
}

const DirectionSegmentImpl: React.FC<DirectionSegmentProps> = ({
  value,
  upLabel,
  downLabel,
  onChange,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const trackStyle: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: semantic.bgSubtle,
    borderRadius: WANTED_TOKENS.radius.r6,
    padding: WANTED_TOKENS.spacing.s1,
  };

  const pressOption = useCallback(
    (next: DirectionValue) => {
      if (next !== value) onChange(next);
    },
    [onChange, value]
  );

  const renderOption = (option: DirectionValue, label: string) => {
    const active = value === option;
    const optionStyle: ViewStyle = {
      flex: 1,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r5 - 1,
      backgroundColor: active ? semantic.bgBase : 'transparent',
      alignItems: 'center',
      ...(active
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 2,
            elevation: 1,
          }
        : {}),
    };

    const labelStyle: TextStyle = {
      ...typeStyle('label2', '700'),
      color: active ? semantic.labelStrong : semantic.labelAlt,
    };

    return (
      <TouchableOpacity
        key={option}
        testID={testID ? `${testID}-${option}` : undefined}
        onPress={() => pressOption(option)}
        style={optionStyle}
        accessible
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        activeOpacity={0.7}
      >
        <Text style={labelStyle} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View testID={testID} style={trackStyle}>
      {renderOption('up', upLabel)}
      {renderOption('down', downLabel)}
    </View>
  );
};

export const DirectionSegment = memo(DirectionSegmentImpl);
DirectionSegment.displayName = 'DirectionSegment';
