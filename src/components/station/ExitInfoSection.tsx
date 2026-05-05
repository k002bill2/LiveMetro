/**
 * ExitInfoSection Component
 * Displays exit information with nearby landmarks for a station.
 *
 * Phase 48 — migrated to Wanted Design System tokens.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/services/theme/themeContext';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
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
  semantic: WantedSemanticTheme;
}

const ExitCard: React.FC<ExitCardProps> = memo(({ exit, semantic }) => {
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
    <View style={[styles.exitCard, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}>
      <View style={[styles.exitBadge, { backgroundColor: WANTED_TOKENS.blue[500] }]}>
        <Text style={styles.exitBadgeText}>{exit.exitNumber}</Text>
      </View>
      <View style={styles.exitContent}>
        {Array.from(landmarksByCategory.entries()).map(([category, names]) => (
          <View key={category} style={styles.categoryRow}>
            <Text style={styles.categoryIcon}>
              {CATEGORY_ICONS[category]}
            </Text>
            <Text
              style={[styles.landmarkText, { color: semantic.labelStrong }]}
              numberOfLines={2}
            >
              {names.join(', ')}
            </Text>
          </View>
        ))}
        {exit.landmarks.length === 0 && (
          <Text style={[styles.noDataText, { color: semantic.labelAlt }]}>
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
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

    if (loading) {
      return (
        <View
          style={[styles.container, { backgroundColor: semantic.bgSubtlePage }]}
          testID={testID}
        >
          <Text style={[styles.loadingText, { color: semantic.labelNeutral }]}>
            출구 정보 로딩 중...
          </Text>
        </View>
      );
    }

    if (exitInfo.length === 0) {
      return (
        <View
          style={[styles.container, { backgroundColor: semantic.bgSubtlePage }]}
          testID={testID}
        >
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🚪</Text>
            <Text style={[styles.headerTitle, { color: semantic.labelStrong }]}>
              출구 정보
            </Text>
          </View>
          <Text style={[styles.noDataText, { color: semantic.labelAlt }]}>
            출구 정보가 없습니다
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[styles.container, { backgroundColor: semantic.bgSubtlePage }]}
        testID={testID}
        accessible={true}
        accessibilityLabel="출구별 주요 장소 정보"
      >
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🚪</Text>
          <Text style={[styles.headerTitle, { color: semantic.labelStrong }]}>
            출구 정보
          </Text>
          <Text style={[styles.exitCount, { color: semantic.labelNeutral }]}>
            {exitInfo.length}개
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {exitInfo.map((exit) => (
            <ExitCard key={exit.exitNumber} exit={exit} semantic={semantic} />
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
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: WANTED_TOKENS.spacing.s1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: weightToFontFamily('600'),
    flex: 1,
  },
  exitCount: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
  },
  scrollContent: {
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    gap: WANTED_TOKENS.spacing.s2,
  },
  exitCard: {
    width: 200,
    borderRadius: WANTED_TOKENS.radius.r8,
    borderWidth: 1,
    padding: WANTED_TOKENS.spacing.s3,
    flexDirection: 'row',
  },
  exitBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: WANTED_TOKENS.spacing.s2,
  },
  exitBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: weightToFontFamily('700'),
  },
  exitContent: {
    flex: 1,
    gap: WANTED_TOKENS.spacing.s1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  categoryIcon: {
    fontSize: 14,
    marginRight: WANTED_TOKENS.spacing.s1,
    width: 20,
  },
  landmarkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    lineHeight: 18,
  },
  noDataText: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    textAlign: 'center',
    padding: WANTED_TOKENS.spacing.s3,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: weightToFontFamily('500'),
    textAlign: 'center',
    padding: WANTED_TOKENS.spacing.s3,
  },
});

export default ExitInfoSection;
