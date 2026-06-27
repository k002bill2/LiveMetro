/**
 * RoutesTabScreen — entry screen for the bottom tab "경로".
 *
 * Full RoutesScreen implementation per Wanted bundle rest.jsx:7-142.
 * Composes inline search bar + time chip row + multi-route cards into a
 * single orchestrator. ML metadata (ETA confidence, delay risk) is supplied
 * by the useRouteSearch adapter hook; this screen owns only state and
 * picker modal toggle, no direct service/hook composition.
 *
 * Spec: docs/superpowers/specs/2026-05-09-routes-screen-design.md
 */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTranslation } from '@/services/i18n';
import { useNearbyStations } from '@/hooks/useNearbyStations';
import { useRouteSearch, type DepartureMode, type RouteWithMLMeta } from '@/hooks/useRouteSearch';
import { routeService } from '@/services/route';
import { setGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import type { AppStackParamList, RouteSearchInitialParams } from '@/navigation/types';
import type { RouteSortTab } from '@/models/route';
import { STATIONS as GRAPH_STATIONS, isRoutableStation } from '@/utils/subwayMapData';
import { resolveInternalStationId } from '@/utils/stationIdResolver';
import { StationSearchBar } from '@/components/route/StationSearchBar';
import { TimeChipRow } from '@/components/route/TimeChipRow';
import { StationPickerModal } from '@/components/route/StationPickerModal';
import { RouteSortTabs } from '@/components/route/RouteSortTabs';
import { RouteCard } from '@/components/route/RouteCard';

interface StationLite {
  id: string;
  name: string;
}

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type RoutesTabRouteProp = RouteProp<{ Routes: RouteSearchInitialParams | undefined }, 'Routes'>;

const resolveRoutableInitialStationId = (stationId: string, stationName: string): string | null => {
  const resolvedId = resolveInternalStationId(stationId);
  if (resolvedId && isRoutableStation(resolvedId)) return resolvedId;

  const graphMatch = Object.values(GRAPH_STATIONS).find(
    (station) => station.name === stationName && isRoutableStation(station.id)
  );
  return graphMatch?.id ?? null;
};

export const RoutesTabScreen: React.FC = () => {
  const semantic = useSemanticTokens();
  const t = useTranslation();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutesTabRouteProp>();
  const initialParams = route.params;
  const preferredLineId = initialParams?.preferredLineId;

  const initialFromStation = useMemo<StationLite | null>(() => {
    if (!initialParams?.fromStationId || !initialParams.fromStationName) return null;
    const id = resolveRoutableInitialStationId(initialParams.fromStationId, initialParams.fromStationName);
    return id
      ? { id, name: initialParams.fromStationName }
      : null;
  }, [initialParams?.fromStationId, initialParams?.fromStationName]);

  const initialToStation = useMemo<StationLite | null>(() => {
    if (!initialParams?.toStationId || !initialParams.toStationName) return null;
    const id = resolveRoutableInitialStationId(initialParams.toStationId, initialParams.toStationName);
    return id
      ? { id, name: initialParams.toStationName }
      : null;
  }, [initialParams?.toStationId, initialParams?.toStationName]);
  const hasInitialCommuteRoute = initialParams?.source === 'commute' && !!initialFromStation && !!initialToStation;

  // 비포커스 탭에서 useRouteSearch 내부 useDelayDetection의 9개 대표역 폴링을
  // 멈춘다 — bottom-tab은 blur 시 unmount되지 않아 게이트가 없으면 영구 폴링한다.
  const isFocused = useIsFocused();

  const { closestStation } = useNearbyStations({
    radius: 1000,
    maxStations: 1,
    autoUpdate: false,
    minUpdateInterval: 30000,
  });

  const [fromStation, setFromStation] = useState<StationLite | null>(initialFromStation);
  const [toStation, setToStation] = useState<StationLite | null>(initialToStation);
  const [departureMode, setDepartureMode] = useState<DepartureMode>('now');
  const [departureTime, setDepartureTime] = useState<Date | null>(null);
  const [pickerSlot, setPickerSlot] = useState<'from' | 'to' | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sortTab, setSortTab] = useState<RouteSortTab>('optimal');

  useEffect(() => {
    if (initialParams && !initialFromStation && !initialToStation) {
      setFromStation(null);
      setToStation(null);
      setExpandedRouteId(null);
      return;
    }
    if (!initialFromStation && !initialToStation) return;
    setFromStation(initialFromStation);
    setToStation(initialToStation);
    setExpandedRouteId(null);
  }, [initialParams, initialFromStation, initialToStation]);

  // Seed closest station to fromStation when it first becomes available.
  // Only seeds while fromStation is null — user explicit clears stick.
  // closestStation.id comes from trainService (Firestore/station_cd), but
  // useRouteSearch needs the routing graph's slug id, so we resolve by name.
  // If the closest station isn't in the graph, skip seeding rather than
  // populating a non-routable id.
  useEffect(() => {
    if (!fromStation && !initialFromStation && closestStation) {
      const graphMatch = Object.values(GRAPH_STATIONS).find(
        (s) => s.name === closestStation.name
      );
      // Only seed when the matched station is also wired into a line's order
      // — otherwise routeService cannot reach any neighbor from it and the
      // user gets a stale "no route" until they manually pick another station.
      if (graphMatch && isRoutableStation(graphMatch.id)) {
        setFromStation({ id: graphMatch.id, name: graphMatch.name });
      }
    }
  }, [closestStation, fromStation, initialFromStation]);

  const { routes, loading, error, refetch } = useRouteSearch({
    fromId: fromStation?.id,
    toId: toStation?.id,
    departureTime,
    departureMode,
    enabled: isFocused,
  });

  // Client-side re-order by the selected sort tab — no re-search. The hook
  // returns the diverse candidate pool; switching tabs only re-sorts it.
  const sortedRoutes = useMemo(
    () => routeService.sortRoutesByTab(routes, sortTab),
    [routes, sortTab]
  );

  const routeSections = useMemo((): {
    currentRoute: RouteWithMLMeta | null;
    suggestedRoutes: RouteWithMLMeta[];
  } => {
    if (!hasInitialCommuteRoute || sortedRoutes.length === 0) {
      return { currentRoute: null, suggestedRoutes: sortedRoutes };
    }
    const preferredIndex = preferredLineId
      ? sortedRoutes.findIndex((candidate) => candidate.lineIds.includes(preferredLineId))
      : -1;
    const currentIndex = preferredIndex >= 0 ? preferredIndex : 0;
    const currentRoute = sortedRoutes[currentIndex] ?? null;
    return {
      currentRoute,
      suggestedRoutes: sortedRoutes.filter((_, index) => index !== currentIndex),
    };
  }, [hasInitialCommuteRoute, preferredLineId, sortedRoutes]);

  const handleSwap = useCallback((): void => {
    setFromStation(toStation);
    setToStation(fromStation);
  }, [fromStation, toStation]);

  const handleSelect = useCallback(
    (station: StationLite): void => {
      if (pickerSlot === 'from') setFromStation(station);
      else if (pickerSlot === 'to') setToStation(station);
      setPickerSlot(null);
    },
    [pickerSlot]
  );

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleToggleExpand = useCallback((id: string): void => {
    setExpandedRouteId((prev) => (prev === id ? null : id));
  }, []);

  // 길안내 시작 — 펼친 카드가 있으면 그 경로, 없으면 1위(추천) 경로.
  // Route payload는 navigation param이 아닌 guidanceSessionStore로 핸드오프.
  const handleStartGuidance = useCallback((): void => {
    const selected =
      sortedRoutes.find((r) => r.id === expandedRouteId) ?? sortedRoutes[0];
    if (!selected || !fromStation || !toStation) return;
    setGuidanceSession({
      route: selected,
      fromStationName: fromStation.name,
      toStationName: toStation.name,
      startedAt: Date.now(),
    });
    navigation.navigate('RouteGuidance');
  }, [sortedRoutes, expandedRouteId, fromStation, toStation, navigation]);

  const handlePressFrom = useCallback((): void => {
    setPickerSlot('from');
  }, []);
  const handlePressTo = useCallback((): void => {
    setPickerSlot('to');
  }, []);
  const handleClosePicker = useCallback((): void => {
    setPickerSlot(null);
  }, []);

  const renderContent = (): React.ReactElement => {
    if (!fromStation || !toStation) {
      return (
        <View style={styles.emptyHint} testID="routes-empty-hint">
          <Search size={36} color={semantic.labelAlt} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t.routes.emptyTitle}</Text>
          <Text style={styles.emptyBody}>
            {t.routes.emptyBody}
          </Text>
        </View>
      );
    }

    if (loading && routes.length === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={semantic.primaryNormal} />
          <Text style={styles.loadingText}>{t.routes.loading}</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: semantic.statusNegative }]}>{error}</Text>
          <Pressable style={styles.retry} onPress={refetch} accessibilityRole="button">
            <Text style={[styles.retryText, { color: semantic.primaryNormal }]}>{t.routes.retry}</Text>
          </Pressable>
        </View>
      );
    }

    if (routes.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t.routes.noRoutes}</Text>
        </View>
      );
    }

    const renderRouteCard = (routeItem: RouteWithMLMeta, recommended: boolean): React.ReactElement => (
      <RouteCard
        key={routeItem.id}
        route={routeItem}
        expanded={expandedRouteId === routeItem.id}
        recommended={recommended}
        activeSortTab={sortTab}
        onToggleExpand={(): void => handleToggleExpand(routeItem.id)}
      />
    );

    return (
      <View>
        <RouteSortTabs value={sortTab} onChange={setSortTab} testID="route-sort-tabs" />
        {routeSections.currentRoute ? (
          <>
            <Text style={styles.sectionTitle}>{t.routes.currentRoute}</Text>
            {renderRouteCard(routeSections.currentRoute, true)}
            {routeSections.suggestedRoutes.length > 0 && (
              <Text style={styles.sectionTitle}>{t.routes.suggestedRoutes}</Text>
            )}
            {routeSections.suggestedRoutes.map((routeItem) => renderRouteCard(routeItem, false))}
          </>
        ) : (
          routeSections.suggestedRoutes.map((routeItem, idx) => renderRouteCard(routeItem, idx === 0))
        )}
      </View>
    );
  };

  const hasRoutes = routes.length > 0 && !loading && !error;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, hasRoutes && styles.contentWithCta]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={semantic.primaryNormal}
          />
        }
        testID="routes-tab-screen"
      >
        <Text style={styles.title}>{t.routes.title}</Text>

        <StationSearchBar
          fromStation={fromStation}
          toStation={toStation}
          onPressFrom={handlePressFrom}
          onPressTo={handlePressTo}
          onSwap={handleSwap}
        />

        <TimeChipRow
          mode={departureMode}
          time={departureTime}
          onChangeMode={setDepartureMode}
          onChangeTime={setDepartureTime}
        />

        {renderContent()}
      </ScrollView>

      {hasRoutes && (
        <View style={[styles.ctaBar, { backgroundColor: semantic.bgBase, borderTopColor: semantic.lineSubtle }]}>
          <Pressable
            style={[styles.ctaButton, { backgroundColor: semantic.primaryNormal }]}
            onPress={handleStartGuidance}
            accessibilityRole="button"
            accessibilityLabel={t.routes.startGuidanceA11y}
            testID="route-start-cta"
          >
            <Text style={styles.ctaText}>{t.routes.startGuidance}</Text>
          </Pressable>
        </View>
      )}

      <StationPickerModal
        visible={pickerSlot !== null}
        onClose={handleClosePicker}
        onSelect={handleSelect}
        recentStations={[]}
      />
    </SafeAreaView>
  );
};

RoutesTabScreen.displayName = 'RoutesTabScreen';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: semantic.bgSubtlePage },
    content: { padding: WANTED_TOKENS.spacing.s4 },
    contentWithCta: { paddingBottom: 96 },
    ctaBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s3,
      paddingBottom: WANTED_TOKENS.spacing.s5,
      borderTopWidth: 1,
    },
    ctaButton: {
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r4,
      alignItems: 'center',
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('700'),
    },
    title: {
      fontSize: WANTED_TOKENS.type.heading1.size,
      lineHeight: WANTED_TOKENS.type.heading1.lh,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    emptyHint: {
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s2,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    emptyBody: {
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    center: { alignItems: 'center', paddingVertical: WANTED_TOKENS.spacing.s8 },
    sectionTitle: {
      fontSize: WANTED_TOKENS.type.label1.size,
      lineHeight: WANTED_TOKENS.type.label1.lh,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    loadingText: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    errorText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('500'),
    },
    retry: { marginTop: WANTED_TOKENS.spacing.s3 },
    retryText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontFamily: weightToFontFamily('700'),
    },
  });

export default RoutesTabScreen;
