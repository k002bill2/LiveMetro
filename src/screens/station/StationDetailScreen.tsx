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
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AlertCircle, Moon } from 'lucide-react-native';

import { AppStackParamList } from '../../navigation/types';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
// TODO(혼잡도): 실시간 혼잡도 표시 비활성 — 서울시 AI 실시간 혼잡도 소스 공개 시 복원
// import { useCongestion } from '@/hooks/useCongestion';
import { usePublicDataForStation } from '@/hooks/usePublicData';
import { useFavorites } from '@/hooks/useFavorites';
import { useAutoCommuteLog } from '@/hooks/useAutoCommuteLog';
import { useWeatherAlert } from '@/hooks/useWeatherAlert';
import { AlertBanner } from '@/components/common/AlertBanner';
import { StationDetailHeader } from '@/components/station/StationDetailHeader';
import { DirectionSegment } from '@/components/station/DirectionSegment';
import { ArrivalCard } from '@/components/station/ArrivalCard';
import { ExitInfoGrid } from '@/components/station/ExitInfoGrid';
import { StationTimetableSection } from '@/components/station/StationTimetableSection';
import type { TrainCongestionSummary } from '@/models/congestion';
import { carsToPercentages } from '@/utils/congestionDisplay';
import {
  getBoardingSelection,
  clearBoardingSelection,
  boardingSelectionMatches,
} from '@/services/train/boardingSelectionStore';
import type { Station, Train } from '@/models/train';
import type { LineId } from '@/components/design';
import { mapCacheService, type CachedStation } from '@/services/map/mapCacheService';

/**
 * 서울 지하철 운행 종료 시간대 휴리스틱.
 *
 * 서울 모든 노선의 첫차 ≥ 05:00, 막차 ≤ 01:00(자정 후 약간). 02:00–04:59 KST은
 * 모든 노선 확실히 운행 종료. 그 외 시간에 빈 도착 정보가 오는 경우는 API 일시
 * 빈 응답, 폴링 간격 미스, 또는 진짜 도착 직전 빈 상태 — "운행 종료"가 아닌
 * "잠시 후 다시 확인" 안내가 적절.
 *
 * jest.config의 `process.env.TZ = 'Asia/Seoul'` pin으로 로컬·CI 결정적
 * (메모리: [TZ-naive Date.getHours CI 회귀] 회피).
 */
const isOperatingEndHours = (now: Date): boolean => {
  const h = now.getHours();
  return h >= 2 && h < 5;
};

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

  // 1Hz tick — 도착 카드의 "초" 카운트다운을 매초 갱신한다. arrivalViews는
  // 폴링(30초) 주기에만 재계산되므로 tick이 없으면 "초" 표시가 얼어붙어 false
  // precision이 발생한다 (메모리: feedback_no_subminute_countdown_false_precision,
  // feedback_usememo_stale_new_date_prop_sync). 시계 SoT는 이 부모 한 곳 —
  // ArrivalCard는 갱신된 minutes/seconds props를 받아 표시만 한다.
  // isFocused 게이트로 비활성 화면에서는 tick을 멈춘다 (subscription-cleanup).
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isFocused) return;
    setNowMs(Date.now());
    const tickId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tickId);
  }, [isFocused]);

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

  useAutoCommuteLog({
    stationId,
    stationName,
    lineId,
    enabled: isFocused,
  });

  // 악천후(moderate/severe) 시 weather SubwayAlert을 생성하여 기존 alerts와 합침.
  // 호출자 화면별로 enabled 가드 — 비활성 화면에서 30분 interval 폴링 방지.
  const weatherAlert = useWeatherAlert({ enabled: isFocused });
  const combinedAlerts = useMemo(
    () => (weatherAlert ? [weatherAlert, ...alerts] : alerts),
    [weatherAlert, alerts],
  );

  // 환승역(예: 신설동 — 1·2·우이신설)에서 realtime API는 역에 도착하는 모든
  // 노선의 열차를 반환한다. 이 화면은 한 노선(lineId)의 상세이므로 해당 노선
  // 열차만 남겨 타 노선이 섞여 표시되는 것을 막는다.
  //
  // lineId가 1–9 숫자 노선일 때만 필터한다 — 연장·광역 노선(분당선 등)은
  // realtime subwayId 정규화 형식이 route lineId와 달라 strict 비교가 화면을
  // 통째로 비울 수 있으므로 그 경우 기존 동작(전체 표시)을 보존한다.
  const lineFilteredTrains = useMemo<Train[]>(() => {
    const all = trains ?? [];
    if (!/^[1-9]$/.test(lineId)) return all;
    return all.filter((t) => t.lineId === lineId);
  }, [trains, lineId]);

  // Split trains by direction once and reuse across views.
  const trainsByDirection = useMemo(() => {
    const up: Train[] = [];
    const down: Train[] = [];
    for (const t of lineFilteredTrains) {
      (t.direction === 'down' ? down : up).push(t);
    }
    return { up, down };
  }, [lineFilteredTrains]);

  // 탑승 시작한 선택을 이 화면의 reactive state로 끌어올린다. 매칭되면 (1) 해당
  // 방향으로 전환하고 (2) store를 즉시 비운다(consume-on-read). 두 가지를 한다:
  //   - clear: module 싱글턴이 세션 내내 살아남아 이후 무관한 재방문 때 stale하게
  //     재적용되는 것을 막는다 (코드리뷰 #1).
  //   - state로 승격: 같은 방향(예: 상행→상행) 선택이라 setDirection이 no-op이어도
  //     boardingTarget 변경이 orderedTrains를 즉시 재계산시켜 reorder가 폴링을
  //     기다리지 않고 바로 반영된다 (코드리뷰 #2).
  const [boardingTarget, setBoardingTarget] = useState<{
    direction: 'up' | 'down';
    finalDestination: string;
  } | null>(null);
  useEffect(() => {
    if (!isFocused) return;
    const sel = getBoardingSelection();
    if (!boardingSelectionMatches(sel, { stationId, stationName, lineId })) return;
    clearBoardingSelection();
    setBoardingTarget({ direction: sel.direction, finalDestination: sel.finalDestination });
    setDirection(sel.direction);
  }, [isFocused, stationId, stationName, lineId]);

  // 선택된 boarding 열차를 최상단으로 끌어올린 방향별 리스트. boardingTarget(state)이
  // dep이라 reactive하게 재계산된다. 매칭/선택이 없으면 원래 순서 그대로 — 기존 동작
  // 보존. orderedTrains는 arrivalViews(+isFirst 강조)의 공통 SoT.
  const orderedTrains = useMemo<Train[]>(() => {
    const list = direction === 'up' ? trainsByDirection.up : trainsByDirection.down;
    if (!boardingTarget || boardingTarget.direction !== direction) return list;
    const idx = list.findIndex((t) => t.finalDestination === boardingTarget.finalDestination);
    const matched = idx > 0 ? list[idx] : undefined;
    if (!matched) return list;
    return [matched, ...list.slice(0, idx), ...list.slice(idx + 1)];
  }, [direction, trainsByDirection, boardingTarget]);

  // TODO(혼잡도): 실시간 혼잡도 비활성 — 복원 시 focusedTrain 및 아래 useCongestion
  //   주석 해제하고 `const trainCongestion = null` 라인 삭제. (서울시 AI 소스 대기)
  // const focusedTrain: Train | undefined = orderedTrains[0];
  // const { trainCongestion } = useCongestion({
  //   lineId,
  //   trainId: focusedTrain?.id,
  //   direction,
  //   autoSubscribe: !!focusedTrain,
  // });
  // null 단언 캐스트: 죽은 분기의 narrowing 유지 (const-narrowing이 never로 좁히는 것 방지)
  const trainCongestion = null as TrainCongestionSummary | null;

  const carCongestionPct = useMemo(() => {
    if (!trainCongestion?.cars?.length) return undefined;
    // 공유 SoT 유틸 사용 — StationDetail 전용 LEVEL_TO_PCT 중복 제거 (코드리뷰 #7).
    return carsToPercentages(trainCongestion.cars);
  }, [trainCongestion]);

  // nowMs(1Hz tick)를 deps에 포함 → 매초 재계산되어 초 카운트다운이 흐른다.
  // orderedTrains를 소스로 사용 → boarding 선택 열차가 최상단(isFirst)에 온다.
  const arrivalViews = useMemo<ArrivalView[]>(
    () => orderedTrains.map((t) => trainToArrival(t, nowMs)),
    [orderedTrains, nowMs]
  );

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

  const handleOpenTrainSelect = useCallback(() => {
    navigation.navigate('TrainSelection', {
      stationId: stationId ?? '',
      stationName,
      lineId,
    });
  }, [navigation, stationId, stationName, lineId]);

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

      {combinedAlerts.length > 0 ? (
        <View style={styles.alertWrap}>
          <AlertBanner alerts={combinedAlerts} testID="station-detail-alerts" />
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
              {isOperatingEndHours(new Date())
                ? '운행 종료 시간대입니다'
                : '잠시 후 다시 확인해주세요'}
            </Text>
            {/* 빈 상태는 일시적 API 빈 응답일 수 있어 수동 재시도를 제공한다.
                에러 상태(위)에만 있던 affordance를 빈 상태에도 추가. */}
            <Text
              accessible
              accessibilityRole="button"
              accessibilityLabel="열차 정보 다시 불러오기"
              onPress={refetchTrains}
              style={[styles.retryText, { color: semantic.primaryNormal }]}
              testID="station-detail-empty-retry"
            >
              다시 시도
            </Text>
          </View>
        ) : (
          <>
            {/* 탑승 열차 선택 화면 진입 — 도착 카드가 있을 때만 노출. */}
            <TouchableOpacity
              testID="station-detail-train-select"
              onPress={handleOpenTrainSelect}
              style={[styles.trainSelectButton, { backgroundColor: semantic.primaryNormal }]}
              accessible
              accessibilityRole="button"
              accessibilityLabel="탑승 열차 선택"
              accessibilityHint="탑승할 열차를 선택하면 칸별 혼잡도와 도착 시간을 안내합니다"
            >
              <Text style={styles.trainSelectText}>탑승 열차 선택</Text>
            </TouchableOpacity>
            {arrivalViews.map((arrival, idx) => (
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
                // TODO(혼잡도): 실시간 혼잡도 비활성 동안 빈 placeholder도 숨김.
                //   복원 시 `idx === 0` 으로 되돌릴 것.
                showEmptyCongestion={false}
                testID={`station-detail-arrival-${idx}`}
              />
            ))}
          </>
        )}
      </View>

      <StationTimetableSection
        stationName={stationName}
        lineId={lineId}
        direction={direction}
        enabled={isFocused}
        testID="station-detail-timetable"
      />

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
  trainSelectButton: {
    paddingVertical: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: WANTED_TOKENS.spacing.s1,
  },
  trainSelectText: {
    color: '#FFFFFF',
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
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
