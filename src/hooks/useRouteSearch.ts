import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { routeService } from '@/services/route';
import { useDelayDetection } from '@/hooks/useDelayDetection';
import type { Route } from '@/models/route';

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
  routes: RouteWithMLMeta[];
  fetchedAt: number;
}

function timeBucket(time: Date | null): number {
  if (!time) return 0;
  return Math.floor(time.getTime() / TIME_BUCKET_MS);
}

function buildCacheKey(input: UseRouteSearchInput): string {
  return `${input.fromId ?? ''}|${input.toId ?? ''}|${input.departureMode}|${timeBucket(input.departureTime)}`;
}

function calcEtaConfidence(transferCount: number, delayLineCount: number): number {
  const raw = 2 + transferCount + delayLineCount * 2;
  return Math.min(8, Math.max(2, raw));
}

function enrichRoute(route: Route, index: number, delayedLineIds: Set<string>): RouteWithMLMeta {
  const delayRiskLineIds = (route.lineIds as string[]).filter(id => delayedLineIds.has(id));
  return {
    ...route,
    id: `route-${index}-${route.lineIds.join('-')}`,
    etaMinutes: route.totalMinutes,
    etaConfidenceMinutes: calcEtaConfidence(route.transferCount, delayRiskLineIds.length),
    delayRiskLineIds,
  };
}

// Extend routeService type to include getDiverseRoutes for this hook
type RouteServiceWithDiverseRoutes = typeof routeService & {
  getDiverseRoutes: (fromId: string, toId: string) => Route[];
};

export function useRouteSearch(input: UseRouteSearchInput): UseRouteSearchResult {
  const { delays } = useDelayDetection();
  const delayedLineIds = useMemo(
    () => new Set(delays.map((d: { lineId: string }) => d.lineId)),
    [delays]
  );

  const [routes, setRoutes] = useState<RouteWithMLMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const cacheKey = buildCacheKey(input);

  const performFetch = useCallback(
    (forceFresh: boolean): void => {
      if (!input.fromId || !input.toId) {
        setRoutes([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (input.fromId === input.toId) {
        setRoutes([]);
        setError('출발역과 도착역이 같습니다');
        setLoading(false);
        return;
      }

      const cached = cacheRef.current.get(cacheKey);
      if (!forceFresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        setRoutes(cached.routes);
        setError(null);
        setLoading(false);
        return;
      }

      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const service = routeService as RouteServiceWithDiverseRoutes;
        const baseRoutes = service.getDiverseRoutes(input.fromId, input.toId);
        if (myRequestId !== requestIdRef.current) return;

        const enriched = baseRoutes.map((route, idx) => enrichRoute(route, idx, delayedLineIds));
        cacheRef.current.set(cacheKey, { routes: enriched, fetchedAt: Date.now() });

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
