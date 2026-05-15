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

/**
 * Dev-only sample data for the ML hero + CommuteRouteCard.
 *
 * Reason: the production gating chain (mlPrediction != null && origin name
 * lookup OK && destination lookup OK) only fires after a user has set their
 * commute schedule AND the ML model has trained on enough ride history. On
 * first run / dev simulator that never lights up, so the design preview
 * shows the placeholder instead of the real card.
 *
 * Three-way gate:
 *   __DEV__                     true in dev, false in release (tree-shake)
 *   NODE_ENV !== 'test'          false under jest so the mock-driven
 *                                 placeholder/no-prediction branch tests
 *                                 still exercise the real code paths
 *
 * Production behaviour is unchanged — placeholder still shows when no real
 * data exists.
 */
const DEV_SAMPLE_COMMUTE =
  __DEV__ && process.env.NODE_ENV !== 'test'
    ? ({
        origin: '홍대입구',
        destination: '강남',
        originLineId: '2',
        predictedDepartureTime: '08:32',
        predictedArrivalTime: '09:00',
        predictedMinutes: 28,
        deltaMinutes: -3,
        confidence: 0.87,
        transferCount: 0,
        stationCount: 8,
        fareKrw: 1450,
      } as const)
    : null;

/**
 * Dev-only sample nearby stations — mirrors the design handoff image
 * (2026-05-06). Cards intentionally omit arrival/congestion data so
 * the divider + bottom-half stays hidden in this slot; real-time
 * arrival cues belong to the "즐겨찾는 역" section instead. The
 * `NearbyStationCard` component still supports the bottom half for
 * other contexts.
 */
type SampleNearby = {
  readonly id: string;
  readonly lineIds: readonly ('1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'sb' | 'gj' | 'ap' | 'bd' | 'gx')[];
  readonly stationName: string;
  readonly distanceM: number;
  readonly walkMin: number;
  readonly exitNumber: string;
};

const DEV_SAMPLE_NEARBY: readonly SampleNearby[] | null =
  __DEV__ && process.env.NODE_ENV !== 'test'
    ? ([
        {
          id: 'sample-nearby-hongdae',
          lineIds: ['2', 'gj', 'ap'],
          stationName: '홍대입구',
          distanceM: 180,
          walkMin: 3,
          exitNumber: '9',
        },
        {
          id: 'sample-nearby-sinchon',
          lineIds: ['2'],
          stationName: '신촌',
          distanceM: 720,
          walkMin: 9,
          exitNumber: '4',
        },
      ] as const)
    : null;

/**
 * Dev-only sample favorites — mirrors the design handoff image (2026-05-06):
 *   ① 강남 (2 + 신분당, 회사, 잠실 방면, 혼잡, 1분 44초 · 곧 도착)
 *   ② 홍대입구 (2 + 경의, 집, 시청 방면, 보통, 4분)
 *   ③ 잠실 (2 + 8, 모란 방면, 여유, 7분)
 *
 * Each sample item carries its own `secondsLeft` so the topmost row can
 * render the "곧 도착" overlay without hitting useRealtimeTrains.
 */
type SampleFavorite = {
  readonly id: string;
  readonly lineIds: readonly ('1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'sb' | 'gj' | 'ap' | 'bd' | 'gx')[];
  readonly stationName: string;
  readonly alias?: string;
  readonly destinationLabel: string;
  readonly congestion: 'low' | 'mid' | 'high' | 'vhigh';
  readonly nextMinutes: number;
  readonly secondsLeft?: number; // first row only — drives "X초 · 곧 도착"
};

const DEV_SAMPLE_FAVORITES: readonly SampleFavorite[] | null =
  __DEV__ && process.env.NODE_ENV !== 'test'
    ? ([
        {
          id: 'sample-fav-gangnam',
          lineIds: ['2', 'sb'],
          stationName: '강남',
          alias: '회사',
          destinationLabel: '잠실 방면',
          congestion: 'high',
          nextMinutes: 1,
          secondsLeft: 104, // 1분 44초
        },
        {
          id: 'sample-fav-hongdae',
          lineIds: ['2', 'gj'],
          stationName: '홍대입구',
          alias: '집',
          destinationLabel: '시청 방면',
          congestion: 'mid',
          nextMinutes: 4,
        },
        {
          id: 'sample-fav-jamsil',
          lineIds: ['2', '8'],
          stationName: '잠실',
          destinationLabel: '모란 방면',
          congestion: 'low',
          nextMinutes: 7,
        },
      ] as const)
    : null;

/**
 * Dev-only sample community delay — mirrors the design handoff:
 *   "강남역 신호장애 · 검증됨 · 교대~강남 구간 약 5분 정차 중 · 12분 전 · 47명 확인"
 */
const DEV_SAMPLE_DELAY =
  __DEV__ && process.env.NODE_ENV !== 'test'
    ? ({
        lineId: '2' as const,
        lineName: '2호선',
        title: '강남역 신호장애',
        description: '교대~강남 구간 약 5분 정차 중',
        timestampLabel: '12분 전 · 47명 확인',
        verified: true,
      } as const)
    : null;

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteStations, setFavoriteStations] = useState<Station[]>([]);
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
    radius: 1000,
    maxStations: 5,
    autoUpdate: true,
    minUpdateInterval: 30000,
  });

  const { delays: activeDelays } = useDelayDetection({
    pollingInterval: 60000,
    autoPolling: true,
    enabled: isFocused,
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
  //   3. DEV_SAMPLE_COMMUTE                      — design preview only, tree-shaken
  //                                                 in release bundles AND suppressed
  //                                                 whenever a real morningCommute is
  //                                                 registered (the sample must never
  //                                                 mask the user's actual route)
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
    // A registered commute exists but its hero data hasn't resolved (route
    // graph search not ready). Return null instead of the dev sample so the
    // slot falls to the placeholder rather than showing a fake route — the
    // sample is a design preview, never a stand-in for real user data.
    if (morningCommute) return null;
    if (!DEV_SAMPLE_COMMUTE) return null;
    return {
      predictedMinutes: DEV_SAMPLE_COMMUTE.predictedMinutes,
      deltaMinutes: DEV_SAMPLE_COMMUTE.deltaMinutes,
      arrivalTime: DEV_SAMPLE_COMMUTE.predictedArrivalTime,
      confidence: DEV_SAMPLE_COMMUTE.confidence,
      origin: DEV_SAMPLE_COMMUTE.origin,
      destination: DEV_SAMPLE_COMMUTE.destination,
    };
  }, [heroProps, registeredCommuteHero, morningCommute]);

  const effectiveNames = useMemo(() => {
    if (commuteStationNames.origin) return commuteStationNames;
    // Same rule as effectiveHero: never let the dev sample override a real
    // registered commute, even when its station names are still resolving.
    if (morningCommute || !DEV_SAMPLE_COMMUTE) return commuteStationNames;
    return {
      origin: DEV_SAMPLE_COMMUTE.origin,
      destination: DEV_SAMPLE_COMMUTE.destination,
      originLineId: DEV_SAMPLE_COMMUTE.originLineId,
    };
  }, [commuteStationNames, morningCommute]);

  const effectiveRouteFacts = useMemo(() => {
    // Real routeSummary takes precedence; fall back to sample for facts grid.
    const realFacts =
      routeSummary.transferCount !== undefined ||
      routeSummary.stationCount !== undefined ||
      routeSummary.fareKrw !== undefined;
    if (realFacts) return routeSummary;
    // Dev sample suppressed when a real commute is registered (see above) —
    // the fact grid simply hides until graph search resolves.
    if (morningCommute || !DEV_SAMPLE_COMMUTE) return routeSummary;
    return {
      ...routeSummary,
      transferCount: DEV_SAMPLE_COMMUTE.transferCount,
      stationCount: DEV_SAMPLE_COMMUTE.stationCount,
      fareKrw: DEV_SAMPLE_COMMUTE.fareKrw,
    };
  }, [routeSummary, morningCommute]);

  const effectiveDepartureTime =
    mlPrediction?.predictedDepartureTime ??
    morningCommute?.departureTime ??
    DEV_SAMPLE_COMMUTE?.predictedDepartureTime;

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

  const loadFavoriteStations = useCallback(async (): Promise<void> => {
    if (!user?.preferences.favoriteStations.length) {
      setFavoriteStations([]);
      return;
    }
    try {
      const ids = user.preferences.favoriteStations.map((f) => f.stationId);
      const stations: Station[] = [];
      for (const stationId of ids.slice(0, 5)) {
        const s = await trainService.getStation(stationId);
        if (s) stations.push(s);
      }
      setFavoriteStations(stations);
    } catch {
      // Empty state covers visual case
    }
  }, [user?.preferences.favoriteStations]);

  const initializeScreen = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationPermission(granted);
      await loadFavoriteStations();
    } catch {
      showError('데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [loadFavoriteStations, showError]);

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
  const handleOpenCommuteSettings = useCallback((): void => {
    const navigateToSettings = navigation.navigate as (
      route: 'Profile',
      params: { screen: 'CommuteSettings' },
    ) => void;
    navigateToSettings('Profile', { screen: 'CommuteSettings' });
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
      } else {
        await loadFavoriteStations();
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadFavoriteStations, locationPermission, refreshNearby]);

  useEffect(() => {
    initializeScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearbyList = locationPermission ? hookNearbyStations : favoriteStations;

  // Dev sample policy (2026-05-06 review pass): in dev simulator we ALWAYS
  // prefer the design-handoff sample so the card layout (line badges,
  // station name, walk meta) is stable across mounts. The bottom-half
  // (arrival/congestion) is intentionally omitted in this slot — those
  // cues live in "즐겨찾는 역". Production/jest are unaffected because
  // DEV_SAMPLE_* is null there.
  const useSampleNearby = DEV_SAMPLE_NEARBY !== null;
  const showNearbySection = useSampleNearby || nearbyList.length > 0;

  const useSampleFavorites = DEV_SAMPLE_FAVORITES !== null;
  const showFavoritesSection = useSampleFavorites || favoriteStations.length > 0;

  const useSampleDelay = DEV_SAMPLE_DELAY !== null;
  const showCommunitySection = useSampleDelay || activeDelays.length > 0;

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
            {useSampleNearby
              ? DEV_SAMPLE_NEARBY!.map((s) => (
                  <NearbyStationCard
                    key={s.id}
                    lineIds={[...s.lineIds]}
                    stationName={s.stationName}
                    distanceM={s.distanceM}
                    walkMin={s.walkMin}
                    exitNumber={s.exitNumber}
                    testID={`home-nearby-${s.id}`}
                  />
                ))
              : nearbyList.map((station) => {
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

      {/* 6. 즐겨찾는 역 — real favorites preferred; falls back to dev
          samples in dev simulator (DEV_SAMPLE_FAVORITES tree-shakes in
          release / jest). Empty state inside the section keeps the slot
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
            {useSampleFavorites
              ? DEV_SAMPLE_FAVORITES!.map((s, idx) => {
                  const isFirst = idx === 0;
                  const showImminent =
                    isFirst && typeof s.secondsLeft === 'number';
                  return (
                    <FavoriteRow
                      key={s.id}
                      lines={[...s.lineIds]}
                      stationName={s.stationName}
                      nickname={s.alias ?? null}
                      destinationLabel={s.destinationLabel}
                      congestion={s.congestion}
                      nextMinutes={s.nextMinutes}
                      imminent={showImminent}
                      testID={`home-favorite-${s.id}`}
                    />
                  );
                })
              : favoriteStations.map((station, idx) => {
                  const fav = user?.preferences.favoriteStations.find(
                    (f) => f.stationId === station.id,
                  );
                  const isFirst = idx === 0;
                  return (
                    <HomeFavoriteRow
                      key={station.id}
                      station={station}
                      alias={fav?.alias}
                      isFocused={isFocused}
                      isFirst={isFirst}
                      onPress={() => handleStationPress(station)}
                    />
                  );
                })}
          </View>
        )}
      </View>

      {/* 7. 실시간 제보 — real activeDelays preferred; dev sample renders
          when there are no real delays so the design preview is complete. */}
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
            {useSampleDelay && DEV_SAMPLE_DELAY ? (
              <CommunityDelayCard
                line={DEV_SAMPLE_DELAY.lineId}
                title={DEV_SAMPLE_DELAY.title}
                description={DEV_SAMPLE_DELAY.description}
                verified={DEV_SAMPLE_DELAY.verified}
                timestampLabel={DEV_SAMPLE_DELAY.timestampLabel}
                onPress={onPressDelayCard}
                testID="home-community-delay-card"
              />
            ) : (
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
            )}
          </View>
        )}
      </View>

      <ToastComponent />
    </ScrollView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
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
