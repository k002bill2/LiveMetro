/**
 * Train Arrival List Component
 * Displays real-time train arrival information for a station
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { trainService } from '../../services/train/trainService';
import { Train, TrainStatus } from '../../models/train';

interface TrainArrivalListProps {
  stationId: string;
}

interface TrainArrivalItemProps {
  train: Train;
}

const TrainArrivalItem: React.FC<TrainArrivalItemProps> = ({ train }) => {
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
    <View style={styles.trainItem}>
      <View style={styles.trainHeader}>
        <View style={styles.directionInfo}>
          <Ionicons 
            name={train.direction === 'up' ? 'arrow-up' : 'arrow-down'} 
            size={16} 
            color="#6b7280" 
          />
          <Text style={styles.direction}>
            {train.direction === 'up' ? '상행' : '하행'}
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
};

export const TrainArrivalList: React.FC<TrainArrivalListProps> = ({ stationId }) => {
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const subscribeToUpdates = (): void => {
      setLoading(true);
      
      unsubscribe = trainService.subscribeToTrainUpdates(
        stationId,
        (updatedTrains) => {
          setTrains(updatedTrains);
          setLoading(false);
          setRefreshing(false);
        }
      );
    };

    subscribeToUpdates();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [stationId]);

  const onRefresh = (): void => {
    setRefreshing(true);
    // The real-time subscription will automatically update the data
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const renderEmptyState = (): React.ReactElement => (
    <View style={styles.emptyState}>
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
      <View style={styles.loadingContainer}>
        <Ionicons name="refresh" size={24} color="#2563eb" />
        <Text style={styles.loadingText}>
          실시간 열차 정보를 불러오고 있습니다...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={trains}
      renderItem={({ item }) => <TrainArrivalItem train={item} />}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={renderEmptyState}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={trains.length === 0 ? styles.emptyContainer : undefined}
    />
  );
};

const styles = StyleSheet.create({
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