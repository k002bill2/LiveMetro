/**
 * Train Arrival List Component
 * Displays real-time train arrival information for a station
 */

import { TrainFront, CheckCircle, Clock, XCircle, Wrench, AlertTriangle, CircleHelp, RefreshCw } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/modernTheme';

import { Train, TrainStatus } from '../../models/train';
import type { TrainType } from '../../models/train';
import { trainService } from '../../services/train/trainService';
import { getLocalStation } from '../../services/data/stationsDataService';
import { dataManager, RealtimeTrainData } from '../../services/data/dataManager';
import { formatArrivalTime } from '../../utils/dateUtils';
import { throttle } from '../../utils/performanceUtils';
import { ErrorFallback } from '@/components/common/ErrorFallback';

interface TrainArrivalListProps {
  stationId: string;
  stationName?: string;
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

  const StatusIcon = getStatusIcon(train.status);

  // Train tier badge: visible only for non-normal service. Mirrors
  // TrainArrivalCard's mapping so 급행/특급 read identically across screens.
  const trainTypeBadge = useMemo((): { label: string; backgroundColor: string; textColor: string } | null => {
    const tier: TrainType | undefined = train.trainType;
    if (!tier || tier === 'normal') return null;
    if (tier === 'express') {
      return { label: '급행', backgroundColor: COLORS.semantic.warning, textColor: '#1A1A1A' };
    }
    return { label: '특급', backgroundColor: COLORS.semantic.error, textColor: '#FFFFFF' };
  }, [train.trainType]);

  return (
    <View
      style={styles.trainItem}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`${getDestinationName()} 방면${trainTypeBadge ? ` ${trainTypeBadge.label}` : ''} 열차, ${getStatusText(train.status)} 상태, ${formatArrivalTime(train.arrivalTime)}${train.delayMinutes > 0 ? `, ${train.delayMinutes}분 지연` : ''}`}
    >
      <View style={styles.trainHeader}>
        <View style={styles.directionInfo}>
          <TrainFront size={16} color={COLORS.text.secondary} />
          <Text style={styles.direction}>{getDestinationName()} 방면</Text>
          {trainTypeBadge && (
            <View
              style={[styles.trainTypeBadge, { backgroundColor: trainTypeBadge.backgroundColor }]}
            >
              <Text style={[styles.trainTypeText, { color: trainTypeBadge.textColor }]}>
                {trainTypeBadge.label}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(train.status) }]}>
          <StatusIcon size={12} color="white" />
          <Text style={styles.statusText}>{getStatusText(train.status)}</Text>
        </View>
      </View>

      <View style={styles.trainDetails}>
        <View style={styles.arrivalInfo}>
          <Text style={styles.arrivalTime}>{formatArrivalTime(train.arrivalTime)}</Text>
          {train.delayMinutes > 0 && <Text style={styles.delayText}>({train.delayMinutes}분 지연)</Text>}
        </View>

        {train.nextStationId && <Text style={styles.nextStation}>다음역 정보 로딩중...</Text>}
      </View>
    </View>
  );
});

// Set display name for debugging
TrainArrivalItem.displayName = 'TrainArrivalItem';

export const TrainArrivalList: React.FC<TrainArrivalListProps> = memo(({ stationId, stationName: stationNameProp }) => {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  // 에러 원본 인스턴스 보존 — ErrorFallback이 SeoulApiError.category로 분기
  // 가능. 이전 string 저장은 category 정보 손실.
  const [error, setError] = useState<unknown | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const resolvedStationNameRef = useRef<string | null>(null);

  // Memoize the update handler to prevent unnecessary re-renders
  const handleTrainUpdate = useCallback(
    (updatedTrains: Train[]) => {
      setTrains(updatedTrains);
      setLoading(false);
    },
    []
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

    // Resolve station name for DataManager (needs Korean name, not ID)
    const resolveAndSubscribe = async (): Promise<void> => {
      let stationName = stationNameProp || resolvedStationNameRef.current;
      if (!stationName) {
        const station = await trainService.getStation(stationId);
        const localStation = getLocalStation(stationId);
        stationName = station?.name || localStation?.name || stationId;
        resolvedStationNameRef.current = stationName;
      }

      // Subscribe via DataManager (handles polling, caching, SWR, dedup)
      unsubscribe = dataManager.subscribeToRealtimeUpdates(
        stationName,
        (data: RealtimeTrainData | null) => {
          if (data) {
            setError(null);
            const sorted = [...data.trains].sort((a, b) => {
              const aTime = a.arrivalTime?.getTime() || 0;
              const bTime = b.arrivalTime?.getTime() || 0;
              return aTime - bTime;
            });
            throttledUpdate(sorted);
          } else {
            throttledUpdate([]);
          }
        },
        35000 // 30s rate limit + 5s buffer
      );
    };

    let unsubscribe: (() => void) | undefined;

    // Expose for retry button
    retryRef.current = () => {
      setLoading(true);
      setError(null);
      // Force re-subscribe
      if (unsubscribe) unsubscribe();
      resolveAndSubscribe().catch((err) => {
        // 원본 인스턴스 보존 — ErrorFallback이 SeoulApiError.category로 분기
        setError(err);
        setLoading(false);
      });
    };

    setLoading(true);
    resolveAndSubscribe().catch((err) => {
      setError(err instanceof Error ? err.message : '도착정보를 불러올 수 없습니다');
      setLoading(false);
    });

    return () => {
      resolvedStationNameRef.current = null;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [stationId, stationNameProp, throttledUpdate]);

  const handleRetry = useCallback((): void => {
    setError(null);
    setLoading(true);
    retryRef.current?.();
  }, []);

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

  if (error && trains.length === 0) {
    // PR #127의 ErrorFallback이 SeoulApiError.category 5종으로 메시지 분기.
    // network/unknown fallback도 포함 — 호출자는 try-catch 결과 그대로 던지면 됨.
    return (
      <View style={styles.container}>
        <ErrorFallback error={error} onRetry={handleRetry} testID="train-list-error" />
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
  trainTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  trainTypeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
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
