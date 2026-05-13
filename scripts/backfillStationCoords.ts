/**
 * Backfill Station Coordinates via Neighbor Interpolation
 *
 * Many stations in src/data/stations.json have placeholder (0,0) coords.
 * For stations that lie between two valid-coord stations on the same line
 * subarray, linear-interpolate based on array position.
 *
 * Stations with no valid neighbors (e.g., lines where all stations are
 * (0,0)) are skipped and reported — they need external coordinate
 * source (Seoul Open Data lat/long + canvas transform).
 *
 * Usage:
 *   npx ts-node scripts/backfillStationCoords.ts            # dry-run
 *   npx ts-node scripts/backfillStationCoords.ts --apply    # write changes
 *
 * Memory references:
 *   [[pr79-pending-followups]] Priority 3a — 231 (0,0) stations
 *   [[stations-json-identity-collision]] — neighbor interpolation pattern
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

interface LinesData {
  stations: Record<string, string[] | string[][]>;
  colors?: Record<string, string>;
}

const STATIONS_PATH = path.join(__dirname, '..', 'src', 'data', 'stations.json');
const LINES_PATH = path.join(__dirname, '..', 'src', 'data', 'lines.json');

const stations: Record<string, StationData> = JSON.parse(
  fs.readFileSync(STATIONS_PATH, 'utf-8'),
);
const linesData: LinesData = JSON.parse(fs.readFileSync(LINES_PATH, 'utf-8'));

const isZeroCoord = (s: StationData): boolean => s.x === 0 && s.y === 0;

/** Normalize line stations to nested form (PR #79 schema). */
function normalizeLine(raw: string[] | string[][]): string[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'string') return [raw as string[]];
  return raw as string[][];
}

interface Interpolation {
  stationId: string;
  name: string;
  newX: number;
  newY: number;
  basis: string; // explanation
}

/**
 * For one subarray, find (0,0) stations bounded by valid neighbors and
 * compute their interpolated coords.
 */
function interpolateSubarray(stationIds: string[]): Interpolation[] {
  const interpolations: Interpolation[] = [];
  const n = stationIds.length;
  if (n < 3) return []; // need at least 1 zero + 2 valid bounds

  for (let i = 0; i < n; i++) {
    const sid = stationIds[i];
    if (!sid) continue;
    const s = stations[sid];
    if (!s || !isZeroCoord(s)) continue;

    let leftIdx = i - 1;
    while (leftIdx >= 0) {
      const lsid = stationIds[leftIdx];
      const ls = lsid ? stations[lsid] : undefined;
      if (ls && !isZeroCoord(ls)) break;
      leftIdx--;
    }
    let rightIdx = i + 1;
    while (rightIdx < n) {
      const rsid = stationIds[rightIdx];
      const rs = rsid ? stations[rsid] : undefined;
      if (rs && !isZeroCoord(rs)) break;
      rightIdx++;
    }
    if (leftIdx < 0 || rightIdx >= n) continue;

    // Conservative: only interpolate single-(0,0) gaps (total === 2).
    // Multi-station chains risk garbage when the array contains
    // mash of distant subroutes (e.g., 1호선 long-tail).
    const total = rightIdx - leftIdx;
    if (total > 2) continue;

    const lsid = stationIds[leftIdx];
    const rsid = stationIds[rightIdx];
    const left = lsid ? stations[lsid] : undefined;
    const right = rsid ? stations[rsid] : undefined;
    if (!left || !right) continue;

    // Sanity check: if left/right are too far apart (e.g., 1호선 array
    // mashes Seoul ↔ Cheonan), interpolation is garbage. Skip.
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 600) continue; // empirical: typical adjacent station pair < 300

    const offset = i - leftIdx;
    const ratio = offset / total;
    const newX = Math.round(left.x + dx * ratio);
    const newY = Math.round(left.y + dy * ratio);

    interpolations.push({
      stationId: sid,
      name: s.name,
      newX,
      newY,
      basis: `${left.name}(${left.x},${left.y}) → ${right.name}(${right.x},${right.y}), ratio ${offset}/${total}`,
    });
  }
  return interpolations;
}

const allInterpolations = new Map<string, Interpolation>();
const skippedByLine = new Map<string, string[]>();

for (const [lineId, raw] of Object.entries(linesData.stations)) {
  const segments = normalizeLine(raw);
  for (const seg of segments) {
    const found = interpolateSubarray(seg);
    for (const interp of found) {
      // First interpolation wins (stable); subsequent attempts on same
      // station id from another line/subarray skipped to avoid
      // contradictions.
      if (!allInterpolations.has(interp.stationId)) {
        allInterpolations.set(interp.stationId, interp);
      }
    }
  }
  // Identify (0,0) stations on this line that didn't get interpolated
  const segFlat = segments.flat();
  for (const sid of segFlat) {
    const s = stations[sid];
    if (s && isZeroCoord(s) && !allInterpolations.has(sid)) {
      if (!skippedByLine.has(lineId)) skippedByLine.set(lineId, []);
      skippedByLine.get(lineId)!.push(`${sid} (${s.name})`);
    }
  }
}

/* eslint-disable no-console */
console.log('=== Station Coordinate Backfill (Neighbor Interpolation) ===\n');

console.log(`## Interpolations (${allInterpolations.size} stations)\n`);
for (const interp of allInterpolations.values()) {
  console.log(`  ${interp.stationId} "${interp.name}" → (${interp.newX}, ${interp.newY})`);
  console.log(`    basis: ${interp.basis}`);
}
console.log();

console.log(`## Skipped — no valid neighbors (${[...skippedByLine.values()].flat().length} stations)\n`);
for (const [lineId, list] of skippedByLine.entries()) {
  console.log(`  Line ${lineId} (${list.length}):`);
  for (const item of list) console.log(`    - ${item}`);
}
console.log();

const isApply = process.argv.includes('--apply');

if (isApply) {
  for (const interp of allInterpolations.values()) {
    const s = stations[interp.stationId];
    if (s) {
      s.x = interp.newX;
      s.y = interp.newY;
    }
  }
  fs.writeFileSync(STATIONS_PATH, JSON.stringify(stations, null, 2) + '\n');
  console.log(`\n[APPLIED] Wrote ${allInterpolations.size} coordinate updates to stations.json`);
} else {
  console.log('\n[DRY-RUN] No changes written. Pass --apply to update stations.json.');
}
