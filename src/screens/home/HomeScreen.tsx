/**
 * Home Screen — Wanted bundle main.jsx alignment (Phase 56).
 *
 * Sections (top → bottom, mirrors `~/Downloads/livemetro/project/src/screens/main.jsx`):
 *   1. HomeTopBar       — date/time + greeting + bell (red dot when delays)
 *   2. ML hero          — MLHeroCard | placeholder
 *   3. CommuteRouteCard — 오늘의 출근 경로 (visualised legs + facts grid)
 *   4. QuickActionsGrid — 경로검색 / 노선도 / 제보 / 증명서
 *   5. 주변 역           — horizontal scroll of NearbyStationCard
 *   6. 즐겨찾는 역        — vertical FavoriteRow list (when location granted)
 *   7. 실시간 제보        — CommunityDelayCard preview
 *
 * The inline DelayAlertBanner, the location permission banner, and the
 * real-time TrainArrivalList were removed in Phase 56 — their data still
 * feeds CommunityDelayCard / the empty-state link / StationDetail.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Map as MapIcon, MapPin, Megaphone, Search, TrainFront } from 'lucide-react-native';
import * as Location from 'expo-location';
import { NavigationProp, useIsFocused, useNavigation } from '@react-navigation/native';

import { useAuth } from '../../services/auth/AuthContext';
import { useNearbyStations } from '../../hooks/useNearbyStations';
import { useDelayDetection } from '../../hooks/useDelayDetection';
import { useCommuteHeroEstimate } from '../../hooks/useCommuteHeroEstimate';
import { useStartCommuteGuidance } from '../../hooks/useStartCommuteGuidance';
import { useGuidanceSession } from '../../hooks/useGuidanceSession';
import { useFavorites } from '../../hooks/useFavorites';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { CommunityDelayCard, CommuteRouteCard, CommuteRouteCardPlaceholder, HomeTopBar, MLHeroCard, MLHeroCardPlaceholder, NearbyStationCard, Pill, QuickActionsGrid, SectionHeader } from '../../components/design';
import type { LineId } from '../../components/design';
import { GuidanceActiveBanner } from '../../components/guidance/GuidanceActiveBanner';
import { useToast } from '../../components/common/Toast';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '../../styles/modernTheme';

import { Station } from '../../models/train';
import { AppStackParamList } from '../../navigation/types';
import { HomeFavoriteRow } from './HomeFavoriteRow';
import { useCommuteDiagnostics } from './useCommuteDiagnostics';
import { formatDateTimeLabel, formatRelativeKorean } from './homeTimeFormat';

const WALK_METERS_PER_MINUTE = 80;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const { showError, showSuccess, showInfo, ToastComponent } = useToast();

  // Favorites come from the app-wide reactive FavoritesContext — the single
  // source of truth shared with FavoritesScreen / SubwayMap. Reading it here
  // (instead of a mount-only snapshot of user.preferences resolved through
  // trainService.getStation) means a favorite added, removed, or renamed on
  // any other tab is reflected on Home without a remount or pull-to-refresh.
  // The bottom-tab navigator keeps HomeScreen mounted, so the prior mount-only
  // effect left the list stale until app restart (home-refresh audit B1/B2/B3).
  const { favoritesWithDetails, refresh: refreshFavorites } = useFavorites();
  // Home shows only the FIRST 5 favorites (`slice(0, 5)`), in the user's saved
  // order — i.e. the order they were added (arrayUnion appends, so oldest
  // first) unless reordered on the Favorites tab. This is a home-surface cap,
  // NOT a "most recently added" view: a 6th favorite lands at the end of the
  // array and won't appear here. The full list lives behind "전체 보기 ›".
  // The station's lineId is already overridden to the favorite's lineId inside
  // FavoritesContext, so transfer stations render the correct line.
  const favoriteStations = useMemo<Station[]>(
    () =>
      favoritesWithDetails
        .slice(0, 5)
        .map((f) => f.station)
        .filter((s): s is Station => s !== null),
    [favoritesWithDetails],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  const {
    nearbyStations: hookNearbyStations,
    refresh: refreshNearby,
    closestStation: nearbyClosestStation,
    isEstimated: nearbyIsEstimated,
    hasLocation: nearbyHasLocation,
  } = useNearbyStations({
    radius: 500, // 도보권 500m 우선 — 하지만 캡(maxRadius)은 두지 않는다
    // maxRadius 미지정 → 500m 안에 3개 미만이면 600→1000→1500m로 적응형 확장
    // (locationService.ADAPTIVE_RADIUS_STEPS). 역 희소 지역에서 "주변 역"이 비는
    // 것을 막는다. 도심에선 500m로 충분해 확장은 거의 일어나지 않음.
    maxStations: 5,
    autoUpdate: true,
    minUpdateInterval: 30000,
  });

  // 주변 역 섹션의 단일 표시 기준. HomeScreen의 locationPermission state는 마운트
  // 시 useLocation 훅과 별도로 requestForegroundPermissions를 호출해 두 권한 결과가
  // 갈라질 수 있다(동시 요청 race). 훅이 실제로 위치를 얻었으면(hasLocation) 그
  // 사실이 우선 — 안 그러면 훅이 찾은 주변 역이 빈 화면("데이터가 없습니다.")으로
  // 가려진다(디바이스 repro). 권한 *요청* 흐름(initializeScreen 등)은 그대로
  // locationPermission을 쓴다.
  const locationActive = locationPermission || nearbyHasLocation;

  // 지연 배너 비활성화: 1~9호선 "대표역" 9곳을 1분마다 폴링해 Seoul API
  // rate budget(일 1,000회)을 소진하고, per-station throttle 누적으로 즐겨찾기
  // 도착정보까지 굶주리게 했다. enabled:false면 초기 fetch·폴링 모두 중단되고
  // delays는 빈 배열을 유지해 의존 UI(실시간 제보 섹션·벨 알림)가 자동 숨김된다.
  const { delays: activeDelays } = useDelayDetection({
    pollingInterval: 60000,
    autoPolling: true,
    enabled: false,
  });

  // Force a fresh commute re-read whenever Home regains focus (e.g. returning
  // from CommuteSettings after editing the route). The commute estimate is
  // already live (useFirestoreMorningCommute → onSnapshot), so this is a
  // belt-and-suspenders recovery for any stale/dropped subscription: bumping the
  // nonce re-subscribes the listener. The initial mount focus is skipped (the
  // subscription already runs on mount) to avoid a redundant double-subscribe.
  const [commuteRefreshNonce, setCommuteRefreshNonce] = useState(0);
  const didInitialFocusRef = useRef(false);
  useEffect(() => {
    if (!isFocused) return;
    if (!didInitialFocusRef.current) {
      didInitialFocusRef.current = true;
      return;
    }
    setCommuteRefreshNonce((n) => n + 1);
  }, [isFocused]);

  // Commute hero estimate — shared single source of truth with
  // WeeklyPredictionScreen via useCommuteHeroEstimate. This hook is the sole
  // caller of useMLPrediction / useFirestoreMorningCommute /
  // useCommuteRouteSummary and the station-name resolution (the 2-store morning
  // commute resolution included), so the home card and the prediction screen
  // can never show different numbers / departure times. The estimate chain (ML
  // door-to-door ?? registered-commute graph ride) and the isUsableCommuteTime
  // gate now live in that hook (see its JSDoc). `commuteRefreshNonce` re-reads
  // the live subscription on focus.
  const {
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    activeCommute,
    activeCommuteType,
    routeSummary,
    commuteStationNames,
    effectiveHero,
    effectiveDepartureTime,
  } = useCommuteHeroEstimate(commuteRefreshNonce, 'auto');

  // Card label follows the time-resolved active leg (출근 in the morning window,
  // 퇴근 in the afternoon/evening) — drives both the real card and placeholder.
  const commuteCardTitle =
    activeCommuteType === 'evening' ? '오늘의 퇴근 경로' : '오늘의 출근 경로';

  // Dev-only diagnostic (no-op in production/jest): logs stored commute ids
  // vs. resolved stations — see useCommuteDiagnostics for the failure shape
  // it catches.
  useCommuteDiagnostics({
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    routeSummary,
  });

  const [dateTimeLabel, setDateTimeLabel] = useState(() =>
    formatDateTimeLabel(new Date()),
  );
  useEffect(() => {
    const id = setInterval(
      () => setDateTimeLabel(formatDateTimeLabel(new Date())),
      60_000,
    );
    return () => clearInterval(id);
  }, []);

  const initializeScreen = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationPermission(granted);
      // Favorites are no longer loaded here — they flow reactively from
      // FavoritesContext (see favoriteStations memo above).
    } catch {
      showError('데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const handleStationPress = useCallback(
    (station: Station): void => {
      navigation.navigate('StationDetail', {
        stationId: station.id,
        stationName: station.name,
        lineId: station.lineId,
      });
    },
    [navigation],
  );

  const handleOpenPrediction = useCallback((): void => {
    navigation.navigate('WeeklyPrediction');
  }, [navigation]);

  // One-tap "이 경로로 길안내 시작" for the active leg (출근 in the morning, 퇴근
  // in the afternoon/evening) — null when the registered commute can't resolve a
  // route or endpoint names, so the CTA stays hidden rather than dead-ending.
  // Reuses the same guidance handoff as the route-search tab.
  const startCommuteGuidance = useStartCommuteGuidance({
    fromStationId: activeCommute?.stationId,
    toStationId: activeCommute?.destinationStationId,
    viaTransferId: activeCommute?.transferStationId,
    fromStationName: commuteStationNames.origin,
    toStationName: commuteStationNames.destination,
  });

  // Re-entry into an in-progress guidance journey from the "안내 중" banner.
  // Gated on an active session so the banner slot occupies zero space when idle.
  const guidanceSession = useGuidanceSession();
  const handleResumeGuidance = useCallback((): void => {
    navigation.navigate('RouteGuidance');
  }, [navigation]);

  // Opens CommuteSettings (출퇴근 경로 등록/변경). Every "set up your commute"
  // affordance funnels here regardless of whether a commute already exists:
  //   - ML hero placeholder CTA ("지금 설정하기")
  //   - CommuteRouteCard "경로 변경" link
  //   - CommuteRouteCardPlaceholder "지금 설정하기" CTA
  //
  // HomeScreen lives inside the bottom-tab navigator, so `Profile` is a direct
  // sibling route — navigate straight to it instead of bouncing up through the
  // outer `Main` stack route (the prior `navigate('Main', { screen: 'Profile',
  // ... })` form silently no-op'd at runtime when already on Main). types.ts
  // MainTabs/Settings aliases don't exist at runtime (see
  // project_dual_stack_paramlist), so the typed signature can't express this
  // nested navigation — cast the function once.
  //
  // `initial: false` is load-bearing: without it, navigating into an unmounted
  // SettingsNavigator makes `CommuteSettings` that stack's *only* (initial)
  // entry — `SettingsHome` is dropped. The bottom-tab keeps each tab's stack,
  // so the "나" tab then shows CommuteSettings permanently, and the screen's
  // `canGoBack()`-guarded save can never pop back. With `initial: false` the
  // stack is seeded as [SettingsHome, CommuteSettings] instead.
  const handleOpenCommuteSettings = useCallback((): void => {
    const navigateToSettings = navigation.navigate as (
      route: 'Profile',
      params: { screen: 'CommuteSettings'; initial: false },
    ) => void;
    navigateToSettings('Profile', {
      screen: 'CommuteSettings',
      initial: false,
    });
  }, [navigation]);

  const requestLocationPermission = useCallback(async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationPermission(true);
      showSuccess('위치 권한이 허용되었습니다');
      refreshNearby();
    } else {
      showInfo('위치 권한이 필요합니다. 설정에서 수동으로 허용해주세요.');
    }
  }, [refreshNearby, showInfo, showSuccess]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      if (locationActive) {
        refreshNearby();
      }
      // Always re-pull favorites from Firestore. The prior code skipped this
      // whenever location was granted, so a pull-to-refresh could never recover
      // a stale favorites list on a location-enabled device (audit B1 ④).
      await refreshFavorites();
    } finally {
      setRefreshing(false);
    }
  }, [locationActive, refreshNearby, refreshFavorites]);

  useEffect(() => {
    initializeScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearbyList = locationActive ? hookNearbyStations : favoriteStations;

  const showNearbySection = nearbyList.length > 0;
  const showFavoritesSection = favoriteStations.length > 0;
  const firstDelay = activeDelays[0];

  const onPressRouteSearch = useCallback((): void => {
    if (nearbyClosestStation) {
      navigation.navigate('AlternativeRoutes', {
        fromStationId: nearbyClosestStation.id,
        toStationId: 'gangnam',
        fromStationName: nearbyClosestStation.name,
        toStationName: '강남',
      });
    } else {
      navigation.navigate('AlternativeRoutes', {
        fromStationId: '',
        toStationId: '',
        fromStationName: '',
        toStationName: '',
      });
    }
  }, [nearbyClosestStation, navigation]);

  const onPressMap = useCallback(
    () => navigation.navigate('SubwayMap'),
    [navigation],
  );
  const onPressCurrentLocationMap = useCallback(
    () => navigation.navigate('CurrentLocationMap'),
    [navigation],
  );
  const onPressReport = useCallback(
    () => navigation.navigate('DelayFeed'),
    [navigation],
  );
  const onPressCert = useCallback(
    () => navigation.navigate('DelayCertificate'),
    [navigation],
  );
  const onPressBell = useCallback(
    () => navigation.navigate('Alerts'),
    [navigation],
  );
  const onPressFavoritesAll = useCallback(
    // Navigate to the Favorites tab. Cast to never to avoid coupling
    // HomeScreen's prop type to MainTabParamList — the tab navigator owns
    // the route name space.
    () => navigation.navigate('Favorites' as never),
    [navigation],
  );
  const onPressDelayCard = useCallback(
    () => navigation.navigate('DelayFeed'),
    [navigation],
  );

  if (loading) {
    return <LoadingScreen message="주변 역 정보를 가져오고 있습니다..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
      {/* 1. Top bar */}
      <HomeTopBar
        userName={user?.displayName ?? undefined}
        dateTime={dateTimeLabel}
        hasUnread={activeDelays.length > 0}
        onBellPress={onPressBell}
      />

      {/* Resume banner — only while a guidance journey is in progress. */}
      {guidanceSession && (
        <View style={styles.guidanceBannerWrap}>
          <GuidanceActiveBanner onPress={handleResumeGuidance} />
        </View>
      )}

      {/* 2. ML hero — MLHeroCard when a prediction is available, otherwise the
          gradient placeholder. The placeholder shows whenever effectiveHero is
          null (no ML prediction yet) — INCLUDING when a commute is registered
          but the model hasn't trained on enough ride history. This keeps the
          slot visually consistent (one gradient surface, not a separate white
          progress card) and always surfaces a "set up commute" CTA. */}
      <View style={styles.heroWrap}>
        {effectiveHero ? (
          <MLHeroCard
            origin={effectiveHero.origin}
            destination={effectiveHero.destination}
            predictedMinutes={effectiveHero.predictedMinutes}
            deltaMinutes={effectiveHero.deltaMinutes}
            arrivalTime={effectiveHero.arrivalTime}
            confidence={effectiveHero.confidence}
            onPress={handleOpenPrediction}
          />
        ) : (
          <MLHeroCardPlaceholder onPress={handleOpenCommuteSettings} />
        )}
      </View>

      {/* 3. CommuteRouteCard — main.jsx:72-162. Renders as soon as both
          endpoint NAMES are known — a hero prediction is NOT required. This
          lets a registered commute show its real origin→destination + 출발
          시각 even before (or without) ML/graph-search results; arrivalTime,
          rideMinutes and the fact grid degrade gracefully to hidden when the
          hero/route summary hasn't resolved. The placeholder occupies the
          slot only when no endpoints are known (no registered commute, and
          the dev sample is suppressed once a commute exists). */}
      <View style={styles.routeCardWrap}>
        {commuteStationNames.origin && commuteStationNames.destination ? (
          <CommuteRouteCard
            title={commuteCardTitle}
            origin={commuteStationNames.origin}
            destination={commuteStationNames.destination}
            lineId={(routeSummary.lineId ?? commuteStationNames.originLineId) as LineId | undefined}
            departureTime={effectiveDepartureTime}
            arrivalTime={effectiveHero?.arrivalTime}
            rideMinutes={effectiveHero?.predictedMinutes}
            transferCount={routeSummary.transferCount}
            stationCount={routeSummary.stationCount}
            fareKrw={routeSummary.fareKrw}
            onPressEdit={handleOpenCommuteSettings}
            onStartGuidance={startCommuteGuidance ?? undefined}
            testID="home-commute-route-card"
          />
        ) : (
          <CommuteRouteCardPlaceholder
            title={commuteCardTitle}
            onPress={handleOpenCommuteSettings}
          />
        )}
      </View>

      {/* 4. Quick actions */}
      <View style={styles.quickActionsWrap}>
        <QuickActionsGrid
          actions={[
            { id: 'route', Icon: Search, label: '경로검색', onPress: onPressRouteSearch },
            { id: 'map', Icon: MapIcon, label: '노선도', onPress: onPressMap },
            { id: 'mylocation', Icon: MapPin, label: '내 위치', onPress: onPressCurrentLocationMap },
            { id: 'report', Icon: Megaphone, label: '제보', onPress: onPressReport },
            { id: 'cert', Icon: FileText, label: '증명서', onPress: onPressCert },
          ]}
        />
      </View>

      {/* 5. 주변 역 — horizontal scroll. "홍대 인근" Pill uses pos (green)
          tone to match the design handoff's green dot + label. */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTitle}>
            <SectionHeader
              title={
                locationActive
                  ? nearbyIsEstimated
                    ? '주변 역 (추정)'
                    : '주변 역'
                  : '즐겨찾기'
              }
              subtitle={locationActive ? 'GPS 기반 · 도보 거리순' : undefined}
              testID="home-stations-section"
            />
          </View>
          {/* Suppress the definitive "OO 인근" proximity claim on a coarse fix:
              at >100m uncertainty the nearest-station pick is a guess, not fact
              (location-services skill BP#5). */}
          {locationActive && nearbyClosestStation && !nearbyIsEstimated && (
            <View style={styles.locationBadgeWrap}>
              <Pill tone="pos" size="sm">
                {`${nearbyClosestStation.name} 인근`}
              </Pill>
            </View>
          )}
        </View>

        {locationActive && nearbyIsEstimated && showNearbySection && (
          <Text style={styles.estimatedNote} testID="home-nearby-estimated-note">
            위치 정확도가 낮아 추정 결과예요
          </Text>
        )}

        {!showNearbySection ? (
          // Empty state — see feedback_empty_state_and_skeleton.md.
          <View style={styles.emptyState}>
            <TrainFront size={48} color={semantic.labelAlt} />
            <Text style={styles.emptyText}>데이터가 없습니다.</Text>
            <Text style={styles.emptySubtext}>
              {locationActive
                ? '다른 위치에서 시도해보세요'
                : '설정에서 자주 이용하는 역을 추가해보세요'}
            </Text>
            {!locationActive && (
              <Text
                style={styles.permissionLink}
                onPress={requestLocationPermission}
                accessibilityRole="link"
                accessibilityLabel="위치 권한 허용"
              >
                위치 권한 허용하기
              </Text>
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nearbyScroll}
          >
            {nearbyList.map((station) => {
              const distanceM =
                'distance' in station
                  ? (station as Station & { distance: number }).distance
                  : 0;
              return (
                <NearbyStationCard
                  key={station.id}
                  lineIds={[station.lineId as LineId]}
                  stationName={station.name}
                  distanceM={distanceM}
                  walkMin={Math.max(
                    1,
                    Math.ceil(distanceM / WALK_METERS_PER_MINUTE),
                  )}
                  onPress={() => handleStationPress(station)}
                />
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 6. 즐겨찾는 역 — real favorites only. Empty state keeps the slot
          reserved per the empty-state policy. */}
      <View style={styles.section}>
        <SectionHeader
          title="즐겨찾는 역"
          subtitle="실시간 도착"
          action={
            <Text
              style={styles.allLink}
              onPress={onPressFavoritesAll}
              accessibilityRole="link"
              accessibilityLabel="즐겨찾는 역 전체 보기"
            >
              전체 보기 ›
            </Text>
          }
        />
        {!showFavoritesSection ? (
          <View style={styles.sectionEmpty}>
            <Text style={styles.emptyText}>데이터가 없습니다.</Text>
            <Text style={styles.emptySubtext}>
              자주 이용하는 역을 즐겨찾기에 추가해보세요
            </Text>
          </View>
        ) : (
          <View style={styles.favoriteList}>
            {/* Capped at the first 5 favorites (saved order). The "전체 보기 ›"
                link above navigates to the Favorites tab for the rest. */}
            {favoritesWithDetails
              .slice(0, 5)
              .map((fav, idx) => {
                const station = fav.station;
                if (!station) return null;
                const isFirst = idx === 0;
                return (
                  <HomeFavoriteRow
                    key={station.id}
                    station={station}
                    alias={fav.alias}
                    isFocused={isFocused}
                    isFirst={isFirst}
                    onPress={() => handleStationPress(station)}
                  />
                );
              })}
          </View>
        )}
      </View>

      {/* 7. 실시간 제보 — real activeDelays only. */}
      <View style={styles.section}>
        <SectionHeader title="실시간 제보" subtitle="근처 노선" />
        {!firstDelay ? (
          <View style={styles.sectionEmpty}>
            <Text style={styles.emptyText}>데이터가 없습니다.</Text>
            <Text style={styles.emptySubtext}>
              근처 노선에 제보된 지연이 없습니다
            </Text>
          </View>
        ) : (
          <View style={styles.communityCardWrap}>
            <CommunityDelayCard
              line={firstDelay.lineId as LineId}
              title={`${
                firstDelay.lineName ?? `${firstDelay.lineId}호선`
              }${firstDelay.reason ? ` ${firstDelay.reason}` : ' 지연 발생'}`}
              description={
                firstDelay.delayMinutes > 0
                  ? `약 ${firstDelay.delayMinutes}분 지연 중`
                  : undefined
              }
              timestampLabel={
                formatRelativeKorean(firstDelay.timestamp) ?? undefined
              }
              onPress={onPressDelayCard}
              testID="home-community-delay-card"
            />
          </View>
        )}
      </View>

      <ToastComponent />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    guidanceBannerWrap: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s4,
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
    section: {
      backgroundColor: semantic.bgBase,
      marginBottom: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s4,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: WANTED_TOKENS.spacing.s5,
    },
    sectionHeaderTitle: {
      flex: 1,
    },
    locationBadgeWrap: {
      paddingTop: WANTED_TOKENS.spacing.s2,
    },
    nearbyScroll: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      columnGap: WANTED_TOKENS.spacing.s3,
    },
    favoriteList: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      rowGap: WANTED_TOKENS.spacing.s2,
    },
    communityCardWrap: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s10,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
    },
    /** Per-section empty slot. Reserves vertical space (~one card row)
     *  so the layout doesn't collapse when data is absent. See
     *  feedback_empty_state_and_skeleton.md. */
    sectionEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s8,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      minHeight: 88,
    },
    emptyText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      lineHeight: WANTED_TOKENS.type.body1.lh,
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
    estimatedNote: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      lineHeight: WANTED_TOKENS.type.caption1.lh * 1.4,
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    permissionLink: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryNormal,
      marginTop: WANTED_TOKENS.spacing.s4,
      textDecorationLine: 'underline',
    },
    allLink: {
      fontSize: WANTED_TOKENS.type.label1.size,
      lineHeight: WANTED_TOKENS.type.label1.lh,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
  });

// Memoize to prevent unnecessary re-renders.
export default React.memo(HomeScreen);
