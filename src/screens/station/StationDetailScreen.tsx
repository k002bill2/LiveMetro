import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  RefreshCw,
  Navigation,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Moon,
  ChevronDown,
  Users,
} from 'lucide-react-native';

import { AppStackParamList } from '../../navigation/types';
import { getSubwayLineColor } from '../../utils/colorUtils';
import { useRealtimeTrains } from '../../hooks/useRealtimeTrains';
import { useAdjacentStations } from '../../hooks/useAdjacentStations';
import { useTheme, ThemeColors } from '../../services/theme';
import { useCongestion } from '@/hooks/useCongestion';
import { TrainCongestionView } from '@/components/congestion/TrainCongestionView';
import { CongestionReportModal } from '@/components/congestion/CongestionReportModal';
import { CongestionReportInput } from '@/models/congestion';

type StationDetailRouteProp = RouteProp<AppStackParamList, 'StationDetail'>;
const TAB_LABELS = ['출발', '도착', '시간표', '즐겨찾기'] as const;
type TabLabel = (typeof TAB_LABELS)[number];

const StationDetailScreen: React.FC = () => {
  const route = useRoute<StationDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors } = useTheme();
  const {
    // stationId = 'gangnam', // TODO: 향후 역 ID로 조회 시 사용
    stationName = '강남',
    lineId = '2',
  } = route.params || {};
  const styles = createStyles(colors);

  // Get adjacent stations for navigation
  const { prevStation, nextStation, hasPrev, hasNext } = useAdjacentStations(
    stationName,
    lineId
  );

  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabLabel>('출발');
  const [mapLoadError, setMapLoadError] = useState(false);
  const [showCongestionModal, setShowCongestionModal] = useState(false);
  const [selectedCarNumber, setSelectedCarNumber] = useState<number | undefined>(undefined);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // 실시간 열차 데이터 가져오기
  const {
    trains: realtimeTrains,
    loading: trainsLoading,
    error: trainsError,
    refetch: refetchTrains,
  } = useRealtimeTrains(stationName, {
    refetchInterval: 30000, // 30초마다 자동 갱신
    retryAttempts: 3,
  });

  // 혼잡도 데이터 (첫 번째 열차 기준)
  const firstTrain = realtimeTrains?.[0];
  const {
    trainCongestion,
    submitReport,
    submitting: congestionSubmitting,
  } = useCongestion({
    lineId: lineId,
    trainId: firstTrain?.id,
    direction: firstTrain?.direction,
    autoSubscribe: !!firstTrain,
  });

  // 혼잡도 제보 핸들러
  const handleCarPress = useCallback((carNumber: number) => {
    setSelectedCarNumber(carNumber);
    setShowCongestionModal(true);
  }, []);

  const handleCongestionReportSubmit = useCallback(async (input: CongestionReportInput) => {
    await submitReport(input);
  }, [submitReport]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    rotateAnim.setValue(0);
    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();

    // 실제 API 데이터 다시 가져오기
    refetchTrains();

    setTimeout(() => {
      setCurrentTime(new Date());
      setRefreshing(false);
      spin.stop();
      rotateAnim.setValue(0);
    }, 2000);
  };

  const formattedTime = currentTime.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // 실시간 열차 데이터를 도착 정보 형식으로 변환
  const arrivals = useMemo(() => {
    if (!realtimeTrains || realtimeTrains.length === 0) {
      return [];
    }

    return realtimeTrains.map((train) => {
      // 도착 시간 계산
      const timeUntilArrival = train.arrivalTime
        ? Math.max(0, Math.floor((train.arrivalTime.getTime() - Date.now()) / 1000))
        : 0;

      const minutes = Math.floor(timeUntilArrival / 60);
      const seconds = timeUntilArrival % 60;

      let timeString = '';
      if (minutes > 0 && seconds > 0) {
        timeString = `${minutes}분 ${seconds}초`;
      } else if (minutes > 0) {
        timeString = `${minutes}분`;
      } else if (seconds > 0) {
        timeString = `${seconds}초`;
      } else {
        timeString = '곧 도착';
      }

      return {
        finalDestination: train.finalDestination,
        time: timeString,
        status: train.delayMinutes > 0 ? 'delay' : 'normal',
      };
    });
  }, [realtimeTrains]);

  const exits = useMemo(
    () => [
      {
        id: '1',
        description:
          '부평우체국, 인천마장초등학교, 산곡2동행정복지센터',
        transfers: '부평구청 방면 3-3, 6-1 / 석남 방면 3-4, 6-2',
      },
      {
        id: '2',
        description: '부평구청, 상동호수공원',
        transfers: '50m 앞 버스 정류장',
      },
    ],
    []
  );

  const lineColor = getSubwayLineColor(lineId);


  const openKakaoSubway = () => {
    Linking.openURL('https://map.kakao.com/?subwayMap').catch(() => {
      // silently fail if linking is not supported
    });
  };

  return (
    <ScrollView style={styles.container} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Text style={styles.timeText}>{formattedTime}</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleManualRefresh}
            accessible
            accessibilityRole="button"
            accessibilityLabel="시간 및 도착 정보 새로고침"
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
                size={18}
                color={refreshing ? colors.textTertiary : colors.primary}
              />
            </Animated.View>
          </TouchableOpacity>
          <View style={styles.locationChip}>
            <Navigation size={14} color={colors.primary} />
            <Text style={styles.locationChipText}>GPS 동기화</Text>
          </View>
        </View>
        <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
          <Text style={styles.lineBadgeText}>{lineId}</Text>
        </View>
        <View style={styles.stationSwitcher}>
          {hasPrev && prevStation ? (
            <TouchableOpacity
              style={styles.prevStationButton}
              onPress={() => {
                navigation.push('StationDetail', {
                  stationId: prevStation.id,
                  stationName: prevStation.name,
                  lineId: lineId,
                });
              }}
            >
              <ChevronLeft size={18} color={colors.textSecondary} />
              <Text style={styles.switchText}>{prevStation.name}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.prevStationButton} />
          )}
          <View style={styles.currentStation}>
            <Text style={styles.currentStationText}>{stationName}</Text>
          </View>
          {hasNext && nextStation ? (
            <TouchableOpacity
              style={styles.nextStationButton}
              onPress={() => {
                navigation.push('StationDetail', {
                  stationId: nextStation.id,
                  stationName: nextStation.name,
                  lineId: lineId,
                });
              }}
            >
              <Text style={styles.switchText}>{nextStation.name}</Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.nextStationButton} />
          )}
        </View>
      </View>

      <View style={styles.arrivalContainer}>
        <Text style={styles.lastUpdatedText}>
          현재 {formattedTime} 기준 실시간 열차
        </Text>

        {trainsLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>열차 정보를 불러오는 중...</Text>
          </View>
        )}

        {!trainsLoading && trainsError && (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color={colors.error} />
            <Text style={styles.errorText}>{trainsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refetchTrains}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {!trainsLoading && !trainsError && arrivals.length === 0 && (
          <View style={styles.emptyContainer}>
            <Moon size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>현재 운행 중인 열차가 없습니다</Text>
            <Text style={styles.emptySubtext}>운행 종료 시간대입니다</Text>
          </View>
        )}

        {!trainsLoading && !trainsError && arrivals.length > 0 && arrivals.map((item, index) => (
          <View key={`${item.finalDestination}-${index}`} style={styles.arrivalRow}>
            <Text style={styles.arrivalDirection}>{`${item.finalDestination}행`}</Text>
            <Text
              style={[
                styles.arrivalTime,
                item.status === 'delay' && styles.arrivalDelay,
              ]}
            >
              {item.time}
            </Text>
          </View>
        ))}
      </View>

      {/* 혼잡도 섹션 */}
      {firstTrain && (
        <View style={styles.congestionSection}>
          <TrainCongestionView
            congestion={trainCongestion}
            onCarPress={handleCarPress}
            showLegend={true}
          />
          <TouchableOpacity
            style={styles.reportCongestionButton}
            onPress={() => setShowCongestionModal(true)}
          >
            <Users size={16} color={colors.primary} />
            <Text style={styles.reportCongestionText}>혼잡도 제보하기</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabRow}>
        {TAB_LABELS.map((label) => {
          const isActive = activeTab === label;
          return (
          <TouchableOpacity
            key={label}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => setActiveTab(label)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.tabButtonText,
                isActive && styles.tabButtonTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
        })}
      </View>

      {activeTab === '도착' && (
        <View
          style={styles.subwayMapCard}
          accessible
          accessibilityLabel="서울 전체 지하철 노선도"
        >
          <View style={styles.subwayMapHeader}>
            <Text style={styles.subwayMapTitle}>서울 지하철 노선도</Text>
            <Text style={styles.subwayMapSubtitle}>다음 지하철 (Daum Subway)</Text>
          </View>
          <View style={styles.subwayMapWebViewWrapper}>
            <WebView
              source={{ uri: 'https://m.map.kakao.com/actions/subwayRouteView' }}
              style={styles.subwayMapWebView}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.subwayMapLoader}>
                  <ActivityIndicator size="large" color={colors.warning} />
                  <Text style={styles.subwayMapLoaderText}>노선도 불러오는 중...</Text>
                </View>
              )}
              onError={() => setMapLoadError(true)}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
            />
          </View>
          {mapLoadError && (
            <View style={styles.subwayMapError}>
              <Text style={styles.subwayMapErrorText}>
                네트워크 연결을 확인한 뒤 다시 시도하거나 카카오맵에서 노선도를 확인하세요.
              </Text>
              <TouchableOpacity
                style={styles.subwayMapLink}
                onPress={openKakaoSubway}
                accessibilityRole="link"
              >
                <Text style={styles.subwayMapLinkText}>카카오맵 노선도 열기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.kakaoCard}>
        <View style={styles.kakaoIconWrapper}>
          <Text style={styles.kakaoIconText}>B</Text>
        </View>
        <View style={styles.kakaoInfo}>
          <Text style={styles.kakaoTitle}>
            카카오버스에서 지하철 도착정보 확인
          </Text>
          <ChevronRight size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>출구정보</Text>
        <Image
          source={{
            uri: 'https://maps.googleapis.com/maps/api/staticmap?center=37.4988,126.7189&zoom=16&size=600x300&maptype=roadmap&key=AIzaSyD-Placeholder',
          }}
          style={styles.mapImage}
          resizeMode="cover"
        />
        {exits.map((exit) => (
          <View key={exit.id} style={styles.exitCard}>
            <View style={styles.exitHeader}>
              <View style={styles.exitBadge}>
                <Text style={styles.exitBadgeText}>{exit.id}</Text>
              </View>
              <ChevronDown size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.exitDescription}>{exit.description}</Text>
            <Text style={styles.exitMeta}>{exit.transfers}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.busButton}>
        <Text style={styles.busButtonText}>버스 도착 정보 보기</Text>
        <ChevronRight size={18} color="#ffffff" />
      </TouchableOpacity>

      <View style={styles.adCard}>
        <View style={styles.adBadge} />
        <View style={styles.adContent}>
          <Text style={styles.adTitle}>
            이번 동남아 연말 휴가갈 땐 현지인이 사용하는 앱으로 간편하게 음식 배달 받으세요
          </Text>
          <Text style={styles.adSubtitle}>App Store</Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </View>

      {/* 혼잡도 제보 모달 */}
      {firstTrain && (
        <CongestionReportModal
          visible={showCongestionModal}
          onClose={() => {
            setShowCongestionModal(false);
            setSelectedCarNumber(undefined);
          }}
          onSubmit={handleCongestionReportSubmit}
          initialCarNumber={selectedCarNumber}
          trainInfo={{
            trainId: firstTrain.id,
            lineId: lineId,
            stationId: stationName, // Using stationName as ID for now
            stationName: stationName,
            direction: firstTrain.direction,
          }}
          submitting={congestionSubmitting}
        />
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    backgroundColor: colors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMedium,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  locationChipText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  refreshButton: {
    marginHorizontal: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  lineBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  lineBadgeText: {
    color: colors.textInverse,
    fontWeight: 'bold',
    fontSize: 16,
  },
  stationSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  prevStationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nextStationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  switchText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  currentStation: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 999,
    elevation: 2,
  },
  currentStationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  arrivalContainer: {
    backgroundColor: colors.surface,
    marginTop: 8,
    padding: 20,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  arrivalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrivalDirection: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  arrivalTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  arrivalDelay: {
    color: colors.warning,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  tabButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  subwayMapCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  subwayMapHeader: {
    marginBottom: 12,
  },
  subwayMapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subwayMapSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  subwayMapImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: colors.backgroundSecondary,
  },
  subwayMapImageWrapper: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subwayMapWebViewWrapper: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  subwayMapWebView: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  subwayMapLoader: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  subwayMapLoaderText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  subwayMapCaption: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
  },
  subwayMapError: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
  },
  subwayMapErrorText: {
    fontSize: 13,
    color: colors.error,
    marginBottom: 8,
    lineHeight: 18,
  },
  subwayMapLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  subwayMapLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textInverse,
  },
  kakaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d', // Kakao brand color
  },
  kakaoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fcd34d', // Kakao brand color
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  kakaoIconText: {
    fontWeight: 'bold',
    color: '#7c2d12',
  },
  kakaoInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kakaoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  mapImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.borderMedium,
    marginBottom: 16,
  },
  exitCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  exitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exitBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  exitBadgeText: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  exitDescription: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  exitMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  busButton: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  busButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  adCard: {
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  adBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.success,
    marginRight: 12,
  },
  adContent: {
    flex: 1,
  },
  adTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  adSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 16,
  },
  retryButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textTertiary,
  },
  congestionSection: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    gap: 12,
  },
  reportCongestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  reportCongestionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StationDetailScreen;
