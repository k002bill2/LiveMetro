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
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { useAuth } from '../../services/auth/AuthContext';
import { trainService } from '../../services/train/trainService';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StationCard } from '../../components/train/StationCard';
import { TrainArrivalList } from '../../components/train/TrainArrivalList';

import { Station } from '../../models/train';

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  // const [trains, setTrains] = useState<Train[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  useEffect(() => {
    initializeScreen();
  }, []);

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
      Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
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
      await loadNearbyStations();
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

      {/* Location Permission Banner */}
      {!locationPermission && (
        <TouchableOpacity style={styles.permissionBanner} onPress={requestLocationPermission}>
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
          <View style={styles.emptyState}>
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