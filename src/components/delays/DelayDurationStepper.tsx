/**
 * Delay Duration Stepper
 *
 * 지연 시간(분) 입력용 stepper. − / [N분] / + 버튼과 빠른선택 chip 행을 제공.
 * 시안 #2 (제보 작성폼) 정렬용 신규 컴포넌트.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface DelayDurationStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  quickPicks?: number[];
}

const DEFAULT_QUICK_PICKS = [3, 5, 10, 15, 30];

export const DelayDurationStepper: React.FC<DelayDurationStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 60,
  quickPicks = DEFAULT_QUICK_PICKS,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDecrement = (): void => {
    if (canDecrement) onChange(value - 1);
  };

  const handleIncrement = (): void => {
    if (canIncrement) onChange(value + 1);
  };

  const handleQuickPick = (next: number): void => {
    const clamped = Math.max(min, Math.min(max, next));
    onChange(clamped);
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          testID="duration-stepper-decrement"
          accessibilityRole="button"
          accessibilityLabel="지연 시간 감소"
          accessibilityState={{ disabled: !canDecrement }}
          style={[styles.stepperButton, !canDecrement && styles.stepperButtonDisabled]}
          onPress={handleDecrement}
          disabled={!canDecrement}
        >
          <Minus
            size={20}
            color={canDecrement ? semantic.labelStrong : semantic.labelAlt}
            strokeWidth={2.2}
          />
        </TouchableOpacity>

        <Text testID="duration-stepper-value" style={styles.valueText}>
          {value}분
        </Text>

        <TouchableOpacity
          testID="duration-stepper-increment"
          accessibilityRole="button"
          accessibilityLabel="지연 시간 증가"
          accessibilityState={{ disabled: !canIncrement }}
          style={[styles.stepperButton, !canIncrement && styles.stepperButtonDisabled]}
          onPress={handleIncrement}
          disabled={!canIncrement}
        >
          <Plus
            size={20}
            color={canIncrement ? semantic.labelStrong : semantic.labelAlt}
            strokeWidth={2.2}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.quickPickRow}>
        {quickPicks.map(pick => {
          const isSelected = pick === value;
          return (
            <TouchableOpacity
              key={pick}
              testID={`duration-quick-${pick}`}
              accessibilityRole="button"
              accessibilityLabel={`${pick}분 선택`}
              accessibilityState={{ selected: isSelected }}
              style={[styles.quickPickChip, isSelected && styles.quickPickChipSelected]}
              onPress={() => handleQuickPick(pick)}
            >
              <Text style={[styles.quickPickText, isSelected && styles.quickPickTextSelected]}>
                {pick}분
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      gap: WANTED_TOKENS.spacing.s3,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r4,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    stepperButton: {
      width: 44,
      height: 44,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    stepperButtonDisabled: {
      opacity: 0.4,
    },
    valueText: {
      fontSize: 28,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      minWidth: 80,
      textAlign: 'center',
    },
    quickPickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
    },
    quickPickChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    quickPickChipSelected: {
      backgroundColor: semantic.primaryNormal,
      borderColor: semantic.primaryNormal,
    },
    quickPickText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    quickPickTextSelected: {
      color: semantic.labelOnColor,
    },
  });

export default DelayDurationStepper;
