/**
 * TrainCongestionView Component
 * Shows a visual representation of congestion levels for each train car.
 *
 * Phase 53 — adopted Wanted handoff design's vertical bar visualization
 * (bottom-aligned fill, height = mapped percentage). Hybrid approach:
 * report count + reliability are preserved via long-press tooltip rather
 * than discarded — the design's purely-visual intent is kept while
 * LiveMetro's richer crowdsourced data remains accessible on demand.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Users, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import {
  CongestionLevel,
  CarCongestion,
  TrainCongestionSummary,
  getCongestionLevelName,
  getCongestionLevelColor,
  MIN_REPORTS_FOR_RELIABILITY,
  createEmptyCarCongestions,
} from '@/models/congestion';

interface TrainCongestionViewProps {
  congestion: TrainCongestionSummary | null;
  onCarPress?: (carNumber: number) => void;
  style?: ViewStyle;
  showLegend?: boolean;
  compact?: boolean;
}

interface CarBarProps {
  car: CarCongestion;
  onPress?: () => void;
  onLongPress?: () => void;
  compact?: boolean;
  semantic: WantedSemanticTheme;
}

/**
 * Map a 4-step CongestionLevel enum to a percentage matching the Wanted
 * handoff's CONG_TONE.pct values. Pure visual mapping — no data shape
 * change. Used to set the bar fill height.
 */
const CONGESTION_PCT: Record<CongestionLevel, number> = {
  [CongestionLevel.LOW]: 30,
  [CongestionLevel.MODERATE]: 55,
  [CongestionLevel.HIGH]: 80,
  [CongestionLevel.CROWDED]: 95,
};

const CarBar: React.FC<CarBarProps> = ({
  car,
  onPress,
  onLongPress,
  compact = false,
  semantic,
}) => {
  const congestionColor = getCongestionLevelColor(car.congestionLevel);
  const hasReports = car.reportCount > 0;
  const isReliable = car.reportCount >= MIN_REPORTS_FOR_RELIABILITY;
  // Reliability still surfaces visually via opacity: 1.0 reliable, 0.7
  // some-reports, 0.4 no-reports. Matches prior CarIndicator semantics so
  // the design switch doesn't lose at-a-glance data quality cues.
  const opacity = isReliable ? 1 : hasReports ? 0.7 : 0.4;
  const fillPct = hasReports ? CONGESTION_PCT[car.congestionLevel] : 0;

  const trackHeight = compact ? 24 : 32;

  const inner = (
    <View style={sharedStyles.carColumn}>
      <View
        style={[
          sharedStyles.barTrack,
          {
            height: trackHeight,
            backgroundColor: semantic.bgSubtle,
            borderColor: semantic.lineSubtle,
            opacity,
          },
        ]}
      >
        {hasReports && (
          <View
            style={[
              sharedStyles.barFill,
              {
                height: `${fillPct}%`,
                backgroundColor: congestionColor,
              },
            ]}
          />
        )}
      </View>
      <Text
        style={[
          sharedStyles.carNumber,
          compact && sharedStyles.carNumberCompact,
          { color: semantic.labelAlt },
        ]}
      >
        {car.carNumber}
      </Text>
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        style={sharedStyles.carTouch}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${car.carNumber}호차, ${getCongestionLevelName(car.congestionLevel)}, 제보 ${car.reportCount}건`}
        accessibilityHint="길게 눌러 상세 정보 보기"
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={sharedStyles.carTouch}>{inner}</View>;
};

const CongestionLegend: React.FC<{ semantic: WantedSemanticTheme }> = ({ semantic }) => {
  const levels = [
    { level: CongestionLevel.LOW, name: getCongestionLevelName(CongestionLevel.LOW) },
    { level: CongestionLevel.MODERATE, name: getCongestionLevelName(CongestionLevel.MODERATE) },
    { level: CongestionLevel.HIGH, name: getCongestionLevelName(CongestionLevel.HIGH) },
    { level: CongestionLevel.CROWDED, name: getCongestionLevelName(CongestionLevel.CROWDED) },
  ];

  return (
    <View style={sharedStyles.legendContainer}>
      {levels.map(({ level, name }) => (
        <View key={level} style={sharedStyles.legendItem}>
          <View
            style={[
              sharedStyles.legendColor,
              { backgroundColor: getCongestionLevelColor(level) },
            ]}
          />
          <Text style={[sharedStyles.legendText, { color: semantic.labelNeutral }]}>
            {name}
          </Text>
        </View>
      ))}
    </View>
  );
};

/** Tooltip auto-dismiss delay (ms). Long enough to read, short enough to
 *  not block subsequent interactions. */
const TOOLTIP_DISMISS_MS = 2500;

export const TrainCongestionView: React.FC<TrainCongestionViewProps> = ({
  congestion,
  onCarPress,
  style,
  showLegend = true,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const cars = congestion?.cars || createEmptyCarCongestions();
  const overallLevel = congestion?.overallLevel || CongestionLevel.LOW;
  const totalReports = congestion?.reportCount || 0;
  const hasData = totalReports > 0;

  // Phase 53: long-press tooltip preserving the rich crowdsourced metadata
  // (reportCount, reliability) that the design's pure-bar visual would
  // otherwise hide. Auto-dismisses on a timer; cleaned up on unmount and
  // on every re-trigger so the timer never leaks.
  const [tooltipCar, setTooltipCar] = useState<number | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTooltip = (carNumber: number): void => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltipCar(carNumber);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipCar(null);
      tooltipTimerRef.current = null;
    }, TOOLTIP_DISMISS_MS);
  };
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const tooltipCarData =
    tooltipCar !== null ? cars.find((c) => c.carNumber === tooltipCar) : null;
  const tooltipReliability =
    tooltipCarData && tooltipCarData.reportCount >= MIN_REPORTS_FOR_RELIABILITY
      ? '신뢰도 높음'
      : tooltipCarData && tooltipCarData.reportCount > 0
        ? '제보 부족'
        : '제보 없음';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {congestion?.overallLevel === CongestionLevel.CROWDED ? (
            <AlertTriangle size={18} color={getCongestionLevelColor(overallLevel)} />
          ) : (
            <Users size={18} color={semantic.labelNeutral} />
          )}
          <Text style={styles.headerTitle}>칸별 혼잡도</Text>
        </View>
        {hasData && (
          <View
            style={[
              styles.overallBadge,
              { backgroundColor: getCongestionLevelColor(overallLevel) },
            ]}
          >
            <Text style={styles.overallText}>
              {getCongestionLevelName(overallLevel)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.trainContainer}>
        {/* Tooltip overlay — only when a car is selected by long-press */}
        {tooltipCarData && (
          <View style={styles.tooltip} pointerEvents="none">
            <Text style={styles.tooltipText}>
              {tooltipCarData.carNumber}호차 · {getCongestionLevelName(tooltipCarData.congestionLevel)} · 제보 {tooltipCarData.reportCount}건 · {tooltipReliability}
            </Text>
          </View>
        )}

        {/* Direction labels match the Wanted handoff wording */}
        <View style={styles.directionLabelRow}>
          <Text style={styles.directionLabelText}>← 전 / 후 →</Text>
        </View>

        <View style={styles.carsWrapper}>
          {cars.map((car) => (
            <CarBar
              key={car.carNumber}
              car={car}
              onPress={onCarPress ? () => onCarPress(car.carNumber) : undefined}
              onLongPress={() => showTooltip(car.carNumber)}
              compact={compact}
              semantic={semantic}
            />
          ))}
        </View>

        {!hasData && (
          <Text style={styles.noDataText}>
            아직 제보된 혼잡도 정보가 없습니다
          </Text>
        )}

        {hasData && (
          <Text style={styles.reportCountText}>
            {totalReports}건의 제보 기반 · 칸 길게 눌러 상세 보기
          </Text>
        )}
      </View>

      {showLegend && <CongestionLegend semantic={semantic} />}
    </View>
  );
};

const sharedStyles = StyleSheet.create({
  /* Phase 53: vertical-bar visualization (Wanted handoff design pattern) */
  carTouch: {
    flex: 1,
  },
  carColumn: {
    alignItems: 'center',
    gap: 3,
  },
  barTrack: {
    width: '100%',
    borderRadius: WANTED_TOKENS.radius.r4,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
  },
  carNumber: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  carNumberCompact: {
    fontSize: 8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: WANTED_TOKENS.spacing.s3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('500'),
  },
});

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      gap: WANTED_TOKENS.spacing.s2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    headerTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    overallBadge: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 4,
      borderRadius: WANTED_TOKENS.radius.r4,
    },
    overallText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
    },
    trainContainer: {
      backgroundColor: semantic.bgBase,
      padding: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r8,
      gap: WANTED_TOKENS.spacing.s2,
      // Relative positioning anchors the absolute tooltip overlay
      position: 'relative',
    },
    /* Direction label row sits above the bars (matches design layout) */
    directionLabelRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    directionLabelText: {
      fontSize: 10,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    carsWrapper: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: 3,
    },
    noDataText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
    },
    reportCountText: {
      fontSize: 11,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    /* Phase 53: long-press tooltip — preserves rich crowdsourced metadata
       (reportCount, reliability) while keeping the bars visually clean */
    tooltip: {
      position: 'absolute',
      top: WANTED_TOKENS.spacing.s2,
      left: WANTED_TOKENS.spacing.s3,
      right: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.labelStrong,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r4,
      zIndex: 10,
    },
    tooltipText: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.bgBase,
      textAlign: 'center',
    },
  });

export default TrainCongestionView;
