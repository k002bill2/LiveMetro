import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { routeService } from '@/services/route';
import { useDelayDetection } from '@/hooks/useDelayDetection';
import { arrivalService } from '@/services/arrival/arrivalService';
import { getStationById } from '@/utils/subwayMapData';
import type { Route } from '@/models/route';
import type { RealtimeArrival } from '@/services/route/realtimeWeightOverride';

export type DepartureMode = 'now' | 'depart' | 'arrive';

export interface RouteWithMLMeta extends Route {
  id: string;
  etaMinutes: number;
  etaConfidenceMinutes: number;
  delayRiskLineIds: string[];
}

interface UseRouteSearchInput {
  fromId?: string;
  toId?: string;
  departureTime: Date | null;
  departureMode: DepartureMode;
  /**
   * 화면 포커스 여부. 기본값 `true`(하위 호환).
   * 비포커스(다른 탭)일 때 내부 useDelayDetection의 9개 대표역 폴링을 멈춰
   * Seoul API rate-limit 예산 낭비와 per-station 키 교차 오염을 막는다.
   * RoutesTabScreen은 `useIsFocused()`를 전달한다.
   */
  enabled?: boolean;
}

interface UseRouteSearchResult {
  routes: RouteWithMLMeta[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const CACHE_TTL_MS = 60_000;
const TIME_BUCKET_MS = 300_000;
const DEBOUNCE_MS = 300;

interface CacheEntry {
  /**
   * Structural diverse-route pool (realtime-free). Realtime boarding wait is
   * re-applied per fetch on top of these — never baked into the cache — so a
   * cached structural result can still pick up a fresh "next train" wait.
   */
  baseRoutes: Route[];
  fetchedAt: number;
}

function timeBucket(time: Date | null): number {
  if (!time) return 0;
  return Math.floor(time.getTime() / TIME_BUCKET_MS);
}

function buildCacheKey(input: UseRouteSearchInput): string {
  return `${input.fromId ?? ''}|${input.toId ?? ''}|${input.departureMode}|${timeBucket(input.departureTime)}`;
}

// Heuristic: 2-min baseline (signal/walking variance) + 1min per transfer + 2min per delayed line, clamped to [2, 8].
function calcEtaConfidence(transferCount: number, delayLineCount: number): number {
  const raw = 2 + transferCount + delayLineCount * 2;
  return Math.min(8, Math.max(2, raw));
}

/**
 * 출발역 실시간 도착을 1회 조회해 `RealtimeArrival[]`로 매핑한다(폴링 없음).
 *
 * CRITICAL — null-drop: `TrainArrival.arrivalSeconds`가 null인 행은 filter로
 * 버린다. null→0으로 강제하면 "곧 도착"을 위조해 그 노선이 거짓 1위가 된다
 * (seoul-api-limits: `arrivalTime ? ...` 금지). 0초는 유효한 "도착"이므로 유지.
 *
 * 역 미발견/조회 실패 → 빈 배열(graceful). applyRealtimeBoardingWait가 빈 배열을
 * 무변경으로 처리하므로 baseRoutes가 그대로 쓰인다.
 */
async function fetchBoardingArrivals(fromId: string): Promise<RealtimeArrival[]> {
  const station = getStationById(fromId);
  if (!station) return [];
  try {
    const info = await arrivalService.getArrivals(station.name);
    return info.arrivals
      .filter((a) => a.arrivalSeconds !== null)
      .map((a) => ({ lineId: a.lineId, secondsUntilArrival: a.arrivalSeconds! }));
  } catch (err) {
    console.error('useRouteSearch realtime fetch failed', err);
    return [];
  }
}

function enrichRoute(route: Route, index: number, delayedLineIds: Set<string>): RouteWithMLMeta {
  const delayRiskLineIds = route.lineIds.filter(id => delayedLineIds.has(id));
  return {
    ...route,
    id: `route-${index}-${route.lineIds.join('-')}`,
    etaMinutes: route.totalMinutes,
    etaConfidenceMinutes: calcEtaConfidence(route.transferCount, delayRiskLineIds.length),
    delayRiskLineIds,
  };
}

export function useRouteSearch(input: UseRouteSearchInput): UseRouteSearchResult {
  const { delays } = useDelayDetection({ enabled: input.enabled ?? true });
  const delayedLineIds = useMemo(
    () => new Set(delays.map((d: { lineId: string }) => d.lineId)),
    [delays]
  );

  const [routes, setRoutes] = useState<RouteWithMLMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache hit semantics (skip service when cacheKey hits within CACHE_TTL_MS)
  // are exercised at the integration layer in RoutesTabScreen tests (Task 6).
  // The hook-level test here verifies that no double-fetch occurs on stable rerenders.
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const cacheKey = buildCacheKey(input);

  const performFetch = useCallback(
    async (forceFresh: boolean): Promise<void> => {
      const fromId = input.fromId;
      const toId = input.toId;
      if (!fromId || !toId) {
        setRoutes([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (fromId === toId) {
        setRoutes([]);
        setError('출발역과 도착역이 같습니다');
        setLoading(false);
        return;
      }

      const myRequestId = ++requestIdRef.current;
      setError(null);

      try {
        // Structural pool: cached (realtime-free) or freshly computed.
        const cached = cacheRef.current.get(cacheKey);
        const isWarm = !forceFresh && cached !== undefined && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
        // Only show the loading state on a genuine structural miss. On a warm
        // path (cache hit / delay-poll-triggered re-overlay) the cards are
        // already rendered — flipping `loading` true would briefly invalidate
        // downstream `loading`-gated layout (RoutesTabScreen `hasRoutes`) on
        // every poll. The realtime overlay still re-runs; only the spinner is
        // suppressed.
        if (!isWarm) setLoading(true);
        const baseRoutes = isWarm ? cached!.baseRoutes : routeService.getDiverseRoutes(fromId, toId);
        if (myRequestId !== requestIdRef.current) return;
        cacheRef.current.set(cacheKey, { baseRoutes, fetchedAt: Date.now() });

        // Realtime boarding-wait overlay — 1회 조회, structural 캐시에 안 굽는다.
        const realtimeArrivals = await fetchBoardingArrivals(fromId);
        // Re-check AFTER the await: a newer search may have superseded this one.
        if (myRequestId !== requestIdRef.current) return;

        const adjusted = routeService.applyRealtimeBoardingWait(baseRoutes, realtimeArrivals);
        const enriched = adjusted.map((route, idx) => enrichRoute(route, idx, delayedLineIds));

        setRoutes(enriched);
        setLoading(false);
      } catch (err) {
        if (myRequestId !== requestIdRef.current) return;
        console.error('useRouteSearch error', err);
        setRoutes([]);
        setError('경로를 계산할 수 없습니다');
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, input.fromId, input.toId, delayedLineIds]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performFetch(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [performFetch]);

  const refetch = useCallback((): void => {
    cacheRef.current.delete(cacheKey);
    performFetch(true);
  }, [cacheKey, performFetch]);

  return { routes, loading, error, refetch };
}

export default useRouteSearch;
