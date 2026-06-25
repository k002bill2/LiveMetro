/**
 * useCommuteHeroEstimate — single source of truth for the commute hero estimate
 * shared by HomeScreen (MLHeroCard / CommuteRouteCard) and
 * WeeklyPredictionScreen (the big number + range + departure timestamp).
 *
 * Both screens read their headline minutes, arrival/departure times and station
 * names from THIS hook, so they can never diverge — previously HomeScreen showed
 * graph ride minutes while WeeklyPredictionScreen showed an unrelated
 * `4+3+10+3 = 20` fallback constant.
 *
 * This hook is the SOLE caller of useMLPrediction / useFirestoreMorningCommute /
 * useCommuteRouteSummary and the station-name resolution. Screens must NOT call
 * those directly as well, or the expensive hooks would run twice per screen
 * (double model-init / log-fetch / Firestore read — memory
 * `project_single_instance_expensive_hook`).
 *
 * Estimate resolution (mirrors the chain HomeScreen used inline):
 *   1. ML prediction (heroProps)           — best signal; door-to-door minutes
 *                                             from predicted departure→arrival.
 *   2. Registered commute + route summary  — graph-search ride minutes; arrival
 *                                             derived from the registered
 *                                             departure + ride duration. Gated
 *                                             on resolved endpoint names, faithful
 *                                             to the original HomeScreen behavior.
 *   null when neither is available.
 */
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/services/auth/AuthContext';
import { trainService } from '@/services/train/trainService';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import {
  useFirestoreMorningCommute,
  useFirestoreCommuteLeg,
} from '@/hooks/useFirestoreMorningCommute';
import { useCommuteRouteSummary, type CommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';
import { isUsableCommuteTime, type CommuteTime } from '@/models/user';
import { addMinutesToHHmm, minutesBetween } from '@screens/home/homeTimeFormat';
import { resolveActiveCommuteType, type CommuteLeg } from '@/utils/commuteSchedule';

export interface CommuteHeroValue {
  /** Predicted commute minutes (display number). */
  predictedMinutes: number;
  /** Difference vs personal baseline (negative = faster than usual). */
  deltaMinutes?: number;
  /** Predicted arrival HH:mm. */
  arrivalTime?: string;
  /** Model confidence 0–1 (ML only; undefined for the graph fallback). */
  confidence?: number;
  /** Origin station display name (when resolved). */
  origin?: string;
  /** Destination station display name (when resolved). */
  destination?: string;
}

export interface CommuteStationNames {
  origin?: string;
  destination?: string;
  originLineId?: string;
}

export interface CommuteHeroEstimate {
  /** Resolved 2-store morning commute (profile gated by isUsableCommuteTime ?? onboarding). */
  morningCommute: CommuteTime | null;
  /** Raw profile (store #1) value — exposed for dev diagnostics. */
  profileMorningCommute: CommuteTime | null | undefined;
  /** Raw onboarding (store #2) value — exposed for dev diagnostics. */
  onboardingMorningCommute: CommuteTime | null;
  /**
   * Time-resolved active commute (morning OR evening). Equals `morningCommute`
   * when direction='morning'. HomeScreen consumes this for the card + guidance.
   */
  activeCommute: CommuteTime | null;
  /** Which leg is active right now. Always 'morning' for direction='morning'. */
  activeCommuteType: CommuteLeg;
  /** Graph-search facts (transfer/station/fare/ride) for the route card. */
  routeSummary: CommuteRouteSummary;
  /** Resolved origin/destination names + origin line id. */
  commuteStationNames: CommuteStationNames;
  /** The shared hero estimate, or null when no commute/prediction is available. */
  effectiveHero: CommuteHeroValue | null;
  /** Departure HH:mm — ML predicted departure ?? registered departure. */
  effectiveDepartureTime: string | undefined;
  /** True only when a real ML prediction exists (gates the "데이터 수집중" copy). */
  hasRealPrediction: boolean;
}

export function useCommuteHeroEstimate(
  // Forwarded to the live commute subscriptions as a re-subscribe trigger.
  // HomeScreen bumps it on focus so a returning user gets a fresh read;
  // other consumers (CommuteSettings / WeeklyPrediction) omit it (default 0).
  refreshNonce: number = 0,
  // 'auto' lets the home card switch morning↔evening by time-of-day. The
  // default 'morning' keeps WeeklyPrediction (and any other consumer) on the
  // morning leg unchanged — direction='auto' is strictly opt-in.
  direction: 'morning' | 'auto' = 'morning',
): CommuteHeroEstimate {
  const { user } = useAuth();
  const { prediction: mlPrediction, baselineMinutes } = useMLPrediction();

  // Two stores populate the morning commute (full rationale in HomeScreen).
  // morningCommute is always resolved — the field name stays truthful, and the
  // ML hero is morning-based so it's needed regardless of the active leg.
  // Profile (#1) wins only when usable — NotificationTimeScreen can leave a
  // non-null morningCommute with empty station ids, and a plain `??` would let
  // that empty object shadow the valid onboarding data (#2).
  const onboardingMorningCommute = useFirestoreMorningCommute(user?.id, refreshNonce);
  const profileMorningCommute =
    user?.preferences.commuteSchedule?.weekdays?.morningCommute;
  const morningCommute =
    (isUsableCommuteTime(profileMorningCommute) ? profileMorningCommute : null) ??
    onboardingMorningCommute;

  // Active leg — only consult the clock in 'auto' mode (short-circuit keeps the
  // resolver out of the 'morning' path entirely, so WeeklyPrediction is inert).
  const activeLeg: CommuteLeg =
    direction === 'auto' ? resolveActiveCommuteType(new Date()) : 'morning';

  // Evening leg (two-store, symmetric to morning). The onboarding subscription
  // is gated by `enabled` so the 'morning' path opens no needless onSnapshot.
  const profileEveningCommute =
    user?.preferences.commuteSchedule?.weekdays?.eveningCommute;
  const onboardingEveningCommute = useFirestoreCommuteLeg(
    user?.id,
    'evening',
    refreshNonce,
    direction === 'auto',
  );
  const eveningCommute =
    (isUsableCommuteTime(profileEveningCommute) ? profileEveningCommute : null) ??
    onboardingEveningCommute;

  const activeCommute: CommuteTime | null =
    activeLeg === 'evening' ? eveningCommute : morningCommute;

  const routeSummary = useCommuteRouteSummary(
    activeCommute?.stationId,
    activeCommute?.destinationStationId,
    activeCommute?.transferStationId,
  );

  const [commuteStationNames, setCommuteStationNames] = useState<CommuteStationNames>({});

  useEffect(() => {
    if (!activeCommute) {
      setCommuteStationNames({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [origin, dest] = await Promise.all([
          trainService.getStation(activeCommute.stationId).catch(() => null),
          trainService.getStation(activeCommute.destinationStationId).catch(() => null),
        ]);
        if (cancelled) return;
        setCommuteStationNames({
          origin: origin?.name,
          destination: dest?.name,
          originLineId: origin?.lineId,
        });
      } catch {
        // ignore — consumers tolerate missing endpoint names
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCommute]);

  // 1. ML prediction — door-to-door minutes from predicted departure→arrival.
  const heroProps = useMemo<CommuteHeroValue | null>(() => {
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

  // 2. Registered commute + graph route summary fallback. Gated on resolved
  // endpoint names (faithful to HomeScreen) so the route label is always
  // available alongside the number.
  const registeredCommuteHero = useMemo<CommuteHeroValue | null>(() => {
    if (!activeCommute) return null;
    if (!commuteStationNames.origin || !commuteStationNames.destination) return null;
    if (!routeSummary.ready || routeSummary.rideMinutes === undefined) return null;
    const arrival = addMinutesToHHmm(
      activeCommute.departureTime,
      routeSummary.rideMinutes,
    );
    if (!arrival) return null;
    return {
      predictedMinutes: routeSummary.rideMinutes,
      deltaMinutes: undefined,
      arrivalTime: arrival,
      confidence: undefined,
      origin: commuteStationNames.origin,
      destination: commuteStationNames.destination,
    };
  }, [activeCommute, commuteStationNames, routeSummary]);

  // ML (heroProps) is a morning-only model (commute logs aren't split by leg).
  // It feeds the hero ONLY on the morning leg; evening uses the graph estimate
  // (registeredCommuteHero) so a morning number is never mislabeled as evening.
  const effectiveHero =
    (activeLeg === 'morning' ? heroProps : null) ?? registeredCommuteHero;

  const effectiveDepartureTime =
    (activeLeg === 'morning' ? mlPrediction?.predictedDepartureTime : undefined) ??
    activeCommute?.departureTime;

  return {
    morningCommute,
    profileMorningCommute,
    onboardingMorningCommute,
    activeCommute,
    activeCommuteType: activeLeg,
    routeSummary,
    commuteStationNames,
    effectiveHero,
    effectiveDepartureTime,
    hasRealPrediction: activeLeg === 'morning' && mlPrediction !== null,
  };
}

export default useCommuteHeroEstimate;
