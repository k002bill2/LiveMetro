/**
 * RouteGuidanceScreen — 실시간 길안내 (live turn-by-turn navigation).
 *
 * "이 경로로 길안내 시작" CTA가 연결되는 화면. claude.ai/design 핸드오프
 * (live-nav.jsx)의 구조를 따른다: ① 목적지 ETA(가장 큰 정보) + 전체 진행
 * 바, ② NOW 카드(현재 구간), ③ 전체 경로 타임라인, ④ 하단 안내 종료.
 *
 * 추적 모델: 지하 GPS 불가 → 시간 기반 자동 진행(useGuidanceProgress) +
 * 수동 보정 버튼. 탑승/환승 대기 단계에서만 해당 역의 실시간 도착
 * (useRealtimeTrains, 30초 폴링)을 구독해 다음 열차 ETA를 보여준다.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useGuidanceProgress } from '@/hooks/useGuidanceProgress';
import { routeToGuidanceSteps } from '@/services/guidance/guidanceSteps';
import { clearGuidanceSession, getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import { GuidanceControls, GuidanceHeader, GuidanceNowCard, GuidanceStepRow, type GuidanceStepStatus } from '@/components/guidance';
import type { AppStackParamList } from '@/navigation/types';
import type { GuidanceStep } from '@/models/guidance';
import type { Train } from '@/models/train';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const formatWaitText = (totalSec: number): string => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `다음 열차 ${m}분 ${String(s).padStart(2, '0')}초 후 도착` : `다음 열차 ${s}초 후 도착`;
};

/** Contextual confirm label for the manual-correction button. */
const nextLabelFor = (step: GuidanceStep | undefined, nextStep: GuidanceStep | undefined): string | null => {
  if (!step || step.kind === 'alight') return null;
  switch (step.kind) {
    case 'board':
      return '탑승했어요';
    case 'transfer':
      return '환승 열차에 탔어요';
    case 'ride':
      return nextStep?.kind === 'transfer' ? '환승역에 도착했어요' : '하차했어요';
  }
};

export const RouteGuidanceScreen: React.FC = () => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();

  // Session is set by the CTA right before navigating; read once per mount.
  const session = useMemo(() => getGuidanceSession(), []);
  const steps = useMemo(
    () => (session ? routeToGuidanceSteps(session.route) : []),
    [session]
  );

  // Defensive: deep links / state restoration can land here without a session.
  useEffect(() => {
    if (!session || steps.length === 0) {
      navigation.goBack();
    }
  }, [session, steps.length, navigation]);

  const {
    currentIndex,
    isHolding,
    elapsedInStepSec,
    remainingSeconds,
    etaMs,
    nowMs,
    isAtEnd,
    goNext,
    goPrev,
  } = useGuidanceProgress(steps, {
    startedAt: session?.startedAt ?? 0,
    enabled: isFocused && steps.length > 0,
  });

  const currentStep = steps[currentIndex];
  const isWaitingStep =
    currentStep !== undefined &&
    (currentStep.kind === 'board' || currentStep.kind === 'transfer');

  // Live next-train ETA — only while waiting on a platform (board/transfer).
  // 30s minimum polling per Seoul API policy; disabled otherwise to keep the
  // rate-limit budget for foreground arrival screens.
  const waitingStationName = isWaitingStep ? currentStep.stationName : '';
  const waitingLineId =
    currentStep?.kind === 'transfer'
      ? currentStep.toLineId
      : currentStep?.kind === 'board'
        ? currentStep.lineId
        : '';
  const { trains } = useRealtimeTrains(waitingStationName, {
    enabled: isFocused && isWaitingStep,
    refetchInterval: 30000,
  });

  const liveWaitText = useMemo((): string | null => {
    if (!isWaitingStep) return null;
    const all: readonly Train[] = trains ?? [];
    // Numbered-line filter (transfer-station 다노선 혼입 방지) — mirrors
    // TrainSelectionScreen. Extended lines keep all trains.
    const filtered = /^[1-9]$/.test(waitingLineId)
      ? all.filter(t => t.lineId === waitingLineId)
      : all;
    const etas = filtered
      .map(t => (t.arrivalTime !== null ? Math.floor((t.arrivalTime.getTime() - nowMs) / 1000) : null))
      .filter((sec): sec is number => sec !== null && sec >= 0)
      .sort((a, b) => a - b);
    const first = etas[0];
    return first !== undefined ? formatWaitText(first) : null;
  }, [isWaitingStep, trains, waitingLineId, nowMs]);

  // Whole-journey progress for the header bar. Total excludes platform wait
  // (same basis as remainingSeconds), so the fraction is internally honest.
  const totalSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + s.durationMinutes * 60, 0),
    [steps]
  );
  const progress =
    totalSeconds <= 0 ? 0 : isAtEnd ? 1 : (totalSeconds - remainingSeconds) / totalSeconds;

  const handleExit = useCallback((): void => {
    clearGuidanceSession();
    navigation.goBack();
  }, [navigation]);

  const renderStep = useCallback(
    ({ item, index }: { item: GuidanceStep; index: number }): React.ReactElement => {
      const status: GuidanceStepStatus =
        index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'upcoming';
      return (
        <GuidanceStepRow
          step={item}
          status={status}
          isFirst={index === 0}
          isLast={index === steps.length - 1}
        />
      );
    },
    [currentIndex, steps.length]
  );

  const keyExtractor = useCallback((item: GuidanceStep): string => item.id, []);

  if (!session || steps.length === 0) {
    return <SafeAreaView style={styles.container} testID="route-guidance-screen" />;
  }

  const listHeader = (
    <View>
      <GuidanceHeader
        fromStationName={session.fromStationName}
        toStationName={session.toStationName}
        etaMs={etaMs}
        remainingSeconds={remainingSeconds}
        progress={progress}
        onClose={handleExit}
      />
      {currentStep !== undefined && (
        <View style={styles.nowCardWrap}>
          <GuidanceNowCard
            step={currentStep}
            elapsedInStepSec={isHolding ? 0 : elapsedInStepSec}
            liveWaitText={liveWaitText}
          />
        </View>
      )}
      <Text style={styles.sectionLabel}>전체 경로</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="route-guidance-screen">
      <FlatList
        data={steps}
        renderItem={renderStep}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        testID="guidance-timeline"
      />
      <GuidanceControls
        nextLabel={nextLabelFor(currentStep, steps[currentIndex + 1])}
        prevDisabled={currentIndex === 0}
        onPrev={goPrev}
        onNext={goNext}
        onExit={handleExit}
      />
    </SafeAreaView>
  );
};

RouteGuidanceScreen.displayName = 'RouteGuidanceScreen';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    listContent: {
      paddingBottom: WANTED_TOKENS.spacing.s6,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
    },
    nowCardWrap: {
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: 0.36,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
  });

export default RouteGuidanceScreen;
