/**
 * SegmentBreakdownSection — 4-row commute breakdown for ML prediction screen.
 *
 * Renders the predicted route as four stacked rows: walk-to-station,
 * wait-on-platform, ride, walk-to-destination. Mirrors Section 6 of the
 * weekly prediction design (spec 2026-05-12).
 *
 * Theming uses the WANTED_TOKENS semantic palette via useTheme().isDark,
 * matching CommutePredictionCard. The wait row embeds a LineBadge and the
 * ride row embeds CongestionDots when a congestion level is supplied.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Footprints, Clock, Train, type LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { LineBadge } from '@/components/design/LineBadge';
import { CongestionDots } from '@/components/design/CongestionDots';
import { CongestionLevel } from '@/models/congestion';
import type { CongestionLevel as DesignCongestionLevel } from '@/components/design/congestion';

// ============================================================================
// Types
// ============================================================================

export interface PredictedRoute {
  readonly walkToStation: { readonly durationMin: number };
  readonly wait: {
    readonly lineId: string;
    readonly direction: string;
    readonly durationMin: number;
  };
  readonly ride: {
    readonly fromStation: string;
    readonly toStation: string;
    readonly stopsCount: number;
    readonly durationMin: number;
    readonly congestionLevel?: CongestionLevel;
  };
  readonly walkToDestination: { readonly durationMin: number };
}

export interface SegmentBreakdownSectionProps {
  readonly route: PredictedRoute | null;
  readonly origin: { readonly name: string; readonly exit: string };
  readonly destination: { readonly name: string; readonly exit: string };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map the canonical 4-step CongestionLevel enum from @/models/congestion
 * (low / moderate / high / crowded) onto the design system's 4-step palette
 * (low / mid / high / vhigh) consumed by CongestionDots.
 */
const toDesignCongestion = (level: CongestionLevel): DesignCongestionLevel => {
  switch (level) {
    case CongestionLevel.LOW:
      return 'low';
    case CongestionLevel.MODERATE:
      return 'mid';
    case CongestionLevel.HIGH:
      return 'high';
    case CongestionLevel.CROWDED:
      return 'vhigh';
    default: {
      // Exhaustiveness: adding a new CongestionLevel member will fail here.
      const _exhaustive: never = level;
      void _exhaustive;
      return 'low';
    }
  }
};

// ============================================================================
// Row sub-component
// ============================================================================

interface RowProps {
  readonly testID: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly sublabel: string;
  readonly durationMin: number;
  readonly semantic: WantedSemanticTheme;
  readonly badge?: React.ReactNode;
  readonly dots?: React.ReactNode;
}

const SegmentRow: React.FC<RowProps> = memo(
  ({ testID, icon: Icon, label, sublabel, durationMin, semantic, badge, dots }) => {
    const styles = useMemo(() => createRowStyles(semantic), [semantic]);

    return (
      <View style={styles.row} testID={testID}>
        <View style={styles.iconCircle}>
          <Icon size={18} color={semantic.labelAlt} />
        </View>
        <View style={styles.middle}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            {badge}
            {dots}
          </View>
          <Text style={styles.sublabel}>{sublabel}</Text>
        </View>
        <Text style={styles.duration}>
          <Text style={styles.durationNumber}>{durationMin}</Text>
          <Text style={styles.durationUnit}>분</Text>
        </Text>
      </View>
    );
  },
);
SegmentRow.displayName = 'SegmentRow';

// ============================================================================
// Component
// ============================================================================

const SegmentBreakdownSectionComponent: React.FC<SegmentBreakdownSectionProps> = ({
  route,
  origin,
  destination,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  if (!route) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>경로 정보 없음</Text>
      </View>
    );
  }

  const designLevel = route.ride.congestionLevel
    ? toDesignCongestion(route.ride.congestionLevel)
    : null;

  return (
    <View style={styles.container}>
      <SegmentRow
        testID="segment-row-walk-origin"
        icon={Footprints}
        label="도보"
        sublabel={`${origin.name} → ${origin.exit}`}
        durationMin={route.walkToStation.durationMin}
        semantic={semantic}
      />
      <SegmentRow
        testID="segment-row-wait"
        icon={Clock}
        label="대기"
        sublabel={`${route.wait.lineId}호선 ${route.wait.direction} 방면`}
        durationMin={route.wait.durationMin}
        semantic={semantic}
        badge={<LineBadge line={route.wait.lineId} size={20} />}
      />
      <SegmentRow
        testID="segment-row-ride"
        icon={Train}
        label="승차"
        sublabel={`${route.ride.fromStation} → ${route.ride.toStation} (${route.ride.stopsCount}개역)`}
        durationMin={route.ride.durationMin}
        semantic={semantic}
        dots={designLevel ? <CongestionDots level={designLevel} /> : null}
      />
      <SegmentRow
        testID="segment-row-walk-destination"
        icon={Footprints}
        label="도보"
        sublabel={`${destination.name} → ${destination.exit}`}
        durationMin={route.walkToDestination.durationMin}
        semantic={semantic}
      />
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme): {
  container: ViewStyle;
  emptyText: TextStyle;
} =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgElevated,
      borderRadius: WANTED_TOKENS.radius.r8,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s3,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s6,
    },
  });

const createRowStyles = (semantic: WantedSemanticTheme): {
  row: ViewStyle;
  iconCircle: ViewStyle;
  middle: ViewStyle;
  labelRow: ViewStyle;
  label: TextStyle;
  sublabel: TextStyle;
  duration: TextStyle;
  durationNumber: TextStyle;
  durationUnit: TextStyle;
} =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: semantic.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    middle: { flex: 1 },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    label: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNormal,
    },
    sublabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('400'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    duration: {},
    durationNumber: {
      fontSize: 20,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNormal,
    },
    durationUnit: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });

export const SegmentBreakdownSection = memo(SegmentBreakdownSectionComponent);
SegmentBreakdownSection.displayName = 'SegmentBreakdownSection';
