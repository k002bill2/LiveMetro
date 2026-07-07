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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useGuidanceProgress } from '@/hooks/useGuidanceProgress';
import { routeToGuidanceSteps } from '@/services/guidance/guidanceSteps';
import {
  detectDeparture,
  ARRIVING_ETA_THRESHOLD_SEC,
} from '@/services/guidance/departureDetection';
import {
  appendDepartedTrains,
  collectDepartures,
  collectEstimates,
  getDepartedTrainLog,
  clearDepartedTrainLog,
  type DepartedTrainEntry,
} from '@/services/guidance/departedTrainLog';
import {
  scheduleBoardingAlert,
  cancelBoardingAlert,
} from '@/services/notification/boardingAlertService';
import { clearGuidanceSession, getGuidanceSession } from '@/services/guidance/guidanceSessionStore';
import { completeGuidanceCommuteLog } from '@/services/guidance/guidanceCommuteLogService';
import { useAuth } from '@/services/auth/AuthContext';
import { GuidanceControls, GuidanceHeader, GuidanceNowCard, GuidanceStepRow, TrainSelectSheet, type GuidanceStepStatus } from '@/components/guidance';
import type { AppStackParamList } from '@/navigation/types';
import type { GuidanceStep } from '@/models/guidance';
import type { Train } from '@/models/train';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

/** Grace window before a detected departure auto-confirms boarding (dismissable). */
const SOFT_CONFIRM_AUTO_MS = 4000;

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
  const { user } = useAuth();

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
    elapsedInStepSec,
    remainingSeconds,
    etaMs,
    nowMs,
    isAtEnd,
    goNextAt,
    rebaseAt,
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

  // Travel-direction endpoint name for the waiting step (board/transfer have it).
  const waitingDirection: string | null =
    currentStep !== undefined && currentStep.kind !== 'alight' ? currentStep.direction : null;

  // Numbered-line filter (transfer-station 다노선 혼입 방지) — mirrors
  // TrainSelectionScreen. Extended lines keep all trains. 이후 진행 방향(방면)
  // 매칭 열차를 우선한다 — 반대 방향 열차 기준의 칩/알림 방지. 단축 운행
  // 종착역은 방면명과 정당하게 다를 수 있어(detectDeparture와 같은 원칙)
  // 매칭이 전무하면 노선 필터 결과로 폴백한다.
  const filteredTrains = useMemo((): readonly Train[] => {
    if (!isWaitingStep) return [];
    const all: readonly Train[] = trains ?? [];
    const onLine = /^[1-9]$/.test(waitingLineId)
      ? all.filter(t => t.lineId === waitingLineId)
      : all;
    if (waitingDirection === null) return onLine;
    const matched = onLine.filter(t => t.finalDestination === waitingDirection);
    return matched.length > 0 ? matched : onLine;
  }, [isWaitingStep, trains, waitingLineId, waitingDirection]);

  // Earliest train still ahead — feeds both the live chip and the local alert.
  const earliestTrain = useMemo((): Train | null => {
    let best: { train: Train; ms: number } | null = null;
    for (const t of filteredTrains) {
      if (t.arrivalTime === null) continue;
      const ms = t.arrivalTime.getTime();
      if (ms - nowMs < 0) continue;
      if (best === null || ms < best.ms) best = { train: t, ms };
    }
    return best?.train ?? null;
  }, [filteredTrains, nowMs]);

  const liveWaitText = useMemo((): string | null => {
    if (!isWaitingStep || earliestTrain?.arrivalTime == null) return null;
    const sec = Math.floor((earliestTrain.arrivalTime.getTime() - nowMs) / 1000);
    return sec >= 0 ? formatWaitText(sec) : null;
  }, [isWaitingStep, earliestTrain, nowMs]);

  // ── Soft-confirm: auto-advance a board/transfer hold when the awaited train
  // departs (inferred from id disappearance), so the rider rarely needs to tap.
  const [softConfirm, setSoftConfirm] = useState<{ readonly trainId: string } | null>(null);
  const [trainSelectVisible, setTrainSelectVisible] = useState(false);
  const prevTrainsRef = useRef<readonly Train[] | null>(null);
  const firedForIndexRef = useRef<number | null>(null);
  const cooldownTrainIdRef = useRef<string | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nowMsRef = useRef(nowMs);
  nowMsRef.current = nowMs;

  const clearAutoTimer = useCallback((): void => {
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  // Single advance funnel — manual button, "예", the auto timeout, and a
  // train-select pick all route here, so a tap during the auto window can never
  // double-advance. `atMs` is the boarding anchor (past for a retroactive pick).
  const confirmBoardedAt = useCallback((atMs: number): void => {
    clearAutoTimer();
    if (firedForIndexRef.current === currentIndex) return;
    firedForIndexRef.current = currentIndex;
    setSoftConfirm(null);
    void cancelBoardingAlert();
    // Polling stops after boarding, so the last snapshot's approaching trains
    // are kept as estimated departures for the ride-time "change train" case.
    appendDepartedTrains(
      collectEstimates({
        trains: trains ?? [],
        lineId: waitingLineId,
        stationName: waitingStationName,
        nowMs: Date.now(),
      }),
      Date.now()
    );
    goNextAt(atMs);
  }, [clearAutoTimer, currentIndex, goNextAt, trains, waitingLineId, waitingStationName]);

  const confirmBoarded = useCallback((): void => confirmBoardedAt(Date.now()), [confirmBoardedAt]);

  const dismissSoftConfirm = useCallback((): void => {
    clearAutoTimer();
    cooldownTrainIdRef.current = softConfirm?.trainId ?? null;
    setSoftConfirm(null);
  }, [clearAutoTimer, softConfirm]);

  const openTrainSelect = useCallback((): void => setTrainSelectVisible(true), []);
  const closeTrainSelect = useCallback((): void => setTrainSelectVisible(false), []);

  const handleSoftConfirmOther = useCallback((): void => {
    dismissSoftConfirm();
    setTrainSelectVisible(true);
  }, [dismissSoftConfirm]);

  // Rebase to the picked departure: retroactive board while waiting, or an
  // in-place anchor swap (index kept) while riding.
  const handleTrainSelected = useCallback((departedAtMs: number): void => {
    setTrainSelectVisible(false);
    if (isWaitingStep) {
      confirmBoardedAt(departedAtMs);
    } else {
      rebaseAt(departedAtMs);
    }
  }, [isWaitingStep, confirmBoardedAt, rebaseAt]);

  // Reset per-step guards whenever the active step changes (incl. undo via goPrev).
  useEffect(() => {
    clearAutoTimer();
    setSoftConfirm(null);
    firedForIndexRef.current = null;
    cooldownTrainIdRef.current = null;
    prevTrainsRef.current = null;
  }, [currentIndex, clearAutoTimer]);

  // Departure detection — compare successive fresh snapshots. `trains` only
  // changes on a successful poll (error/stale keep the last array), so this is
  // equivalent to an onDataReceived hook but stays mockable. nowMs is read via
  // ref so the 1Hz tick doesn't re-run detection.
  useEffect(() => {
    if (!isWaitingStep) {
      prevTrainsRef.current = null;
      return;
    }
    const next = trains ?? [];
    const result = detectDeparture({
      prev: prevTrainsRef.current,
      next,
      awaited: { lineId: waitingLineId, directionName: waitingDirection },
      nowMs: nowMsRef.current,
      thresholdSec: ARRIVING_ETA_THRESHOLD_SEC,
    });
    // Log every train that departed between snapshots (all candidates, no
    // direction filter — that happens at the sheet). Must read prev BEFORE
    // reassigning prevTrainsRef.
    appendDepartedTrains(
      collectDepartures({
        prev: prevTrainsRef.current,
        next,
        lineId: waitingLineId,
        stationName: waitingStationName,
        nowMs: nowMsRef.current,
      }),
      nowMsRef.current
    );
    prevTrainsRef.current = next;
    if (
      result.departed &&
      result.trainId !== null &&
      result.trainId !== cooldownTrainIdRef.current &&
      firedForIndexRef.current !== currentIndex
    ) {
      setSoftConfirm({ trainId: result.trainId });
      clearAutoTimer();
      autoTimerRef.current = setTimeout(confirmBoarded, SOFT_CONFIRM_AUTO_MS);
    }
  }, [
    trains,
    isWaitingStep,
    waitingLineId,
    waitingStationName,
    waitingDirection,
    currentIndex,
    confirmBoarded,
    clearAutoTimer,
  ]);

  // Local-notification bridge — schedule/reschedule for the earliest train while
  // waiting. 폴링마다 earliestTrain 참조가 갱신되어 effect가 재실행되므로,
  // boardingAlertService가 trainId 발사-이력 dedup으로 같은 열차의 중복 발사를
  // 막는다(발사된 알림은 취소 불가 — pending만 cancel-then-schedule). The screen
  // is foreground when scheduling, so tapping the alert just returns here.
  const notificationSettings = user?.preferences?.notificationSettings ?? null;
  useEffect(() => {
    if (!isWaitingStep || earliestTrain?.arrivalTime == null) return;
    void scheduleBoardingAlert({
      stationName: waitingStationName,
      finalDestination: earliestTrain.finalDestination,
      arrivalTime: earliestTrain.arrivalTime,
      trainId: earliestTrain.id,
      settings: notificationSettings,
      variant: currentStep?.kind === 'transfer' ? 'transfer' : 'board',
    });
  }, [isWaitingStep, earliestTrain, waitingStationName, currentStep?.kind, notificationSettings]);

  // Cancel any pending alert / timer on unmount (subscription-cleanup rule).
  useEffect(() => {
    return () => {
      clearAutoTimer();
      void cancelBoardingAlert();
    };
  }, [clearAutoTimer]);

  const softConfirmHandlers = useMemo(
    () =>
      softConfirm !== null
        ? { onYes: confirmBoarded, onNotYet: dismissSoftConfirm, onOther: handleSoftConfirmOther }
        : null,
    [softConfirm, confirmBoarded, dismissSoftConfirm, handleSoftConfirmOther]
  );

  // Candidates for the sheet: recent departures at the current step's station on
  // its line, within this session and not in the future.
  const trainSelectEntries = useMemo((): readonly DepartedTrainEntry[] => {
    if (!session || !trainSelectVisible || currentStep === undefined) return [];
    const station =
      currentStep.kind === 'board' || currentStep.kind === 'transfer'
        ? currentStep.stationName
        : currentStep.kind === 'ride'
          ? currentStep.fromStationName
          : null;
    if (station === null) return [];
    const lineId = isWaitingStep ? waitingLineId : currentStep.kind === 'ride' ? currentStep.lineId : '';
    const numbered = /^[1-9]$/.test(lineId);
    return getDepartedTrainLog().filter(
      (e) =>
        e.stationName === station &&
        (!numbered || e.lineId === lineId) &&
        e.departedAtMs <= nowMs &&
        e.departedAtMs >= session.startedAt
    );
  }, [session, trainSelectVisible, isWaitingStep, currentStep, waitingLineId, nowMs]);

  const completedLogKeyRef = useRef<string | null>(null);

  const persistCompletion = useCallback((completedAt: number = Date.now()): void => {
    if (!session || !user?.id || session.commuteLogCompletedAt) return;
    const key = `${user.id}:${session.startedAt}`;
    if (completedLogKeyRef.current === key) return;
    completedLogKeyRef.current = key;
    completeGuidanceCommuteLog(user.id, session, completedAt).catch((error) => {
      completedLogKeyRef.current = null;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[RouteGuidanceScreen] commute log completion failed:', error);
      }
    });
  }, [session, user?.id]);

  // Whole-journey progress for the header bar. Total excludes platform wait
  // (same basis as remainingSeconds), so the fraction is internally honest.
  const totalSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + s.durationMinutes * 60, 0),
    [steps]
  );
  const progress =
    totalSeconds <= 0 ? 0 : isAtEnd ? 1 : (totalSeconds - remainingSeconds) / totalSeconds;

  useEffect(() => {
    if (isAtEnd) {
      persistCompletion();
    }
  }, [isAtEnd, persistCompletion]);

  const handleExit = useCallback((): void => {
    clearAutoTimer();
    void cancelBoardingAlert();
    if (isAtEnd) {
      persistCompletion();
    }
    clearDepartedTrainLog();
    clearGuidanceSession();
    navigation.goBack();
  }, [clearAutoTimer, isAtEnd, persistCompletion, navigation]);

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
            elapsedInStepSec={currentStep.kind === 'board' ? 0 : elapsedInStepSec}
            liveWaitText={liveWaitText}
            softConfirm={softConfirmHandlers}
            onOpenTrainSelect={openTrainSelect}
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
        onNext={confirmBoarded}
        onExit={handleExit}
      />
      <TrainSelectSheet
        visible={trainSelectVisible}
        entries={trainSelectEntries}
        onSelect={handleTrainSelected}
        onClose={closeTrainSelect}
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
