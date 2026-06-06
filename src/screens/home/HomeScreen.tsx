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
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  Map as MapIcon,
  Megaphone,
  Search,
  TrainFront,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';

import { useAuth } from '../../services/auth/AuthContext';
import { trainService } from '../../services/train/trainService';
import { useNearbyStations } from '../../hooks/useNearbyStations';
import { useDelayDetection } from '../../hooks/useDelayDetection';
import { useMLPrediction } from '../../hooks/useMLPrediction';
import { useCommuteRouteSummary } from '../../hooks/useCommuteRouteSummary';
import { useFirestoreMorningCommute } from '../../hooks/useFirestoreMorningCommute';
import { useRealtimeTrains } from '../../hooks/useRealtimeTrains';
import { useFavorites } from '../../hooks/useFavorites';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import {
  CommunityDelayCard,
  CommuteRouteCard,
  CommuteRouteCardPlaceholder,
  FavoriteRow,
  HomeTopBar,
  MLHeroCard,
  MLHeroCardPlaceholder,
  NearbyStationCard,
  Pill,
  QuickActionsGrid,
  SectionHeader,
} from '../../components/design';
import type { LineId } from '../../components/design';
import { useToast } from '../../components/common/Toast';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '../../styles/modernTheme';
import { useTheme } from '../../services/theme';

import { Station } from '../../models/train';
import { isUsableCommuteTime } from '../../models/user';
import { AppStackParamList } from '../../navigation/types';

/**
 * Compute commute minutes from "HH:mm" departure → arrival strings.
 * Wraps midnight (23:55 → 00:20 = 25 min). Returns null on malformed input.
 */
const MIN_PER_DAY = 24 * 60;
const WALK_METERS_PER_MINUTE = 80;

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
 * Add minutes to an "HH:mm" time string, wrapping at midnight.
 * Returns null on malformed input. Used to derive an arrival time when
 * only the registered departure + estimated ride duration is known
 * (no ML prediction yet).
 */
const addMinutesToHHmm = (
  hhmm: string | undefined,
  minutes: number | undefined,
): string | null => {
  if (!hhmm || minutes === undefined || !Number.isFinite(minutes)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const base = parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
  const total = ((base + Math.round(minutes)) % MIN_PER_DAY + MIN_PER_DAY) % MIN_PER_DAY;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

/** "방금 전" / "12분 전" / "3시간 전" / "2일 전" */
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

/** "2026.05.03 (수) · 오전 8:32" */
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

/**
 * One favorite-row item with its own real-time arrivals subscription. Each
 * card is gated on `isFocused` to avoid background polling
 * (project_inactive_screen_polling_gating.md).
 *
 * `isFirst` enables the design-handoff treatment for the topmost favorite:
 * shows an extra "초" countdown and a green "곧 도착" label, ticking once
 * per second (main.jsx:259-294). Subsequent rows show only minutes.
 */
interface HomeFavoriteRowProps {
  station: Station;
  alias?: string | null;
  isFocused: boolean;
  isFirst?: boolean;
  onPress: () => void;
  testID?: string;
}

const HomeFavoriteRow: React.FC<HomeFavoriteRowProps> = memo(
  ({ station, alias, isFocused, isFirst = false, onPress, testID }) => {
    const { trains } = useRealtimeTrains(station.name, { enabled: isFocused });
    const next = trains[0];

    // Tick every second only when this is the first row AND the screen is
    // focused — avoids 1Hz timers across the favorite stack.
    const [, setTick] = useState(0);
    useEffect(() => {
      if (!isFirst || !isFocused) return;
      const id = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(id);
    }, [isFirst, isFocused]);

    const totalSecondsLeft = next?.arrivalTime
      ? Math.max(0, Math.round((next.arrivalTime.getTime() - Date.now()) / 1000))
      : 0;
    const nextMinutes = Math.floor(totalSecondsLeft / 60);

    const destLabel = next?.finalDestination
      ? `${next.finalDestination} 방면`
      : undefined;

    const imminent =
      isFirst && totalSecondsLeft > 0 && totalSecondsLeft <= 90;

    return (
      <FavoriteRow
        lines={[station.lineId as LineId]}
        stationName={station.name}
        nickname={alias ?? null}
        destinationLabel={destLabel}
        nextMinutes={nextMinutes}
        imminent={imminent}
        onPress={onPress}
        testID={testID}
      />
    );
  },
);
HomeFavoriteRow.displayName = 'HomeFavoriteRow';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
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
  // Top-5 favorites that resolved to a station, in the user's saved order. The
  // station's lineId is already overridden to the favorite's lineId inside
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
  const [commuteStationNames, setCommuteStationNames] = useState<{
    origin?: string;
    destination?: string;
    originLineId?: string;
  }>({});

  const {
    nearbyStations: hookNearbyStations,
    refresh: refreshNearby,
    closestStation: nearbyClosestStation,
  } = useNearbyStations({
    radius: 500,
    maxRadius: 500, // 도보권 역만 노출 — 적응형 확장 비활성화 (반경 고정)
    maxStations: 5,
    autoUpdate: true,
    minUpdateInterval: 30000,
  });

  // 지연 배너 비활성화: 1~9호선 "대표역" 9곳을 1분마다 폴링해 Seoul API
  // rate budget(일 1,000회)을 소진하고, per-station throttle 누적으로 즐겨찾기
  // 도착정보까지 굶주리게 했다. enabled:false면 초기 fetch·폴링 모두 중단되고
  // delays는 빈 배열을 유지해 의존 UI(실시간 제보 섹션·벨 알림)가 자동 숨김된다.
  const { delays: activeDelays } = useDelayDetection({
    pollingInterval: 60000,
    autoPolling: true,
    enabled: false,
  });

  // HomeScreen uses MLPrediction (not the PredictedCommute model extended in spec 2026-05-12 §7.1)
  const { prediction: mlPrediction, baselineMinutes } = useMLPrediction();

  // Two stores populate the morning commute:
  //   1. `user.preferences.commuteSchedule.weekdays.morningCommute` — written by
  //      Settings → 출근 경로 (CommuteSettingsScreen writes through to the
  //      user profile).
  //   2. Firestore `commuteSettings/<uid>` — written by the onboarding flow
  //      (CommuteRouteScreen → CommuteTimeScreen → FavoritesOnboardingScreen
  //      → commuteService.saveCommuteRoutes). Onboarding does NOT update the
  //      user profile, so users who registered there had no morningCommute
  //      on the profile and the CommuteRouteCard never rendered.
  //
  // The hook below adapts store #2 to the same `CommuteTime` shape so the
  // resolution is a simple `?? fallback`. Profile (#1) wins only when it is
  // actually usable — NotificationTimeScreen can leave a non-null
  // morningCommute with empty-string station ids, and a plain `??` would
  // let that empty object shadow the valid onboarding data.
  const onboardingMorningCommute = useFirestoreMorningCommute(user?.id);
  const profileMorningCommute =
    user?.preferences.commuteSchedule?.weekdays?.morningCommute;
  const morningCommute =
    (isUsableCommuteTime(profileMorningCommute) ? profileMorningCommute : null) ??
    onboardingMorningCommute;

  const routeSummary = useCommuteRouteSummary(
    morningCommute?.stationId,
    morningCommute?.destinationStationId,
  );

  // Dev-only diagnostic: compare what each store stored vs. what
  // trainService.getStation() resolves to. If a store wrote an external
  // OpenAPI code instead of an internal slug, the lookup returns null here
  // even though `morningCommute` is non-null — the exact failure shape that
  // hides the fact grid on the home card.
  useEffect(() => {
    if (!__DEV__) return;
    // Skip in jest — the async warn fires past act() boundaries and flakes
    // unrelated assertions. JEST_WORKER_ID is set on every jest worker.
    if (process.env.JEST_WORKER_ID) return;
    if (!morningCommute) return;
    let cancelled = false;
    (async () => {
      const ids = {
        fromProfile: profileMorningCommute
          ? {
              from: profileMorningCommute.stationId,
              to: profileMorningCommute.destinationStationId,
            }
          : null,
        fromOnboarding: onboardingMorningCommute
          ? {
              from: onboardingMorningCommute.stationId,
              to: onboardingMorningCommute.destinationStationId,
            }
          : null,
        chosen: {
          from: morningCommute.stationId,
          to: morningCommute.destinationStationId,
        },
      };
      const [fromStation, toStation] = await Promise.all([
        trainService.getStation(morningCommute.stationId).catch(() => null),
        trainService
          .getStation(morningCommute.destinationStationId)
          .catch(() => null),
      ]);
      if (cancelled) return;
      console.warn('[HomeScreen.commuteDiag] stored ids vs resolved stations', {
        ids,
        resolved: {
          from: fromStation
            ? { id: fromStation.id, name: fromStation.name }
            : null,
          to: toStation ? { id: toStation.id, name: toStation.name } : null,
        },
        routeSummary,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    routeSummary,
  ]);

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
          originLineId: origin?.lineId,
        });
      } catch {
        // ignore — components tolerate missing endpoint names
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [morningCommute]);

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

  // Fallback chain for the CommuteRouteCard hero data:
  //   1. ML prediction (heroProps)               — best signal, kicks in after ~10 rides
  //   2. Registered commute + route summary      — production fallback so users who
  //                                                 set morningCommute see the card
  //                                                 immediately, with ride/arrival
  //                                                 derived from graph search instead
  //                                                 of ML inference
  //
  // Note: the hero ML card still uses `heroProps` directly (see render block) — this
  // chain only exists so CommuteRouteCard renders without ML.
  const registeredCommuteHero = useMemo(() => {
    if (!morningCommute) return null;
    if (!commuteStationNames.origin || !commuteStationNames.destination) return null;
    if (!routeSummary.ready || routeSummary.rideMinutes === undefined) return null;
    const arrival = addMinutesToHHmm(
      morningCommute.departureTime,
      routeSummary.rideMinutes,
    );
    if (!arrival) return null;
    return {
      predictedMinutes: routeSummary.rideMinutes,
      deltaMinutes: undefined as number | undefined,
      arrivalTime: arrival,
      confidence: undefined as number | undefined,
      origin: commuteStationNames.origin,
      destination: commuteStationNames.destination,
    };
  }, [morningCommute, commuteStationNames, routeSummary]);

  const effectiveHero = useMemo(() => {
    if (heroProps) return heroProps;
    if (registeredCommuteHero) return registeredCommuteHero;
    return null;
  }, [heroProps, registeredCommuteHero]);

  const effectiveNames = commuteStationNames;

  const effectiveRouteFacts = routeSummary;

  const effectiveDepartureTime =
    mlPrediction?.predictedDepartureTime ?? morningCommute?.departureTime;

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
      if (locationPermission) {
        refreshNearby();
      }
      // Always re-pull favorites from Firestore. The prior code skipped this
      // whenever location was granted, so a pull-to-refresh could never recover
      // a stale favorites list on a location-enabled device (audit B1 ④).
      await refreshFavorites();
    } finally {
      setRefreshing(false);
    }
  }, [locationPermission, refreshNearby, refreshFavorites]);

  useEffect(() => {
    initializeScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearbyList = locationPermission ? hookNearbyStations : favoriteStations;

  const showNearbySection = nearbyList.length > 0;
  const showFavoritesSection = favoriteStations.length > 0;
  const showCommunitySection = activeDelays.length > 0;

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
    () => navigation.navigate('MainTabs' as never),
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
        {effectiveNames.origin && effectiveNames.destination ? (
          <CommuteRouteCard
            origin={effectiveNames.origin}
            destination={effectiveNames.destination}
            lineId={effectiveNames.originLineId as LineId | undefined}
            departureTime={effectiveDepartureTime}
            arrivalTime={effectiveHero?.arrivalTime}
            rideMinutes={effectiveHero?.predictedMinutes}
            transferCount={effectiveRouteFacts.transferCount}
            stationCount={effectiveRouteFacts.stationCount}
            fareKrw={effectiveRouteFacts.fareKrw}
            onPressEdit={handleOpenCommuteSettings}
            testID="home-commute-route-card"
          />
        ) : (
          <CommuteRouteCardPlaceholder onPress={handleOpenCommuteSettings} />
        )}
      </View>

      {/* 4. Quick actions */}
      <View style={styles.quickActionsWrap}>
        <QuickActionsGrid
          actions={[
            { id: 'route', Icon: Search, label: '경로검색', onPress: onPressRouteSearch },
            { id: 'map', Icon: MapIcon, label: '노선도', onPress: onPressMap },
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
              title={locationPermission ? '주변 역' : '즐겨찾기'}
              subtitle={locationPermission ? 'GPS 기반 · 도보 거리순' : undefined}
              testID="home-stations-section"
            />
          </View>
          {locationPermission && nearbyClosestStation && (
            <View style={styles.locationBadgeWrap}>
              <Pill tone="pos" size="sm">
                {`${nearbyClosestStation.name} 인근`}
              </Pill>
            </View>
          )}
        </View>

        {!showNearbySection ? (
          // Empty state — see feedback_empty_state_and_skeleton.md.
          <View style={styles.emptyState}>
            <TrainFront size={48} color={semantic.labelAlt} />
            <Text style={styles.emptyText}>데이터가 없습니다.</Text>
            <Text style={styles.emptySubtext}>
              {locationPermission
                ? '다른 위치에서 시도해보세요'
                : '설정에서 자주 이용하는 역을 추가해보세요'}
            </Text>
            {!locationPermission && (
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
        {!showCommunitySection ? (
          <View style={styles.sectionEmpty}>
            <Text style={styles.emptyText}>데이터가 없습니다.</Text>
            <Text style={styles.emptySubtext}>
              근처 노선에 제보된 지연이 없습니다
            </Text>
          </View>
        ) : (
          <View style={styles.communityCardWrap}>
            <CommunityDelayCard
              line={activeDelays[0]!.lineId as LineId}
              title={`${
                activeDelays[0]!.lineName ?? `${activeDelays[0]!.lineId}호선`
              }${activeDelays[0]!.reason ? ` ${activeDelays[0]!.reason}` : ' 지연 발생'}`}
              description={
                activeDelays[0]!.delayMinutes > 0
                  ? `약 ${activeDelays[0]!.delayMinutes}분 지연 중`
                  : undefined
              }
              timestampLabel={
                formatRelativeKorean(activeDelays[0]!.timestamp) ?? undefined
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
