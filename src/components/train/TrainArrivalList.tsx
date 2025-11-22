/**
 * Train Arrival List Component
 * Displays real-time train arrival information for a station
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { trainService } from '../../services/train/trainService';
import { Train, TrainStatus } from '../../models/train';
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
        return '#059669';
      case TrainStatus.DELAYED:
        return '#dc2626';
      case TrainStatus.SUSPENDED:
        return '#7c2d12';
      case TrainStatus.MAINTENANCE:
        return '#6b7280';
      case TrainStatus.EMERGENCY:
        return '#991b1b';
      default:
        return '#6b7280';
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

  const getStatusIcon = (status: TrainStatus): string => {
    switch (status) {
      case TrainStatus.NORMAL:
        return 'checkmark-circle';
      case TrainStatus.DELAYED:
        return 'time-outline';
      case TrainStatus.SUSPENDED:
        return 'close-circle';
      case TrainStatus.MAINTENANCE:
        return 'construct-outline';
      case TrainStatus.EMERGENCY:
        return 'warning';
      default:
        return 'help-circle';
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

  return (
    <View
      style={styles.trainItem}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`${getDestinationName()} 방면 열차, ${getStatusText(train.status)} 상태, ${formatArrivalTime()}${train.delayMinutes > 0 ? `, ${train.delayMinutes}분 지연` : ''}`}
    >
      <View style={styles.trainHeader}>
        <View style={styles.directionInfo}>
          <Ionicons
            name="train"
            size={16}
            color="#6b7280"
          />
          <Text style={styles.direction}>
            {getDestinationName()} 방면
          </Text>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(train.status) }]}>
          <Ionicons 
            name={getStatusIcon(train.status) as any} 
            size={12} 
            color="white" 
          />
          <Text style={styles.statusText}>
            {getStatusText(train.status)}
          </Text>
        </View>
      </View>

      <View style={styles.trainDetails}>
        <View style={styles.arrivalInfo}>
          <Text style={styles.arrivalTime}>
            {formatArrivalTime()}
          </Text>
          {train.delayMinutes > 0 && (
            <Text style={styles.delayText}>
              ({train.delayMinutes}분 지연)
            </Text>
          )}
        </View>

        {train.nextStationId && (
          <Text style={styles.nextStation}>
            다음역 정보 로딩중...
          </Text>
        )}
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
  const handleTrainUpdate = useCallback((updatedTrains: Train[]) => {
    performanceMonitor.startMeasure(`train_update_${stationId}`);
    setTrains(updatedTrains);
    setLoading(false);
    performanceMonitor.endMeasure(`train_update_${stationId}`);
  }, [stationId]);

  // Throttle subscription updates to improve performance
  const throttledUpdate = useMemo(
    () => throttle(handleTrainUpdate, 1000),
    [handleTrainUpdate]
  );

  useEffect(() => {
    // Development: Mock data for Sangok station (산곡역)
    if (__DEV__ && stationId === 'sangok') {
      let trainCounter = 5;

      const generateInitialTrains = (): Train[] => {
        const now = new Date();
        return [
          {
            id: 'train-sangok-1',
            lineId: '7',
            direction: 'down',
            currentStationId: 'bupyeong-gu-office',
            nextStationId: 'sangok',
            finalDestination: '석남',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 5 * 60 * 1000 + 5 * 1000), // 5분 5초 후
            delayMinutes: 0,
            lastUpdated: now,
          },
          {
            id: 'train-sangok-2',
            lineId: '7',
            direction: 'up',
            currentStationId: 'bupyeong-gu-office',
            nextStationId: 'sangok',
            finalDestination: '도봉산',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 8 * 60 * 1000 + 35 * 1000), // 8분 35초 후
            delayMinutes: 0,
            lastUpdated: now,
          },
          {
            id: 'train-sangok-3',
            lineId: '7',
            direction: 'up',
            currentStationId: 'gulpocheon',
            nextStationId: 'sangok',
            finalDestination: '대륭입구',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 18 * 60 * 1000), // 18분 후
            delayMinutes: 0,
            lastUpdated: now,
          },
          {
            id: 'train-sangok-4',
            lineId: '7',
            direction: 'down',
            currentStationId: 'seoknam',
            nextStationId: 'sangok',
            finalDestination: '석남',
            status: TrainStatus.NORMAL,
            arrivalTime: new Date(now.getTime() + 18 * 60 * 1000), // 18분 후
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
            const newArrivalMinutes = 6 + Math.random() * 4; // 6-10분 사이
            const hasDelay = Math.random() > 0.8; // 20% 확률로 지연

            // Random destination for up trains
            const destinations: string[] = ['장암', '도봉산', '대륭입구'];
            const randomDestination: string = destinations[Math.floor(Math.random() * destinations.length)] || '장암';
            const finalDestination: string = newDirection === 'up' ? randomDestination : '석남';

            const newTrain: Train = {
              id: `train-sangok-${trainCounter++}`,
              lineId: '7',
              direction: newDirection,
              currentStationId: newDirection === 'up' ? 'gulpocheon' : 'seoknam',
              nextStationId: 'sangok',
              finalDestination,
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

      unsubscribe = trainService.subscribeToTrainUpdates(
        stationId,
        throttledUpdate
      );

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
      <Ionicons name="train-outline" size={48} color="#9ca3af" />
      <Text style={styles.emptyText}>
        현재 도착 예정인 열차가 없습니다
      </Text>
      <Text style={styles.emptySubtext}>
        잠시 후 다시 확인해보세요
      </Text>
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
        <Ionicons name="refresh" size={24} color="#2563eb" />
        <Text style={styles.loadingText}>
          실시간 열차 정보를 불러오고 있습니다...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {trains.length === 0 ? (
        renderEmptyState()
      ) : (
        trains.map((train) => (
          <TrainArrivalItem key={train.id} train={train} />
        ))
      )}
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
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  trainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  directionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  direction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  delayText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 2,
  },
  nextStation: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
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
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
});
