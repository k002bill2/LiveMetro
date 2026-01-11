/**
 * ExitInfoSection Component
 * Displays exit information with nearby landmarks for a station
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/services/theme/themeContext';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import type { ExitInfo, LandmarkCategory } from '@/models/publicData';

// ============================================================================
// Types
// ============================================================================

interface ExitInfoSectionProps {
  /** Exit info grouped by exit number */
  exitInfo: ExitInfo[];
  /** Whether data is loading */
  loading?: boolean;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_ICONS: Record<LandmarkCategory, string> = {
  hospital: '🏥',
  school: '🏫',
  government: '🏛️',
  shopping: '🛍️',
  culture: '🎭',
  transport: '🚌',
  food: '🍽️',
  accommodation: '🏨',
  park: '🌳',
  other: '📍',
};


// ============================================================================
// Sub-components
// ============================================================================

interface ExitCardProps {
  exit: ExitInfo;
}

const ExitCard: React.FC<ExitCardProps> = memo(({ exit }) => {
  const { colors } = useTheme();

  const landmarksByCategory = useMemo(() => {
    const grouped = new Map<LandmarkCategory, string[]>();
    for (const landmark of exit.landmarks) {
      const existing = grouped.get(landmark.category) || [];
      existing.push(landmark.landmarkName);
      grouped.set(landmark.category, existing);
    }
    return grouped;
  }, [exit.landmarks]);

  return (
    <View style={[styles.exitCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.exitBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.exitBadgeText}>{exit.exitNumber}</Text>
      </View>
      <View style={styles.exitContent}>
        {Array.from(landmarksByCategory.entries()).map(([category, names]) => (
          <View key={category} style={styles.categoryRow}>
            <Text style={styles.categoryIcon}>
              {CATEGORY_ICONS[category]}
            </Text>
            <Text
              style={[styles.landmarkText, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {names.join(', ')}
            </Text>
          </View>
        ))}
        {exit.landmarks.length === 0 && (
          <Text style={[styles.noDataText, { color: colors.textTertiary }]}>
            주요 장소 정보 없음
          </Text>
        )}
      </View>
    </View>
  );
});

ExitCard.displayName = 'ExitCard';

// ============================================================================
// Main Component
// ============================================================================

export const ExitInfoSection: React.FC<ExitInfoSectionProps> = memo(
  ({ exitInfo, loading = false, testID }) => {
    const { colors } = useTheme();

    if (loading) {
      return (
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
          testID={testID}
        >
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            출구 정보 로딩 중...
          </Text>
        </View>
      );
    }

    if (exitInfo.length === 0) {
      return (
        <View
          style={[styles.container, { backgroundColor: colors.background }]}
          testID={testID}
        >
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🚪</Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              출구 정보
            </Text>
          </View>
          <Text style={[styles.noDataText, { color: colors.textTertiary }]}>
            출구 정보가 없습니다
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
        testID={testID}
        accessible={true}
        accessibilityLabel="출구별 주요 장소 정보"
      >
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🚪</Text>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            출구 정보
          </Text>
          <Text style={[styles.exitCount, { color: colors.textSecondary }]}>
            {exitInfo.length}개
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {exitInfo.map((exit) => (
            <ExitCard key={exit.exitNumber} exit={exit} />
          ))}
        </ScrollView>
      </View>
    );
  }
);

ExitInfoSection.displayName = 'ExitInfoSection';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
    flex: 1,
  },
  exitCount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  exitCard: {
    width: 200,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
  },
  exitBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  exitBadgeText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  exitContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  categoryIcon: {
    fontSize: 14,
    marginRight: SPACING.xs,
    width: 20,
  },
  landmarkText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 18,
  },
  noDataText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    padding: SPACING.md,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    padding: SPACING.md,
  },
});

export default ExitInfoSection;
