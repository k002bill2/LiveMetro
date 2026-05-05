/**
 * Home Screen Component - Modern Design
 * Main screen displaying real-time train information and nearby stations
 * Minimal grayscale design with black accent
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Search,
  Map as MapIcon,
  Megaphone,
  FileText,
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
import {
  CommunityDelayCard,
  CommuteRouteCard,
  HomeTopBar,
  MLHeroCard,
  MLHeroCardPlaceholder,
  QuickActionsGrid,
  SectionHeader,
} from '../../components/design';
import type { LineId } from '../../components/design';
import { LocationDebugPanel } from '../../components/debug';
import { useToast } from '../../components/common/Toast';
import { useDelayDetection } from '../../hooks/useDelayDetection';
import { useIntegratedAlerts } from '../../hooks/useIntegratedAlerts';
import { useMLPrediction } from '../../hooks/useMLPrediction';
import { useCommuteRouteSummary } from '../../hooks/useCommuteRouteSummary';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '../../styles/modernTheme';
import { useTheme } from '../../services/theme';

import { Station } from '../../models/train';
import { AppStackParamList } from '../../navigation/types';

/**
 * Compute commute minutes from "HH:mm" departure → arrival strings.
 *
 * Wraps midnight: a 23:55 → 00:20 commute (real on Seoul late-night service)
 * yields 25 min, not null. Returns null only on malformed inputs or when
 * departure equals arrival (zero-minute commute is treated as invalid).
 */
const MIN_PER_DAY = 24 * 60;

const minutesBetween = (departure?: string, arrival?: string): number | null => {
  if (!departure || !arrival) return null;
  const parse = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
  };
  const d = parse(departure);
  const a = parse(arrival);
  if (d === null || a === null) return null;
  const diff = ((a - d) % MIN_PER_DAY + MIN_PER_DAY) % MIN_PER_DAY;
  return diff > 0 ? diff : null;
};

/**
 * Format an absolute timestamp into a relative Korean label
 * ("방금 전" / "12분 전" / "3시간 전"). Returns null for invalid input.
 * Used by CommunityDelayCard meta line.
 */
const formatRelativeKorean = (ts?: Date, now: Date = new Date()): string | null => {
  if (!ts) return null;
  const diffSec = Math.max(0, Math.floor((now.getTime() - ts.getTime()) / 1000));
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}일 전`;
};

/**
 * Format the current date as "2026.05.03 (수) · 오전 8:32" for the top bar.
 */
const formatDateTimeLabel = (now: Date = new Date()): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dow = days[now.getDay()];
  const h = now.getHours();
  const min = String(now.getMinutes()).padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${yyyy}.${mm}.${dd} (${dow}) · ${period} ${h12}:${min}`;
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
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
  // closestStation/lastUpdated도 destructure해서 LocationDebugPanel에 전달
  // → dev 패널이 자체 useNearbyStations 두 번째 인스턴스를 만들지 않게 함.
  const {
    nearbyStations: hookNearbyStations,
    loading: _nearbyLoading,
    refresh: refreshNearby,
    closestStation: nearbyClosestStation,
    lastUpdated: nearbyLastUpdated,
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

  // ML 예측 — Hero 카드 데이터 소스
  const { prediction: mlPrediction, baselineMinutes } = useMLPrediction();

  // Origin/destination 이름 lookup — commuteSchedule.weekdays.morningCommute의
  // stationId/destinationStationId를 station 이름으로 변환. async라 useMemo
  // 안에서 못 함, 별도 effect로 fetch 후 state에 보관.
  const morningCommute = user?.preferences.commuteSchedule?.weekdays?.morningCommute;

  // 출퇴근 경로 카드 fact grid 데이터 — routeService + fareService
  // (Phase 44.1). morningCommute 미설정 시 자동으로 ready=false → 팩트 grid hide.
  const routeSummary = useCommuteRouteSummary(
    morningCommute?.stationId,
    morningCommute?.destinationStationId,
  );

  const [commuteStationNames, setCommuteStationNames] = useState<{
    origin?: string;
    destination?: string;
    originLineId?: string;
  }>({});

  useEffect(() => {
    if (!morningCommute) {
      setCommuteStationNames({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [origin, dest] = await Promise.all([
          trainService.getStation(morningCommute.stationId).catch(() => null),
          trainService.getStation(morningCommute.destinationStationId).catch(() => null),
        ]);
        if (cancelled) return;
        setCommuteStationNames({
          origin: origin?.name,
          destination: dest?.name,
          // origin.lineId feeds CommuteRouteCard's LineBadge ride leg.
          // Phase 44 (May 2026 bundle "오늘의 출근 경로" card).
          originLineId: origin?.lineId,
        });
      } catch {
        // 실패 시 빈 객체 유지 — MLHeroCard는 origin/destination이 없으면
        // route 라인 자체를 생략 (optional UI).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [morningCommute]);

  // Hero 카드 props 도출 — prediction이 있고 정상 계산 가능할 때만 표시.
  // deltaMinutes: 예측 시간과 사용자 평소 평균(baseline)의 차이.
  // 음수 = 평소보다 빠름 → MLHeroCard의 delta pill에 "평소보다 -N분" 표시.
  const heroProps = useMemo(() => {
    if (!mlPrediction) return null;
    const minutes = minutesBetween(
      mlPrediction.predictedDepartureTime,
      mlPrediction.predictedArrivalTime,
    );
    if (minutes === null) return null;
    const delta =
      baselineMinutes !== null ? minutes - baselineMinutes : undefined;
    return {
      predictedMinutes: minutes,
      deltaMinutes: delta,
      arrivalTime: mlPrediction.predictedArrivalTime,
      confidence: mlPrediction.confidence,
      origin: commuteStationNames.origin,
      destination: commuteStationNames.destination,
    };
  }, [mlPrediction, baselineMinutes, commuteStationNames]);

  // 상단 바에 표시할 날짜/시간 — 1분마다 갱신 (분 단위까지만 표시하므로 충분).
  const [dateTimeLabel, setDateTimeLabel] = useState(() => formatDateTimeLabel(new Date()));
  useEffect(() => {
    const id = setInterval(() => setDateTimeLabel(formatDateTimeLabel(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);


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

  const onStationSelect = useCallback(
    (station: Station): void => {
      setSelectedStation(station);
      navigation.navigate('StationNavigator', {
        stationId: station.id,
        lineId: station.lineId,
      });
    },
    [navigation]
  );

  // 출발 버튼 핸들러 - StationNavigator로 이동 (출발 모드)
  const handleSetStart = useCallback(
    (station: Station): void => {
      setSelectedStation(station);
      navigation.navigate('StationNavigator', {
        stationId: station.id,
        lineId: station.lineId,
        mode: 'departure',
      });
    },
    [navigation]
  );

  // 도착 버튼 핸들러 - 상태 초기화
  const handleSetEnd = useCallback((): void => {
    setSelectedStation(null);
    showInfo('선택이 초기화되었습니다');
  }, [showInfo]);

  /**
   * Station별 onPress/onSetStart 콜백을 캐시한다.
   * StationCard는 React.memo로 감싸져 있으나 전달되는 onPress가 매 렌더 새 함수면
   * memo가 무효화된다. nearbyStations 또는 핸들러가 바뀔 때만 콜백을 재생성한다.
   */
  const stationCallbacks = useMemo(() => {
    const map = new Map<
      string,
      { onPress: () => void; onSetStart: () => void }
    >();
    nearbyStations.forEach((station) => {
      map.set(station.id, {
        onPress: () => onStationSelect(station),
        onSetStart: () => handleSetStart(station),
      });
    });
    return map;
  }, [nearbyStations, onStationSelect, handleSetStart]);

  // 출발 알림 예약 핸들러
  const handleScheduleAlert = async (): Promise<void> => {
    const alert = await scheduleDepartureAlert(15);
    if (alert) {
      showSuccess(`${alert.alertTime}에 출발 알림이 예약되었습니다`);
    }
  };

  // 주간 예측 보기 핸들러
  const handleViewPredictions = (): void => {
    // commute 미설정 시 onboarding으로 안내. 설정된 후에 ML hero detail이
    // 의미 있는 데이터를 보여줄 수 있음.
    if (!morningCommute) {
      navigation.navigate('Onboarding' as never);
      showInfo('출퇴근 경로를 먼저 설정해 주세요');
      return;
    }
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
          tintColor={semantic.labelStrong}
        />
      }
      accessible={false}
      contentInsetAdjustmentBehavior="automatic"
      testID="home-screen"
    >
      {/* Top bar — greeting + bell (Phase 2 redesign) */}
      <HomeTopBar
        userName={user?.displayName ?? undefined}
        dateTime={dateTimeLabel}
        hasUnread={activeDelays.length > 0}
        onBellPress={() => navigation.navigate('Alerts' as never)}
      />

      {/* ML hero — three states:
          1. heroProps available → gradient MLHeroCard with real prediction
          2. commute set but prediction unavailable → CommutePredictionCard
             (handles training / empty / loading / error)
          3. commute unset → MLHeroCardPlaceholder with explicit setup CTA
             (avoids misleading "데이터 학습 필요" copy when the real issue
             is no commute exists yet) */}
      <View style={styles.heroWrap}>
        {heroProps ? (
          <MLHeroCard
            origin={heroProps.origin}
            destination={heroProps.destination}
            predictedMinutes={heroProps.predictedMinutes}
            deltaMinutes={heroProps.deltaMinutes}
            arrivalTime={heroProps.arrivalTime}
            confidence={heroProps.confidence}
            onPress={handleViewPredictions}
          />
        ) : morningCommute ? (
          <CommutePredictionCard
            onScheduleAlert={handleScheduleAlert}
            onViewDetails={handleViewPredictions}
          />
        ) : (
          <MLHeroCardPlaceholder onPress={handleViewPredictions} />
        )}
      </View>

      {/* Phase 44 — "오늘의 출근 경로" timeline card.
          Renders only when we have both endpoint names and a prediction
          (departure/arrival times). lineId is best-effort from origin
          station's primary line; route service-derived fields (transfer/
          stop count/fare) are intentionally omitted on HomeScreen — the
          fact grid hides automatically when all three are absent. The
          full route detail lives in AlternativeRoutes; this card is a
          summary + entry point to settings. */}
      {heroProps &&
        commuteStationNames.origin &&
        commuteStationNames.destination && (
          <View style={styles.routeCardWrap}>
            <CommuteRouteCard
              origin={commuteStationNames.origin}
              destination={commuteStationNames.destination}
              lineId={commuteStationNames.originLineId as LineId | undefined}
              departureTime={mlPrediction?.predictedDepartureTime}
              arrivalTime={heroProps.arrivalTime}
              rideMinutes={heroProps.predictedMinutes}
              transferCount={routeSummary.transferCount}
              stationCount={routeSummary.stationCount}
              fareKrw={routeSummary.fareKrw}
              onPressEdit={() =>
                navigation.navigate('CommuteSettings' as never)
              }
              testID="home-commute-route-card"
            />
          </View>
        )}

      {/* Quick actions — 4-button grid */}
      <View style={styles.quickActionsWrap}>
        <QuickActionsGrid
          actions={[
            {
              id: 'route',
              Icon: Search,
              label: '경로검색',
              onPress: () => {
                // 경로 검색 — 선택된 역이 있으면 출발역으로 시드, 도착은 강남 기본값
                if (selectedStation) {
                  navigation.navigate('AlternativeRoutes', {
                    fromStationId: selectedStation.id,
                    toStationId: 'gangnam',
                    fromStationName: selectedStation.name,
                    toStationName: '강남',
                  });
                } else {
                  navigation.navigate('AlternativeRoutes' as never);
                }
              },
            },
            {
              id: 'map',
              Icon: MapIcon,
              label: '노선도',
              onPress: () => navigation.navigate('SubwayMap' as never),
            },
            {
              id: 'report',
              Icon: Megaphone,
              label: '제보',
              onPress: () => navigation.navigate('DelayFeed' as never),
            },
            {
              id: 'cert',
              Icon: FileText,
              label: '증명서',
              onPress: () => navigation.navigate('DelayCertificate' as never),
            },
          ]}
        />
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <View
          style={styles.offlineBanner}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="현재 오프라인 상태입니다. 캐시된 정보가 표시됩니다"
        >
          <CloudOff size={20} color={semantic.labelAlt} />
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
          <MapPin size={24} color={semantic.labelStrong} />
          <View style={styles.permissionText}>
            <Text style={styles.permissionTitle}>위치 권한 허용</Text>
            <Text style={styles.permissionSubtitle}>
              주변 역 정보를 보려면 위치 권한이 필요합니다
            </Text>
          </View>
          <ChevronRight size={20} color={semantic.labelAlt} />
        </TouchableOpacity>
      )}

      {/* Station Selection */}
      <View style={styles.section}>
        <SectionHeader
          title={locationPermission ? '주변 역' : '즐겨찾기'}
          subtitle={locationPermission ? 'GPS 기반 자동 갱신' : undefined}
          testID="home-stations-section"
        />

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
            <TrainFront size={48} color={semantic.labelAlt} />
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
          // Phase 33-C1: vertical stack to mirror the design handoff's
          // 즐겨찾는 역 / 주변 역 column layout. StationCard retains its own
          // realtime polling; the wrapper neutralizes its horizontal-list
          // marginRight via flex-column gap.
          <View style={styles.stationListVertical}>
            {nearbyStations.map((station) => {
              const callbacks = stationCallbacks.get(station.id);
              return (
                <View key={station.id} style={styles.stationRowWrap}>
                  <StationCard
                    station={station}
                    isSelected={selectedStation?.id === station.id}
                    onPress={callbacks?.onPress}
                    onSetStart={callbacks?.onSetStart}
                    onSetEnd={handleSetEnd}
                    showDistance={locationPermission && 'distance' in station}
                    distance={'distance' in station ? (station as { distance: number }).distance / 1000 : undefined}
                    arrivalsEnabled={isFocused}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Community delays preview — single-card representation of the most
          recent active delay, mirroring the design handoff's "실시간 제보" slot.
          The DelayAlertBanner above remains as the dismissible alert affordance;
          this card is the always-on feed preview that links to DelayFeed. */}
      {activeDelays.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="실시간 제보" subtitle="근처 노선" />
          <View style={styles.communityCardWrap}>
            <CommunityDelayCard
              line={activeDelays[0]!.lineId as LineId}
              title={`${activeDelays[0]!.lineName ?? `${activeDelays[0]!.lineId}호선`}${
                activeDelays[0]!.reason ? ` ${activeDelays[0]!.reason}` : ' 지연 발생'
              }`}
              description={
                activeDelays[0]!.delayMinutes > 0
                  ? `약 ${activeDelays[0]!.delayMinutes}분 지연 중`
                  : undefined
              }
              timestampLabel={formatRelativeKorean(activeDelays[0]!.timestamp) ?? undefined}
              onPress={() => navigation.navigate('DelayFeed' as never)}
              testID="home-community-delay-card"
            />
          </View>
        </View>
      )}

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
                <ChevronRight size={18} color={semantic.labelStrong} />
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
                    color={refreshing ? semantic.labelAlt : semantic.labelStrong}
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
      {__DEV__ && (
        <LocationDebugPanel
          closestStation={nearbyClosestStation}
          lastUpdated={nearbyLastUpdated}
          stationsLoading={_nearbyLoading}
        />
      )}
    </ScrollView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.bgSubtlePage,
  },
  heroWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s4,
  },
  routeCardWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s4,
  },
  quickActionsWrap: {
    paddingBottom: WANTED_TOKENS.spacing.s2,
  },
  communityCardWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s4,
  },
  permissionBanner: {
    backgroundColor: semantic.bgBase,
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s4,
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s2,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  permissionText: {
    flex: 1,
    marginLeft: WANTED_TOKENS.spacing.s3,
  },
  permissionTitle: {
    fontSize: WANTED_TOKENS.type.body1.size,
    lineHeight: WANTED_TOKENS.type.body1.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    color: semantic.labelAlt,
  },
  offlineBanner: {
    backgroundColor: semantic.bgBase,
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s4,
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s2,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  offlineText: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    color: semantic.labelAlt,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginLeft: WANTED_TOKENS.spacing.s2,
    flex: 1,
  },
  section: {
    backgroundColor: semantic.bgBase,
    marginBottom: WANTED_TOKENS.spacing.s2,
    paddingBottom: WANTED_TOKENS.spacing.s4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: WANTED_TOKENS.spacing.s3,
  },
  sectionTitle: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    lineHeight: WANTED_TOKENS.type.heading2.lh,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelStrong,
    flex: 1,
    letterSpacing:
      WANTED_TOKENS.type.heading2.size * WANTED_TOKENS.type.heading2.tracking,
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    borderRadius: WANTED_TOKENS.radius.pill,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    backgroundColor: semantic.bgSubtle,
  },
  detailButtonText: {
    color: semantic.labelStrong,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginRight: 4,
    fontSize: WANTED_TOKENS.type.label1.size,
  },
  refreshButton: {
    padding: WANTED_TOKENS.spacing.s2,
    borderRadius: WANTED_TOKENS.radius.pill,
    backgroundColor: semantic.bgSubtle,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationList: {
    paddingLeft: WANTED_TOKENS.spacing.s4,
  },
  stationListVertical: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    rowGap: WANTED_TOKENS.spacing.s2,
  },
  stationRowWrap: {
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s10,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
  },
  emptyText: {
    fontSize: WANTED_TOKENS.type.body1.size,
    lineHeight: WANTED_TOKENS.type.body1.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelAlt,
    marginTop: WANTED_TOKENS.spacing.s4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh * 1.4,
    color: semantic.labelAlt,
    marginTop: WANTED_TOKENS.spacing.s2,
    textAlign: 'center',
  },
});

// Memoize to prevent unnecessary re-renders
export default React.memo(HomeScreen);
