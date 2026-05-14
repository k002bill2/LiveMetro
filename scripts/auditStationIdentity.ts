/**
 * Stations Identity Collision Audit
 *
 * Detects pattern where a single stationId in stations.json represents
 * physically distinct stations on different lines (e.g., the s_2523 case
 * where Line 5 양평 (서울 영등포구) and gyeongui 양평 (경기 양평) shared
 * one id, causing phantom transfer edges in the routing graph).
 *
 * Heuristics:
 *  1. Cross-line geography mismatch — single station claims membership
 *     on lines from a curated suspect-pair list.
 *  2. Name duplicates — same Korean name appears in multiple
 *     stations.json entries (intentional splits like 도라산,
 *     yangpyeong_gyeongui). Verifies line memberships are disjoint.
 *
 * Usage:
 *   npx ts-node scripts/auditStationIdentity.ts
 *   npx ts-node scripts/auditStationIdentity.ts --strict
 *
 * Memory references:
 *   [[stations-json-identity-collision]] — pattern documentation
 *   [[pr79-pending-followups]] Priority 3b — preventive audit
 */

import * as fs from 'fs';
import * as path from 'path';

interface StationData {
  id: string;
  name: string;
  nameEn?: string;
  x: number;
  y: number;
  lines: string[];
}

const STATIONS_PATH = path.join(__dirname, '..', 'src', 'data', 'stations.json');

const stations: Record<string, StationData> = JSON.parse(
  fs.readFileSync(STATIONS_PATH, 'utf-8'),
);

/**
 * Curated line pairs historically prone to identity collision (same
 * name, physically distinct stations). When a station claims membership
 * on both lines of a pair AND is not in the known-transfer allowlist,
 * treat as suspect.
 *
 * Maintained based on empirical findings:
 *  - ['5', 'gyeongui']: s_2523 양평 (resolved PR #79)
 *
 * Add new pairs as future PRs surface them.
 */
const SUSPECT_LINE_PAIRS: readonly (readonly [string, string])[] = [
  ['5', 'gyeongui'], // s_2523 양평 case
];

/**
 * Known legitimate transfer stations on suspect line pairs — these are
 * physically the same station (서울 도심 환승역) and should NOT be
 * flagged. Identified by station id (not name, since name reuse is
 * itself the collision pattern).
 */
const TRANSFER_ALLOWLIST: ReadonlySet<string> = new Set([
  'wangsimni', // 왕십리: 2/5/경의중앙/분당 환승역 (서울 성동구)
  'gongdeok', // 공덕: 5/6/경의중앙/공항 환승역 (서울 마포)
]);

interface CollisionFinding {
  id: string;
  name: string;
  lines: string[];
  suspectPairs: [string, string][];
}

interface NameDuplicateFinding {
  name: string;
  entries: { id: string; lines: string[] }[];
  hasOverlap: boolean;
}

function findSuspectCollisions(): CollisionFinding[] {
  const results: CollisionFinding[] = [];
  for (const station of Object.values(stations)) {
    if (TRANSFER_ALLOWLIST.has(station.id)) continue;
    const lines = station.lines ?? [];
    const matchedPairs: [string, string][] = [];
    for (const [a, b] of SUSPECT_LINE_PAIRS) {
      if (lines.includes(a) && lines.includes(b)) {
        matchedPairs.push([a, b]);
      }
    }
    if (matchedPairs.length > 0) {
      results.push({
        id: station.id,
        name: station.name,
        lines,
        suspectPairs: matchedPairs,
      });
    }
  }
  return results;
}

function findNameDuplicates(): NameDuplicateFinding[] {
  const byName = new Map<string, { id: string; lines: string[] }[]>();
  for (const station of Object.values(stations)) {
    const list = byName.get(station.name) ?? [];
    list.push({ id: station.id, lines: station.lines ?? [] });
    byName.set(station.name, list);
  }
  const duplicates: NameDuplicateFinding[] = [];
  for (const [name, entries] of byName.entries()) {
    if (entries.length > 1) {
      const allLines = entries.flatMap((e) => e.lines);
      const hasOverlap = allLines.length !== new Set(allLines).size;
      duplicates.push({ name, entries, hasOverlap });
    }
  }
  return duplicates;
}

const isStrict = process.argv.includes('--strict');

/* eslint-disable no-console */
console.log('=== Stations Identity Collision Audit ===\n');

console.log('## Suspect collisions (cross-line geography mismatch)\n');
const collisions = findSuspectCollisions();
if (collisions.length === 0) {
  console.log('  None found.\n');
} else {
  for (const { id, name, lines, suspectPairs } of collisions) {
    console.log(`  ${id} "${name}" lines=${JSON.stringify(lines)}`);
    for (const [a, b] of suspectPairs) {
      console.log(`    [WARN] suspect pair: ${a} + ${b}`);
    }
  }
  console.log();
}

console.log('## Name duplicates (intentional splits — verify)\n');
const duplicates = findNameDuplicates();
if (duplicates.length === 0) {
  console.log('  None found.\n');
} else {
  for (const { name, entries, hasOverlap } of duplicates) {
    console.log(`  "${name}" (${entries.length} entries):`);
    for (const { id, lines } of entries) {
      console.log(`    ${id}: lines=[${lines.join(', ')}]`);
    }
    if (hasOverlap) {
      console.log('    [WARN] duplicate line membership — review required');
    }
  }
  console.log();
}

console.log('=== Summary ===');
console.log(`  Suspect collisions: ${collisions.length}`);
console.log(`  Name duplicates: ${duplicates.length}`);
console.log(
  `  Name duplicates with line overlap: ${duplicates.filter((d) => d.hasOverlap).length}`,
);

const hasIssues =
  isStrict && (collisions.length > 0 || duplicates.some((d) => d.hasOverlap));
process.exit(hasIssues ? 1 : 0);
