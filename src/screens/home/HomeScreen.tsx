/**
 * Home Screen Component - Modern Design
 * Main screen displaying real-time train information and nearby stations
 * Minimal grayscale design with black accent
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { useAuth } from '../../services/auth/AuthContext';
import { trainService } from '../../services/train/trainService';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StationCard } from '../../components/train/StationCard';
import { TrainArrivalList } from '../../components/train/TrainArrivalList';
import { useToast } from '../../components/common/Toast';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';

import { Station } from '../../models/train';
import { AppStackParamList } from '../../navigation/types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { showError, showSuccess, showInfo, ToastComponent } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;

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

      // Development: Use 강남역 (Gangnam) for testing - Seoul API reliably returns data for this station
      if (__DEV__) {
        const mockGangnamStation: Station = {
          id: 'gangnam',
          name: '강남',
          nameEn: 'Gangnam',
          lineId: '2',
          coordinates: {
            latitude: 37.4979,
            longitude: 127.0276,
          },
          transfers: [],
        };

        setNearbyStations([mockGangnamStation]);
        setSelectedStation(mockGangnamStation);
        setLocationPermission(true);
        setLoading(false);
        showSuccess('개발 모드: 강남역으로 설정되었습니다');
        return;
      }
      
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
    // Development: Skip in dev mode as we're using mock data
    if (__DEV__) {
      console.log('Development mode: Skipping loadNearbyStations');
      return;
    }

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
      showError('주변 역 정보를 가져오는데 실패했습니다');
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
    navigation.navigate('StationNavigator', {
      stationId: station.id,
      lineId: station.lineId,
    });
  };

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);

    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

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
      rotateAnim.setValue(0);
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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.black}
        />
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
          <Ionicons name="cloud-offline-outline" size={20} color={COLORS.text.secondary} />
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
          <Ionicons name="location-outline" size={24} color={COLORS.black} />
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>위치 권한 허용</Text>
            <Text style={styles.permissionSubtitle}>
              주변 역 정보를 보려면 위치 권한이 필요합니다
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
        </TouchableOpacity>
      )}

      {/* Station Selection */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {locationPermission ? '주변 역' : '즐겨찾기'}
          </Text>
        </View>
        
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
            <Ionicons name="train-outline" size={48} color={COLORS.gray[300]} />
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedStation.name} 실시간 정보
            </Text>
            <View style={styles.sectionHeaderActions}>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() =>
                  navigation.navigate('StationDetail', {
                    stationId: selectedStation.id,
                    stationName: selectedStation.name,
                    lineId: selectedStation.lineId,
                  })
                }
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${selectedStation.name} 역 상세 정보 보기`}
              >
                <Text style={styles.detailButtonText}>상세보기</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.black} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRefresh}
                style={styles.refreshButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="실시간 정보 새로고침"
                accessibilityHint="열차 도착 정보를 다시 불러옵니다"
                disabled={refreshing}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons
                    name="refresh"
                    size={24}
                    color={refreshing ? COLORS.gray[400] : COLORS.black}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
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
    backgroundColor: COLORS.white,
  },
  welcomeSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: 4,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  permissionBanner: {
    backgroundColor: COLORS.surface.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  permissionText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  permissionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  offlineBanner: {
    backgroundColor: COLORS.surface.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  offlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.white,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    flex: 1,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    backgroundColor: COLORS.surface.card,
  },
  detailButtonText: {
    color: COLORS.black,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginRight: 4,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  refreshButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface.card,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationList: {
    paddingLeft: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
});
export default HomeScreen;
