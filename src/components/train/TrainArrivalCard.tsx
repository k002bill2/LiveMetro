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

import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Train, TrainStatus } from '@models/train';
import {
  getSubwayLineColor,
  getLineTextColor,
  getDelayColor,
  addAlpha,
} from '@utils/colorUtils';

export interface TrainArrivalCardProps {
  /** Train data to display */
  train: Train;
  /** Station name for context */
  stationName?: string;
  /** Line name to display */
  lineName?: string;
  /** Optional press handler */
  onPress?: () => void;
  /** Custom style */
  style?: ViewStyle;
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
  stationName,
  lineName,
  onPress,
  style,
}) => {
  // Memoize line colors to prevent recalculation
  const lineColor = useMemo(() => {
    return getSubwayLineColor(train.lineId || lineName || '');
  }, [train.lineId, lineName]);

  const lineTextColor = useMemo(() => {
    return getLineTextColor(train.lineId || lineName || '');
  }, [train.lineId, lineName]);

  const lineBackgroundColor = useMemo(() => {
    return addAlpha(lineColor, 0.1);
  }, [lineColor]);

  // Calculate arrival time display
  const arrivalDisplay = useMemo((): {
    text: string;
    minutes: number;
    isImmediate: boolean;
  } => {
    if (!train.arrivalTime) {
      return { text: '정보 없음', minutes: -1, isImmediate: false };
    }

    const now = new Date();
    const arrivalTime = new Date(train.arrivalTime);
    const diffMs = arrivalTime.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    if (diffMinutes <= 0) {
      return { text: '도착', minutes: 0, isImmediate: true };
    } else if (diffMinutes === 1) {
      return { text: '1분 후', minutes: 1, isImmediate: true };
    } else {
      return { text: `${diffMinutes}분 후`, minutes: diffMinutes, isImmediate: false };
    }
  }, [train.arrivalTime]);

  // Get status display information
  const statusInfo = useMemo(() => {
    const getStatusDetails = (status: TrainStatus) => {
      switch (status) {
        case TrainStatus.NORMAL:
          return {
            color: '#059669',
            icon: 'checkmark-circle',
            text: '정상',
          };
        case TrainStatus.DELAYED:
          return {
            color: getDelayColor(train.delayMinutes),
            icon: 'time-outline',
            text: '지연',
          };
        case TrainStatus.SUSPENDED:
          return {
            color: '#7c2d12',
            icon: 'close-circle',
            text: '운행중단',
          };
        case TrainStatus.MAINTENANCE:
          return {
            color: '#6b7280',
            icon: 'construct-outline',
            text: '점검중',
          };
        case TrainStatus.EMERGENCY:
          return {
            color: '#991b1b',
            icon: 'warning',
            text: '긴급',
          };
        default:
          return {
            color: '#6b7280',
            icon: 'help-circle',
            text: '알수없음',
          };
      }
    };

    return getStatusDetails(train.status);
  }, [train.status, train.delayMinutes]);

  // Direction display
  const directionInfo = useMemo(() => {
    return {
      icon: train.direction === 'up' ? 'arrow-up' : 'arrow-down',
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

  const cardContent = (
    <>
      {/* Line Badge */}
      {lineName && (
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
              <Ionicons
                name={directionInfo.icon as any}
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
            <Ionicons
              name={statusInfo.icon as any}
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
              <Ionicons
                name="alert-circle"
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
        {stationName && (
          <Text style={styles.stationName}>
            {stationName}역
          </Text>
        )}
      </View>

      {/* Chevron for pressable cards */}
      {onPress && (
        <View style={styles.chevronContainer}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#9ca3af"
          />
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
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
      style={[styles.container, style]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      {cardContent}
    </View>
  );
});

TrainArrivalCard.displayName = 'TrainArrivalCard';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#ffffff',
    marginLeft: 4,
  },
  arrivalContainer: {
    marginBottom: 4,
  },
  arrivalTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  arrivalTimeImmediate: {
    color: '#dc2626',
  },
  delayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  delayText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  stationName: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  chevronContainer: {
    marginLeft: 8,
  },
});
