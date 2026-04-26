/**
 * Home Screen Component - Modern Design
 * Main screen displaying real-time train information and nearby stations
 * Minimal grayscale design with black accent
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  CloudOff,
  MapPin,
  ChevronRight,
  TrainFront,
  RefreshCw,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { NavigationProp, useIsFocused, useNavigation } from '@react-navigation/native';

import { useAuth } from '../../services/auth/AuthContext';
import { trainService } from '../../services/train/trainService';
import { useNearbyStations } from '../../hooks/useNearbyStations';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StationCard } from '../../components/train/StationCard';
import { TrainArrivalList } from '../../components/train/TrainArrivalList';
import { DelayAlertBanner } from '../../components/delays';
import { CommutePredictionCard } from '../../components/prediction';
import { LocationDebugPanel } from '../../components/debug';
import { useToast } from '../../components/common/Toast';
import { useDelayDetection } from '../../hooks/useDelayDetection';
import { useIntegratedAlerts } from '../../hooks/useIntegratedAlerts';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';

import { Station } from '../../models/train';
import { AppStackParamList } from '../../navigation/types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { showError, showSuccess, showInfo, ToastComponent } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteStations, setFavoriteStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showDelayBanner, setShowDelayBanner] = useState<boolean>(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // 주변역 검색 훅 - GPS 기반 자동 업데이트
  const {
    nearbyStations: hookNearbyStations,
    loading: _nearbyLoading,
    refresh: refreshNearby,
  } = useNearbyStations({
    radius: 1000,
    maxStations: 5,
    autoUpdate: true,
    minUpdateInterval: 30000,
  });

  // 위치 권한이 있으면 훅 결과 사용, 없으면 즐겨찾기
  const nearbyStations = locationPermission ? hookNearbyStations : favoriteStations;

  // Seoul API 지연 감지 훅 — 화면 포커스 시에만 폴링 (백그라운드 호출 방지)
  const { delays: activeDelays } = useDelayDetection({
    pollingInterval: 60000, // 1분마다 체크
    autoPolling: true,
    enabled: isFocused,
  });

  // 통합 알림 훅 - ML 기반 출퇴근 예측
  const { scheduleDepartureAlert } = useIntegratedAlerts({
    autoStartMonitoring: false,
    enableDeparture: true,
    enableDelay: true,
  });


  const loadFavoriteStations = useCallback(async (): Promise<void> => {
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

      setFavoriteStations(stations);

      if (stations.length > 0) {
        setSelectedStation(prev => prev ?? stations[0] ?? null);
      }
    } catch {
      // Error loading favorite stations
    }
  }, [user?.preferences.favoriteStations]);

  const initializeScreen = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status !== 'granted') {
        // Load user's favorite stations if no location permission
        await loadFavoriteStations();
      }
      // When granted, useNearbyStations hook handles station loading automatically
    } catch {
      showError('데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [loadFavoriteStations, showError]);

  const onStationSelect = (station: Station): void => {
    setSelectedStation(station);
    navigation.navigate('StationNavigator', {
      stationId: station.id,
      lineId: station.lineId,
    });
  };

  // 출발 버튼 핸들러 - StationNavigator로 이동 (출발 모드)
  const handleSetStart = (station: Station): void => {
    setSelectedStation(station);
    navigation.navigate('StationNavigator', {
      stationId: station.id,
      lineId: station.lineId,
      mode: 'departure',
    });
  };

  // 도착 버튼 핸들러 - 상태 초기화
  const handleSetEnd = (): void => {
    setSelectedStation(null);
    showInfo('선택이 초기화되었습니다');
  };

  // 출발 알림 예약 핸들러
  const handleScheduleAlert = async (): Promise<void> => {
    const alert = await scheduleDepartureAlert(15);
    if (alert) {
      showSuccess(`${alert.alertTime}에 출발 알림이 예약되었습니다`);
    }
  };

  // 주간 예측 보기 핸들러
  const handleViewPredictions = (): void => {
    navigation.navigate('WeeklyPrediction' as never);
  };

  // Animation reference for proper cleanup
  const rotateAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-select closest station when nearby stations update
  useEffect(() => {
    if (nearbyStations.length > 0) {
      setSelectedStation(prev => prev ?? nearbyStations[0] ?? null);
    }
  }, [nearbyStations]);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);

    // Stop any existing animation first
    if (rotateAnimRef.current) {
      rotateAnimRef.current.stop();
    }

    // Rotate animation with ref for cleanup
    rotateAnimRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    rotateAnimRef.current.start();

    try {
      if (locationPermission) {
        refreshNearby();
      } else {
        await loadFavoriteStations();
      }
    } catch {
      // Error refreshing
    } finally {
      // Stop animation and reset
      if (rotateAnimRef.current) {
        rotateAnimRef.current.stop();
        rotateAnimRef.current = null;
      }
      rotateAnim.setValue(0);
      setRefreshing(false);
    }
  };

  const requestLocationPermission = async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermission(true);
      showSuccess('위치 권한이 허용되었습니다');
      refreshNearby();
    } else {
      showInfo('위치 권한이 필요합니다. 설정에서 수동으로 허용해주세요.');
    }
  };

  useEffect(() => {
    initializeScreen();
    // setupNetworkListener is safe to run once
    setIsOnline(true);

    // Cleanup on unmount
    return () => {
      if (rotateAnimRef.current) {
        rotateAnimRef.current.stop();
        rotateAnimRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          tintColor={colors.textPrimary}
        />
      }
      accessible={false}
      contentInsetAdjustmentBehavior="automatic"
      testID="home-screen"
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

      {/* ML-based Commute Prediction Card */}
      <CommutePredictionCard
        onScheduleAlert={handleScheduleAlert}
        onViewDetails={handleViewPredictions}
      />

      {/* Offline Banner */}
      {!isOnline && (
        <View
          style={styles.offlineBanner}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="현재 오프라인 상태입니다. 캐시된 정보가 표시됩니다"
        >
          <CloudOff size={20} color={colors.textSecondary} />
          <Text style={styles.offlineText}>
            오프라인 상태 - 캐시된 정보가 표시됩니다
          </Text>
        </View>
      )}

      {/* Delay Alert Banner */}
      {showDelayBanner && activeDelays.length > 0 && (
        <DelayAlertBanner
          delays={activeDelays}
          onPress={() => navigation.navigate('DelayFeed' as never)}
          onDismiss={() => setShowDelayBanner(false)}
          onAlternativeRoutePress={selectedStation ? () => {
            // Navigate to alternative routes with selected station as start
            // Default to Gangnam as destination for demo
            navigation.navigate('AlternativeRoutes', {
              fromStationId: selectedStation.id,
              toStationId: 'gangnam',
              fromStationName: selectedStation.name,
              toStationName: '강남',
            });
          } : undefined}
          showAlternativeRoute={!!selectedStation}
          dismissible
        />
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
          <MapPin size={24} color={colors.textPrimary} />
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>위치 권한 허용</Text>
            <Text style={styles.permissionSubtitle}>
              주변 역 정보를 보려면 위치 권한이 필요합니다
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
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
            <TrainFront size={48} color={colors.textTertiary} />
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
                onSetStart={() => handleSetStart(station)}
                onSetEnd={handleSetEnd}
                showDistance={locationPermission && 'distance' in station}
                distance={'distance' in station ? (station as { distance: number }).distance / 1000 : undefined}
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
                <ChevronRight size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRefresh}
                style={styles.refreshButton}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="실시간 정보 새로고침"
                accessibilityHint="열차 도착 정보를 다시 불러옵니다"
                disabled={refreshing}
                testID="refresh-button"
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
                  <RefreshCw
                    size={24}
                    color={refreshing ? colors.textTertiary : colors.textPrimary}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
          <TrainArrivalList stationId={selectedStation.id} stationName={selectedStation.name} />
        </View>
      )}
      
      <ToastComponent />

      {/* Location Debug Panel - Development only */}
      {__DEV__ && <LocationDebugPanel />}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcomeSection: {
    backgroundColor: colors.surface,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: colors.textSecondary,
  },
  permissionBanner: {
    backgroundColor: colors.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  permissionText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  permissionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
  },
  offlineBanner: {
    backgroundColor: colors.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  offlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  section: {
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
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
    borderColor: colors.borderMedium,
    backgroundColor: colors.backgroundSecondary,
  },
  detailButtonText: {
    color: colors.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginRight: 4,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  refreshButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: colors.backgroundSecondary,
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
    color: colors.textSecondary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textTertiary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
});

// Memoize to prevent unnecessary re-renders
export default React.memo(HomeScreen);
