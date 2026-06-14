/**
 * AccentColorSwatches — 강조 색상 8종 스와치 그리드 (테마 설정 화면).
 *
 * Wanted handoff: 흰 카드 안에 원형 스와치, 선택된 색은
 * 같은 색 ring(2px) + 흰색 체크로 표시. 행당 6개 wrap 배치.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme, useSemanticTokens } from '@/services/theme';
import {
  ACCENT_COLORS,
  type AccentColorId,
  type AccentColorOption,
} from '@/services/theme/accentColors';
import { WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';

interface AccentColorSwatchesProps {
  selectedId: AccentColorId;
  onSelect: (id: AccentColorId) => void;
}

interface SwatchProps {
  option: AccentColorOption;
  selected: boolean;
  isDark: boolean;
  onSelect: (id: AccentColorId) => void;
}

const Swatch: React.FC<SwatchProps> = memo(
  ({ option, selected, isDark, onSelect }) => {
    const handlePress = useCallback(() => {
      onSelect(option.id);
    }, [onSelect, option.id]);

    const hex = isDark ? option.dark : option.light;

    return (
      <TouchableOpacity
        style={[swatchStyles.ring, selected && { borderColor: hex }]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`강조 색상 ${option.labelKo}`}
        accessibilityState={{ selected }}
        testID={`accent-${option.id}`}
      >
        <View style={[swatchStyles.circle, { backgroundColor: hex }]}>
          {selected && <Check size={20} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  }
);
Swatch.displayName = 'AccentColorSwatch';

const AccentColorSwatchesImpl: React.FC<AccentColorSwatchesProps> = ({
  selectedId,
  onSelect,
}) => {
  const { isDark } = useTheme();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={styles.card} testID="accent-color-swatches">
      {ACCENT_COLORS.map((option) => (
        <Swatch
          key={option.id}
          option={option}
          selected={option.id === selectedId}
          isDark={isDark}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
};

const swatchStyles = StyleSheet.create({
  ring: {
    width: 52,
    height: 52,
    borderRadius: WANTED_TOKENS.radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: WANTED_TOKENS.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
    },
  });

export const AccentColorSwatches = memo(AccentColorSwatchesImpl);
AccentColorSwatches.displayName = 'AccentColorSwatches';

export default AccentColorSwatches;
