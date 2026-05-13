/**
 * Report Filter Bar
 *
 * 실시간 제보 피드의 카테고리/내노선만 필터. 시안 #1의 chip 행을 따르며,
 * 카테고리(전체/지연/신호장애/혼잡)는 단일 선택, "내 노선만"은 독립 토글.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

import { useTheme } from '@/services/theme';
import { ReportType } from '@/models/delayReport';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

export type FilterCategory = 'all' | ReportType.DELAY | ReportType.SIGNAL_ISSUE | ReportType.CROWDED;

interface CategoryDef {
  key: FilterCategory;
  label: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'all', label: '전체' },
  { key: ReportType.DELAY, label: '지연' },
  { key: ReportType.SIGNAL_ISSUE, label: '신호장애' },
  { key: ReportType.CROWDED, label: '혼잡' },
];

interface ReportFilterBarProps {
  selectedCategory: FilterCategory;
  onSelectCategory: (next: FilterCategory) => void;
  onlyMyLines: boolean;
  onToggleMyLines: () => void;
  myLinesAvailable: boolean;
}

interface ChipItem {
  testID: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  onlyMyLines,
  onToggleMyLines,
  myLinesAvailable,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const items: ChipItem[] = [
    ...CATEGORIES.map(c => ({
      testID: `report-filter-${c.key}`,
      label: c.label,
      selected: selectedCategory === c.key,
      onPress: () => onSelectCategory(c.key),
    })),
    {
      testID: 'report-filter-my-lines',
      label: '내 노선만',
      selected: onlyMyLines,
      disabled: !myLinesAvailable,
      onPress: onToggleMyLines,
    },
  ];

  return (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={items}
        keyExtractor={item => item.testID}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const isSelected = item.selected;
          const isDisabled = !!item.disabled;
          return (
            <TouchableOpacity
              testID={item.testID}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              style={[
                styles.filterButton,
                isSelected && styles.filterButtonSelected,
                isDisabled && styles.filterButtonDisabled,
              ]}
              onPress={item.onPress}
              disabled={isDisabled}
            >
              <Text
                style={[
                  styles.filterText,
                  isSelected && styles.filterTextSelected,
                  isDisabled && styles.filterTextDisabled,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    filterContainer: {
      backgroundColor: semantic.bgBase,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    filterList: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    filterButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      marginRight: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
    },
    filterButtonSelected: {
      backgroundColor: semantic.labelStrong,
      borderColor: semantic.labelStrong,
    },
    filterButtonDisabled: {
      opacity: 0.4,
    },
    filterText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    filterTextSelected: {
      color: semantic.labelOnColor,
    },
    filterTextDisabled: {
      color: semantic.labelAlt,
    },
  });

export default ReportFilterBar;
