/**
 * Pattern Analysis Service
 * Analyzes commute logs to detect patterns and make predictions
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { firestore as db } from '@/services/firebase/config';
import {
  CommuteLog,
  CommutePattern,
  CommutePatternDoc,
  PredictedCommute,
  PredictedTransitSegment,
  FrequentRoute,
  DayOfWeek,
  MIN_LOGS_FOR_PATTERN,
  MIN_PATTERN_CONFIDENCE_FOR_ALERTS,
  DEFAULT_WALK_TO_STATION_MIN,
  DEFAULT_WAIT_MIN,
  DEFAULT_WALK_TO_DEST_MIN,
  RANGE_HALF_MIN_FLOOR,
  RANGE_HALF_MIN_CAP,
  calculateAverageTime,
  calculateTimeStdDev,
  calculateConfidence,
  calculateAlertTime,
  computeArrivalTime,
  deriveDirection,
  getDayOfWeek,
  formatDateString,
  isWeekday,
  fromCommutePatternDoc,
} from '@/models/pattern';
import { calculateRoute } from '@/services/route/routeService';
import { resolveInternalStationId } from '@/utils/stationIdResolver';
import {
  loadCommuteRoutesOrThrow,
  type CommuteSettings,
} from '@/services/commute/commuteService';
import {
  commuteLogService,
  RECENT_LOGS_ANALYSIS_LIMIT,
} from './commuteLogService';

const COLLECTION_NAME = 'commutePatterns';

// ============================================================================
// Service
// ============================================================================

class PatternAnalysisService {
  /** Per-user in-flight recompute — concurrent callers share one run. */
  private readonly recomputeInFlight = new Map<string, Promise<CommutePattern[]>>();

  /**
   * Analyze logs and generate patterns for a user
   */
  async analyzeAndUpdatePatterns(userId: string): Promise<CommutePattern[]> {
    // Concurrent callers share one in-flight run (WeeklyPredictionScreen
    // mounts useCommutePattern twice — directly and via usePredictionFactors).
    // Interleaved recomputes could otherwise let the older run finish last
    // and clobber the newer run's saves with its stale snapshot.
    const inFlight = this.recomputeInFlight.get(userId);
    if (inFlight) return inFlight;
    const run = this.recomputePatterns(userId).finally(() => {
      this.recomputeInFlight.delete(userId);
    });
    this.recomputeInFlight.set(userId, run);
    return run;
  }

  private async recomputePatterns(userId: string): Promise<CommutePattern[]> {
    // Settings are read with the strict variant: a read FAILURE must not be
    // conflated with "no settings saved" — the fallback scoping below could
    // then publish the wrong leg over a valid morning model during a
    // transient outage. On failure, write nothing and serve what's stored.
    let settings: CommuteSettings | null;
    try {
      settings = await loadCommuteRoutesOrThrow(userId);
    } catch {
      return this.getPatterns(userId).catch(() => []);
    }

    // Get recent logs
    const logs = await commuteLogService.getRecentLogsForAnalysis(userId);

    if (logs.length === 0) {
      return [];
    }

    // Invariant: one pattern set describes ONE origin→destination. Logs mix
    // legs (morning A→B, evening B→A, ad-hoc guidance), and averaging their
    // departure times produced meaningless stats (prod: avgDep 13:15,
    // stdDev ±311min from ~07:30 and ~18:50 rows in one mean). Scope to the
    // configured morning OD — the pattern/prediction surface is the morning
    // commute model (#271) — falling back to the dominant OD by name.
    // All four endpoint fields must be present: legacy/partial settings docs
    // can carry a truthy-but-incomplete morningRoute. Empty names would match
    // zero logs and turn every recompute into a 7-day doc wipe; missing ids
    // would ride into setDoc as undefined, which Firestore rejects
    // client-side (the #291 undefined-field class) and recomputation would
    // fail on every run. Incomplete settings degrade to the non-destructive
    // no-settings fallback.
    const morningRoute =
      settings?.morningRoute?.departureStationName &&
      settings.morningRoute.arrivalStationName &&
      settings.morningRoute.departureStationId &&
      settings.morningRoute.arrivalStationId
        ? settings.morningRoute
        : null;
    const morningOd = morningRoute
      ? {
          departure: morningRoute.departureStationName,
          arrival: morningRoute.arrivalStationName,
        }
      : null;
    // With settings the persisted route IS the configured morning route — by
    // definition — so log-derived route counting (and any stub arrival '')
    // can never leak into the stored pattern. Counting only serves the
    // no-settings fallback.
    const settingsRoute: FrequentRoute | null = morningRoute
      ? {
          departureStationId: morningRoute.departureStationId,
          departureStationName: morningRoute.departureStationName,
          arrivalStationId: morningRoute.arrivalStationId,
          arrivalStationName: morningRoute.arrivalStationName,
          // Transfer lines included: delay checks read lineIds as "lines to
          // watch", so a 7→2→분당 route must keep the middle line.
          lineIds: [
            ...new Set(
              [
                morningRoute.departureLineId,
                ...(morningRoute.transferStations ?? []).map(
                  (transfer) => transfer.lineId
                ),
                morningRoute.arrivalLineId,
              ].filter((lineId): lineId is string => Boolean(lineId))
            ),
          ],
        }
      : null;
    const scopedLogs = this.scopeLogsToSingleOd(logs, morningOd);

    // Group logs by day of week
    const logsByDay = this.groupLogsByDayOfWeek(scopedLogs);

    // Analyze each day
    const patterns: CommutePattern[] = [];

    for (const [dayOfWeek, dayLogs] of logsByDay.entries()) {
      if (dayLogs.length >= MIN_LOGS_FOR_PATTERN) {
        const pattern = this.analyzeLogsForDay(
          userId,
          dayOfWeek,
          dayLogs,
          settingsRoute
        );
        await this.savePattern(userId, pattern);
        patterns.push(pattern);
      }
    }

    // Days absent from this recompute keep no stored pattern: pre-scoping
    // recomputes wrote a doc for every day that had ANY log, and leaving those
    // behind would let getPatternForDay keep serving the mixed-leg stats this
    // scoping exists to kill. Guarded twice: the empty-fetch early return
    // above never wipes docs on a transient empty/error log read, and the
    // sweep requires an actually-loaded morning OD — loadCommuteRoutes
    // returns null for read errors too, and a destructive sweep must not run
    // on a path a network blip can reach.
    // A fetch at the query cap may have paged out whole weekdays — absence
    // from a truncated result does not prove absence of logs, so the sweep
    // only runs on a complete window.
    if (morningOd && logs.length < RECENT_LOGS_ANALYSIS_LIMIT) {
      const savedDays = new Set<DayOfWeek>(patterns.map((p) => p.dayOfWeek));
      for (let day = 0 as DayOfWeek; day <= 6; day = (day + 1) as DayOfWeek) {
        if (!savedDays.has(day)) {
          await this.deletePattern(userId, day);
        }
      }
    }

    return patterns;
  }

  /**
   * Get all patterns for a user
   */
  async getPatterns(userId: string): Promise<CommutePattern[]> {
    const patternsRef = collection(db, COLLECTION_NAME, userId, 'patterns');
    const snapshot = await getDocs(patternsRef);

    return snapshot.docs.map((docSnap) =>
      fromCommutePatternDoc(userId, docSnap.data() as CommutePatternDoc)
    );
  }

  /**
   * Get pattern for a specific day
   */
  async getPatternForDay(
    userId: string,
    dayOfWeek: DayOfWeek
  ): Promise<CommutePattern | null> {
    const patternRef = doc(
      db,
      COLLECTION_NAME,
      userId,
      'patterns',
      dayOfWeek.toString()
    );
    const docSnap = await getDoc(patternRef);

    if (!docSnap.exists()) {
      return null;
    }

    return fromCommutePatternDoc(userId, docSnap.data() as CommutePatternDoc);
  }

  /**
   * Predict commute for a specific date
   */
  async predictCommute(
    userId: string,
    date: Date = new Date()
  ): Promise<PredictedCommute | null> {
    const dayOfWeek = getDayOfWeek(date);
    const pattern = await this.getPatternForDay(userId, dayOfWeek);

    if (!pattern) {
      return null;
    }

    // Resolve transit segments — soft-fail to null route on any failure.
    // Pattern docs persist whatever id domain the source logs carried (Seoul
    // API station_cd like "3762"/"1023"), while the route graph is slug-keyed;
    // bridge at this boundary or every prediction silently loses its duration.
    // Unresolvable ids pass through unchanged so the graph's own null return
    // stays the single soft-fail path.
    const departureStationId =
      resolveInternalStationId(pattern.frequentRoute.departureStationId) ??
      pattern.frequentRoute.departureStationId;
    const arrivalStationId =
      resolveInternalStationId(pattern.frequentRoute.arrivalStationId) ??
      pattern.frequentRoute.arrivalStationId;
    let route: ReturnType<typeof calculateRoute> = null;
    try {
      route = calculateRoute(departureStationId, arrivalStationId);
    } catch {
      route = null;
    }

    const transitSegments: readonly PredictedTransitSegment[] | undefined =
      route && route.segments.length > 0
        ? route.segments.map((seg) => ({
            ...seg,
            congestionForecast: undefined,
          }))
        : undefined;

    const transitMinutes = transitSegments
      ? transitSegments.reduce((sum, seg) => sum + seg.estimatedMinutes, 0)
      : undefined;

    const walkToStationMinutes = DEFAULT_WALK_TO_STATION_MIN;
    const waitMinutes = DEFAULT_WAIT_MIN;
    const walkToDestinationMinutes = DEFAULT_WALK_TO_DEST_MIN;

    const predictedMinutes =
      transitMinutes !== undefined
        ? walkToStationMinutes + waitMinutes + walkToDestinationMinutes + transitMinutes
        : undefined;

    const predictedArrivalTime =
      predictedMinutes !== undefined
        ? computeArrivalTime(pattern.avgDepartureTime, predictedMinutes)
        : undefined;

    let predictedMinutesRange: readonly [number, number] | undefined;
    if (predictedMinutes !== undefined && pattern.stdDevMinutes > 0) {
      const half = Math.min(RANGE_HALF_MIN_CAP, Math.max(RANGE_HALF_MIN_FLOOR, Math.round(pattern.stdDevMinutes)));
      predictedMinutesRange = [predictedMinutes - half, predictedMinutes + half];
    }

    const direction = deriveDirection(route?.segments[0]);

    return {
      date: formatDateString(date),
      dayOfWeek,
      predictedDepartureTime: pattern.avgDepartureTime,
      route: pattern.frequentRoute,
      confidence: pattern.confidence,
      suggestedAlertTime: calculateAlertTime(pattern.avgDepartureTime),
      predictedMinutes,
      predictedArrivalTime,
      predictedMinutesRange,
      deltaMinutes: undefined,
      direction,
      walkToStationMinutes,
      waitMinutes,
      walkToDestinationMinutes,
      transitSegments,
    };
  }

  /**
   * Get predictions for the week ahead
   */
  async getWeekPredictions(
    userId: string,
    includeWeekends: boolean = false
  ): Promise<PredictedCommute[]> {
    const predictions: PredictedCommute[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayOfWeek = getDayOfWeek(date);

      // Skip weekends if not included
      if (!includeWeekends && !isWeekday(dayOfWeek)) {
        continue;
      }

      const prediction = await this.predictCommute(userId, date);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    return predictions;
  }

  /**
   * Check if there's a pattern match for today
   */
  async hasTodayPattern(userId: string): Promise<boolean> {
    const dayOfWeek = getDayOfWeek(new Date());
    const pattern = await this.getPatternForDay(userId, dayOfWeek);
    return pattern !== null && pattern.confidence >= MIN_PATTERN_CONFIDENCE_FOR_ALERTS;
  }

  /**
   * Get suggested alert time for today
   */
  async getTodaySuggestedAlertTime(userId: string): Promise<string | null> {
    const prediction = await this.predictCommute(userId);
    return prediction?.suggestedAlertTime || null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Restrict logs to a single origin→destination before any statistics run.
   *
   * Matching is by station NAME (both ends): log writers persist different id
   * domains (Seoul API codes vs internal slugs) for the same physical
   * station, so id-based matching would silently split one OD into several.
   *
   * With a configured morning OD the result is exactly its matches — possibly
   * EMPTY. No dominant-OD rescue there: the pattern surface is the morning
   * commute model, and publishing whatever leg happens to dominate would put
   * evening stats behind a morning label (honest empty beats mislabeled
   * data). Without settings, fall back to the most frequent OD among
   * complete logs — destination-less stubs (arrivalStationName '') would
   * otherwise win the count and persist an unroutable "origin→(empty)"
   * pattern.
   */
  private scopeLogsToSingleOd(
    logs: CommuteLog[],
    morningOd: { departure: string; arrival: string } | null
  ): CommuteLog[] {
    if (morningOd) {
      // A destination-less stub (arrivalStationName '') whose departure
      // matches the morning OD is most plausibly a morning commute whose
      // arrival was never stamped — the same stub semantics adoption uses
      // (findAdoptableOpenLog). It contributes a departure-time sample; it
      // can never contaminate the stored route because with settings the
      // route comes from the settings, not from log counting.
      return logs.filter(
        (log) =>
          log.departureStationName === morningOd.departure &&
          (log.arrivalStationName === morningOd.arrival ||
            log.arrivalStationName === '')
      );
    }

    const completeLogs = logs.filter(
      (log) => log.departureStationName !== '' && log.arrivalStationName !== ''
    );
    const counts = new Map<string, number>();
    for (const log of completeLogs) {
      const key = `${log.departureStationName}→${log.arrivalStationName}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let dominantKey: string | null = null;
    let dominantCount = 0;
    for (const [key, count] of counts.entries()) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantKey = key;
      }
    }
    return completeLogs.filter(
      (log) =>
        `${log.departureStationName}→${log.arrivalStationName}` === dominantKey
    );
  }

  /**
   * Group logs by day of week
   */
  private groupLogsByDayOfWeek(logs: CommuteLog[]): Map<DayOfWeek, CommuteLog[]> {
    const groups = new Map<DayOfWeek, CommuteLog[]>();

    for (const log of logs) {
      const existing = groups.get(log.dayOfWeek) || [];
      existing.push(log);
      groups.set(log.dayOfWeek, existing);
    }

    return groups;
  }

  /**
   * Analyze logs for a specific day of week
   */
  private analyzeLogsForDay(
    userId: string,
    dayOfWeek: DayOfWeek,
    logs: CommuteLog[],
    settingsRoute: FrequentRoute | null = null
  ): CommutePattern {
    // Extract departure times
    const departureTimes = logs.map((log) => log.departureTime);

    // Calculate average and standard deviation
    const avgDepartureTime = calculateAverageTime(departureTimes);
    const stdDevMinutes = calculateTimeStdDev(departureTimes);

    // The configured morning route is authoritative when present; counting
    // only decides the route on the no-settings fallback path.
    const frequentRoute = settingsRoute ?? this.findMostFrequentRoute(logs);

    // Calculate confidence
    const confidence = calculateConfidence(logs.length, stdDevMinutes);

    return {
      userId,
      dayOfWeek,
      avgDepartureTime,
      stdDevMinutes,
      frequentRoute,
      confidence,
      sampleCount: logs.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Find the most frequently used route
   */
  private findMostFrequentRoute(logs: CommuteLog[]): FrequentRoute {
    // Count route occurrences
    const routeCounts = new Map<string, { route: FrequentRoute; count: number }>();

    for (const log of logs) {
      const key = `${log.departureStationId}-${log.arrivalStationId}`;

      if (routeCounts.has(key)) {
        const entry = routeCounts.get(key)!;
        entry.count++;
      } else {
        routeCounts.set(key, {
          route: {
            departureStationId: log.departureStationId,
            departureStationName: log.departureStationName,
            arrivalStationId: log.arrivalStationId,
            arrivalStationName: log.arrivalStationName,
            lineIds: [...log.lineIds],
          },
          count: 1,
        });
      }
    }

    // Find most common route
    let maxCount = 0;
    let mostFrequent: FrequentRoute | null = null;

    for (const { route, count } of routeCounts.values()) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = route;
      }
    }

    // Fallback to first log if no clear winner
    const firstLog = logs[0];
    if (!mostFrequent && firstLog) {
      mostFrequent = {
        departureStationId: firstLog.departureStationId,
        departureStationName: firstLog.departureStationName,
        arrivalStationId: firstLog.arrivalStationId,
        arrivalStationName: firstLog.arrivalStationName,
        lineIds: [...firstLog.lineIds],
      };
    }

    // This should never happen since we check logs.length >= MIN_LOGS_FOR_PATTERN
    if (!mostFrequent) {
      throw new Error('No route data available');
    }

    return mostFrequent;
  }

  /**
   * Save pattern to Firestore
   */
  private async savePattern(
    userId: string,
    pattern: CommutePattern
  ): Promise<void> {
    const patternRef = doc(
      db,
      COLLECTION_NAME,
      userId,
      'patterns',
      pattern.dayOfWeek.toString()
    );

    const patternData: CommutePatternDoc = {
      dayOfWeek: pattern.dayOfWeek,
      avgDepartureTime: pattern.avgDepartureTime,
      stdDevMinutes: pattern.stdDevMinutes,
      frequentRoute: {
        departureStationId: pattern.frequentRoute.departureStationId,
        departureStationName: pattern.frequentRoute.departureStationName,
        arrivalStationId: pattern.frequentRoute.arrivalStationId,
        arrivalStationName: pattern.frequentRoute.arrivalStationName,
        lineIds: [...pattern.frequentRoute.lineIds],
      },
      confidence: pattern.confidence,
      sampleCount: pattern.sampleCount,
      lastUpdated: Timestamp.fromDate(pattern.lastUpdated),
    };

    await setDoc(patternRef, patternData);
  }

  /**
   * Delete a stored pattern doc. Deleting a missing doc is a Firestore no-op,
   * so callers may sweep all seven days without existence checks.
   */
  private async deletePattern(
    userId: string,
    dayOfWeek: DayOfWeek
  ): Promise<void> {
    const patternRef = doc(
      db,
      COLLECTION_NAME,
      userId,
      'patterns',
      dayOfWeek.toString()
    );
    await deleteDoc(patternRef);
  }
}

export const patternAnalysisService = new PatternAnalysisService();
export default patternAnalysisService;
