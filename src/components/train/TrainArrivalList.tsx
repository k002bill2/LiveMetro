/**
 * Train Arrival List Component
 * Displays real-time train arrival information for a station
 */

import { TrainFront, CheckCircle, Clock, XCircle, Wrench, AlertTriangle, CircleHelp, RefreshCw } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/modernTheme';

import { Train, TrainStatus } from '../../models/train';
import { trainService } from '../../services/train/trainService';
import { performanceMonitor, throttle } from '../../utils/performanceUtils';

interface TrainArrivalListProps {
  stationId: string;
}

interface TrainArrivalItemProps {
  train: Train;
}

const TrainArrivalItem: React.FC<TrainArrivalItemProps> = memo(({ train }) => {
  const getStatusColor = (status: TrainStatus): string => {
    switch (status) {
      case TrainStatus.NORMAL:
        return COLORS.semantic.success;
      case TrainStatus.DELAYED:
        return COLORS.semantic.error;
      case TrainStatus.SUSPENDED:
        return COLORS.gray[800];
      case TrainStatus.MAINTENANCE:
        return COLORS.gray[500];
      case TrainStatus.EMERGENCY:
        return COLORS.semantic.error;
      default:
        return COLORS.gray[500];
    }
  };

  const getDestinationName = (): string => {
    // Use finalDestination from train data
    return train.finalDestination;
  };

  const getStatusText = (status: TrainStatus): string => {
    switch (status) {
      case TrainStatus.NORMAL:
        return '정상';
      case TrainStatus.DELAYED:
        return '지연';
      case TrainStatus.SUSPENDED:
        return '운행중단';
      case TrainStatus.MAINTENANCE:
        return '점검중';
      case TrainStatus.EMERGENCY:
        return '긴급';
      default:
        return '알수없음';
    }
  };

  const getStatusIcon = (status: TrainStatus) => {
    switch (status) {
      case TrainStatus.NORMAL:
        return CheckCircle;
      case TrainStatus.DELAYED:
        return Clock;
      case TrainStatus.SUSPENDED:
        return XCircle;
      case TrainStatus.MAINTENANCE:
        return Wrench;
      case TrainStatus.EMERGENCY:
        return AlertTriangle;
      default:
        return CircleHelp;
    }
  };

  const formatArrivalTime = (): string => {
    if (!train.arrivalTime) {
      return '정보없음';
    }

    const now = new Date();
    const arrivalTime = new Date(train.arrivalTime);
    const diffMs = arrivalTime.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    if (diffMinutes <= 0) {
      return '도착';
    } else if (diffMinutes === 1) {
      return '1분 후';
    } else {
      return `${diffMinutes}분 후`;
    }
  };

  const StatusIcon = getStatusIcon(train.status);

  return (
    <View
      style={styles.trainItem}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`${getDestinationName()} 방면 열차, ${getStatusText(train.status)} 상태, ${formatArrivalTime()}${train.delayMinutes > 0 ? `, ${train.delayMinutes}분 지연` : ''}`}
    >
      <View style={styles.trainHeader}>
        <View style={styles.directionInfo}>
          <TrainFront size={16} color={COLORS.text.secondary} />
          <Text style={styles.direction}>{getDestinationName()} 방면</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(train.status) }]}>
          <StatusIcon size={12} color="white" />
          <Text style={styles.statusText}>{getStatusText(train.status)}</Text>
        </View>
      </View>

      <View style={styles.trainDetails}>
        <View style={styles.arrivalInfo}>
          <Text style={styles.arrivalTime}>{formatArrivalTime()}</Text>
          {train.delayMinutes > 0 && <Text style={styles.delayText}>({train.delayMinutes}분 지연)</Text>}
        </View>

        {train.nextStationId && <Text style={styles.nextStation}>다음역 정보 로딩중...</Text>}
      </View>
    </View>
  );
});

// Set display name for debugging
TrainArrivalItem.displayName = 'TrainArrivalItem';

export const TrainArrivalList: React.FC<TrainArrivalListProps> = memo(({ stationId }) => {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);

  // Memoize the update handler to prevent unnecessary re-renders
  const handleTrainUpdate = useCallback(
    (updatedTrains: Train[]) => {
      performanceMonitor.startMeasure(`train_update_${stationId}`);
      setTrains(updatedTrains);
      setLoading(false);
      performanceMonitor.endMeasure(`train_update_${stationId}`);
    },
    [stationId]
  );

  // Throttle subscription updates to improve performance
  const throttledUpdate = useMemo(() => throttle(handleTrainUpdate, 1000), [handleTrainUpdate]);

  useEffect(() => {
    // Development: Mock data for Gangnam station (강남역) - Line 2
    if (__DEV__ && stationId === 'gangnam') {
      let trainCounter = 5;

      const generateInitialTrains = (): Train[] => {
        const now = new Date();
        return [
          {
            id: 'train-gangnam-1',
            lineId: '2',
            direction: 'down',
            currentStationId: 'samseong',
            nextStationId: 'gangnam',
            finalDestination: '신도림',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 3 * 60 * 1000 + 30 * 1000), // 3분 30초 후
            delayMinutes: 0,
            lastUpdated: now,
          },
          {
            id: 'train-gangnam-2',
            lineId: '2',
            direction: 'up',
            currentStationId: 'yeoksam',
            nextStationId: 'gangnam',
            finalDestination: '성수',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 5 * 60 * 1000 + 10 * 1000), // 5분 10초 후
            delayMinutes: 0,
            lastUpdated: now,
          },
          {
            id: 'train-gangnam-3',
            lineId: '2',
            direction: 'up',
            currentStationId: 'seolleung',
            nextStationId: 'gangnam',
            finalDestination: '건대입구',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 10 * 60 * 1000), // 10분 후
            delayMinutes: 0,
            lastUpdated: now,
          },
          {
            id: 'train-gangnam-4',
            lineId: '2',
            direction: 'down',
            currentStationId: 'jamsil',
            nextStationId: 'gangnam',
            finalDestination: '까치산',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 12 * 60 * 1000), // 12분 후
            delayMinutes: 0,
            lastUpdated: now,
          },
        ];
      };

      const initialTrains = generateInitialTrains();
      setTrains(initialTrains);
      setLoading(false);

      // Real-time update every 10 seconds
      const interval = setInterval(() => {
        setTrains(prevTrains => {
          const now = new Date();

          // Filter out arrived trains (arrival time passed)
          const updatedTrains = prevTrains.filter(train => {
            if (!train.arrivalTime) {
              return false;
            }
            const timeLeft = train.arrivalTime.getTime() - now.getTime();
            return timeLeft > -10000; // Keep for 10 seconds after arrival
          });

          // Add new train if we have less than 4 trains
          if (updatedTrains.length < 4) {
            const newDirection = Math.random() > 0.5 ? 'up' : 'down';
            const newArrivalMinutes = 4 + Math.random() * 6; // 4-10분 사이
            const hasDelay = Math.random() > 0.85; // 15% 확률로 지연

            // Random destination
            const upDestinations: string[] = ['성수', '건대입구', '왕십리', '을지로입구'];
            const downDestinations: string[] = ['신도림', '까치산', '문래', '당산'];
            const destinations = newDirection === 'up' ? upDestinations : downDestinations;
            const randomDestination: string = destinations[Math.floor(Math.random() * destinations.length)] || '성수';

            const newTrain: Train = {
              id: `train-gangnam-${trainCounter++}`,
              lineId: '2',
              direction: newDirection,
              currentStationId: newDirection === 'up' ? 'seolleung' : 'jamsil',
              nextStationId: 'gangnam',
              finalDestination: randomDestination,
              status: hasDelay ? TrainStatus.DELAYED : TrainStatus.NORMAL,
              arrivalTime: new Date(now.getTime() + newArrivalMinutes * 60 * 1000),
              delayMinutes: hasDelay ? Math.floor(Math.random() * 3) + 1 : 0,
              lastUpdated: now,
            };

            updatedTrains.push(newTrain);
          }

          // Sort by arrival time
          updatedTrains.sort((a, b) => {
            const aTime = a.arrivalTime ? a.arrivalTime.getTime() : 0;
            const bTime = b.arrivalTime ? b.arrivalTime.getTime() : 0;
            return aTime - bTime;
          });

          // Update lastUpdated time for all trains
          return updatedTrains.map(train => ({
            ...train,
            lastUpdated: now,
          }));
        });
      }, 10000); // Update every 10 seconds

      return () => clearInterval(interval);
    }

    let unsubscribe: (() => void) | undefined;

    const subscribeToUpdates = (): void => {
      setLoading(true);
      performanceMonitor.startMeasure(`subscription_${stationId}`);

      unsubscribe = trainService.subscribeToTrainUpdates(stationId, throttledUpdate);

      performanceMonitor.endMeasure(`subscription_${stationId}`);
    };

    subscribeToUpdates();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [stationId, throttledUpdate]);

  const renderEmptyState = (): React.ReactElement => (
    <View
      style={styles.emptyState}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel="현재 도착 예정인 열차가 없습니다. 잠시 후 다시 확인해보세요"
    >
      <TrainFront size={48} color={COLORS.text.tertiary} />
      <Text style={styles.emptyText}>현재 도착 예정인 열차가 없습니다</Text>
      <Text style={styles.emptySubtext}>잠시 후 다시 확인해보세요</Text>
    </View>
  );

  if (loading && trains.length === 0) {
    return (
      <View
        style={styles.loadingContainer}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel="실시간 열차 정보를 불러오고 있습니다"
      >
        <RefreshCw size={24} color={COLORS.primary.main} />
        <Text style={styles.loadingText}>실시간 열차 정보를 불러오고 있습니다...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {trains.length === 0
        ? renderEmptyState()
        : trains.map(train => <TrainArrivalItem key={train.id} train={train} />)}
    </View>
  );
});

// Set display name for debugging
TrainArrivalList.displayName = 'TrainArrivalList';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  trainItem: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    ...SHADOWS.sm,
  },
  trainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  directionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  direction: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
    marginLeft: 4,
  },
  trainDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrivalInfo: {
    flex: 1,
  },
  arrivalTime: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  delayText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.semantic.error,
    marginTop: 2,
  },
  nextStation: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});
