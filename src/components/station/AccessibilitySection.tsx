/**
 * AccessibilitySection Component
 * Displays accessibility facilities information for a station.
 *
 * Phase 48 — migrated to Wanted Design System tokens. Status colors
 * (success/warning/error) now resolve to WANTED_TOKENS.status palette.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/services/theme/themeContext';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import type { AccessibilityInfo } from '@/models/publicData';

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
  semantic: WantedSemanticTheme;
}

// ============================================================================
// Sub-components
// ============================================================================

const FacilityItem: React.FC<FacilityItemProps> = memo(
  ({ icon, label, available, count, status, semantic }) => {
    const statusColor = useMemo(() => {
      if (!available) return semantic.labelAlt;
      switch (status) {
        case 'maintenance':
          return WANTED_TOKENS.status.yellow500;
        case 'broken':
          return WANTED_TOKENS.status.red500;
        default:
          return WANTED_TOKENS.status.green500;
      }
    }, [available, status, semantic]);

    return (
      <View style={styles.facilityItem}>
        <Text style={[styles.facilityIcon, { opacity: available ? 1 : 0.4 }]}>
          {icon}
        </Text>
        <View style={styles.facilityInfo}>
          <Text
            style={[
              styles.facilityLabel,
              { color: available ? semantic.labelStrong : semantic.labelAlt },
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
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

    if (loading) {
      return (
        <View
          style={[styles.container, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}
          testID={testID}
        >
          <Text style={[styles.loadingText, { color: semantic.labelNeutral }]}>
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
        style={[styles.container, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}
        testID={testID}
        accessible={true}
        accessibilityLabel="교통약자 편의시설 정보"
      >
        <View style={styles.header}>
          <Text style={styles.headerIcon}>♿</Text>
          <Text style={[styles.headerTitle, { color: semantic.labelStrong }]}>
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
            semantic={semantic}
          />
          <FacilityItem
            icon="📶"
            label="에스컬레이터"
            available={info.escalator.available}
            count={info.escalator.count}
            status={info.escalator.status}
            semantic={semantic}
          />
          <FacilityItem
            icon="🦽"
            label="휠체어리프트"
            available={info.wheelchairLift}
            semantic={semantic}
          />
          <FacilityItem
            icon="⠿"
            label="점자블록"
            available={info.tactilePaving}
            semantic={semantic}
          />
          <FacilityItem
            icon="🚻"
            label="장애인화장실"
            available={info.accessibleRestroom}
            semantic={semantic}
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
    borderRadius: WANTED_TOKENS.radius.r8,
    padding: WANTED_TOKENS.spacing.s3,
    marginVertical: WANTED_TOKENS.spacing.s2,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: WANTED_TOKENS.spacing.s1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: weightToFontFamily('600'),
  },
  facilitiesGrid: {
    gap: WANTED_TOKENS.spacing.s2,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s1,
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
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
  facilityLabel: {
    fontSize: 14,
    fontFamily: weightToFontFamily('500'),
  },
  facilityCount: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    marginLeft: WANTED_TOKENS.spacing.s1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: weightToFontFamily('500'),
    textAlign: 'center',
    padding: WANTED_TOKENS.spacing.s3,
  },
});

export default AccessibilitySection;
