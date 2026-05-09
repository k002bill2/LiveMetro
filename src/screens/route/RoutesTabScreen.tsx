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
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Search } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useNearbyStations } from '@/hooks/useNearbyStations';
import { useRouteSearch, type DepartureMode } from '@/hooks/useRouteSearch';
import { StationSearchBar } from '@/components/route/StationSearchBar';
import { TimeChipRow } from '@/components/route/TimeChipRow';
import { StationPickerModal } from '@/components/route/StationPickerModal';
import { RouteCard } from '@/components/route/RouteCard';

interface StationLite {
  id: string;
  name: string;
}

export const RoutesTabScreen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const { closestStation } = useNearbyStations({
    radius: 1000,
    maxStations: 1,
    autoUpdate: false,
    minUpdateInterval: 30000,
  });

  const [fromStation, setFromStation] = useState<StationLite | null>(null);
  const [toStation, setToStation] = useState<StationLite | null>(null);
  const [departureMode, setDepartureMode] = useState<DepartureMode>('now');
  const [departureTime, setDepartureTime] = useState<Date | null>(null);
  const [pickerSlot, setPickerSlot] = useState<'from' | 'to' | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Seed closest station to fromStation when it first becomes available.
  // Only seeds while fromStation is null — user explicit clears stick.
  useEffect(() => {
    if (!fromStation && closestStation) {
      setFromStation({ id: closestStation.id, name: closestStation.name });
    }
  }, [closestStation, fromStation]);

  const { routes, loading, error, refetch } = useRouteSearch({
    fromId: fromStation?.id,
    toId: toStation?.id,
    departureTime,
    departureMode,
  });

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
          <Text style={styles.emptyTitle}>경로를 검색해 보세요</Text>
          <Text style={styles.emptyBody}>
            출발역과 도착역을 선택하면 가장 빠른 경로를 비교해드려요.
          </Text>
        </View>
      );
    }

    if (loading && routes.length === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={semantic.primaryNormal} />
          <Text style={styles.loadingText}>경로를 계산 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: semantic.statusNegative }]}>{error}</Text>
          <Pressable style={styles.retry} onPress={refetch} accessibilityRole="button">
            <Text style={[styles.retryText, { color: semantic.primaryNormal }]}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }

    if (routes.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>이 시간대에 가능한 경로가 없습니다</Text>
        </View>
      );
    }

    return (
      <View>
        {routes.map((route, idx) => (
          <RouteCard
            key={route.id}
            route={route}
            expanded={expandedRouteId === route.id}
            recommended={idx === 0}
            onToggleExpand={(): void => handleToggleExpand(route.id)}
          />
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={semantic.primaryNormal}
        />
      }
      testID="routes-tab-screen"
    >
      <Text style={styles.title}>경로 검색</Text>

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

      <StationPickerModal
        visible={pickerSlot !== null}
        onClose={handleClosePicker}
        onSelect={handleSelect}
        recentStations={[]}
      />
    </ScrollView>
  );
};

RoutesTabScreen.displayName = 'RoutesTabScreen';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: semantic.bgSubtlePage },
    content: { padding: WANTED_TOKENS.spacing.s4 },
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
