/**
 * TrainCongestionView Component
 * Shows a visual representation of congestion levels for each train car.
 *
 * Phase 51 — migrated to Wanted Design System tokens.
 */

import React, { useMemo } from 'react';
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

interface CarIndicatorProps {
  car: CarCongestion;
  onPress?: () => void;
  compact?: boolean;
  semantic: WantedSemanticTheme;
}

const CarIndicator: React.FC<CarIndicatorProps> = ({ car, onPress, compact = false, semantic }) => {
  const congestionColor = getCongestionLevelColor(car.congestionLevel);
  const hasReports = car.reportCount > 0;
  const isReliable = car.reportCount >= MIN_REPORTS_FOR_RELIABILITY;

  const content = (
    <View
      style={[
        sharedStyles.carContainer,
        compact && sharedStyles.carContainerCompact,
        {
          backgroundColor: hasReports ? congestionColor : semantic.bgBase,
          borderColor: hasReports ? congestionColor : semantic.lineNormal,
          opacity: isReliable ? 1 : hasReports ? 0.7 : 0.4,
        },
      ]}
    >
      <Text
        style={[
          sharedStyles.carNumber,
          compact && sharedStyles.carNumberCompact,
          { color: hasReports ? '#FFFFFF' : semantic.labelNeutral },
        ]}
      >
        {car.carNumber}
      </Text>
      {!compact && hasReports && (
        <Text
          style={[
            sharedStyles.reportCount,
            { color: 'rgba(255, 255, 255, 0.8)' },
          ]}
        >
          {car.reportCount}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
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

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {congestion?.overallLevel === CongestionLevel.CROWDED ? (
            <AlertTriangle size={18} color={getCongestionLevelColor(overallLevel)} />
          ) : (
            <Users size={18} color={semantic.labelNeutral} />
          )}
          <Text style={styles.headerTitle}>객차별 혼잡도</Text>
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
        <View style={styles.directionContainer}>
          <Text style={styles.directionText}>← 앞</Text>
          <View style={styles.carsWrapper}>
            {cars.map((car) => (
              <CarIndicator
                key={car.carNumber}
                car={car}
                onPress={onCarPress ? () => onCarPress(car.carNumber) : undefined}
                compact={compact}
                semantic={semantic}
              />
            ))}
          </View>
          <Text style={styles.directionText}>뒤 →</Text>
        </View>

        {!hasData && (
          <Text style={styles.noDataText}>
            아직 제보된 혼잡도 정보가 없습니다
          </Text>
        )}

        {hasData && (
          <Text style={styles.reportCountText}>
            {totalReports}건의 제보 기반
          </Text>
        )}
      </View>

      {showLegend && <CongestionLegend semantic={semantic} />}
    </View>
  );
};

const sharedStyles = StyleSheet.create({
  carContainer: {
    flex: 1,
    aspectRatio: 0.8,
    borderRadius: WANTED_TOKENS.radius.r4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
    maxHeight: 56,
  },
  carContainerCompact: {
    aspectRatio: 1,
    minHeight: 28,
    maxHeight: 36,
  },
  carNumber: {
    fontSize: 13,
    fontFamily: weightToFontFamily('700'),
  },
  carNumberCompact: {
    fontSize: 12,
  },
  reportCount: {
    fontSize: 8,
    fontFamily: weightToFontFamily('500'),
    marginTop: 2,
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
    },
    directionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    directionText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      minWidth: 24,
    },
    carsWrapper: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    noDataText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
    },
    reportCountText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
    },
  });

export default TrainCongestionView;
