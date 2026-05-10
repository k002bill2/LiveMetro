/**
 * FavoritesLineChips
 * Horizontal chip row that filters the favorites list by line. The first
 * chip ("전체") clears the filter; subsequent chips are derived from the
 * unique lineIds present in the user's favorites — empty user state means
 * an empty chip row, never a hardcoded full-network list.
 */
import React, { memo, useCallback, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';

interface FavoritesLineChipsProps {
  lineIds: readonly string[];
  selectedLineId: string | undefined;
  onSelect: (lineId: string | undefined) => void;
  semantic: WantedSemanticTheme;
  testID?: string;
}

const chipLabel = (lineId: string): string => {
  if (/^\d$/.test(lineId)) return `${lineId}호선`;
  if (lineId === 'sb' || lineId === '신분당선') return '신분당';
  if (lineId === 'bd' || lineId === '수인분당선') return '분당';
  if (lineId === 'gj' || lineId === '경의선' || lineId === '경의중앙선') return '경의';
  if (lineId === 'gx' || lineId === '공항철도') return '공항';
  if (lineId === '경춘선') return '경춘';
  if (lineId === '경강선') return '경강';
  if (lineId === '서해선') return '서해';
  return lineId;
};

const FavoritesLineChipsImpl: React.FC<FavoritesLineChipsProps> = ({
  lineIds,
  selectedLineId,
  onSelect,
  semantic,
  testID,
}) => {
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const handleSelectAll = useCallback(() => onSelect(undefined), [onSelect]);
  const handleSelectLine = useCallback(
    (id: string) => () => onSelect(selectedLineId === id ? undefined : id),
    [onSelect, selectedLineId],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
      testID={testID}
    >
      <TouchableOpacity
        onPress={handleSelectAll}
        style={[styles.chip, !selectedLineId && styles.chipActive]}
        accessibilityRole="button"
        accessibilityLabel="전체 라인 보기"
        accessibilityState={{ selected: !selectedLineId }}
        testID={`${testID ?? 'fav-line-chip'}-all`}
      >
        <Text style={[styles.chipText, !selectedLineId && styles.chipTextActive]}>
          전체
        </Text>
      </TouchableOpacity>

      {lineIds.map((id) => {
        const isActive = selectedLineId === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={handleSelectLine(id)}
            style={[styles.chip, isActive && styles.chipActive]}
            accessibilityRole="button"
            accessibilityLabel={`${chipLabel(id)} 라인만 보기`}
            accessibilityState={{ selected: isActive }}
            testID={`${testID ?? 'fav-line-chip'}-${id}`}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {chipLabel(id)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

export const FavoritesLineChips = memo(FavoritesLineChipsImpl);
FavoritesLineChips.displayName = 'FavoritesLineChips';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    chipActive: {
      backgroundColor: semantic.labelStrong,
      borderColor: semantic.labelStrong,
    },
    chipText: {
      fontSize: 14,
      lineHeight: 20,
      color: semantic.labelNeutral,
      fontFamily: weightToFontFamily('600'),
    },
    chipTextActive: {
      color: semantic.bgBase,
    },
  });
