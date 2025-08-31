/**
 * Home Screen Component
 * Main screen displaying real-time train information and nearby stations
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { useAuth } from '../../services/auth/AuthContext';
import { trainService } from '../../services/train/trainService';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StationCard } from '../../components/train/StationCard';
import { TrainArrivalList } from '../../components/train/TrainArrivalList';
import { useToast } from '../../components/common/Toast';

import { Station } from '../../models/train';

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const { showError, showSuccess, showInfo, ToastComponent } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    initializeScreen();
    setupNetworkListener();
  }, []);

  const setupNetworkListener = (): void => {
    // Network state monitoring - simplified for MVP
    // Future: Implement proper network state detection
    setIsOnline(true);
  };

  const initializeScreen = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        await loadNearbyStations();
      } else {
        // Load user's favorite stations if no location permission
        await loadFavoriteStations();
      }
    } catch (error) {
      console.error('Error initializing home screen:', error);
      showError('데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyStations = async (): Promise<void> => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const stations = await trainService.getNearbyStations(
        location.coords.latitude,
        location.coords.longitude,
        2 // 2km radius
      );

      setNearbyStations(stations);
      
      // Auto-select the closest station
      if (stations.length > 0 && !selectedStation) {
        setSelectedStation(stations[0] || null);
      }
    } catch (error) {
      console.error('Error loading nearby stations:', error);
      await loadFavoriteStations();
    }
  };

  const loadFavoriteStations = async (): Promise<void> => {
    if (!user?.preferences.favoriteStations.length) {
      return;
    }

    try {
      const favoriteStationIds = user.preferences.favoriteStations.map(fav => fav.stationId);
      const stations: Station[] = [];

      for (const stationId of favoriteStationIds.slice(0, 5)) {
        const station = await trainService.getStation(stationId);
        if (station) {
          stations.push(station);
        }
      }

      setNearbyStations(stations);
      
      if (stations.length > 0 && !selectedStation) {
        setSelectedStation(stations[0] || null);
      }
    } catch (error) {
      console.error('Error loading favorite stations:', error);
    }
  };

  const onStationSelect = (station: Station): void => {
    setSelectedStation(station);
  };

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      if (locationPermission) {
        await loadNearbyStations();
      } else {
        await loadFavoriteStations();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const requestLocationPermission = async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermission(true);
      showSuccess('위치 권한이 허용되었습니다');
      await loadNearbyStations();
    } else {
      showInfo('위치 권한이 필요합니다. 설정에서 수동으로 허용해주세요.');
    }
  };

  if (loading) {
    return <LoadingScreen message="주변 역 정보를 가져오고 있습니다..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      accessible={false}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          안녕하세요, {user?.displayName || '사용자'}님! 👋
        </Text>
        <Text style={styles.subtitle}>
          실시간 지하철 정보를 확인하세요
        </Text>
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <View 
          style={styles.offlineBanner}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="현재 오프라인 상태입니다. 캐시된 정보가 표시됩니다"
        >
          <Ionicons name="cloud-offline-outline" size={20} color="#dc2626" />
          <Text style={styles.offlineText}>
            오프라인 상태 - 캐시된 정보가 표시됩니다
          </Text>
        </View>
      )}

      {/* Location Permission Banner */}
      {!locationPermission && (
        <TouchableOpacity 
          style={styles.permissionBanner} 
          onPress={requestLocationPermission}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="위치 권한 허용하기"
          accessibilityHint="주변 지하철역 정보를 받기 위해 위치 권한을 허용하세요"
        >
          <Ionicons name="location-outline" size={24} color="#2563eb" />
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>위치 권한 허용</Text>
            <Text style={styles.permissionSubtitle}>
              주변 역 정보를 보려면 위치 권한이 필요합니다
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </TouchableOpacity>
      )}

      {/* Station Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {locationPermission ? '주변 역' : '즐겨찾기'}
        </Text>
        
        {nearbyStations.length === 0 ? (
          <View 
            style={styles.emptyState}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={locationPermission 
              ? '주변에 지하철역이 없습니다. 다른 위치에서 시도해보세요' 
              : '즐겨찾기에 추가된 역이 없습니다. 설정에서 자주 이용하는 역을 추가해보세요'
            }
          >
            <Ionicons name="train-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>
              {locationPermission 
                ? '주변에 지하철역이 없습니다' 
                : '즐겨찾기에 추가된 역이 없습니다'
              }
            </Text>
            <Text style={styles.emptySubtext}>
              {locationPermission 
                ? '다른 위치에서 시도해보세요' 
                : '설정에서 자주 이용하는 역을 추가해보세요'
              }
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stationList}>
            {nearbyStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                isSelected={selectedStation?.id === station.id}
                onPress={() => onStationSelect(station)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Real-time Train Information */}
      {selectedStation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedStation.name} 실시간 정보
          </Text>
          <TrainArrivalList stationId={selectedStation.id} />
        </View>
      )}
      
      <ToastComponent />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  welcomeSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  permissionBanner: {
    backgroundColor: '#dbeafe',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  permissionText: {
    flex: 1,
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#3730a3',
  },
  offlineBanner: {
    backgroundColor: '#fef2f2',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  offlineText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  stationList: {
    paddingLeft: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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