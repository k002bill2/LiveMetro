/**
 * StationDetailScreen — 역 상세 화면 (Wanted Design System).
 *
 * Phase 7 rewrite: orchestrator only. Visual presentation lives in
 *   - StationDetailHeader  (top bar + hero)
 *   - DirectionSegment     (상행/하행)
 *   - ArrivalCard          (single arrival, optional per-car congestion)
 *   - ExitInfoGrid         (출구 안내)
 *
 * Removed from the previous implementation per the Wanted handoff:
 *   - 4-tab control (출발/도착/시간표/즐겨찾기)
 *   - AccessibilitySection
 *   - WebView map preview
 *   - Adjacent station switcher
 *   - LiveClock + manual refresh + GPS chip in the header
 *   - 시간표 tab (TrainSchedule hook)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AlertCircle, Moon } from 'lucide-react-native';

import { AppStackParamList } from '../../navigation/types';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useCongestion } from '@/hooks/useCongestion';
import { usePublicDataForStation } from '@/hooks/usePublicData';
import { useFavorites } from '@/hooks/useFavorites';
import { AlertBanner } from '@/components/common/AlertBanner';
import { StationDetailHeader } from '@/components/station/StationDetailHeader';
import { DirectionSegment } from '@/components/station/DirectionSegment';
import { ArrivalCard } from '@/components/station/ArrivalCard';
import { ExitInfoGrid } from '@/components/station/ExitInfoGrid';
import { CongestionLevel } from '@/models/congestion';
import type { Station, Train } from '@/models/train';
import type { LineId } from '@/components/design';
import { mapCacheService, type CachedStation } from '@/services/map/mapCacheService';

type StationDetailRouteProp = RouteProp<AppStackParamList, 'StationDetail'>;
type StationDetailNavProp = NativeStackNavigationProp<AppStackParamList>;

interface ArrivalView {
  id: string;
  line: LineId;
  destination: string;
  minutes: number;
  seconds: number;
  delayMinutes: number;
}

const REFETCH_INTERVAL_MS = 30_000;

/** Center-of-band percentages for each congestion level (drives the bar fill). */
const LEVEL_TO_PCT: Record<CongestionLevel, number> = {
  [CongestionLevel.LOW]: 20,
  [CongestionLevel.MODERATE]: 50,
  [CongestionLevel.HIGH]: 80,
  [CongestionLevel.CROWDED]: 95,
};

const trainToArrival = (train: Train, now: number): ArrivalView => {
  const total = train.arrivalTime
    ? Math.max(0, Math.floor((train.arrivalTime.getTime() - now) / 1000))
    : 0;
  return {
    id: train.id,
    line: train.lineId as LineId,
    destination: train.finalDestination,
    minutes: Math.floor(total / 60),
    seconds: total % 60,
    delayMinutes: train.delayMinutes ?? 0,
  };
};

const StationDetailScreen: React.FC = () => {
  const route = useRoute<StationDetailRouteProp>();
  const navigation = useNavigation<StationDetailNavProp>();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const {
    stationId,
    stationName = '강남',
    lineId = '2',
  } = route.params || {};

  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [stationMeta, setStationMeta] = useState<CachedStation | null>(null);

  // Fetch station meta (nameEn, stationCode, transfer line ids) for the
  // header subtitle + multi-line badges. Reset when the station changes so
  // the previous station's badges don't briefly flash on navigation.
  useEffect(() => {
    let cancelled = false;
    setStationMeta(null);
    (async () => {
      try {
        const matches = await mapCacheService.searchStations(stationName);
        if (cancelled) return;
        const exact = matches.find((s) => s.name === stationName) ?? null;
        setStationMeta(exact);
      } catch {
        if (!cancelled) setStationMeta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stationName]);

  const isFocused = useIsFocused();
  const {
    trains,
    loading: trainsLoading,
    error: trainsError,
    refetch: refetchTrains,
  } = useRealtimeTrains(stationName, {
    enabled: isFocused,
    refetchInterval: REFETCH_INTERVAL_MS,
    retryAttempts: 3,
  });

  const { exitInfo, alerts } = usePublicDataForStation(stationName, {
    lineName: `${lineId}호선`,
  });

  const { isFavorite, toggleFavorite } = useFavorites();

  // Split trains by direction once and reuse across views.
  const trainsByDirection = useMemo(() => {
    const up: Train[] = [];
    const down: Train[] = [];
    for (const t of trains ?? []) {
      (t.direction === 'down' ? down : up).push(t);
    }
    return { up, down };
  }, [trains]);

  const focusedTrain: Train | undefined =
    direction === 'up' ? trainsByDirection.up[0] : trainsByDirection.down[0];

  const { trainCongestion } = useCongestion({
    lineId,
    trainId: focusedTrain?.id,
    direction,
    autoSubscribe: !!focusedTrain,
  });

  const carCongestionPct = useMemo(() => {
    if (!trainCongestion?.cars?.length) return undefined;
    return trainCongestion.cars.map((c) => LEVEL_TO_PCT[c.congestionLevel] ?? 0);
  }, [trainCongestion]);

  const arrivalViews = useMemo<ArrivalView[]>(() => {
    const list = direction === 'up' ? trainsByDirection.up : trainsByDirection.down;
    const now = Date.now();
    return list.map((t) => trainToArrival(t, now));
  }, [direction, trainsByDirection]);

  // Header subtitle mirrors the design handoff (`Gangnam · 222 · ...`).
  // Cross-line station codes (e.g. "신분당 D07") aren't in CachedTransfer,
  // so this falls back to a 2-part `${nameEn} · ${stationCode}` form when
  // available.
  const headerSubtitle = useMemo<string | undefined>(() => {
    if (!stationMeta) return undefined;
    const nameEn = stationMeta.nameEn?.trim();
    const code = stationMeta.id?.trim();
    if (nameEn && code) return `${nameEn} · ${code}`;
    return nameEn || code || undefined;
  }, [stationMeta]);

  const headerLines = useMemo<readonly LineId[]>(() => {
    const ids = stationMeta?.lineIds;
    if (ids && ids.length > 0) return ids as readonly LineId[];
    return [lineId as LineId];
  }, [stationMeta, lineId]);

  const upLabel = useMemo(
    () => `상행${trainsByDirection.up[0] ? ` (${trainsByDirection.up[0].finalDestination})` : ''}`,
    [trainsByDirection.up]
  );
  const downLabel = useMemo(
    () => `하행${trainsByDirection.down[0] ? ` (${trainsByDirection.down[0].finalDestination})` : ''}`,
    [trainsByDirection.down]
  );

  const stationLike: Station = useMemo(
    () => ({
      id: stationId || `${stationName}-${lineId}`,
      name: stationName,
      nameEn: '',
      lineId,
      coordinates: { latitude: 0, longitude: 0 },
      transfers: [],
    }),
    [stationId, stationName, lineId]
  );

  const isCurrentlyFavorite = isFavorite(stationLike.id);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${stationName}역 ${lineId}호선 실시간 도착 정보`,
      });
    } catch {
      // 사용자 취소 또는 공유 불가 — 조용히 실패
    }
  }, [stationName, lineId]);

  const handleToggleFavorite = useCallback(async () => {
    try {
      await toggleFavorite(stationLike);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }, [toggleFavorite, stationLike]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: semantic.bgSubtlePage }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <StationDetailHeader
        stationName={stationName}
        subtitle={headerSubtitle}
        lines={headerLines}
        isFavorite={isCurrentlyFavorite}
        onBack={handleBack}
        onShare={handleShare}
        onToggleFavorite={handleToggleFavorite}
        testID="station-detail-header"
      />

      {alerts.length > 0 ? (
        <View style={styles.alertWrap}>
          <AlertBanner alerts={alerts} testID="station-detail-alerts" />
        </View>
      ) : null}

      <View style={styles.segmentWrap}>
        <DirectionSegment
          value={direction}
          upLabel={upLabel}
          downLabel={downLabel}
          onChange={setDirection}
          testID="station-detail-direction"
        />
      </View>

      <View style={styles.arrivalsWrap}>
        {trainsLoading ? (
          <View style={styles.statePanel} testID="station-detail-loading">
            <ActivityIndicator size="large" color={semantic.primaryNormal} />
            <Text style={[styles.stateText, { color: semantic.labelNeutral }]}>
              열차 정보를 불러오는 중...
            </Text>
          </View>
        ) : trainsError ? (
          <View style={styles.statePanel} testID="station-detail-error">
            <AlertCircle size={48} color={WANTED_TOKENS.status.red500} />
            <Text style={[styles.stateText, { color: semantic.labelNeutral }]}>
              {trainsError}
            </Text>
            <Text
              accessible
              accessibilityRole="button"
              onPress={refetchTrains}
              style={[styles.retryText, { color: semantic.primaryNormal }]}
            >
              다시 시도
            </Text>
          </View>
        ) : arrivalViews.length === 0 ? (
          <View style={styles.statePanel} testID="station-detail-empty">
            <Moon size={48} color={semantic.labelAlt} />
            <Text style={[styles.stateText, { color: semantic.labelNeutral }]}>
              현재 운행 중인 열차가 없습니다
            </Text>
            <Text style={[styles.stateSub, { color: semantic.labelAlt }]}>
              운행 종료 시간대입니다
            </Text>
          </View>
        ) : (
          arrivalViews.map((arrival, idx) => (
            <ArrivalCard
              key={arrival.id}
              line={arrival.line}
              destination={arrival.destination}
              minutes={arrival.minutes}
              seconds={arrival.seconds}
              delayMinutes={arrival.delayMinutes}
              isFirst={idx === 0}
              carCongestion={idx === 0 ? carCongestionPct : undefined}
              // Phase 55: surface a friendly placeholder on the focused
              // (first) arrival when congestion data hasn't loaded yet —
              // avoids the prior "blank space" UX when subscribe fails.
              showEmptyCongestion={idx === 0}
              testID={`station-detail-arrival-${idx}`}
            />
          ))
        )}
      </View>

      <View style={styles.sectionHeaderWrap}>
        <Text style={[styles.sectionHeader, { color: semantic.labelStrong }]}>
          출구 안내
        </Text>
      </View>
      <View style={styles.exitWrap}>
        <ExitInfoGrid exits={exitInfo} max={6} testID="station-detail-exits" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  alertWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s2,
  },
  segmentWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  arrivalsWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    gap: WANTED_TOKENS.spacing.s2,
  },
  statePanel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s8,
    gap: WANTED_TOKENS.spacing.s3,
  },
  stateText: {
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    textAlign: 'center',
  },
  stateSub: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    textAlign: 'center',
  },
  retryText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  sectionHeaderWrap: {
    paddingTop: WANTED_TOKENS.spacing.s6,
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  sectionHeader: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    lineHeight: WANTED_TOKENS.type.heading2.lh,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  exitWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
});

export default React.memo(StationDetailScreen);
