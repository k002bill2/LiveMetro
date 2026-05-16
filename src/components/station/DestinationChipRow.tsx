/**
 * DestinationChipRow
 *
 * F3.3 — 방면(destination) chip filter. 시간표 그리드 데이터를
 * destination별로 필터링할 수 있는 가로 chip row.
 *
 * 이미지 디자인(2026-05-17)의 `2 잠실 / 2 서울대입구 / 신분당 광교 / ...`
 * 부분. 첫 chip은 "전체"(선택 해제) — 사용자가 종착지 무관하게 시간표
 * 둘러볼 수 있는 기본 상태.
 *
 * 빈 destinations(예: 시간표 미로딩) → null 반환 (호출자의 빈 상태 처리에
 * 위임). chip이 1개 뿐이면 filter 의미 없으므로 마찬가지로 null.
 */

import React, { memo, useCallback } from 'react';
import { FlatList, ListRenderItem, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/services/theme/themeContext';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

export interface DestinationChipRowProps {
  /** 시간표에서 추출된 unique destination names */
  readonly destinations: readonly string[];
  /** 현재 선택된 destination. null이면 "전체"(필터 해제) */
  readonly selected: string | null;
  /** chip press 핸들러. null 전달 = "전체" 복귀 */
  readonly onSelect: (destination: string | null) => void;
  /** 외부 셀렉터 / 테스트용 */
  readonly testID?: string;
}

const ALL_KEY = '__all__';

interface ChipDatum {
  readonly key: string;
  readonly label: string;
  readonly value: string | null;
}

const buildChips = (destinations: readonly string[]): readonly ChipDatum[] => {
  const all: ChipDatum = { key: ALL_KEY, label: '전체', value: null };
  const rest = destinations.map((d) => ({ key: d, label: d, value: d }));
  return [all, ...rest];
};

export const DestinationChipRow: React.FC<DestinationChipRowProps> = memo(
  ({ destinations, selected, onSelect, testID }) => {
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

    const handlePress = useCallback(
      (value: string | null) => () => onSelect(value),
      [onSelect],
    );

    // chip이 1개 이하면 filter의 의미가 없음 → 미렌더
    if (destinations.length <= 1) return null;

    const chips = buildChips(destinations);

    const renderItem: ListRenderItem<ChipDatum> = ({ item }) => {
      const isSelected = item.value === selected;
      const bg = isSelected ? semantic.labelStrong : semantic.bgSubtle;
      const color = isSelected ? semantic.bgBase : semantic.labelNeutral;
      return (
        <Pressable
          onPress={handlePress(item.value)}
          style={[styles.chip, { backgroundColor: bg }]}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={item.value ? `${item.label} 방면 필터` : '전체 방면'}
          testID={testID ? `${testID}-chip-${item.key}` : undefined}
        >
          <Text style={[styles.chipText, { color }]}>{item.label}</Text>
        </Pressable>
      );
    };

    return (
      <FlatList
        horizontal
        data={chips}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        testID={testID}
      />
    );
  },
);

DestinationChipRow.displayName = 'DestinationChipRow';

const styles = StyleSheet.create({
  contentContainer: {
    gap: WANTED_TOKENS.spacing.s2,
    paddingVertical: WANTED_TOKENS.spacing.s1,
  },
  chip: {
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});
