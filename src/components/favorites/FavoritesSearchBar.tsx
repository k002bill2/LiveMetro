/**
 * Favorites Search Bar Component
 * Search and filter favorites by station name, line, direction, and commute status
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Search, XCircle, SlidersHorizontal, ArrowUp, ArrowDown, Briefcase } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';

interface FavoritesSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: {
    lineId?: string;
    direction?: 'up' | 'down';
    commuteOnly?: boolean;
  };
  onFilterChange: (filters: FavoritesSearchBarProps['activeFilters']) => void;
  resultCount: number;
}

export const FavoritesSearchBar: React.FC<FavoritesSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterChange,
  resultCount,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [showFilters, setShowFilters] = useState(false);
  const filterAnimation = React.useRef(new Animated.Value(0)).current;

  /**
   * Toggle filter visibility with animation
   */
  const toggleFilters = () => {
    const toValue = showFilters ? 0 : 1;
    setShowFilters(!showFilters);

    Animated.timing(filterAnimation, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  /**
   * Handle direction filter toggle
   */
  const handleDirectionFilter = (direction: 'up' | 'down') => {
    if (activeFilters.direction === direction) {
      // Deselect if already selected
      const { direction: _, ...rest } = activeFilters;
      onFilterChange(rest);
    } else {
      onFilterChange({ ...activeFilters, direction });
    }
  };

  /**
   * Handle commute filter toggle
   */
  const handleCommuteFilter = () => {
    onFilterChange({
      ...activeFilters,
      commuteOnly: !activeFilters.commuteOnly,
    });
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    onSearchChange('');
    onFilterChange({});
  };

  const hasActiveFilters =
    searchQuery.length > 0 ||
    activeFilters.lineId !== undefined ||
    activeFilters.direction !== undefined ||
    activeFilters.commuteOnly === true;

  const filterScale = filterAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search
          size={20}
          color={colors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="역 이름으로 검색"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Clear Button */}
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchChange('')}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XCircle size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Filter Toggle Button */}
        <TouchableOpacity
          onPress={toggleFilters}
          style={[
            styles.filterToggle,
            (activeFilters.direction || activeFilters.commuteOnly) && styles.filterToggleActive,
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <SlidersHorizontal
            size={20}
            color={
              activeFilters.direction || activeFilters.commuteOnly
                ? colors.textPrimary
                : colors.textTertiary
            }
          />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <Animated.View
          style={[
            styles.filtersContainer,
            { transform: [{ scale: filterScale }] }
          ]}
        >
          {/* Direction Filters */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>방향</Text>
            <View style={styles.filterChips}>
              <TouchableOpacity
                onPress={() => handleDirectionFilter('up')}
                style={[
                  styles.filterChip,
                  activeFilters.direction === 'up' && styles.filterChipActive,
                ]}
              >
                <ArrowUp
                  size={14}
                  color={activeFilters.direction === 'up' ? colors.textInverse : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.direction === 'up' && styles.filterChipTextActive,
                  ]}
                >
                  상행
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDirectionFilter('down')}
                style={[
                  styles.filterChip,
                  activeFilters.direction === 'down' && styles.filterChipActive,
                ]}
              >
                <ArrowDown
                  size={14}
                  color={activeFilters.direction === 'down' ? colors.textInverse : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.direction === 'down' && styles.filterChipTextActive,
                  ]}
                >
                  하행
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Commute Filter */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>종류</Text>
            <View style={styles.filterChips}>
              <TouchableOpacity
                onPress={handleCommuteFilter}
                style={[
                  styles.filterChip,
                  activeFilters.commuteOnly && styles.filterChipActive,
                ]}
              >
                <Briefcase
                  size={14}
                  color={activeFilters.commuteOnly ? colors.textInverse : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilters.commuteOnly && styles.filterChipTextActive,
                  ]}
                >
                  출퇴근
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Result Count & Clear */}
      {hasActiveFilters && (
        <View style={styles.resultBar}>
          <Text style={styles.resultText}>
            {resultCount}개의 결과
          </Text>
          <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersButton}>
            <Text style={styles.clearFiltersText}>필터 초기화</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: colors.textPrimary,
    paddingVertical: SPACING.xs,
  },
  clearButton: {
    marginLeft: SPACING.xs,
    padding: SPACING.xs,
  },
  filterToggle: {
    marginLeft: SPACING.sm,
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  filterToggleActive: {
    backgroundColor: colors.surface,
  },
  filtersContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  filterGroup: {
    gap: SPACING.sm,
  },
  filterLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterChips: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  filterChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  filterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  resultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  resultText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
  },
  clearFiltersButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  clearFiltersText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
