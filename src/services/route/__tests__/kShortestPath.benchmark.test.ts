/**
 * Yen's K-Shortest benchmark (Issue #162 E.3 measurement)
 *
 * NOT a regression test. On-demand profiler for Yen's hot path. Skipped
 * in CI (~16s) — flip `describe.skip` → `describe` and re-run if you're
 * tuning the algorithm.
 *
 * Run: `npx jest kShortestPath.benchmark --watchman=false`
 *
 * Issue #162 baseline (Option B — lazy exclude predicate in Dijkstra):
 *   K=15 median (production):
 *     seoul→city_hall_1   ~23ms  (was 135ms — 5.9x)
 *     종각→을지로입구     ~21ms  (was 123ms — 5.9x)
 *     s_4111→s_ec9881ec   ~65ms  (was 261ms — 4.0x)
 *     seoul→gangnam       ~42ms  (was 211ms — 5.0x)
 *   All pairs under user-perceptible threshold (100ms).
 */

import { findKShortestPaths } from '../kShortestPath';

interface BenchResult {
  pair: string;
  k: number;
  totalMs: number;
  pathsFound: number;
}

const pairs: readonly (readonly [string, string])[] = [
  ['seoul', 'city_hall_1'], // very short
  ['s_eca285ea', 's_ec9d84ec'], // 종각→을지로입구 (city_hall transfer)
  ['gangnam', 'hongdae_ipgu'], // longer cross-line
  ['s_4111', 's_ec9881ec'], // arbitrary mid-graph pair
  ['seoul', 'gangnam'], // common commute
];

const TRIALS = 5;

const benchOne = (from: string, to: string, k: number): BenchResult => {
  const times: number[] = [];
  let pathsFound = 0;
  // warm-up
  findKShortestPaths(from, to, k);
  for (let i = 0; i < TRIALS; i++) {
    const t0 = performance.now();
    const r = findKShortestPaths(from, to, k);
    times.push(performance.now() - t0);
    pathsFound = r.paths.length;
  }
  times.sort((a, b) => a - b);
  const medianMs = times[Math.floor(times.length / 2)] ?? 0;
  return {
    pair: `${from}→${to}`,
    k,
    totalMs: Number(medianMs.toFixed(2)),
    pathsFound,
  };
};

describe.skip('Yen K-Shortest benchmark (Issue #162 baseline)', () => {
  it('measure baseline cost across K=5,15,30', () => {
    const results: BenchResult[] = [];
    for (const [from, to] of pairs) {
      for (const k of [5, 15, 30]) {
        results.push(benchOne(from, to, k));
      }
    }
    // eslint-disable-next-line no-console
    console.log('\n=== Yen K-Shortest Benchmark ===');
    // eslint-disable-next-line no-console
    console.table(results);
    // eslint-disable-next-line no-console
    console.log(`Trials per cell: ${TRIALS} (median reported, warm-up excluded)`);
    expect(results.length).toBeGreaterThan(0);
  });
});
