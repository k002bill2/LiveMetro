/**
 * routeCache — LRU + TTL cache tests
 *
 * Issue #161 (Phase E.2). Covers: key construction, hit/miss, TTL lazy
 * delete, LRU eviction at capacity, congestionMultipliers stable hashing,
 * stats lifecycle. clear() between tests for isolation.
 */

import type { Route } from '@models/route';
import {
  LRU_CAPACITY,
  TTL_MS,
  buildCacheKey,
  clear,
  get,
  getStats,
  set,
} from '../routeCache';

const makeRoute = (id: string): Route => ({
  segments: [],
  totalMinutes: 10,
  transferCount: 0,
  lineIds: [id],
});

describe('routeCache', () => {
  beforeEach(() => {
    clear();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buildCacheKey', () => {
    it('produces stable key for same inputs', () => {
      const k1 = buildCacheKey('a', 'b', 5);
      const k2 = buildCacheKey('a', 'b', 5);
      expect(k1).toBe(k2);
    });

    it('differentiates by station ids and maxRoutes', () => {
      expect(buildCacheKey('a', 'b', 5)).not.toBe(buildCacheKey('b', 'a', 5));
      expect(buildCacheKey('a', 'b', 5)).not.toBe(buildCacheKey('a', 'b', 3));
    });

    it('treats undefined congestion same as empty Map (both → "0")', () => {
      const k1 = buildCacheKey('a', 'b', 5, undefined);
      const k2 = buildCacheKey('a', 'b', 5, new Map());
      expect(k1).toBe(k2);
      expect(k1.endsWith('|0')).toBe(true);
    });

    it('congestion hash is stable regardless of Map insertion order', () => {
      const m1 = new Map([['1', 1.2], ['2', 1.5], ['9', 0.9]]);
      const m2 = new Map([['9', 0.9], ['2', 1.5], ['1', 1.2]]);
      expect(buildCacheKey('a', 'b', 5, m1)).toBe(buildCacheKey('a', 'b', 5, m2));
    });

    it('different congestion values produce different keys', () => {
      const m1 = new Map([['1', 1.2]]);
      const m2 = new Map([['1', 1.5]]);
      expect(buildCacheKey('a', 'b', 5, m1)).not.toBe(buildCacheKey('a', 'b', 5, m2));
    });
  });

  describe('get/set', () => {
    it('miss for unset key', () => {
      expect(get('k1')).toBeUndefined();
      expect(getStats().misses).toBe(1);
      expect(getStats().hits).toBe(0);
    });

    it('hit after set', () => {
      set('k1', [makeRoute('1')]);
      const result = get('k1');
      expect(result).toBeDefined();
      expect(result!.length).toBe(1);
      expect(result![0]!.lineIds).toEqual(['1']);
      expect(getStats().hits).toBe(1);
      expect(getStats().misses).toBe(0);
    });

    it('caches empty results (e.g. unreachable pair)', () => {
      set('k_empty', []);
      const result = get('k_empty');
      expect(result).toBeDefined();
      expect(result!.length).toBe(0);
      expect(getStats().hits).toBe(1);
    });

    it('overwrites existing entry on set', () => {
      set('k1', [makeRoute('1')]);
      set('k1', [makeRoute('2'), makeRoute('3')]);
      const result = get('k1');
      expect(result!.length).toBe(2);
      expect(getStats().size).toBe(1);
    });
  });

  describe('TTL lazy delete', () => {
    it('returns undefined after TTL elapsed', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 25, 10, 0, 0));
      set('k1', [makeRoute('1')]);
      expect(get('k1')).toBeDefined();

      jest.setSystemTime(new Date(2026, 4, 25, 10, 0, 0).getTime() + TTL_MS + 1);
      expect(get('k1')).toBeUndefined();
      expect(getStats().size).toBe(0);
    });

    it('returns hit at exact TTL boundary - 1ms', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 4, 25, 10, 0, 0));
      set('k1', [makeRoute('1')]);
      jest.setSystemTime(new Date(2026, 4, 25, 10, 0, 0).getTime() + TTL_MS - 1);
      expect(get('k1')).toBeDefined();
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry when capacity exceeded', () => {
      for (let i = 0; i < LRU_CAPACITY; i++) {
        set(`k${i}`, [makeRoute(`${i}`)]);
      }
      expect(getStats().size).toBe(LRU_CAPACITY);
      expect(getStats().evictions).toBe(0);

      set('k_new', [makeRoute('new')]);
      expect(getStats().size).toBe(LRU_CAPACITY);
      expect(getStats().evictions).toBe(1);

      expect(get('k0')).toBeUndefined();
      expect(get('k_new')).toBeDefined();
    });

    it('get-hit refreshes LRU position so old entries survive', () => {
      for (let i = 0; i < LRU_CAPACITY; i++) {
        set(`k${i}`, [makeRoute(`${i}`)]);
      }
      get('k0');
      set('k_new', [makeRoute('new')]);
      expect(get('k0')).toBeDefined();
      expect(get('k1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('resets store and stats', () => {
      set('k1', [makeRoute('1')]);
      get('k1');
      get('nope');
      clear();
      const s = getStats();
      expect(s.size).toBe(0);
      expect(s.hits).toBe(0);
      expect(s.misses).toBe(0);
      expect(s.evictions).toBe(0);
      expect(get('k1')).toBeUndefined();
    });
  });
});
