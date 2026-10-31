/**
 * CommuteRouteScreen — onboarding step 2/4 (경로 설정).
 *
 * Wanted handoff redesign:
 *  - Eyebrow "STEP 2 / 4 · 경로 설정"
 *  - 2-line hero title "어디서 어디까지 / 이동하시나요?"
 *  - Stacked station card (출발 / 환승(선택) / 도착) — single bordered group
 *    with the transfer slot acting as a visual gate that activates once both
 *    departure and arrival are chosen.
 *  - "환승역 추천" search input + radio list of transfer options
 *      • 직행 (환승 없음) when route algorithm finds a direct path
 *      • Real transfer options from K-shortest-path diversity filter
 *      • User-searched stations resolved against the full station catalog
 *        (so peripheral stations like "강남구청" are reachable even when
 *         they don't appear in the algorithm's top-K)
 *  - Single primary CTA "다음 단계 →"
 *  - Footer summary "{출발} → {도착} · {옵션 라벨}"
 *
 * Data flow:
 *  - Selected option ⇒ transferStations:
 *      direct → []  | transfer → [{ stationId, stationName, lineId, lineName, order: 0 }]
 *  - Forward to NotificationPermission with the existing OnboardingRouteData
 *    contract — no consumer changes needed downstream.
 *
 * Routing fallback:
 *  - When the LINE_STATIONS dataset doesn't cover a station (e.g. peripheral
 *    7호선 산곡), the K-shortest call returns empty. We surface a "직행"
 *    fallback so the form is still submittable; the downstream journey
 *    planner handles routing at runtime.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// core RN SafeAreaView는 Android no-op — 헤더가 상태바에 깔림 (WelcomeOnboardingScreen 참조)
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Home,
  Repeat,
  Search,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme, useSemanticTokens } from '@/services/theme';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import {
  TransferRouteOption,
  type TransferRouteOptionData,
} from '@/components/onboarding/TransferRouteOption';
import { LineBadge } from '@/components/design/LineBadge';
import { useOnboardingCallbacksOptional } from '@/navigation/onboardingCallbacks';
import { OnboardingStackParamList, SettingsStackParamList } from '@/navigation/types';
import {
  StationSelection,
  TransferStation,
  CommuteRoute,
  DEFAULT_COMMUTE_NOTIFICATIONS,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_MORNING_DEPARTURE_TIME,
  reverseCommuteRoute,
} from '@/models/commute';
import { useAuth } from '@/services/auth/AuthContext';
import { saveCommuteRoutes } from '@/services/commute/commuteService';
import { getDiverseRoutes } from '@/services/route';
import { routeVia } from '@/services/route/routeVia';
import { selectCommuteRoute } from '@/services/route/selectCommuteRoute';
import { resolveInternalStationId } from '@/utils/stationIdResolver';
import { AVG_STATION_TRAVEL_TIME } from '@/models/route';
import { STATIONS, LINE_STATIONS } from '@/utils/subwayMapData';
import { searchLocalStations } from '@/services/data/stationsDataService';
import { useCommuteRouteSteps } from '@/hooks/useCommuteRouteSteps';
import type { TransferStep } from '@/models/guidance';

// CommuteRouteScreen serves TWO entry points:
//   1. onboarding step 2/5 (OnboardingStack) — `route.name === 'CommuteRoute'`
//   2. in-settings route editor (SettingsStack) — `route.name === 'EditCommuteRoute'`
// The component branches on `route.name` to choose the picker target,
// hydrate initial state, and decide what "다음 단계 / 저장" means.
type Props =
  | NativeStackScreenProps<OnboardingStackParamList, 'CommuteRoute'>
  | NativeStackScreenProps<SettingsStackParamList, 'EditCommuteRoute'>;

type StationSelectionType = 'departure' | 'arrival' | 'transfer';

// Aliased to the model constant (single source of truth) to avoid drift.
const DEFAULT_DEPARTURE_TIME = DEFAULT_MORNING_DEPARTURE_TIME;
const DEFAULT_EVENING_DEPARTURE_TIME = '18:30';
const DIRECT_OPTION_ID = 'direct';
// Cross-line OD has no single-line 직행. This synthetic default means "let the
// app pick the fastest route" (no forced transfer) — saved as an empty
// transferStations list, so home/ML render the globally fastest path.
const FASTEST_OPTION_ID = 'fastest';
const MAX_TRANSFER_OPTIONS = 4;

// stations.json (used by routeService graph) is keyed by English-slug IDs
// like "gangnam"/"city_hall_1", whereas StationSelection.stationId comes from
// seoulStations.json (Seoul Metro station_cd, e.g. "0222"). The two ID
// spaces don't overlap, so we resolve via Korean station name — which is
// stable across both data sources — into the graph node key.
//
// Same-name stations on multiple lines (e.g. 공덕 5/6/경의) collapse onto
// one entry here, but routeService.calculateRoute() expands them back into
// per-line graph nodes via STATIONS[id].lines, so the lookup loss is benign.
const NAME_TO_GRAPH_ID = (() => {
  const map = new Map<string, string>();
  for (const [id, data] of Object.entries(STATIONS)) {
    if (!map.has(data.name)) map.set(data.name, id);
  }
  return map;
})();

// `STATIONS` keeps `lines: string[]` per station (e.g. 강남구청 → ['7','bundang']),
// which lets us pick the most-relevant transfer line pair for the user's
// origin/destination instead of guessing from a single-line Station model.
const NAME_TO_LINES = (() => {
  const map = new Map<string, readonly string[]>();
  for (const data of Object.values(STATIONS)) {
    if (!map.has(data.name)) map.set(data.name, data.lines ?? []);
  }
  return map;
})();

const SEARCH_RESULT_PREFIX = 'search-';
const MAX_SEARCH_RESULTS = 6;
// 검색 결과 1건마다 routeVia를 돌린다(최대 6회/입력). 추천 목록과 같은 경로
// SSOT라 분이 일치한다. 1회는 보통 수 ms지만 fast path 검증이 실패한 구간은 Yen
// 전체 탐색(≈100ms)으로 떨어지므로 타이핑이 멈춘 뒤에만 계산한다. 추천 목록의 문자열 필터는 디바운스하지
// 않는다 — 그쪽은 includes() 한 번이라 즉시 반응이 낫다.
const SEARCH_DEBOUNCE_MS = 200;

const buildDirectFallback = (): TransferRouteOptionData => ({
  id: DIRECT_OPTION_ID,
  label: '직행 (환승 없음)',
  isDirect: true,
  recommended: true,
  fastest: false,
});

/**
 * Compute the shortest direct ride between two stations on a single line.
 * Returns minutes if both stations sit on the same operational subarray of
 * the line, undefined otherwise.
 *
 * Uses index distance on `LINE_STATIONS[line]` (no graph search). For
 * branched lines the dataset is `string[][]` — each subarray is one
 * operational segment. Cross-subarray pairs (e.g. main line ↔ branch)
 * cannot be measured by index alone and return undefined; callers fall
 * back to graph search or membership-only logic.
 *
 * Handles line 2 as a circular line — the shorter arc between two
 * endpoints is `min(forward, backward)` around the loop, scoped to the
 * containing subarray.
 */
const directMinutesOnLine = (
  lineId: string,
  fromId: string,
  toId: string,
): number | undefined => {
  const segments = LINE_STATIONS[lineId];
  if (!segments) return undefined;
  for (const stations of segments) {
    const i = stations.indexOf(fromId);
    const j = stations.indexOf(toId);
    if (i < 0 || j < 0) continue;
    const linear = Math.abs(i - j);
    // Note: this circular wrap-around assumes Line 2 is a single-subarray
    // trunk. When PR-6 reshapes Line 2 to trunk + 성수지선 + 신정지선,
    // this math must be revisited (current behavior wraps each subarray
    // as if circular, which would be wrong for branch subarrays).
    const dist =
      lineId === '2' ? Math.min(linear, stations.length - linear) : linear;
    return dist * AVG_STATION_TRAVEL_TIME;
  }
  return undefined;
};

/** Display rule for every option: whole minutes, never below 1. */
const toDisplayMinutes = (raw: number | undefined): number | undefined =>
  raw === undefined || !Number.isFinite(raw) ? undefined : Math.max(1, Math.round(raw));

/**
 * Path-SSOT minutes for a forced transfer at `viaSlug` — the same `routeVia`
 * the settings card / home use once that transfer is saved. undefined (never
 * an approximation) when the graph has no path.
 */
const viaRouteMinutes = (
  depSlug: string,
  viaSlug: string,
  arrSlug: string,
): number | undefined => {
  try {
    return routeVia(depSlug, viaSlug, arrSlug)?.totalMinutes;
  } catch {
    return undefined;
  }
};

/**
 * Minutes for the 직행 option. Prefers the graph's own 0-transfer route
 * (path SSOT); falls back to the LINE_STATIONS index estimate when the
 * diverse-route set has no transfer-free path. `getDiverseRoutes[0]` is NOT
 * used: for same-line ODs it can be a faster multi-transfer path, which would
 * label "직행" with another route's time.
 */
const directRideMinutes = (
  depSlug: string,
  arrSlug: string,
  depLines: readonly string[],
  arrLines: readonly string[],
  depId: string,
  arrId: string,
): number | undefined => {
  try {
    const ride = getDiverseRoutes(depSlug, arrSlug).find((r) => r.transferCount === 0);
    if (ride) return ride.totalMinutes;
  } catch {
    // fall through to the index estimate
  }
  let estimate: number | undefined;
  for (const line of depLines) {
    if (!arrLines.includes(line)) continue;
    const m = directMinutesOnLine(line, depId, arrId);
    if (m !== undefined && (estimate === undefined || m < estimate)) estimate = m;
  }
  return estimate;
};

/**
 * `fastest` ("가장 빠름") goes to exactly one option: the smallest displayed
 * minutes. Options come head-first (자동/직행), so a tie keeps the head. A
 * via route can beat the head — routeVia stitches two optimal legs without
 * getDiverseRoutes' whole-route filters — so the head is not assumed fastest.
 * With no measured option at all the head keeps the flag (badge stays hidden
 * without minutes anyway).
 */
const withFastestBadge = (
  options: readonly TransferRouteOptionData[],
): TransferRouteOptionData[] => {
  let winner = options[0];
  for (const o of options) {
    if (o.minutes === undefined) continue;
    if (winner?.minutes === undefined || o.minutes < winner.minutes) winner = o;
  }
  return options.map((o) => ({ ...o, fastest: o === winner }));
};

/**
 * Build the "환승역 추천" list for the user's departure → arrival pair.
 *
 * The previous implementation used Yen's K-shortest path with a Jaccard
 * diversity filter, but that algorithm optimizes for *segment-level
 * variation* across the full path, not for *meaningful first-transfer
 * stations*. It happily returned 2-transfer detours through stations like
 * 까치산 (line 5 terminus) just because their segment set differed enough
 * — surfacing nonsense recommendations to the user.
 *
 * Strategy now (line-intersection scan):
 *   1. Resolve dep/arr to graph IDs and pull each endpoint's full line set
 *      from STATIONS (e.g. 강남 → ['2', 'sinbundang']).
 *   2. If the two endpoints share any line → emit a 직행 option using the
 *      shortest line-index distance.
 *   3. For every (depLine × stationOnDepLine × arrLine) triplet, check
 *      whether `stationOnDepLine` also serves an arrLine. If yes, the
 *      station is a valid 1-transfer candidate; its time is the path SSOT
 *      `routeVia(dep, station, arr)` — what the settings card shows once the
 *      station is saved.
 *   4. Dedupe by station, keep the fastest entry per station, sort by
 *      total minutes, prune any candidate slower than 2× the direct ride
 *      (kills uninteresting detours when a direct option exists).
 *   5. Cap at MAX_TRANSFER_OPTIONS.
 *
 * This guarantees every recommended station is on a line the user actually
 * boards — no detours through unrelated lines, no "weird" stations.
 */
const buildRecommendations = (
  dep: StationSelection | null,
  arr: StationSelection | null,
): TransferRouteOptionData[] => {
  if (!dep || !arr) return [];
  const depId = NAME_TO_GRAPH_ID.get(dep.stationName);
  const arrId = NAME_TO_GRAPH_ID.get(arr.stationName);
  if (!depId || !arrId || depId === arrId) return [buildDirectFallback()];

  const depLines = STATIONS[depId]?.lines ?? [];
  const arrLines = STATIONS[arrId]?.lines ?? [];
  if (depLines.length === 0 || arrLines.length === 0) {
    return [buildDirectFallback()];
  }

  // Graph slugs for the path SSOT, resolved exactly like selectCommuteRoute
  // (station_cd → slug) so a candidate's minutes equal what the settings card
  // shows once it is saved. Name lookup is only a fallback for fixtures/ids the
  // resolver doesn't know.
  const depSlug = resolveInternalStationId(dep.stationId) ?? depId;
  const arrSlug = resolveInternalStationId(arr.stationId) ?? arrId;

  // 1. Direct option — only when the endpoints share a line.
  const sharesLine = depLines.some((l) => arrLines.includes(l));
  const directMinutes = sharesLine
    ? directRideMinutes(depSlug, arrSlug, depLines, arrLines, depId, arrId)
    : undefined;

  // 2. 1-transfer candidates — scan STATIONS membership directly so the
  // result stays correct even when LINE_STATIONS coverage is incomplete
  // (e.g. 산곡 missing from LINE_STATIONS['7']). Membership decides *which*
  // stations are candidates; minutes come from the path SSOT (routeVia).
  const scanned: {
    stnId: string;
    name: string;
    fromLineId: string;
    toLineId: string;
  }[] = [];
  for (const [stnId, stnData] of Object.entries(STATIONS)) {
    if (stnId === depId || stnId === arrId) continue;
    if (stnId === depSlug || stnId === arrSlug) continue;
    const stnLines = stnData.lines;
    if (!stnLines || stnLines.length === 0) continue;

    // The station must serve a line the user boards from AND another line
    // that reaches the destination.
    const fromCandidate = depLines.find((l) => stnLines.includes(l));
    const toCandidate = arrLines.find(
      (l) => l !== fromCandidate && stnLines.includes(l),
    );
    if (!fromCandidate || !toCandidate) continue;

    scanned.push({
      stnId,
      name: stnData.name,
      fromLineId: fromCandidate,
      toLineId: toCandidate,
    });
  }

  // Every candidate is measured by the path SSOT (routeVia ≈ 2–5ms per call
  // via getFastestRoute), so the shown top-MAX_TRANSFER_OPTIONS is the true
  // SSOT ranking — no index-estimate pre-selection.
  const candidates = scanned.map((s) => {
    const raw = viaRouteMinutes(depSlug, s.stnId, arrSlug);
    const option: TransferRouteOptionData = {
      id: s.stnId,
      label: s.name,
      isDirect: false,
      fromLineId: s.fromLineId,
      toLineId: s.toLineId,
      minutes: toDisplayMinutes(raw),
    };
    return { raw, option };
  });

  // 3. Sort (SSOT minutes) + prune detours slower than 2× the direct ride
  // (only when a direct ride exists — otherwise we keep all candidates,
  // including time-unknown ones, since the user has no faster baseline).
  const directCutoff =
    directMinutes !== undefined ? directMinutes * 2 : Number.POSITIVE_INFINITY;
  const transfers = candidates
    .filter((c) =>
      directMinutes !== undefined
        ? (c.raw ?? Number.POSITIVE_INFINITY) <= directCutoff
        : true,
    )
    .sort(
      (a, b) =>
        (a.raw ?? Number.POSITIVE_INFINITY) - (b.raw ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, MAX_TRANSFER_OPTIONS)
    .map((c) => c.option);

  const result: TransferRouteOptionData[] = [];
  if (directMinutes !== undefined) {
    result.push({
      id: DIRECT_OPTION_ID,
      label: '직행 (환승 없음)',
      isDirect: true,
      minutes: toDisplayMinutes(directMinutes),
      recommended: true,
      fastest: true,
    });
  } else {
    // No single-line 직행 (cross-line OD). The recommended DEFAULT is the app's
    // fastest route, NOT an auto-forced first transfer — `isDirect: true` so it
    // persists an empty transferStations list (→ globally fastest path). The
    // transfer candidates below remain available as explicit overrides.
    // Its minutes are that same saved path (selectCommuteRoute, no via).
    result.push({
      id: FASTEST_OPTION_ID,
      label: '최단 경로 (자동)',
      isDirect: true,
      minutes: toDisplayMinutes(
        selectCommuteRoute(dep.stationId, arr.stationId)?.totalMinutes,
      ),
      recommended: true,
      fastest: true,
    });
  }
  result.push(...transfers);
  const badged = withFastestBadge(result);

  // 4. Honest fallback. Only fall back to a 직행 option when dep and arr
  // actually share a line (so direct is theoretically valid) but
  // LINE_STATIONS coverage prevented us from measuring a time. Never
  // claim 직행 for cross-line pairs — that's the bug from issue 14
  // where 산곡(7호선) → 선릉(2호선) was incorrectly showing 직행.
  if (result.length === 0) {
    return sharesLine ? [buildDirectFallback()] : [];
  }
  return badged;
};

/**
 * Map a persisted transfer station back onto the option list so edit mode
 * re-selects what the user saved. Persisted ids live in two spaces: graph IDs
 * (recommendation picks, e.g. "gangnam_gu_office") and Seoul station_cd
 * (search picks, e.g. "2732" — see the prefix strip in handleNext).
 *   1. id already matches a recommendation → that option
 *   2. stationName → graph ID matches a recommendation → that option
 *   3. otherwise → a synthetic option carrying the stored values, so a pick
 *      outside the top-K is preserved instead of silently reset to `fastest`.
 *      It reuses the search prefix, so handleNext persists the original id.
 */
const resolveStoredTransfer = (
  stored: TransferStation,
  recommendations: readonly TransferRouteOptionData[],
): { optionId: string; preserved: TransferRouteOptionData | null } => {
  if (recommendations.some((r) => r.id === stored.stationId)) {
    return { optionId: stored.stationId, preserved: null };
  }
  const graphId = NAME_TO_GRAPH_ID.get(stored.stationName);
  if (graphId && recommendations.some((r) => r.id === graphId)) {
    return { optionId: graphId, preserved: null };
  }
  const lines = NAME_TO_LINES.get(stored.stationName) ?? [];
  const preserved: TransferRouteOptionData = {
    id: `${SEARCH_RESULT_PREFIX}${stored.stationId}`,
    label: stored.stationName,
    isDirect: false,
    fromLineId: stored.lineId,
    toLineId: lines.find((l) => l !== stored.lineId),
  };
  return { optionId: preserved.id, preserved };
};

const isSameStation = (
  a: StationSelection | null,
  b: StationSelection | null | undefined,
): boolean => !!a && !!b && a.stationId === b.stationId;

export const CommuteRouteScreen: React.FC<Props> = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  // edit mode runs outside OnboardingNavigator. Use the optional variant
  // (always called → Rules-of-Hooks safe) and gate the skip CTA on it.
  const isEditMode = route.name === 'EditCommuteRoute';
  const editParams = isEditMode
    ? (route.params as SettingsStackParamList['EditCommuteRoute'])
    : null;
  const onboardingCallbacks = useOnboardingCallbacksOptional();
  const onSkip = onboardingCallbacks?.onSkip;
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [departureStation, setDepartureStation] = useState<StationSelection | null>(
    editParams?.initial?.departureStation ?? null,
  );
  const [arrivalStation, setArrivalStation] = useState<StationSelection | null>(
    editParams?.initial?.arrivalStation ?? null,
  );
  const initialDeparture = editParams?.initial?.departureStation;
  const initialArrival = editParams?.initial?.arrivalStation;
  const storedTransfer = editParams?.initial?.transferStations?.[0];
  const [selectedOptionId, setSelectedOptionId] = useState<string>(() => {
    // Hydrate selected transfer option from initial route data, resolved
    // against the recommendations the first render will build (stored ids may
    // be station_cd, which never equals a graph-ID recommendation). Empty →
    // direct; the sync effect below maps that onto the first option.
    if (!storedTransfer) return DIRECT_OPTION_ID;
    return resolveStoredTransfer(
      storedTransfer,
      buildRecommendations(initialDeparture ?? null, initialArrival ?? null),
    ).optionId;
  });
  const [query, setQuery] = useState('');
  // TextInput은 query로 즉시 갱신하고, 무거운 경로 계산만 이 값에 매단다.
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Phase 52 picker handoff — picker writes back via merged params.
  useEffect(() => {
    const picked = route.params?.pickedStation;
    if (!picked) return;
    const { selectionType: pickedType, station } = picked;
    if (pickedType === 'departure') setDepartureStation(station);
    else if (pickedType === 'arrival') setArrivalStation(station);
    // Transfer picks now resolve via the recommendation radio list — the
    // picker drill-in only writes back for departure/arrival in this flow.
    navigation.setParams({ pickedStation: undefined });
  }, [route.params?.pickedStation, navigation]);

  const baseRecommendations = useMemo(
    () => buildRecommendations(departureStation, arrivalStation),
    [departureStation, arrivalStation],
  );

  // Keep a saved transfer that falls outside the top-K visible and selectable
  // — but only while the edited OD is unchanged. Once the user picks a new
  // departure/arrival the stored choice no longer applies and drops out, so
  // the sync effect below resets selection as before.
  const recommendations = useMemo(() => {
    if (
      !storedTransfer ||
      !isSameStation(departureStation, initialDeparture) ||
      !isSameStation(arrivalStation, initialArrival)
    ) {
      return baseRecommendations;
    }
    const { preserved } = resolveStoredTransfer(storedTransfer, baseRecommendations);
    return preserved ? [...baseRecommendations, preserved] : baseRecommendations;
  }, [
    baseRecommendations,
    storedTransfer,
    departureStation,
    arrivalStation,
    initialDeparture,
    initialArrival,
  ]);

  // Search-derived options. Computed only when the user types a query —
  // lets users pick *any* station as a transfer point, not just the
  // algorithm's top-K. Station lookup is local/sync, but each candidate
  // costs one routeVia (two K-shortest searches), so this reads the debounced query.
  const searchOptions = useMemo<TransferRouteOptionData[]>(() => {
    const q = debouncedQuery.trim();
    if (!q || !departureStation || !arrivalStation) return [];
    const matches = searchLocalStations(q);
    if (matches.length === 0) return [];

    const depName = departureStation.stationName;
    const arrName = arrivalStation.stationName;
    const depLine = departureStation.lineId;
    const arrLine = arrivalStation.lineId;
    const depGraphId =
      resolveInternalStationId(departureStation.stationId) ?? NAME_TO_GRAPH_ID.get(depName);
    const arrGraphId =
      resolveInternalStationId(arrivalStation.stationId) ?? NAME_TO_GRAPH_ID.get(arrName);

    const seen = new Set<string>();
    const opts: TransferRouteOptionData[] = [];

    for (const station of matches) {
      if (station.name === depName || station.name === arrName) continue;
      if (seen.has(station.name)) continue;
      seen.add(station.name);

      const lines = NAME_TO_LINES.get(station.name) ?? [station.lineId];
      const fromLineId = lines.includes(depLine) ? depLine : lines[0] ?? station.lineId;
      const toLineId =
        lines.find((l) => l !== fromLineId && l === arrLine) ??
        lines.find((l) => l !== fromLineId) ??
        arrLine;

      // Same via resolution the settings card applies to the saved id
      // (station_cd, prefix stripped in handleNext) → same routeVia minutes.
      const stnGraphId =
        resolveInternalStationId(station.id) ?? NAME_TO_GRAPH_ID.get(station.name);
      const minutes =
        stnGraphId && depGraphId && arrGraphId
          ? toDisplayMinutes(viaRouteMinutes(depGraphId, stnGraphId, arrGraphId))
          : undefined;

      opts.push({
        id: `${SEARCH_RESULT_PREFIX}${station.id}`,
        label: station.name,
        isDirect: false,
        fromLineId,
        toLineId,
        minutes,
      });

      if (opts.length >= MAX_SEARCH_RESULTS) break;
    }
    return opts;
  }, [debouncedQuery, departureStation, arrivalStation]);

  // Combined display list — recommendations filtered by query, plus any
  // search-only options that aren't already represented by name.
  const filteredRecommendations = useMemo(() => {
    const q = query.trim();
    if (!q) return recommendations;
    const labelMatches = recommendations.filter((r) => r.label.includes(q));
    if (searchOptions.length === 0) return labelMatches;
    const seenLabels = new Set(labelMatches.map((r) => r.label));
    const additions = searchOptions.filter((o) => !seenLabels.has(o.label));
    return [...labelMatches, ...additions];
  }, [recommendations, searchOptions, query]);

  // Keep the radio selection in sync. We check BOTH the algorithm
  // recommendations and the search-derived options — otherwise picking a
  // search result like "강남구청" (id `search-…`) would be reverted on the
  // next render because that id never appears in `recommendations`.
  // Reset only fires when the current id is in neither list (e.g. user
  // changed dep/arr and the previous selection no longer applies).
  useEffect(() => {
    if (recommendations.length === 0 && searchOptions.length === 0) return;
    const inRecs = recommendations.some((r) => r.id === selectedOptionId);
    const inSearch = searchOptions.some((r) => r.id === selectedOptionId);
    if (inRecs || inSearch) return;
    const first = recommendations[0] ?? searchOptions[0];
    if (first) setSelectedOptionId(first.id);
  }, [recommendations, searchOptions, selectedOptionId]);

  // selectedOption looks at both canonical recommendations AND search-derived
  // options — users can pick a search result and proceed.
  const selectedOption =
    [...recommendations, ...searchOptions].find((r) => r.id === selectedOptionId) ??
    recommendations[0];

  // "최단 경로 (자동)" persists no transfer, but the settings card derives the
  // actual transfer from the path SSOT and shows e.g. "환승 1회 · 강남구청".
  // Name it here through the same seam (useCommuteRouteSteps, no via) so both
  // screens agree. Edit mode only; ids are withheld otherwise so the K-shortest
  // search doesn't run. Empty steps (resolve failure) → keep the plain label.
  const showFastestTransfers = isEditMode && selectedOption?.id === FASTEST_OPTION_ID;
  const fastestSteps = useCommuteRouteSteps(
    showFastestTransfers ? departureStation?.stationId : undefined,
    showFastestTransfers ? arrivalStation?.stationId : undefined,
  );
  const fastestSummary = useMemo<string | null>(() => {
    if (!selectedOption || fastestSteps.length === 0) return null;
    const names = fastestSteps
      .filter((s): s is TransferStep => s.kind === 'transfer')
      .map((s) => s.stationName);
    const via = names.length > 0 ? `${names.join(', ')} 환승` : '직행';
    return `${selectedOption.label} · ${via}`;
  }, [fastestSteps, selectedOption]);

  const getExcludedStationIds = useCallback((): string[] => {
    const ids: string[] = [];
    if (departureStation) ids.push(departureStation.stationId);
    if (arrivalStation) ids.push(arrivalStation.stationId);
    return ids;
  }, [departureStation, arrivalStation]);

  const openStationPicker = useCallback(
    (type: StationSelectionType) => {
      const currentName =
        type === 'departure'
          ? departureStation?.stationName
          : type === 'arrival'
            ? arrivalStation?.stationName
            : undefined;
      // Two stacks, two picker route names. Cast to a name-erased
      // navigator so a single navigate call typechecks regardless of
      // which stack hosts this screen.
      const pickerName = isEditMode
        ? 'EditCommuteStationPicker'
        : 'OnboardingStationPicker';
      (navigation as unknown as NavigationProp<ParamListBase>).navigate(
        pickerName,
        {
          selectionType: type,
          excludeStationIds: getExcludedStationIds(),
          currentName,
        },
      );
    },
    [navigation, departureStation, arrivalStation, getExcludedStationIds, isEditMode],
  );

  const isValid = !!(departureStation && arrivalStation);

  const handleNext = useCallback(async () => {
    if (!isValid || !departureStation || !arrivalStation || !selectedOption) return;

    // Search-derived options carry a "search-" prefix on the id so the
    // radio dedup doesn't collide with graph-ID recommendations. Strip it
    // back out before persisting so downstream consumers see a clean
    // station_cd.
    const rawId = selectedOption.id.startsWith(SEARCH_RESULT_PREFIX)
      ? selectedOption.id.slice(SEARCH_RESULT_PREFIX.length)
      : selectedOption.id;
    const transferStations: TransferStation[] = selectedOption.isDirect
      ? []
      : [
          {
            stationId: rawId,
            stationName: selectedOption.label,
            lineId: selectedOption.fromLineId ?? departureStation.lineId,
            lineName: '',
            order: 0,
          },
        ];

    // Edit mode without an authenticated user (e.g. session timeout
    // mid-edit) must NOT fall through to the onboarding navigation
    // below — that would treat a settings edit as a fresh onboarding
    // step and push the user into CommuteTime with no way back.
    // Surface the issue and halt; the next sign-in re-enables save.
    if (isEditMode && !user) {
      Alert.alert(
        '저장 불가',
        '세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.',
      );
      return;
    }

    if (isEditMode && editParams && user) {
      // Edit mode: persist immediately, then return to CommuteSettings.
      // Preserve the untouched leg via `otherLeg`; when missing (e.g. user
      // had no evening leg), materialise the opposite leg by REVERSING the
      // edited leg (reverseCommuteRoute) — endpoints swapped + transfer chain
      // reversed — with the opposite direction's default departure time, so
      // the two slots are genuine return trips rather than identical copies.
      //
      // notifications/bufferMinutes are threaded from the params (loaded
      // from Firestore by CommuteSettings) so customized alert windows
      // and buffer minutes aren't reset to DEFAULT on every edit.
      const editedLeg: CommuteRoute = {
        departureTime: editParams.initial?.departureTime ?? DEFAULT_DEPARTURE_TIME,
        departureStationId: departureStation.stationId,
        departureStationName: departureStation.stationName,
        departureLineId: departureStation.lineId,
        arrivalStationId: arrivalStation.stationId,
        arrivalStationName: arrivalStation.stationName,
        arrivalLineId: arrivalStation.lineId,
        transferStations: transferStations.map((t, i) => ({
          stationId: t.stationId,
          stationName: t.stationName,
          lineId: t.lineId,
          lineName: '',
          order: i + 1,
        })),
        notifications: editParams.initial?.notifications ?? DEFAULT_COMMUTE_NOTIFICATIONS,
        bufferMinutes: editParams.initial?.bufferMinutes ?? DEFAULT_BUFFER_MINUTES,
        // 편집 = 이 leg의 교체 → 종점행 선호를 명시적으로 무효화한다. 생략하면
        // setDoc({merge:true})가 옛 선호를 보존해, 같은 역·노선이지만 목적지가
        // 달라진 새 경로에 도달 불가한 종점 선택이 재부착된다. 빈 맵은 Firestore
        // 필드 마스크에 명시적으로 실려(SDK parseObject) 기존 키를 지운다.
        // `otherLeg`(아래)는 이 필드를 싣지 않는다 — 손대지 않은 leg의 선호는
        // merge 보존이 정답이고, 여기서 {}를 쓰면 그 leg의 선호가 통째로 날아간다.
        boardingPreferences: {},
      };
      const otherLegSrc = editParams.otherLeg;
      const otherLeg: CommuteRoute = otherLegSrc
        ? {
            departureTime: otherLegSrc.departureTime,
            departureStationId: otherLegSrc.departureStation.stationId,
            departureStationName: otherLegSrc.departureStation.stationName,
            departureLineId: otherLegSrc.departureStation.lineId,
            arrivalStationId: otherLegSrc.arrivalStation.stationId,
            arrivalStationName: otherLegSrc.arrivalStation.stationName,
            arrivalLineId: otherLegSrc.arrivalStation.lineId,
            transferStations: (otherLegSrc.transferStations || []).map((t, i) => ({
              stationId: t.stationId,
              stationName: t.stationName,
              lineId: t.lineId,
              lineName: '',
              order: i + 1,
            })),
            notifications: otherLegSrc.notifications ?? DEFAULT_COMMUTE_NOTIFICATIONS,
            bufferMinutes: otherLegSrc.bufferMinutes ?? DEFAULT_BUFFER_MINUTES,
          }
        : reverseCommuteRoute(
            editedLeg,
            editParams.kind === 'morning'
              ? DEFAULT_EVENING_DEPARTURE_TIME
              : DEFAULT_DEPARTURE_TIME,
          );
      const morning = editParams.kind === 'morning' ? editedLeg : otherLeg;
      const evening = editParams.kind === 'evening' ? editedLeg : otherLeg;

      try {
        setSaving(true);
        const result = await saveCommuteRoutes(user.id, morning, evening);
        if (!result.success) {
          // Surface the failure so the user knows the save didn't land
          // (previously silent — the screen just stopped responding to
          // the CTA, looking identical to "still saving").
          Alert.alert(
            '저장 실패',
            result.error ?? '경로 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          );
          return;
        }
        if (navigation.canGoBack()) navigation.goBack();
      } catch {
        Alert.alert('오류', '경로 저장 중 오류가 발생했습니다.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // 5-step flow: CommuteRoute forwards to CommuteTime (step 3) which
    // finalises departureTime before NotificationPermission consumes it.
    // The default '08:00' here is overwritten by the user's selection in
    // CommuteTime before reaching the alert step.
    (navigation as unknown as NavigationProp<ParamListBase>).navigate('CommuteTime', {
      route: {
        departureTime: DEFAULT_DEPARTURE_TIME,
        eveningDepartureTime: DEFAULT_EVENING_DEPARTURE_TIME,
        departureStation,
        arrivalStation,
        transferStations,
      },
    });
  }, [
    isValid,
    departureStation,
    arrivalStation,
    selectedOption,
    navigation,
    isEditMode,
    editParams,
    user,
  ]);

  const renderStationRow = (
    type: StationSelectionType,
    station: StationSelection | null,
    label: string,
    Icon: typeof Home,
    placeholder: string,
    disabled: boolean,
    // Wanted handoff (image 15): departure uses a neutral gray icon tile,
    // arrival uses the primary blue tile. The visual asymmetry frames the
    // route as origin (subdued) → destination (active accent).
    accent: 'neutral' | 'primary' = 'neutral',
  ): React.ReactElement => {
    const handlePress = (): void => {
      if (disabled) return;
      openStationPicker(type);
    };
    const iconBg =
      accent === 'primary' ? semantic.primaryBg : 'rgba(112,115,124,0.10)';
    const iconFg =
      accent === 'primary' ? semantic.primaryNormal : semantic.labelAlt;
    return (
      <TouchableOpacity
        testID={`station-row-${type}`}
        style={[
          styles.stationRow,
          station ? styles.stationRowFilled : null,
          disabled ? styles.stationRowDisabled : null,
        ]}
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label} 선택`}
      >
        <View style={[styles.stationIconWrap, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconFg} strokeWidth={2.2} />
        </View>
        <View style={styles.stationBody}>
          <Text style={styles.stationLabel}>{label}</Text>
          {station ? (
            <View style={styles.stationValueRow}>
              <Text style={styles.stationValue} numberOfLines={1}>
                {station.stationName}
              </Text>
              {/* Wanted handoff (image 13): a station with multiple lines
                  shows ALL lines as badges. NAME_TO_LINES gives us the
                  full set from STATIONS data; fall back to the single
                  StationSelection.lineId when the station is missing
                  from the map. */}
              {(NAME_TO_LINES.get(station.stationName) ?? [station.lineId]).map(
                (lineId) => (
                  <LineBadge key={lineId} line={lineId} size={14} />
                ),
              )}
            </View>
          ) : (
            <Text style={styles.stationPlaceholder}>{placeholder}</Text>
          )}
        </View>
        <ChevronRight size={18} color={semantic.labelAlt} strokeWidth={2} />
      </TouchableOpacity>
    );
  };

  return (
    // edit 모드는 SettingsNavigator 헤더가 상태바 아래 공간을 이미 차지하므로
    // top inset을 빼고, 온보딩 모드(헤더 없음)에서만 top을 적용한다.
    <SafeAreaView
      style={styles.safe}
      edges={isEditMode ? ['bottom'] : ['top', 'bottom']}
    >
      {/* Onboarding step gauge only — in edit mode the SettingsNavigator
          owns the screen header (title "경로 편집"), so OnbHeader is
          suppressed to avoid a duplicate top bar. */}
      {isEditMode ? null : (
        <OnbHeader
          currentStep={2}
          onBack={() => navigation.canGoBack() && navigation.goBack()}
          onSkip={onSkip}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow} testID="commute-eyebrow">
          {isEditMode
            ? editParams?.kind === 'evening'
              ? '퇴근 경로 편집'
              : '출근 경로 편집'
            : 'STEP 2 / 5 · 경로 설정'}
        </Text>
        <Text style={styles.title} testID="commute-title">
          {'어디서 어디까지\n이동하시나요?'}
        </Text>

        {/* Stacked station card — Wanted handoff (image 15):
            outer subtle gray card with vertical connector tracks between
            three rows; the middle (transfer gate) is a distinct highlight
            box (white bg + 2px primary border). */}
        <View style={styles.stationCard}>
          {renderStationRow(
            'departure',
            departureStation,
            '출발역',
            Home,
            '출발역을 검색하세요',
            false,
            'neutral',
          )}
          <View style={styles.connectorTrack} />
          <View style={styles.transferGateOuter}>
            <View style={styles.stationIconWrap}>
              <Repeat size={18} color={semantic.labelAlt} strokeWidth={2.2} />
            </View>
            <View
              style={[
                styles.transferGateBox,
                !isValid ? styles.transferGateMuted : null,
              ]}
            >
              <Text
                style={[styles.stationLabel, styles.transferGateLabel]}
                numberOfLines={1}
              >
                환승역 (선택)
              </Text>
              <Text style={styles.transferGateValue} numberOfLines={1}>
                {selectedOption?.isDirect
                  ? (fastestSummary ?? selectedOption.label ?? '직행 (환승 없음)')
                  : selectedOption?.label
                    ? `${selectedOption.label} 환승`
                    : '최단 경로 (자동)'}
              </Text>
            </View>
          </View>
          <View style={styles.connectorTrack} />
          {renderStationRow(
            'arrival',
            arrivalStation,
            '도착역',
            Building2,
            '도착역을 검색하세요',
            false,
            'primary',
          )}
        </View>

        {/* Recommendation section */}
        {isValid && recommendations.length > 0 ? (
          <View style={styles.recommendSection}>
            <Text style={styles.recommendTitle}>환승역 추천</Text>
            <Text style={styles.recommendHint}>
              {recommendations.some((r) => r.id === DIRECT_OPTION_ID)
                ? '직행이 가장 빨라요. 필요시 환승역을 선택하세요'
                : '가장 빠른 경로로 안내해 드려요. 필요시 환승역을 선택하세요'}
            </Text>

            <View style={styles.searchRow}>
              <Search size={16} color={semantic.labelAlt} strokeWidth={2} />
              <TextInput
                testID="recommend-search"
                value={query}
                onChangeText={setQuery}
                placeholder="환승역 이름으로 검색"
                placeholderTextColor={semantic.labelAlt}
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.recommendSubtitle}>환승역 추천</Text>

            <View style={styles.optionList} testID="recommend-list">
              {filteredRecommendations.map((opt) => (
                <TransferRouteOption
                  key={opt.id}
                  option={opt}
                  selected={selectedOptionId === opt.id}
                  onPress={setSelectedOptionId}
                  isDark={isDark}
                />
              ))}
              {filteredRecommendations.length === 0 ? (
                <Text style={styles.emptyText}>
                  {query.trim().length > 0
                    ? '입력한 이름으로 역을 찾지 못했어요. 다른 이름으로 검색해보세요.'
                    : '추천할 환승역이 없어요. 검색으로 직접 찾아보세요.'}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom CTA + footer summary */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="commute-next"
          style={[
            styles.primary,
            !isValid || saving ? styles.primaryDisabled : null,
            isValid && !saving ? { shadowColor: semantic.primaryNormal } : null,
          ]}
          onPress={handleNext}
          disabled={!isValid || saving}
          accessibilityRole="button"
          accessibilityLabel={isEditMode ? '경로 저장' : '다음 단계'}
        >
          <Text
            style={[
              styles.primaryLabel,
              !isValid || saving ? styles.primaryLabelDisabled : null,
            ]}
          >
            {isEditMode ? (saving ? '저장 중...' : '저장') : '다음 단계'}
          </Text>
          <ArrowRight
            size={18}
            color={isValid && !saving ? semantic.labelOnColor : semantic.labelDisabled}
            strokeWidth={2.4}
          />
        </TouchableOpacity>
        {isValid && departureStation && arrivalStation ? (
          <Text style={styles.footerSummary} testID="commute-footer">
            {departureStation.stationName} → {arrivalStation.stationName} ·{' '}
            {selectedOption?.isDirect ? (fastestSummary ?? '직행') : selectedOption?.label}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: semantic.bgBase },
    body: {
      paddingHorizontal: WANTED_TOKENS.spacing.s6,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s8,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
      letterSpacing: 0.55,
    },
    title: {
      marginTop: 6,
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.6,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },

    /* Stacked station card — Wanted handoff: subtle gray outer card
       with two vertical connector tracks between the three rows. */
    stationCard: {
      marginTop: WANTED_TOKENS.spacing.s5,
      backgroundColor: semantic.bgSubtlePage,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    // Vertical hairline between rows, aligned with the icon column center.
    // Icon container is 40 wide, sitting in 14px paddingHorizontal — center
    // is at 14 + 20 = 34. Track width 2 → marginLeft: 33.
    connectorTrack: {
      width: 2,
      height: 14,
      marginLeft: 33,
      backgroundColor: semantic.lineNormal,
      opacity: 0.5,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 12,
    },
    stationRowFilled: {
      backgroundColor: 'transparent',
    },
    stationRowDisabled: {
      opacity: 0.5,
    },
    stationIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* Transfer gate — distinct highlight box with primary border */
    transferGateOuter: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 4,
      gap: 12,
    },
    transferGateBox: {
      flex: 1,
      backgroundColor: semantic.bgBase,
      borderWidth: 2,
      borderColor: semantic.primaryNormal,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 56,
      justifyContent: 'center',
    },
    transferGateLabel: {
      color: semantic.primaryNormal,
    },
    transferGateValue: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    transferGateMuted: {
      opacity: 0.6,
    },
    stationBody: {
      flex: 1,
      minWidth: 0,
    },
    stationLabel: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      letterSpacing: 0.4,
    },
    stationValueRow: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    stationValue: {
      fontSize: 16,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      flexShrink: 1,
    },
    stationPlaceholder: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },

    /* Recommendation */
    recommendSection: {
      marginTop: WANTED_TOKENS.spacing.s6,
    },
    recommendTitle: {
      fontSize: 14,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    recommendHint: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    searchRow: {
      marginTop: WANTED_TOKENS.spacing.s3,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgSubtlePage,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    recommendSubtitle: {
      marginTop: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
      fontSize: 12,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    optionList: {
      gap: 8,
    },
    emptyText: {
      paddingVertical: 24,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },

    /* Bottom CTA */
    bottomBar: {
      paddingHorizontal: WANTED_TOKENS.spacing.s6,
      paddingTop: WANTED_TOKENS.spacing.s3,
      paddingBottom: WANTED_TOKENS.spacing.s5,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
      gap: WANTED_TOKENS.spacing.s2,
    },
    primary: {
      flexDirection: 'row',
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: semantic.primaryNormal,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 6,
    },
    primaryDisabled: {
      backgroundColor: 'rgba(112,115,124,0.18)',
      shadowOpacity: 0,
      elevation: 0,
    },
    primaryLabel: {
      fontSize: 16,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelOnColor,
      letterSpacing: -0.16,
    },
    primaryLabelDisabled: {
      color: semantic.labelDisabled,
    },
    footerSummary: {
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
  });

export default CommuteRouteScreen;
