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
import {
  addMinutesToHHmm,
  isWrappedTimePair,
  minutesBetween,
} from '@screens/home/homeTimeFormat';
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

/**
 * Internal: resolved names plus the OD they were resolved FOR. The lookup is
 * asynchronous, so without this provenance a commute/leg change would leave
 * the previous OD's names in state for one window — and since those same
 * stale names feed both the prediction's route context and the OD gate that
 * checks it, the two would agree and a prediction computed for the old route
 * would be promoted onto the new commute.
 */
interface ResolvedCommuteStationNames extends CommuteStationNames {
  forOriginId?: string;
  forDestinationId?: string;
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
  /**
   * True only when the ML prediction was actually promoted to the hero
   * (heroProps survived the OD-match / inversion gates). Graph fallback and
   * discarded predictions report false (gates the "데이터 수집중" copy).
   */
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

  // Declared before useMLPrediction (hook order) — the resolved names feed the
  // prediction's route context; the resolving effect lives further down.
  const [resolvedStationNames, setResolvedStationNames] =
    useState<ResolvedCommuteStationNames>({});

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

  // Expose the names only while they still belong to the CURRENT commute. On a
  // leg switch activeCommute changes a render before the async lookup lands, so
  // an identity check on the OD ids is what keeps the stale (reverse-route)
  // names out of both the route context and the gate below. Memoised because
  // HomeScreen holds this object in a useCallback dep list.
  const namesMatchActiveCommute =
    resolvedStationNames.forOriginId === activeCommute?.stationId &&
    resolvedStationNames.forDestinationId === activeCommute?.destinationStationId;
  const commuteStationNames = useMemo<CommuteStationNames>(
    () =>
      namesMatchActiveCommute
        ? {
            origin: resolvedStationNames.origin,
            destination: resolvedStationNames.destination,
            originLineId: resolvedStationNames.originLineId,
          }
        : {},
    [
      namesMatchActiveCommute,
      resolvedStationNames.origin,
      resolvedStationNames.destination,
      resolvedStationNames.originLineId,
    ],
  );

  // Register the 출근 OD with the prediction pipeline so the fallback model
  // averages only that leg's logs (station-NAME matched — id domains diverge
  // across log writers). Morning leg only: commuteStationNames tracks the
  // ACTIVE leg, so on the evening leg it would name the reverse OD.
  const { prediction: mlPrediction, baselineMinutesFor } = useMLPrediction(
    activeLeg === 'morning'
      ? {
          originStationName: commuteStationNames.origin,
          destinationStationName: commuteStationNames.destination,
        }
      : undefined,
  );

  const routeSummary = useCommuteRouteSummary(
    activeCommute?.stationId,
    activeCommute?.destinationStationId,
    activeCommute?.transferStationId,
  );

  useEffect(() => {
    if (!activeCommute) {
      setResolvedStationNames({});
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
        setResolvedStationNames({
          origin: origin?.name,
          destination: dest?.name,
          originLineId: origin?.lineId,
          forOriginId: activeCommute.stationId,
          forDestinationId: activeCommute.destinationStationId,
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
    // Morning-only is enforced *here*, not just at the effectiveHero gate
    // below, because the baseline lookup depends on it: commuteStationNames
    // tracks the ACTIVE leg, so on the evening leg it would name the reverse
    // OD — producing an evening baseline for a morning number. Bailing out
    // early keeps the names below provably the morning endpoints.
    if (activeLeg !== 'morning') return null;
    // Promote only a prediction computed for the registered 출근 OD. A
    // route-less prediction (initial state, names not yet resolved) or one
    // tagged with a different OD was averaged over the wrong population —
    // mixed legs are exactly what produced the inverted 13:15→13:05 pair.
    // Fall through to the graph estimate instead.
    if (
      !commuteStationNames.origin ||
      !commuteStationNames.destination ||
      mlPrediction.originStationName !== commuteStationNames.origin ||
      mlPrediction.destinationStationName !== commuteStationNames.destination
    ) {
      return null;
    }
    // A morning prediction whose arrival reads earlier than its departure is
    // corrupt input (the fallback model once averaged mixed-leg logs into
    // 13:15 → 13:05), not an overnight trip — minutesBetween would read it as
    // a ~1430-minute midnight wrap. Drop it so the graph fallback shows.
    if (
      isWrappedTimePair(
        mlPrediction.predictedDepartureTime,
        mlPrediction.predictedArrivalTime,
      )
    ) {
      return null;
    }
    const minutes = minutesBetween(
      mlPrediction.predictedDepartureTime,
      mlPrediction.predictedArrivalTime,
    );
    if (minutes === null) return null;
    const baselineMinutes = baselineMinutesFor(
      commuteStationNames.origin,
      commuteStationNames.destination,
    );
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
  }, [mlPrediction, activeLeg, baselineMinutesFor, commuteStationNames]);

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

  // Departure follows the hero's provenance: the ML departure is shown only
  // when the ML hero itself survived promotion (heroProps is already null on
  // the evening leg and for discarded — inverted or OD-mismatched —
  // predictions). Otherwise the registered commute's departure pairs with the
  // graph estimate, so the two numbers never mix sources.
  const effectiveDepartureTime =
    (heroProps !== null ? mlPrediction?.predictedDepartureTime : undefined) ??
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
    // heroProps is already null on the evening leg and for discarded
    // (route-less / OD-mismatched / inverted) predictions, so this flag is
    // true exactly when the hero on screen IS the ML prediction.
    hasRealPrediction: heroProps !== null,
  };
}

export default useCommuteHeroEstimate;
