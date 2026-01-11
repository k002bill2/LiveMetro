/**
 * AccessibilitySection Component
 * Displays accessibility facilities information for a station
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/services/theme/themeContext';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import type { AccessibilityInfo } from '@/models/publicData';
import type { ThemeColors } from '@/services/theme/themeContext';

// ============================================================================
// Types
// ============================================================================

interface AccessibilitySectionProps {
  /** Accessibility info from public data API */
  info: AccessibilityInfo | null;
  /** Whether data is loading */
  loading?: boolean;
  /** Test ID for testing */
  testID?: string;
}

interface FacilityItemProps {
  icon: string;
  label: string;
  available: boolean;
  count?: number;
  status?: 'normal' | 'maintenance' | 'broken';
  colors: ThemeColors;
}

// ============================================================================
// Sub-components
// ============================================================================

const FacilityItem: React.FC<FacilityItemProps> = memo(
  ({ icon, label, available, count, status, colors }) => {
    const statusColor = useMemo(() => {
      if (!available) return colors.textTertiary;
      switch (status) {
        case 'maintenance':
          return colors.warning;
        case 'broken':
          return colors.error;
        default:
          return colors.success;
      }
    }, [available, status, colors]);

    return (
      <View style={styles.facilityItem}>
        <Text style={[styles.facilityIcon, { opacity: available ? 1 : 0.4 }]}>
          {icon}
        </Text>
        <View style={styles.facilityInfo}>
          <Text
            style={[
              styles.facilityLabel,
              { color: available ? colors.textPrimary : colors.textTertiary },
            ]}
          >
            {label}
          </Text>
          {available && count !== undefined && count > 0 && (
            <Text style={[styles.facilityCount, { color: statusColor }]}>
              {count}대
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColor },
          ]}
        />
      </View>
    );
  }
);

FacilityItem.displayName = 'FacilityItem';

// ============================================================================
// Main Component
// ============================================================================

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = memo(
  ({ info, loading = false, testID }) => {
    const { colors } = useTheme();

    if (loading) {
      return (
        <View
          style={[styles.container, { backgroundColor: colors.surface }]}
          testID={testID}
        >
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            교통약자 정보 로딩 중...
          </Text>
        </View>
      );
    }

    if (!info) {
      return null;
    }

    return (
      <View
        style={[styles.container, { backgroundColor: colors.surface }]}
        testID={testID}
        accessible={true}
        accessibilityLabel="교통약자 편의시설 정보"
      >
        <View style={styles.header}>
          <Text style={styles.headerIcon}>♿</Text>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            교통약자 편의시설
          </Text>
        </View>

        <View style={styles.facilitiesGrid}>
          <FacilityItem
            icon="🛗"
            label="엘리베이터"
            available={info.elevator.available}
            count={info.elevator.count}
            status={info.elevator.status}
            colors={colors}
          />
          <FacilityItem
            icon="📶"
            label="에스컬레이터"
            available={info.escalator.available}
            count={info.escalator.count}
            status={info.escalator.status}
            colors={colors}
          />
          <FacilityItem
            icon="🦽"
            label="휠체어리프트"
            available={info.wheelchairLift}
            colors={colors}
          />
          <FacilityItem
            icon="⠿"
            label="점자블록"
            available={info.tactilePaving}
            colors={colors}
          />
          <FacilityItem
            icon="🚻"
            label="장애인화장실"
            available={info.accessibleRestroom}
            colors={colors}
          />
        </View>
      </View>
    );
  }
);

AccessibilitySection.displayName = 'AccessibilitySection';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  facilitiesGrid: {
    gap: SPACING.sm,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  facilityIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  facilityInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  facilityLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  facilityCount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: SPACING.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    padding: SPACING.md,
  },
});

export default AccessibilitySection;
