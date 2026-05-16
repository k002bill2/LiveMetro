/**
 * Train Arrival Card Component
 * Enhanced display of individual train arrival with Seoul Metro colors
 *
 * Features:
 * - Seoul subway line official colors
 * - Real-time countdown display
 * - Delay status indicators
 * - Accessibility optimized
 * - Performance optimized with memo
 */

import React, { memo, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {
  CheckCircle,
  Clock,
  XCircle,
  Wrench,
  AlertTriangle,
  CircleHelp,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  ChevronRight
} from 'lucide-react-native';

import { Train, TrainStatus } from '@/models/train';
import type { TrainType } from '@/services/api/seoulSubwayApi';
import { formatArrivalDisplay } from '@/utils/dateUtils';
import {
  getSubwayLineColor as getLineColor,
  getLineTextColor,
} from '@/utils/colorUtils';
import { useTheme, ThemeColors } from '@/services/theme';
import { weightToFontFamily } from '@/styles/modernTheme';

export interface TrainArrivalCardProps {
  /** Train data to display */
  train: Train;
  /** Optional press handler */
  onPress?: () => void;
  /** Custom style */
  style?: StyleProp<ViewStyle>;
  /** Whether to show detailed information like station name and line badge */
  showDetails?: boolean;
  /**
   * Service tier. Defaults to `train.trainType` (PR #126 wiring) — caller
   * doesn't need to pass it explicitly. Pass explicitly only to override
   * (e.g., showcase/storybook). Omitted/normal → no badge; 'express'/'rapid'
   * → small badge next to the line badge so users can distinguish
   * 일반/급행/특급 at a glance (guide #8).
   */
  trainType?: TrainType;
  /**
   * Layout density. F5.2 — TrainArrivalList integration 준비.
   * - `'regular'` (default): hero-style 단일 카드 (큰 padding, vertical
   *   stack). 기존 모든 사용처와 동일 동작.
   * - `'compact'`: dense row form factor — 작은 padding, 큰 폰트 축소.
   *   여러 카드를 vertical list로 stack할 때 적합 (예: TrainArrivalList).
   *
   * F5.2b(별도 PR)에서 List inline Item을 `variant='compact'`로 교체해
   * Card를 production으로 끌어들일 예정. 본 PR은 variant prop만 추가하고
   * 호출자 변경은 없음 — 시각 회귀 risk를 분리.
   */
  variant?: 'regular' | 'compact';
}

/**
 * Enhanced train arrival card with Seoul Metro design system
 *
 * @example
 * ```tsx
 * <TrainArrivalCard
 *   train={trainData}
 *   stationName="강남"
 *   lineName="2호선"
 *   onPress={() => handleTrainPress(trainData.id)}
 * />
 * ```
 */
export const TrainArrivalCard: React.FC<TrainArrivalCardProps> = memo(({
  train,
  onPress,
  style,
  showDetails = true,
  trainType: trainTypeProp,
  variant = 'regular',
}) => {
  // Default trainType from Train model (PR #126); explicit prop wins for override.
  const trainType: TrainType | undefined = trainTypeProp ?? train.trainType;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCompact = variant === 'compact';

  // Memoize line colors to prevent recalculation
  const lineColor = useMemo(() => {
    return getLineColor(train.lineId || '');
  }, [train.lineId]);

  const lineTextColor = useMemo(() => {
    return getLineTextColor(train.lineId || '');
  }, [train.lineId]);

  const lineName = train.lineId ? `${train.lineId}호선` : '';
  const stationName = train.nextStationId || '';
  const lineBackgroundColor = useMemo(() => {
    return `${lineColor}20`; // 20% opacity
  }, [lineColor]);

  // Train tier badge: visible only for non-normal service. Contrast text
  // colors are hardcoded (not from theme) so readability survives in both
  // light/dark modes — warning yellow vs error red have different optimal
  // text contrast, theme tokens would collapse that distinction.
  const trainTypeBadge = useMemo(() => {
    if (!trainType || trainType === 'normal') return null;
    if (trainType === 'express') {
      return { label: '급행', backgroundColor: colors.warning, textColor: '#1A1A1A' };
    }
    // 'rapid' — 특급 / ITX / 직통
    return { label: '특급', backgroundColor: colors.error, textColor: '#FFFFFF' };
  }, [trainType, colors.warning, colors.error]);

  // Get delay color based on minutes
  const getDelayColor = useCallback((minutes: number) => {
    if (minutes >= 10) return colors.error;
    if (minutes >= 5) return colors.warning;
    return colors.textSecondary;
  }, [colors.error, colors.warning, colors.textSecondary]);

  // Arrival time display — delegated to dateUtils SoT (Math.floor + "곧 도착").
  // Previously this component used its own Math.ceil-based formatter which
  // drifted from dateUtils, producing inconsistent ETAs across screens.
  const arrivalDisplay = useMemo(
    () => formatArrivalDisplay(train.arrivalTime),
    [train.arrivalTime]
  );

  // Get status display information
  const statusInfo = useMemo(() => {
    const getStatusDetails = (status: TrainStatus) => {
      switch (status) {
        case TrainStatus.NORMAL:
          return {
            color: colors.success,
            icon: CheckCircle,
            text: '정상',
          };
        case TrainStatus.DELAYED:
          return {
            color: getDelayColor(train.delayMinutes),
            icon: Clock,
            text: '지연',
          };
        case TrainStatus.SUSPENDED:
          return {
            color: colors.error,
            icon: XCircle,
            text: '운행중단',
          };
        case TrainStatus.MAINTENANCE:
          return {
            color: colors.textSecondary,
            icon: Wrench,
            text: '점검중',
          };
        case TrainStatus.EMERGENCY:
          return {
            color: colors.error,
            icon: AlertTriangle,
            text: '긴급',
          };
        default:
          return {
            color: colors.textSecondary,
            icon: CircleHelp,
            text: '알수없음',
          };
      }
    };

    return getStatusDetails(train.status);
  }, [train.status, train.delayMinutes, colors, getDelayColor]);

  // Direction display
  const directionInfo = useMemo(() => {
    return {
      icon: train.direction === 'up' ? ArrowUp : ArrowDown,
      text: train.direction === 'up' ? '상행' : '하행',
    };
  }, [train.direction]);

  // Accessibility label
  const accessibilityLabel = useMemo(() => {
    const parts = [];

    if (lineName) parts.push(lineName);
    parts.push(`${directionInfo.text} 열차`);
    parts.push(arrivalDisplay.text);

    if (train.delayMinutes > 0) {
      parts.push(`${train.delayMinutes}분 지연`);
    }

    parts.push(`상태: ${statusInfo.text}`);

    if (stationName) {
      parts.push(`${stationName}역`);
    }

    return parts.join(', ');
  }, [lineName, directionInfo.text, arrivalDisplay.text, train.delayMinutes, statusInfo.text, stationName]);

  const StatusIcon = statusInfo.icon;
  const DirectionIcon = directionInfo.icon;

  const cardContent = (
    <>
      {/* Line Badge */}
      {showDetails && lineName && (
        <View
          style={[
            styles.lineBadge,
            {
              backgroundColor: lineColor,
            },
          ]}
        >
          <Text
            style={[
              styles.lineText,
              { color: lineTextColor },
            ]}
          >
            {lineName}
          </Text>
        </View>
      )}

      {/* Service tier badge (express / rapid only) */}
      {showDetails && trainTypeBadge && (
        <View
          style={[
            styles.trainTypeBadge,
            { backgroundColor: trainTypeBadge.backgroundColor },
          ]}
          accessibilityLabel={`${trainTypeBadge.label} 열차`}
          accessibilityRole="text"
        >
          <Text
            style={[
              styles.trainTypeText,
              { color: trainTypeBadge.textColor },
            ]}
          >
            {trainTypeBadge.label}
          </Text>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Header: Direction and Status */}
        <View style={styles.header}>
          <View style={styles.directionContainer}>
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: lineBackgroundColor },
              ]}
            >
              <DirectionIcon
                size={14}
                color={lineColor}
              />
              <Text
                style={[
                  styles.directionText,
                  { color: lineColor },
                ]}
              >
                {directionInfo.text}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusInfo.color },
            ]}
          >
            <StatusIcon
              size={12}
              color="white"
            />
            <Text style={styles.statusText}>
              {statusInfo.text}
            </Text>
          </View>
        </View>

        {/* Arrival Time */}
        <View style={styles.arrivalContainer}>
          <Text
            style={[
              styles.arrivalTime,
              arrivalDisplay.isImmediate && styles.arrivalTimeImmediate,
            ]}
          >
            {arrivalDisplay.text}
          </Text>

          {train.delayMinutes > 0 && (
            <View style={styles.delayBadge}>
              <AlertCircle
                size={14}
                color={getDelayColor(train.delayMinutes)}
              />
              <Text
                style={[
                  styles.delayText,
                  { color: getDelayColor(train.delayMinutes) },
                ]}
              >
                {train.delayMinutes}분 지연
              </Text>
            </View>
          )}
        </View>

        {/* Additional Info */}
        {showDetails && stationName && (
          <Text style={styles.stationName}>
            {stationName}역
          </Text>
        )}
      </View>

      {/* Chevron for pressable cards */}
      {onPress && (
        <View style={styles.chevronContainer}>
          <ChevronRight
            size={20}
            color={colors.textTertiary}
          />
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.container, isCompact && styles.containerCompact, style]}
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="열차 상세 정보를 확인하려면 두 번 탭하세요"
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[styles.container, isCompact && styles.containerCompact, style]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      {cardContent}
    </View>
  );
});

TrainArrivalCard.displayName = 'TrainArrivalCard';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // F5.2 compact variant — TrainArrivalList row density에 맞춤.
  // padding/margin/radius 축소 + shadow 제거(list 안에서 elevation 누적 회피).
  containerCompact: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  lineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
    textAlign: 'center',
  },
  trainTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  trainTypeText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  directionContainer: {
    flex: 1,
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  directionText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: colors.textInverse,
    marginLeft: 4,
  },
  arrivalContainer: {
    marginBottom: 4,
  },
  arrivalTime: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
    color: colors.textPrimary,
    marginBottom: 4,
  },
  arrivalTimeImmediate: {
    color: colors.error,
  },
  delayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  delayText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginLeft: 4,
  },
  stationName: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  chevronContainer: {
    marginLeft: 8,
  },
});
