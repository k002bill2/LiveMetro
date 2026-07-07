/**
 * useGuidanceProgress — hybrid journey tracking for the live guidance screen.
 *
 * Subway GPS is unreliable underground, so progress is *estimated* from wall
 * clock time and *corrected* by the user: the hook keeps a manual anchor
 * (step index + the moment it was confirmed) and lets elapsed time flow the
 * rider forward through timed steps. Board AND transfer steps hold until the
 * user (or the screen's soft-confirm) taps "탑승했어요"/"환승 열차에 탔어요"
 * (the wait for that train is realtime data, never estimated).
 *
 * All math lives in pure functions (`guidanceSteps.ts`); this hook only owns
 * the 1Hz tick (focus-gated, cleaned up) and the anchor state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeProgress,
  computeRemainingSeconds,
} from '@/services/guidance/guidanceSteps';
import type { GuidanceStep } from '@/models/guidance';

interface UseGuidanceProgressOptions {
  /** Epoch ms when guidance started (anchor for the first step). */
  readonly startedAt: number;
  /** Gate for the 1Hz tick — pass `useIsFocused()` from the screen. */
  readonly enabled: boolean;
}

export interface UseGuidanceProgressResult {
  readonly currentIndex: number;
  /** True while parked on a board or transfer step (auto-progress cannot pass it). */
  readonly isHolding: boolean;
  readonly elapsedInStepSec: number;
  /** Estimated seconds to destination (platform wait excluded while holding). */
  readonly remainingSeconds: number;
  /** Estimated arrival time, epoch ms. */
  readonly etaMs: number;
  /** Shared 1Hz clock for countdown rendering. */
  readonly nowMs: number;
  readonly isAtEnd: boolean;
  /** Manual correction: confirm the current step is done (rebases the anchor). */
  readonly goNext: () => void;
  /** goNext와 동일하되 anchor 시각을 지정(과거 허용, 미래는 now로 clamp). */
  readonly goNextAt: (atMs: number) => void;
  /** 현재 스텝 인덱스는 유지하고 anchor 시각만 교체 (ride 중 열차 변경용). */
  readonly rebaseAt: (atMs: number) => void;
  /** Manual correction: step back (rebases the anchor). */
  readonly goPrev: () => void;
}

interface Anchor {
  readonly index: number;
  readonly atMs: number;
}

export const useGuidanceProgress = (
  steps: readonly GuidanceStep[],
  options: UseGuidanceProgressOptions
): UseGuidanceProgressResult => {
  const { startedAt, enabled } = options;
  const [anchor, setAnchor] = useState<Anchor>({ index: 0, atMs: startedAt });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // 1Hz tick — focus-gated, cleared on unmount (subscription-cleanup rule).
  useEffect(() => {
    if (!enabled) return undefined;
    setNowMs(Date.now());
    const tickId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tickId);
  }, [enabled]);

  const progress = useMemo(
    () => computeProgress(steps, anchor.index, (nowMs - anchor.atMs) / 1000),
    [steps, anchor, nowMs]
  );

  const remainingSeconds = useMemo(
    () => computeRemainingSeconds(steps, progress),
    [steps, progress]
  );

  // Functional setState recomputes the live index inside the updater, so the
  // callbacks never depend on tick-churned state (no per-second re-creation).
  const lastIndex = Math.max(0, steps.length - 1);

  const goNextAt = useCallback((atMs: number): void => {
    const clamped = Math.min(atMs, Date.now());
    setAnchor(prev => {
      const cur = computeProgress(steps, prev.index, (Date.now() - prev.atMs) / 1000);
      return { index: Math.min(cur.currentIndex + 1, lastIndex), atMs: clamped };
    });
  }, [steps, lastIndex]);

  const goNext = useCallback((): void => goNextAt(Date.now()), [goNextAt]);

  const rebaseAt = useCallback((atMs: number): void => {
    const clamped = Math.min(atMs, Date.now());
    setAnchor(prev => {
      const cur = computeProgress(steps, prev.index, (Date.now() - prev.atMs) / 1000);
      return { index: cur.currentIndex, atMs: clamped };
    });
  }, [steps]);

  const goPrev = useCallback(() => {
    setAnchor(prev => {
      const cur = computeProgress(steps, prev.index, (Date.now() - prev.atMs) / 1000);
      return { index: Math.max(cur.currentIndex - 1, 0), atMs: Date.now() };
    });
  }, [steps]);

  return {
    currentIndex: progress.currentIndex,
    isHolding: progress.isHolding,
    elapsedInStepSec: progress.elapsedInStepSec,
    remainingSeconds,
    etaMs: nowMs + remainingSeconds * 1000,
    nowMs,
    isAtEnd: steps.length > 0 && progress.currentIndex === steps.length - 1,
    goNext,
    goNextAt,
    rebaseAt,
    goPrev,
  };
};
