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
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import { useGuidanceProgress } from '@/hooks/useGuidanceProgress';
import { useGuidanceBackgroundPermissionPrompt } from '@/hooks/useGuidanceBackgroundPermissionPrompt';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import {
  startGuidanceBackgroundLocation,
  stopGuidanceBackgroundLocation,
} from '@/services/guidance/guidanceBackgroundLocationTask';
import {
  routeToGuidanceSteps,
  computeRideProgress,
  cumulativeRideSecondsTo,
} from '@/services/guidance/guidanceSteps';
import {
  recordDetectionEpisode,
  type DetectionResolution,
} from '@/services/guidance/guidanceDetectionMetrics';
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
  DEPARTED_LOG_RETENTION_MS,
  type DepartedTrainEntry,
} from '@/services/guidance/departedTrainLog';
import {
  scheduleBoardingAlert,
  cancelBoardingAlert,
} from '@/services/notification/boardingAlertService';
import {
  scheduleAlightAlert,
  cancelAlightAlert,
} from '@/services/notification/alightAlertService';
import {
  clearGuidanceSession,
  getGuidanceSession,
  setGuidanceSession,
  updateGuidanceProgressAnchor,
  updateGuidanceLocalCompletion,
  isActiveGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import {
  buildBoardingKey,
  destinationOptions,
  partitionWaitingTrains,
} from '@/services/guidance/destinationPreference';
import { updateBoardingPreferences } from '@/services/commute/commuteService';
import { useAuth } from '@/services/auth/AuthContext';
import { DestinationFilterSheet, GuidanceControls, GuidanceHeader, GuidanceNowCard, GuidanceStepRow, TrainSelectSheet, type GuidanceStepStatus, type WaitPreviewItem } from '@/components/guidance';
import { StationRebaseSheet } from '@/components/guidance/StationRebaseSheet';
import { BackgroundPermissionBanner } from '@/components/guidance/BackgroundPermissionBanner';
import type { AppStackParamList } from '@/navigation/types';
import type { GuidanceStep, RideStep } from '@/models/guidance';
import type { Train } from '@/models/train';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

/**
 * Snapshot of the step the train-select sheet was opened on. Captured at open
 * time so a 1Hz tick advancing the step behind the modal can't misroute the
 * pick (waiting=confirm/retroactive board, ride=rebase/in-place anchor swap).
 */
interface TrainSelectContext {
  readonly mode: 'confirm' | 'rebase';
  readonly stepIndex: number;
  readonly stationName: string;
  readonly lineId: string;
  /** Travel-direction endpoint name for the captured step, or null. */
  readonly direction: string | null;
}

/**
 * Snapshot of the ride step the station-rebase sheet was opened on. Only the
 * tick-stable step (from the `steps` memo) + its index are frozen here — the
 * current-position marker is computed live and passed as a prop, never stored,
 * so it can move per tick without churning this context (predictions stay
 * tick-invariant per the guidance pattern).
 */
interface StationRebaseContext {
  readonly stepIndex: number;
  readonly step: RideStep;
}

/** Grace window before a detected departure auto-confirms boarding (dismissable). */
const SOFT_CONFIRM_AUTO_MS = 4000;

/** expo-keep-awake tag scoping this screen's wake lock (activate/deactivate pair). */
const KEEP_AWAKE_TAG = 'route-guidance';

/**
 * 대기 칩 문구. 종점행을 알면 "OO행"으로 지칭한다 — 분기 노선에서 어느 열차의
 * 카운트다운인지가 문구만으로 드러나야 한다. 종착역명이 비었거나 알 수 없으면
 * 기존의 "다음 열차"로 강등한다 ("undefined행" 렌더 방지).
 */
const formatWaitText = (totalSec: number, destination: string | null): string => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const head = destination != null && destination !== '' ? `${destination}행` : '다음 열차';
  return m > 0
    ? `${head} ${m}분 ${String(s).padStart(2, '0')}초 후 도착`
    : `${head} ${s}초 후 도착`;
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

  // Reactive session for the wake-lock gate — the frozen mount snapshot (below)
  // can't observe a completion (commuteLogCompletedAt) transition. (The keep-awake
  // effect lives after useGuidanceProgress so it can also read local completion.)
  const liveSession = useGuidanceSession();
  // SSOT 활성 정의(W1) — 로컬 완주(localCompletedAt)도 비활성 취급(wake lock 해제).
  const isGuidanceActive = isActiveGuidanceSession(liveSession);
  // 복구 게이트는 REMOTE 완료만 본다 — 로컬 완주 마커를 되돌리는 게 복구의 목적이므로
  // isGuidanceActive(로컬 포함)로 게이트하면 복구가 영영 막힌다.
  const isRemotelyActive = liveSession !== null && !liveSession.commuteLogCompletedAt;

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

  // Restore the persisted progress anchor (re-mount / app restart) so a confirmed
  // boarding isn't rewound to the first hold. Validate defensively — a malformed
  // or out-of-range anchor (legacy/corrupt persisted session) falls back to the
  // default first-step start. Computed once at mount (deps stable), so the 1Hz
  // tick can't re-validate atMs against a moving clock.
  const initialAnchor = useMemo((): { index: number; atMs: number } | undefined => {
    const anchor = session?.progressAnchor;
    if (!anchor) return undefined;
    // stepIndex must be a whole index — a fractional value (e.g. 0.5) would pass
    // a finite+range check yet crash `steps[0.5]` downstream.
    if (!Number.isInteger(anchor.stepIndex) || !Number.isFinite(anchor.atMs)) return undefined;
    if (anchor.stepIndex < 0 || anchor.stepIndex >= steps.length) return undefined;
    if (anchor.atMs > Date.now()) return undefined;
    return { index: anchor.stepIndex, atMs: anchor.atMs };
  }, [session, steps.length]);

  // Persist every anchor change (mount + each manual/soft correction) so the
  // progress survives a screen close or app kill mid-journey. Scoped to this
  // screen's originating session (mount-fixed startedAt) — a screen that outlives
  // a session swap must not write its old anchor onto the new session (Q1).
  const handleAnchorChange = useCallback(
    (anchor: { index: number; atMs: number }): void => {
      if (!session) return;
      updateGuidanceProgressAnchor(
        { stepIndex: anchor.index, atMs: anchor.atMs },
        session.startedAt
      );
    },
    [session]
  );

  const {
    currentIndex,
    isHolding,
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
    initialAnchor,
    onAnchorChange: handleAnchorChange,
  });

  // Keep the screen awake ONLY while focused AND a guidance journey is actively in
  // progress (P1') AND not yet at the destination (R1). `isAtEnd` is the LOCAL
  // completion signal: commuteLogCompletedAt is set only after a successful remote
  // (Firestore) write, so relying on it alone would hold the wake lock forever if
  // the rider finishes offline/underground where that write can't land. Otherwise
  // (no/complete session, blurred, or arrived) release so the device can auto-lock.
  // expo-keep-awake's useKeepAwake requests on web with no Wake Lock check (→
  // unhandled rejection), so web is a no-op; native activates/deactivates. Branch
  // inside the effect (never a conditional hook call).
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    if (!(isFocused && isGuidanceActive && !isAtEnd)) return undefined;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      try {
        void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
      } catch {
        /* no-op — deactivating an already-released tag is harmless */
      }
    };
  }, [isFocused, isGuidanceActive, isAtEnd]);

  // One-time "Always" location nudge — without background permission, guidance and
  // alerts stop when the phone locks. Suspended on local completion (isAtEnd): the
  // banner hides and all start paths no-op once the rider has arrived.
  const {
    status: bgPermStatus,
    requestPermission: requestBgPermission,
    dismiss: dismissBgPermission,
    openSettings: openBgSettings,
  } = useGuidanceBackgroundPermissionPrompt({ suspended: isAtEnd });

  // Stop background tracking on LOCAL completion (isAtEnd), not just remote — the
  // Firestore completion write (commuteLogCompletedAt) can never land offline/
  // logged-out, which would otherwise keep the Android foreground service alive
  // (killServiceOnDestroy:false) after arrival (S1, same class as the wake lock).
  // A goPrev correction (true→false) symmetrically retries (permission-checked).
  // T2: prev를 false로 초기화 — 오프라인 완주(isAtEnd=true) 상태로 복원된 세션도 첫
  // 렌더에서 false→true로 인식돼 stop이 1회 발동한다(전이 미감지로 서비스 잔존 방지).
  const prevIsAtEndRef = useRef(false);
  useEffect(() => {
    const prev = prevIsAtEndRef.current;
    prevIsAtEndRef.current = isAtEnd;
    if (isAtEnd && !prev) {
      void stopGuidanceBackgroundLocation();
      // 로컬 완주를 세션에 영속(W1) — 오프라인/비로그인 도착이 재시작으로 뒤집혀
      // 추적이 되살아나지 않게 한다. SSOT active 정의가 이 마커를 자동 반영한다.
      if (session) updateGuidanceLocalCompletion(Date.now(), session.startedAt);
    } else if (!isAtEnd && prev && isRemotelyActive) {
      // 복구(재시도): true→false는 현 UI 기본 컨트롤(종점에서 GuidanceControls가
      // prev/next 쌍을 숨김)로는 미도달 — 역 재베이스로 anchor가 뒤로 돌아가는 경로
      // 대비 defensive. 로컬 완주 마커를 지우고 재시작한다. REMOTE 완료(commuteLog
      // CompletedAt)가 아닐 때만 — 원격 완료면 sync가 이미 inactive 전이를 소진해 다시
      // stop하지 않으므로 여기서 start·marker-clear하면 안 된다(T3). 로컬 완주 마커는
      // 복구가 지우는 대상이므로 isGuidanceActive(로컬 포함)로 게이트하면 안 된다.
      if (session) updateGuidanceLocalCompletion(null, session.startedAt);
      void startGuidanceBackgroundLocation();
    }
  }, [isAtEnd, isRemotelyActive, session]);

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

  // 종점행 선호 — 세션 사본이 SSOT. liveSession(reactive)을 읽어 attach·시트 토글이
  // 즉시 반영된다 (mount-frozen `session`이 아니라).
  const boardingKey =
    currentStep?.kind === 'board' || currentStep?.kind === 'transfer'
      ? buildBoardingKey(currentStep.stationId, waitingLineId)
      : null;
  const selectedDestinations = useMemo((): readonly string[] => {
    if (boardingKey === null) return [];
    return liveSession?.destinationPreferences?.[boardingKey] ?? [];
  }, [liveSession, boardingKey]);

  // Numbered-line filter (transfer-station 다노선 혼입 방지) — mirrors
  // TrainSelectionScreen. Extended lines keep all trains. 이후 진행 방향(방면)
  // 매칭 열차를 우선한다 — 반대 방향 열차 기준의 칩/알림 방지. 단축 운행
  // 종착역은 방면명과 정당하게 다를 수 있어(detectDeparture와 같은 원칙)
  // 매칭이 전무하면 노선 필터 결과로 폴백한다. display=보조 나열·시트 옵션(선호와
  // 무관한 진행 방향 전체), tracked=칩·알림·감지(선호 적용) 2-풀.
  const trainPools = useMemo(
    () =>
      isWaitingStep
        ? partitionWaitingTrains({
            trains: trains ?? [],
            lineId: waitingLineId,
            directionName: waitingDirection,
            preferredDestinations: selectedDestinations,
          })
        : { display: [] as readonly Train[], tracked: [] as readonly Train[] },
    [isWaitingStep, trains, waitingLineId, waitingDirection, selectedDestinations]
  );
  const filteredTrains = trainPools.tracked;

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

  // 선호를 골랐는데 그 종점행이 지금 도착 목록에 없는 상태 — 로딩("불러오는 중")과
  // 구분해 정직하게 알린다. display가 비어 있으면 그냥 정보 없음이므로 제외한다.
  const noMatchingSelection =
    selectedDestinations.length > 0 &&
    trainPools.tracked.length === 0 &&
    trainPools.display.length > 0;
  const liveWaitText = useMemo((): string | null => {
    if (!isWaitingStep) return null;
    if (noMatchingSelection) return '선택한 종점행 열차가 없어요';
    if (earliestTrain?.arrivalTime == null) return null;
    const sec = Math.floor((earliestTrain.arrivalTime.getTime() - nowMs) / 1000);
    return sec >= 0 ? formatWaitText(sec, earliestTrain.finalDestination) : null;
  }, [isWaitingStep, noMatchingSelection, earliestTrain, nowMs]);

  // 보조 나열 — 진행 방향 다음 도착 2대(선호와 무관). GuidanceNowCard가 memo라
  // 인라인 배열은 메모이제이션을 무력화하므로 반드시 useMemo로 참조를 안정화한다.
  const waitPreview = useMemo((): readonly WaitPreviewItem[] => {
    if (!isWaitingStep) return [];
    const upcoming = trainPools.display
      .filter(t => t.arrivalTime !== null && t.arrivalTime.getTime() >= nowMs)
      .sort((a, b) => (a.arrivalTime as Date).getTime() - (b.arrivalTime as Date).getTime())
      .slice(0, 2);
    return upcoming.map(t => {
      const sec = Math.floor(((t.arrivalTime as Date).getTime() - nowMs) / 1000);
      return {
        destination: t.finalDestination,
        etaText: sec < 60 ? '곧 도착' : `${Math.floor(sec / 60)}분`,
        isMatch:
          selectedDestinations.length === 0 ||
          selectedDestinations.includes(t.finalDestination),
      };
    });
  }, [isWaitingStep, trainPools, nowMs, selectedDestinations]);
  const destinationFilterLabel =
    selectedDestinations.length > 0 ? `${selectedDestinations.join('·')}행만` : null;

  // ── Soft-confirm: auto-advance a board/transfer hold when the awaited train
  // departs (inferred from id disappearance), so the rider rarely needs to tap.
  const [softConfirm, setSoftConfirm] = useState<{ readonly trainId: string } | null>(null);
  const [trainSelectContext, setTrainSelectContext] = useState<TrainSelectContext | null>(null);
  const [stationRebaseContext, setStationRebaseContext] = useState<StationRebaseContext | null>(null);
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  const prevTrainsRef = useRef<readonly Train[] | null>(null);
  // Identity of the last `trains` value the detection effect actually processed.
  // Guards against non-poll re-runs (step transitions) seeding prevTrainsRef with
  // a stale snapshot — useRealtimeTrains keeps the previous station's array until
  // the new subscription delivers, and enforcing this makes the effect a true
  // onDataReceived hook. NOT reset on step change (it marks the stale array).
  const lastSeenTrainsRef = useRef<readonly Train[] | null | undefined>(null);
  const firedForIndexRef = useRef<number | null>(null);
  const cooldownTrainIdRef = useRef<string | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nowMsRef = useRef(nowMs);
  nowMsRef.current = nowMs;
  // Detection-metrics bookkeeping for the CURRENT board/transfer hold. Read via
  // refs so `confirmBoardedAt` (the single record site) stays tick-stable — a
  // direct `elapsedInStepSec` dep would churn the callback every second and
  // destabilize the detection effect (which lists `confirmBoarded`).
  const elapsedInStepSecRef = useRef(elapsedInStepSec);
  elapsedInStepSecRef.current = elapsedInStepSec;
  // known-limit (R6-3): 이 refs는 화면 마운트 수명 동안만 유지된다. 앱 재시작으로
  // 세션이 복원되면(progressAnchor 복원) 그 이전 hold의 softFired/dismissedCount는
  // 소실되어, 복원 후 재확정되는 hold는 softFired가 보수적으로 false로 기록된다
  // (감지 성공을 과소 집계하는 방향 — 과대 집계가 아님). v1 진단 목적상 허용이며
  // 이 refs의 영속화는 의도적으로 미구현.
  const episodeSoftFiredRef = useRef(false);
  const episodeDismissCountRef = useRef(0);
  const pendingResolutionRef = useRef<DetectionResolution | null>(null);

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
    // Only when confirming a WAITING step — otherwise waitingLineId/StationName
    // are '' and the (stale) trains would be logged with an empty station.
    if (isWaitingStep) {
      appendDepartedTrains(
        collectEstimates({
          trains: trains ?? [],
          lineId: waitingLineId,
          stationName: waitingStationName,
          nowMs: Date.now(),
        }),
        Date.now()
      );
      // Detection metric: one confirmed board/transfer hold. resolution defaults
      // to 'manual' when no funnel wrapper set a more specific one. Fire-and-forget
      // (never blocks the advance); the service swallows its own failures.
      void recordDetectionEpisode({
        recordedAtMs: Date.now(),
        sessionKey: session ? String(session.startedAt) : null,
        stepIndex: currentIndex,
        stepKind: currentStep?.kind === 'transfer' ? 'transfer' : 'board',
        stationName: waitingStationName,
        lineId: waitingLineId,
        // R6-1: waitedSec은 hold 시작→탑승 시각(atMs) 구간이어야 한다. 소급 열차
        // 선택은 atMs가 과거라 확정 시점까지의 초과분((now - atMs))을 빼야 실제
        // 대기시간이 된다. 즉시 수동 확정은 atMs≈now라 뺄 값이 0(기존과 동일).
        waitedSec: Math.max(
          0,
          Math.round(elapsedInStepSecRef.current - (Date.now() - atMs) / 1000)
        ),
        softFired: episodeSoftFiredRef.current,
        dismissedCount: episodeDismissCountRef.current,
        resolution: pendingResolutionRef.current ?? 'manual',
      });
      episodeSoftFiredRef.current = false;
      episodeDismissCountRef.current = 0;
      pendingResolutionRef.current = null;
    }
    goNextAt(atMs);
  }, [clearAutoTimer, currentIndex, currentStep, goNextAt, isWaitingStep, session, trains, waitingLineId, waitingStationName]);

  const confirmBoarded = useCallback((): void => confirmBoardedAt(Date.now()), [confirmBoardedAt]);

  // Soft-confirm "예": accept the detected departure. Tags the resolution before
  // funneling through the single advance path.
  const confirmBoardedFromSoftConfirm = useCallback((): void => {
    pendingResolutionRef.current = 'soft-accept';
    confirmBoarded();
  }, [confirmBoarded]);

  const dismissSoftConfirm = useCallback((): void => {
    clearAutoTimer();
    // Only key the cooldown when an active prompt is being dismissed — opening
    // the sheet while inactive must not wipe an existing cooldown to null.
    if (softConfirm !== null) {
      cooldownTrainIdRef.current = softConfirm.trainId;
    }
    setSoftConfirm(null);
  }, [clearAutoTimer, softConfirm]);

  // "아직 안 탔어요" — the ONLY path that counts as a dismissal against this hold
  // (detection metric). The "다른 열차예요" / waiting-card links also route through
  // dismissSoftConfirm (to clear a pending prompt before opening the sheet), but
  // those must NOT inflate dismissedCount — else the same 'train-select' outcome
  // would record 0 or 1 depending on entry path. Keeps the metric's field doc
  // ("아직 안 탔어요 탭 수") honest.
  const dismissSoftConfirmNotYet = useCallback((): void => {
    if (softConfirm !== null) {
      episodeDismissCountRef.current += 1;
    }
    dismissSoftConfirm();
  }, [softConfirm, dismissSoftConfirm]);

  // Opening the sheet always dismisses any pending soft-confirm first, so its
  // 4s auto-advance can never fire behind the sheet. It also captures the step
  // context at open time (mode/index/station/line) so a tick advancing the step
  // behind the modal can't misroute the pick. dismissSoftConfirm is a no-op (bar
  // cooldown bookkeeping) when nothing is pending. Shared by the waiting-card
  // link and the soft-confirm "다른 열차예요" action; alight → no-op.
  const openTrainSelect = useCallback((): void => {
    dismissSoftConfirm();
    if (currentStep === undefined) return;
    if (currentStep.kind === 'board' || currentStep.kind === 'transfer') {
      setTrainSelectContext({
        mode: 'confirm',
        stepIndex: currentIndex,
        stationName: currentStep.stationName,
        lineId: waitingLineId,
        direction: currentStep.direction,
      });
    } else if (currentStep.kind === 'ride') {
      setTrainSelectContext({
        mode: 'rebase',
        stepIndex: currentIndex,
        stationName: currentStep.fromStationName,
        lineId: currentStep.lineId,
        direction: currentStep.direction,
      });
    }
  }, [dismissSoftConfirm, currentStep, currentIndex, waitingLineId]);

  const closeTrainSelect = useCallback((): void => setTrainSelectContext(null), []);

  // Route the pick by the captured context, not the live step. If the step
  // changed underfoot (currentIndex ≠ captured), just close — never act on a
  // stale target.
  const handleTrainSelected = useCallback((departedAtMs: number): void => {
    const ctx = trainSelectContext;
    setTrainSelectContext(null);
    if (ctx === null || currentIndex !== ctx.stepIndex) return;
    if (ctx.mode === 'confirm') {
      // Detection metric: this hold resolved via a train-select pick.
      pendingResolutionRef.current = 'train-select';
      confirmBoardedAt(departedAtMs);
    } else {
      rebaseAt(departedAtMs, ctx.stepIndex);
    }
  }, [trainSelectContext, currentIndex, confirmBoardedAt, rebaseAt]);

  // Estimated current position for the sheet marker — the last station the
  // train has reached (NOT the next stop), so picking it can't over-advance.
  // Live (recomputes per tick); NOT frozen in context.
  const rideCurrentStationId = useMemo((): string | null => {
    if (currentStep?.kind !== 'ride') return null;
    const { nextHopIndex } = computeRideProgress(currentStep, elapsedInStepSec);
    return nextHopIndex === 0
      ? currentStep.fromStationId
      : currentStep.hops[nextHopIndex - 1]?.toStationId ?? currentStep.fromStationId;
  }, [currentStep, elapsedInStepSec]);

  // Ride-only time correction: freeze the active ride step so a tick advancing
  // it behind the modal can't change the list, mirroring trainSelectContext.
  const openStationRebase = useCallback((): void => {
    if (currentStep?.kind !== 'ride') return;
    setStationRebaseContext({ stepIndex: currentIndex, step: currentStep });
  }, [currentStep, currentIndex]);

  const closeStationRebase = useCallback((): void => setStationRebaseContext(null), []);

  // Rebase the anchor to "my train is at station X": now − cumulative ride
  // seconds to that station. Route by the captured context, guarded on the
  // step not changing underfoot — never act on a stale ride.
  const handleStationRebaseSelected = useCallback((stationId: string): void => {
    const ctx = stationRebaseContext;
    setStationRebaseContext(null);
    if (ctx === null || currentIndex !== ctx.stepIndex) return;
    const sec = cumulativeRideSecondsTo(ctx.step, stationId);
    if (sec === null) return;
    rebaseAt(Date.now() - sec * 1000, ctx.stepIndex);
  }, [stationRebaseContext, currentIndex, rebaseAt]);

  const openDestinationSheet = useCallback((): void => setDestinationSheetOpen(true), []);
  const closeDestinationSheet = useCallback((): void => setDestinationSheetOpen(false), []);

  // 세션 사본을 SSOT로 갱신하고, 출퇴근 세션이면 원본(CommuteRoute)에도 write-back.
  const applyDestinationPreferences = useCallback(
    (next: Readonly<Record<string, readonly string[]>>): void => {
      // 귀속 가드: mount-frozen session과 같은 여정일 때만 쓴다 (H2 원칙).
      const live = getGuidanceSession();
      if (session === null || live === null || live.startedAt !== session.startedAt) return;
      setGuidanceSession({ ...live, destinationPreferences: next });
      if (live.sourceCommuteType !== undefined && user?.id) {
        // fire-and-forget — 원격 실패해도 세션 필터는 이미 적용됨 (재시도는 다음 토글).
        void updateBoardingPreferences(user.id, live.sourceCommuteType, next);
      }
    },
    [session, user?.id]
  );

  const handleDestinationToggle = useCallback(
    (name: string): void => {
      if (boardingKey === null) return;
      const prev = getGuidanceSession()?.destinationPreferences ?? {};
      const cur = prev[boardingKey] ?? [];
      const nextList = cur.includes(name) ? cur.filter(d => d !== name) : [...cur, name];
      const next: Record<string, readonly string[]> = { ...prev };
      if (nextList.length === 0) {
        delete next[boardingKey];
      } else {
        next[boardingKey] = nextList;
      }
      applyDestinationPreferences(next);
    },
    [boardingKey, applyDestinationPreferences]
  );

  const handleDestinationClear = useCallback((): void => {
    if (boardingKey === null) return;
    const prev = getGuidanceSession()?.destinationPreferences ?? {};
    if (!(boardingKey in prev)) return;
    const next: Record<string, readonly string[]> = { ...prev };
    delete next[boardingKey];
    applyDestinationPreferences(next);
  }, [boardingKey, applyDestinationPreferences]);

  // Reset per-step guards whenever the active step changes (incl. undo via
  // goPrev). Also auto-closes the sheet so a stale-step pick is impossible.
  useEffect(() => {
    clearAutoTimer();
    setSoftConfirm(null);
    setTrainSelectContext(null);
    setStationRebaseContext(null);
    firedForIndexRef.current = null;
    cooldownTrainIdRef.current = null;
    prevTrainsRef.current = null;
    // Reset detection-metrics bookkeeping for the new hold.
    episodeSoftFiredRef.current = false;
    episodeDismissCountRef.current = 0;
    pendingResolutionRef.current = null;
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
    // Only act on a genuine poll update. A step transition (or other dep change)
    // re-runs this effect with the same (possibly stale) `trains` reference —
    // processing it would seed prevTrainsRef with the previous station's array
    // and mis-detect all of it as departures on the next fresh snapshot.
    if (lastSeenTrainsRef.current === trains) return;
    lastSeenTrainsRef.current = trains;
    const next = trains ?? [];
    const result = detectDeparture({
      prev: prevTrainsRef.current,
      next,
      awaited: {
        lineId: waitingLineId,
        directionName: waitingDirection,
        preferredDestinations: selectedDestinations,
      },
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
    // Keep logging departures even while a sheet is open (real-time list), but
    // never arm the soft-confirm auto-advance behind the modal — that would
    // advance the journey and force-close the sheet under the user (종점행 선택
    // 시트도 열차 선택 시트와 같은 원칙).
    if (
      result.departed &&
      result.trainId !== null &&
      result.trainId !== cooldownTrainIdRef.current &&
      firedForIndexRef.current !== currentIndex &&
      trainSelectContext === null &&
      !destinationSheetOpen
    ) {
      setSoftConfirm({ trainId: result.trainId });
      // Detection metric: the soft-confirm fired at least once this hold.
      episodeSoftFiredRef.current = true;
      clearAutoTimer();
      // Inline wrapper tags the resolution as 'auto' before the shared funnel —
      // keeps `confirmBoarded` as the referenced identity so the effect deps are
      // unchanged.
      autoTimerRef.current = setTimeout(() => {
        pendingResolutionRef.current = 'auto';
        confirmBoarded();
      }, SOFT_CONFIRM_AUTO_MS);
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
    trainSelectContext,
    destinationSheetOpen,
    selectedDestinations,
  ]);

  // Local-notification bridge — schedule/reschedule for the earliest train while
  // waiting. 폴링마다 earliestTrain 참조가 갱신되어 effect가 재실행되므로,
  // boardingAlertService가 대기 컨텍스트(세션·역·variant) dedup으로 승강장 대기당
  // 최대 1회만 발사한다 — 대기 중 열차가 A→B로 승계돼도(각기 다른 id) 중복 발사를
  // 막는다(발사된 알림은 취소 불가 — pending만 cancel-then-schedule). The screen
  // is foreground when scheduling, so tapping the alert just returns here.
  const notificationSettings = user?.preferences?.notificationSettings ?? null;
  useEffect(() => {
    if (!session || !isWaitingStep || earliestTrain?.arrivalTime == null) return;
    void scheduleBoardingAlert({
      context: 'guidance',
      // 화면 마운트 시 고정 read한 세션의 키 — 서비스가 스토어를 다시 읽지 않게
      // 호출자가 전달한다(in-flight 세션 교체 오스탬프 방지, H2).
      sessionKey: String(session.startedAt),
      stationName: waitingStationName,
      finalDestination: earliestTrain.finalDestination,
      arrivalTime: earliestTrain.arrivalTime,
      settings: notificationSettings,
      variant: currentStep?.kind === 'transfer' ? 'transfer' : 'board',
    });
  }, [session, isWaitingStep, earliestTrain, waitingStationName, currentStep?.kind, notificationSettings]);

  // 하차 임박 알림 — ride 스텝의 도착 예정 시각으로 pending 알림을 예약한다.
  // `nowMs - elapsedInStepSec*1000`은 현재 스텝의 시작 시각(anchor 파생)이라
  // 1Hz 틱에 불변 → 이 값이 바뀌는 건 anchor 보정(goNextAt/rebaseAt)이나 스텝
  // 전환뿐이므로, effect 재실행 = 재예약 필요 시점과 정확히 일치한다.
  const rideAlightAtMs =
    currentStep?.kind === 'ride'
      ? Math.round(nowMs - elapsedInStepSec * 1000 + currentStep.durationMinutes * 60_000)
      : null;
  const nextStep = steps[currentIndex + 1];
  useEffect(() => {
    if (
      rideAlightAtMs === null ||
      nextStep === undefined ||
      (nextStep.kind !== 'transfer' && nextStep.kind !== 'alight')
    ) {
      // ride가 아닌 스텝(대기/도착)으로 이동 — 이전 ride의 pending은 더는 유효하지 않다.
      void cancelAlightAlert();
      return;
    }
    if (!session) return;
    void scheduleAlightAlert({
      stationName: nextStep.stationName,
      nextKind: nextStep.kind,
      toLineName: nextStep.kind === 'transfer' ? nextStep.toLineName : undefined,
      arrivalAtMs: rideAlightAtMs,
      stepKey: `${session.startedAt}:${currentIndex}`,
      sessionKey: String(session.startedAt),
      settings: notificationSettings,
    });
  }, [rideAlightAtMs, nextStep, currentIndex, session, notificationSettings]);

  // Clear only the local auto-advance timer on unmount (subscription-cleanup
  // rule). Boarding/alight alerts are intentionally NOT cancelled here: the
  // guidance session can outlive this screen (rider closes the screen mid-ride),
  // and the alight alert fires at an absolute time regardless of whether the
  // screen is mounted. Cancellation responsibility moves to the session-end sync
  // hook (useGuidanceAlertCleanupSync), which cancels when the session actually
  // ends — not merely when the screen is dismissed.
  useEffect(() => {
    return () => {
      clearAutoTimer();
    };
  }, [clearAutoTimer]);

  const softConfirmHandlers = useMemo(
    () =>
      softConfirm !== null
        ? { onYes: confirmBoardedFromSoftConfirm, onNotYet: dismissSoftConfirmNotYet, onOther: openTrainSelect }
        : null,
    [softConfirm, confirmBoardedFromSoftConfirm, dismissSoftConfirmNotYet, openTrainSelect]
  );

  // Candidates for the sheet: recent departures at the station/line captured
  // when the sheet was opened (not the live step), within this session and not
  // in the future.
  const trainSelectEntries = useMemo((): readonly DepartedTrainEntry[] => {
    if (!session || trainSelectContext === null) return [];
    const { stationName, lineId, direction } = trainSelectContext;
    const numbered = /^[1-9]$/.test(lineId);
    // Store prune only runs on non-empty appends, so a long ride without new
    // departures can leave stale entries — filter the retention window here too.
    const base = getDepartedTrainLog().filter(
      (e) =>
        e.stationName === stationName &&
        (!numbered || e.lineId === lineId) &&
        e.departedAtMs <= nowMs &&
        e.departedAtMs >= session.startedAt &&
        e.departedAtMs >= nowMs - DEPARTED_LOG_RETENTION_MS
    );
    // Direction ranking (no drop) — the log records both directions, so surface
    // travel-direction matches first, but keep everything so a same-direction
    // short-turn (종착역명이 방면명과 다름) the rider actually took stays selectable.
    // Stable within each group (base is already departedAtMs desc).
    if (direction === null) return base;
    const matched = base.filter((e) => e.finalDestination === direction);
    const rest = base.filter((e) => e.finalDestination !== direction);
    return [...matched, ...rest];
  }, [session, trainSelectContext, nowMs]);

  // Commute-log COMPLETION is owned solely by the app-level useGuidanceCommuteLogSync
  // hook (Z1): the screen only marks local completion (updateGuidanceLocalCompletion
  // in the isAtEnd transition effect above), and the hook's emit-driven branch writes
  // the arrival with localCompletedAt as the arrival time. Keeping a second writer
  // here raced that branch on the same localCompletedAt emit → duplicate Firestore
  // writes (AA2). The hook covers both first-completion and retry.

  // Whole-journey progress for the header bar. Total excludes platform wait
  // (same basis as remainingSeconds), so the fraction is internally honest.
  const totalSeconds = useMemo(
    () => steps.reduce((acc, s) => acc + s.durationMinutes * 60, 0),
    [steps]
  );
  const progress =
    totalSeconds <= 0 ? 0 : isAtEnd ? 1 : (totalSeconds - remainingSeconds) / totalSeconds;

  const handleExit = useCallback((): void => {
    clearAutoTimer();
    void cancelBoardingAlert();
    void cancelAlightAlert();
    clearDepartedTrainLog();
    clearGuidanceSession();
    navigation.goBack();
  }, [clearAutoTimer, navigation]);

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
      {bgPermStatus !== 'hidden' && (
        <View style={styles.bgPermWrap}>
          <BackgroundPermissionBanner
            mode={bgPermStatus}
            onPrimary={bgPermStatus === 'settings' ? openBgSettings : requestBgPermission}
            onDismiss={dismissBgPermission}
          />
        </View>
      )}
      {currentStep !== undefined && (
        <View style={styles.nowCardWrap}>
          <GuidanceNowCard
            step={currentStep}
            elapsedInStepSec={currentStep.kind === 'board' ? 0 : elapsedInStepSec}
            liveWaitText={liveWaitText}
            softConfirm={softConfirmHandlers}
            onOpenTrainSelect={openTrainSelect}
            onOpenStationRebase={openStationRebase}
            waitPreview={waitPreview}
            destinationFilterLabel={destinationFilterLabel}
            onOpenDestinationFilter={isWaitingStep ? openDestinationSheet : undefined}
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
        nextEmphasis={isHolding ? 'primary' : 'correction'}
      />
      {/* 열차 선택 시트에는 종점행 필터를 걸지 않는다 — 사용자가 필터 밖 열차를 탔다는
          사실 보고를 막으면 안 되므로 전체 후보를 유지한다. */}
      <TrainSelectSheet
        visible={trainSelectContext !== null}
        entries={trainSelectEntries}
        onSelect={handleTrainSelected}
        onClose={closeTrainSelect}
      />
      <DestinationFilterSheet
        visible={destinationSheetOpen}
        options={destinationOptions(trainPools.display, selectedDestinations, nowMs)}
        selected={selectedDestinations}
        onToggle={handleDestinationToggle}
        onClear={handleDestinationClear}
        onClose={closeDestinationSheet}
      />
      {stationRebaseContext !== null && (
        <StationRebaseSheet
          visible
          step={stationRebaseContext.step}
          currentStationId={rideCurrentStationId}
          onSelect={handleStationRebaseSelected}
          onClose={closeStationRebase}
        />
      )}
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
    bgPermWrap: {
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
