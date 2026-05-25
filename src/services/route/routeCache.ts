/**
 * routeCache — LRU + TTL cache for `getDiverseRoutes`
 *
 * Issue #161 (Phase E.2 — split from #73). UI 메인 경로 검색이 같은 입력으로
 * 반복 호출되는 패턴이 잦아 (입력 폼 re-render, 같은 출퇴근 매번 등) Yen's
 * K-Shortest의 dominant cost(buildGraph + spur regeneration)를 짧은 윈도우
 * 안에서 압축한다.
 *
 * Design:
 * - LRU via Map insertion-order. get-hit 시 delete+set으로 recent 위치 갱신.
 * - TTL lazy delete: get 시점에 expired면 evict하고 miss 처리. 실시간성을
 *   해치지 않으면서 active timer로 인한 RN background leak 회피.
 * - congestionMultipliers는 ReadonlyMap이라 JSON.stringify로는 키 순서
 *   불안정 → sorted entries + FNV-1a 32bit hash로 stable key.
 * - Dev-only hit ratio logging (50 calls마다). __DEV__ 가드라 production
 *   에서 0-cost.
 */

import type { Route } from '@models/route';

export const LRU_CAPACITY = 64;
export const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  routes: readonly Route[];
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

const store = new Map<string, CacheEntry>();
const stats: CacheStats = { hits: 0, misses: 0, evictions: 0 };

const LOG_INTERVAL = 50;
let callCount = 0;

const fnv1a32 = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
};

const hashCongestion = (m?: ReadonlyMap<string, number>): string => {
  if (!m || m.size === 0) return '0';
  const sorted = [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const serialized = sorted.map(([k, v]) => `${k}:${v}`).join('|');
  return fnv1a32(serialized).toString(36);
};

export const buildCacheKey = (
  fromStationId: string,
  toStationId: string,
  maxRoutes: number,
  congestionMultipliers?: ReadonlyMap<string, number>,
): string => `${fromStationId}|${toStationId}|${maxRoutes}|${hashCongestion(congestionMultipliers)}`;

export const get = (key: string): readonly Route[] | undefined => {
  callCount++;
  const entry = store.get(key);
  if (!entry) {
    stats.misses++;
    maybeLogStats();
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    stats.misses++;
    maybeLogStats();
    return undefined;
  }
  store.delete(key);
  store.set(key, entry);
  stats.hits++;
  maybeLogStats();
  return entry.routes;
};

export const set = (key: string, routes: readonly Route[]): void => {
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= LRU_CAPACITY) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) {
      store.delete(oldest);
      stats.evictions++;
    }
  }
  store.set(key, { routes, expiresAt: Date.now() + TTL_MS });
};

export const clear = (): void => {
  store.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.evictions = 0;
  callCount = 0;
};

export const getStats = (): Readonly<CacheStats & { size: number }> => ({
  ...stats,
  size: store.size,
});

const maybeLogStats = (): void => {
  if (!__DEV__) return;
  if (callCount % LOG_INTERVAL !== 0) return;
  const total = stats.hits + stats.misses;
  const ratio = total === 0 ? 0 : (stats.hits / total) * 100;
  // eslint-disable-next-line no-console
  console.log(
    `[routeCache] calls=${callCount} hit=${stats.hits} miss=${stats.misses} ratio=${ratio.toFixed(1)}% evictions=${stats.evictions} size=${store.size}/${LRU_CAPACITY}`,
  );
};
