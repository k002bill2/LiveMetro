/**
 * Direction Toggle
 *
 * 제보 작성폼의 방면 선택 세그먼트 — 시안 #2.
 * 옵션 도출(@utils/directionOptions)은 호출부 책임; 이 컴포넌트는
 * 순수 segmented control로 옵션이 없으면 렌더하지 않는다.
 */

import React, { useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface DirectionToggleProps {
  /** "{인접역} 방면" 라벨 목록 (0–2개). 빈 배열이면 null 렌더. */
  options: string[];
  value: string | null;
  onChange: (next: string) => void;
}

export const DirectionToggle: React.FC<DirectionToggleProps> = ({ options, value, onChange }) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.track} testID="direction-toggle">
      {options.map(option => {
        const isSelected = option === value;
        return (
          <TouchableOpacity
            key={option}
            testID={`direction-option-${option}`}
            accessibilityRole="button"
            accessibilityLabel={option}
            accessibilityState={{ selected: isSelected }}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

DirectionToggle.displayName = 'DirectionToggle';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r5,
    },
    segmentSelected: {
      backgroundColor: semantic.bgBase,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    segmentText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    segmentTextSelected: {
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
  });

export default DirectionToggle;
