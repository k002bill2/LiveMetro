/**
 * TrainSelectionScreen — "탑승 열차 선택" (Wanted Design System).
 *
 * Lets the user pick which upcoming train they intend to board. The chosen
 * train drives:
 *   1. the live arrival countdown shown in the bottom CTA bar, and
 *   2. the per-car congestion + recommended car strip on the selected card.
 *
 * On "이 열차로 탑승 시작" the choice is recorded in `boardingSelectionStore`
 * (keyed by station + line + direction + destination, NOT the volatile train
 * id) and the screen pops back to StationDetail, which then surfaces the chosen
 * train's arrival time as the primary one.
 *
 * Orchestrator only — visual cards live in `SelectableTrainCard`; direction
 * control in `DirectionSegment`.
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AlertCircle, Moon } from 'lucide-react-native';

import { AppStackParamList } from '../../navigation/types';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
// TODO(혼잡도): 실시간 혼잡도 표시 비활성 — 서울시 AI 실시간 혼잡도 소스 공개 시 복원
// import { useCongestion } from '@/hooks/useCongestion';
import { DirectionSegment } from '@/components/station/DirectionSegment';
import { SelectableTrainCard } from '@/components/train/SelectableTrainCard';
import { LineBadge, type LineId } from '@/components/design';
import { recommendCar } from '@/utils/carRecommendation';
import { carsToPercentages } from '@/utils/congestionDisplay';
import { getCongestionLevelName, type TrainCongestionSummary } from '@/models/congestion';
import { setBoardingSelection } from '@/services/train/boardingSelectionStore';
import { scheduleBoardingAlert } from '@/services/notification/boardingAlertService';
import { notificationService } from '@/services/notification/notificationService';
import type { Train } from '@/models/train';
import { directionToDisplay } from '@/models/route';
import { normalizeSeoulLineId } from '@/utils/formatUtils';

type TrainSelectionRouteProp = RouteProp<AppStackParamList, 'TrainSelection'>;
type TrainSelectionNavProp = NativeStackNavigationProp<AppStackParamList>;

const REFETCH_INTERVAL_MS = 30_000;

interface Eta {
  minutes: number;
  seconds: number;
  total: number;
  /** false → arrivalTime null(운행중, no countdown) → show "운행 중" not "곧 도착". */
  hasEta: boolean;
}

const etaOf = (train: Train, now: number): Eta => {
  // 명시적 null 체크 — arrivalTime은 Date|null이며 null은 ETA 미상(운행중)을 의미.
  if (train.arrivalTime === null) {
    return { minutes: 0, seconds: 0, total: 0, hasEta: false };
  }
  const total = Math.max(0, Math.floor((train.arrivalTime.getTime() - now) / 1000));
  return { minutes: Math.floor(total / 60), seconds: total % 60, total, hasEta: true };
};

const TrainSelectionScreen: React.FC = () => {
  const route = useRoute<TrainSelectionRouteProp>();
  const navigation = useNavigation<TrainSelectionNavProp>();
  const semantic = useSemanticTokens();
  const green = WANTED_TOKENS.status.green500;

  const { stationId = '', stationName = '강남', lineId = '2' } = route.params || {};

  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [alertEnabled, setAlertEnabled] = useState<boolean>(true);

  const isFocused = useIsFocused();

  // 1Hz tick — keeps the CTA countdown flowing between 30s polls. isFocused
  // gate stops the timer on inactive screens (subscription-cleanup).
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

  // Transfer-station line filtering — mirrors StationDetailScreen.
  const lineFilteredTrains = useMemo<Train[]>(() => {
    const all = trains ?? [];
    const normalizedLineId = normalizeSeoulLineId(lineId);
    return all.filter((t) => normalizeSeoulLineId(t.lineId) === normalizedLineId);
  }, [trains, lineId]);

  const trainsByDirection = useMemo(() => {
    const up: Train[] = [];
    const down: Train[] = [];
    for (const t of lineFilteredTrains) {
      (t.direction === 'down' ? down : up).push(t);
    }
    return { up, down };
  }, [lineFilteredTrains]);

  const directionTrains = direction === 'up' ? trainsByDirection.up : trainsByDirection.down;

  // Resolve the selected train — falls back to the first train of the active
  // direction when the explicit pick is absent (direction switch) or its id has
  // churned out of the list (30s polling regenerates Train.id).
  const selectedTrain = useMemo<Train | undefined>(() => {
    if (directionTrains.length === 0) return undefined;
    return directionTrains.find((t) => t.id === selectedTrainId) ?? directionTrains[0];
  }, [directionTrains, selectedTrainId]);

  // TODO(혼잡도): 실시간 혼잡도 비활성 — 복원 시 아래 useCongestion 주석 해제하고
  //   `const trainCongestion = null` 라인 삭제. (서울시 AI 실시간 혼잡도 소스 대기)
  // const { trainCongestion } = useCongestion({
  //   lineId,
  //   trainId: selectedTrain?.id,
  //   direction,
  //   autoSubscribe: !!selectedTrain,
  // });
  // null 단언 캐스트: 죽은 분기의 narrowing 유지 (const-narrowing이 never로 좁히는 것 방지)
  const trainCongestion = null as TrainCongestionSummary | null;

  // `?? []` produces a fresh array each render when congestion is absent;
  // memoize so the percent/recommendation memos below don't re-run every tick.
  const cars = useMemo(() => trainCongestion?.cars ?? [], [trainCongestion]);
  const carPercentages = useMemo(() => carsToPercentages(cars), [cars]);
  const recommendedCar = useMemo(() => recommendCar(cars)?.carNumber ?? null, [cars]);
  const congestionLabel = trainCongestion
    ? getCongestionLevelName(trainCongestion.overallLevel)
    : null;

  // The car shown in the CTA summary: explicit tap wins, else the recommendation.
  const effectiveCar = selectedCar ?? recommendedCar;

  // Direction labels: prefer the raw API label carried on the train (handles
  // Line 2 circular 내선순환/외선순환 vs its 상행/하행 branch services), fall
  // back to the line-level mapping when no train is present.
  const upLabel = useMemo(
    () =>
      `${trainsByDirection.up[0]?.directionLabel ?? directionToDisplay('up', lineId)}${
        trainsByDirection.up[0] ? ` · ${trainsByDirection.up[0].finalDestination}` : ''
      }`,
    [trainsByDirection.up, lineId]
  );
  const downLabel = useMemo(
    () =>
      `${trainsByDirection.down[0]?.directionLabel ?? directionToDisplay('down', lineId)}${
        trainsByDirection.down[0] ? ` · ${trainsByDirection.down[0].finalDestination}` : ''
      }`,
    [trainsByDirection.down, lineId]
  );

  const handleDirectionChange = useCallback((next: 'up' | 'down') => {
    setDirection(next);
    setSelectedTrainId(null);
    setSelectedCar(null);
  }, []);

  const handleSelectTrain = useCallback((id: string) => {
    setSelectedTrainId(id);
    setSelectedCar(null);
  }, []);

  const handleSelectCar = useCallback((carNumber: number) => {
    setSelectedCar(carNumber);
  }, []);

  // 알림 토글 ON 시점에 권한 요청 (스킬 권고 "right time"). 거부돼도 토글은
  // 유지되며 탑승 시 예약이 조용히 skip된다. fire-and-forget — 권한 대화상자가
  // 이 화면 위에 뜨도록 await하지 않는다.
  const handleAlertToggle = useCallback((next: boolean) => {
    setAlertEnabled(next);
    if (next) {
      void notificationService.requestPermissions().catch(() => undefined);
    }
  }, []);

  // 중복 탭 가드 — handleBoard는 fire-and-forget로 알림을 예약하고 즉시 goBack한다.
  // unmount 전 빠른 더블탭이 예약을 두 번 돌려 알림이 중복/orphan되는 레이스를
  // 차단한다 (코드리뷰 #4). 한 번 탑승하면 재진입 불가.
  const boardedRef = useRef(false);
  const handleBoard = useCallback(() => {
    if (!selectedTrain || boardedRef.current) return;
    boardedRef.current = true;
    setBoardingSelection({
      stationId,
      stationName,
      lineId,
      direction,
      finalDestination: selectedTrain.finalDestination,
      selectedCar: effectiveCar,
    });
    // 도착 30초 전 로컬 알림 예약. fire-and-forget — boardingAlertService가 권한
    // 게이트·임박 처리·재탑승 dedup을 모두 소유하고 절대 throw하지 않는다. 화면은
    // 즉시 복귀하므로 ref/unmount-cleanup를 두지 않는다(방금 예약한 알림을 취소하는
    // 함정 회피).
    if (alertEnabled) {
      void scheduleBoardingAlert({
        // 세션 무관 단독 알림 — kind 마커 없음(길안내 고아 sweep 비대상).
        context: 'standalone',
        stationName,
        finalDestination: selectedTrain.finalDestination,
        arrivalTime: selectedTrain.arrivalTime,
      });
    }
    if (navigation.canGoBack()) navigation.goBack();
  }, [selectedTrain, stationId, stationName, lineId, direction, effectiveCar, alertEnabled, navigation]);

  const selEta = selectedTrain ? etaOf(selectedTrain, nowMs) : null;
  const ctaEtaText = !selEta
    ? ''
    : !selEta.hasEta
      ? '운행 중'
      : selEta.total === 0
        ? '곧 도착'
        : `${selEta.minutes}분 ${String(selEta.seconds).padStart(2, '0')}초 후`;

  const renderList = (): React.ReactNode => {
    if (trainsLoading) {
      return (
        <View style={styles.statePanel} testID="train-selection-loading">
          <ActivityIndicator size="large" color={semantic.primaryNormal} />
          <Text style={[styles.stateText, { color: semantic.labelNeutral }]}>
            열차 정보를 불러오는 중...
          </Text>
        </View>
      );
    }
    if (trainsError) {
      return (
        <View style={styles.statePanel} testID="train-selection-error">
          <AlertCircle size={48} color={WANTED_TOKENS.status.red500} />
          <Text style={[styles.stateText, { color: semantic.labelNeutral }]}>{trainsError}</Text>
          <Text
            accessible
            accessibilityRole="button"
            accessibilityLabel="열차 정보 다시 불러오기"
            onPress={refetchTrains}
            style={[styles.retryText, { color: semantic.primaryNormal }]}
            testID="train-selection-retry"
          >
            다시 시도
          </Text>
        </View>
      );
    }
    if (directionTrains.length === 0) {
      return (
        <View style={styles.statePanel} testID="train-selection-empty">
          <Moon size={48} color={semantic.labelAlt} />
          <Text style={[styles.stateText, { color: semantic.labelNeutral }]}>
            이 방향으로 운행 중인 열차가 없습니다
          </Text>
          <Text
            accessible
            accessibilityRole="button"
            accessibilityLabel="열차 정보 다시 불러오기"
            onPress={refetchTrains}
            style={[styles.retryText, { color: semantic.primaryNormal }]}
            testID="train-selection-empty-retry"
          >
            다시 시도
          </Text>
        </View>
      );
    }
    return directionTrains.map((t, idx) => {
      const eta = etaOf(t, nowMs);
      const isSel = t.id === selectedTrain?.id;
      return (
        <SelectableTrainCard
          key={t.id}
          testID={`train-selection-card-${idx}`}
          line={t.lineId as LineId}
          destination={t.finalDestination}
          minutes={eta.minutes}
          seconds={eta.seconds}
          hasEta={eta.hasEta}
          trainType={t.trainType}
          delayMinutes={t.delayMinutes}
          selected={isSel}
          onSelect={() => handleSelectTrain(t.id)}
          carCongestion={isSel ? carPercentages : undefined}
          recommendedCar={isSel ? recommendedCar : null}
          selectedCar={isSel ? selectedCar : null}
          onSelectCar={handleSelectCar}
          congestionLabel={isSel ? congestionLabel : null}
        />
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: semantic.bgSubtlePage }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <LineBadge line={lineId as LineId} size={28} />
            <Text style={[styles.heroName, { color: semantic.labelStrong }]} numberOfLines={1}>
              {stationName}
            </Text>
            <View
              testID="train-selection-live"
              style={[styles.liveBadge, { backgroundColor: `${green}1A` }]}
              accessibilityRole="text"
              accessibilityLabel="실시간"
            >
              <View style={[styles.liveDot, { backgroundColor: green }]} />
              <Text style={[styles.liveText, { color: green }]}>LIVE</Text>
            </View>
          </View>
          {/* TODO(혼잡도): 실시간 칸별 혼잡도 복원 시 "탑승할 열차를 선택하면 칸별
              혼잡도를 안내해 드려요"로 되돌릴 것. 현재는 혼잡도가 비활성이라 실제
              제공 항목(도착 시간 + 30초 전 알림)만 약속한다 (코드리뷰 #5, honesty). */}
          <Text style={[styles.heroSubtitle, { color: semantic.labelAlt }]}>
            탑승할 열차를 선택하면 도착 시간과 30초 전 알림을 안내해 드려요
          </Text>
        </View>

        <View style={styles.segmentWrap}>
          <DirectionSegment
            value={direction}
            upLabel={upLabel}
            downLabel={downLabel}
            onChange={handleDirectionChange}
            testID="train-selection-direction"
          />
        </View>

        <View style={styles.listWrap}>{renderList()}</View>

        {selectedTrain ? (
          <View style={[styles.alertRow, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}>
            <View style={styles.alertTextWrap}>
              <Text style={[styles.alertTitle, { color: semantic.labelStrong }]}>
                도착 30초 전 알림
              </Text>
              <Text style={[styles.alertSub, { color: semantic.labelAlt }]}>
                승강장으로 이동할 시간을 알려드려요
              </Text>
            </View>
            <Switch
              testID="train-selection-alert-toggle"
              value={alertEnabled}
              onValueChange={handleAlertToggle}
              accessibilityLabel="도착 30초 전 알림"
            />
          </View>
        ) : null}
      </ScrollView>

      {selectedTrain ? (
        <View
          testID="train-selection-cta"
          style={[styles.ctaBar, { backgroundColor: semantic.bgBase, borderTopColor: semantic.lineSubtle }]}
        >
          <View style={styles.ctaInfo}>
            <Text style={[styles.ctaDest, { color: semantic.labelStrong }]} numberOfLines={1}>
              {`${selectedTrain.finalDestination} 방면${effectiveCar != null ? ` · 추천 ${effectiveCar}번 칸` : ''}`}
            </Text>
            <Text
              testID="train-selection-cta-eta"
              style={[styles.ctaEta, { color: semantic.primaryNormal }]}
            >
              {ctaEtaText}
            </Text>
          </View>
          <TouchableOpacity
            testID="train-selection-cta-button"
            style={[styles.ctaButton, { backgroundColor: semantic.primaryNormal }]}
            onPress={handleBoard}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${selectedTrain.finalDestination} 방면 열차로 탑승 시작`}
          >
            <Text style={styles.ctaButtonText}>이 열차로 탑승 시작</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  hero: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
  heroName: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.heading2.size,
    lineHeight: WANTED_TOKENS.type.heading2.lh,
    fontFamily: weightToFontFamily('800'),
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('700'),
  },
  heroSubtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontFamily: weightToFontFamily('500'),
  },
  segmentWrap: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s3,
  },
  listWrap: {
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
    fontFamily: weightToFontFamily('600'),
    textAlign: 'center',
  },
  retryText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontFamily: weightToFontFamily('700'),
  },
  alertRow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    marginHorizontal: WANTED_TOKENS.spacing.s5,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertTextWrap: {
    flex: 1,
    paddingRight: WANTED_TOKENS.spacing.s3,
  },
  alertTitle: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontFamily: weightToFontFamily('700'),
  },
  alertSub: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontFamily: weightToFontFamily('500'),
  },
  ctaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingTop: WANTED_TOKENS.spacing.s3,
    paddingBottom: WANTED_TOKENS.spacing.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaInfo: {
    flex: 1,
  },
  ctaDest: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontFamily: weightToFontFamily('600'),
  },
  ctaEta: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontFamily: weightToFontFamily('800'),
  },
  ctaButton: {
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontFamily: weightToFontFamily('700'),
  },
});

export default React.memo(TrainSelectionScreen);
