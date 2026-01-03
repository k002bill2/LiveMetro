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
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';

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
        <Ionicons
          name="search"
          size={20}
          color={COLORS.text.tertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="역 이름으로 검색"
          placeholderTextColor={COLORS.text.tertiary}
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
            <Ionicons name="close-circle" size={20} color={COLORS.text.tertiary} />
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
          <Ionicons
            name="options"
            size={20}
            color={
              activeFilters.direction || activeFilters.commuteOnly
                ? COLORS.black
                : COLORS.text.tertiary
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
                <Ionicons
                  name="arrow-up"
                  size={14}
                  color={activeFilters.direction === 'up' ? COLORS.white : COLORS.text.secondary}
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
                <Ionicons
                  name="arrow-down"
                  size={14}
                  color={activeFilters.direction === 'down' ? COLORS.white : COLORS.text.secondary}
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
                <Ionicons
                  name="briefcase"
                  size={14}
                  color={activeFilters.commuteOnly ? COLORS.white : COLORS.text.secondary}
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface.background,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
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
    backgroundColor: COLORS.surface.card,
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
    color: COLORS.text.secondary,
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
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  filterChipActive: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  filterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  resultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface.background,
  },
  resultText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  clearFiltersButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  clearFiltersText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.black,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
