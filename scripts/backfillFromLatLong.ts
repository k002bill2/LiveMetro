/**
 * Backfill Station Coordinates from Seoul Open Data lat/long
 *
 * For (0,0) stations remaining after neighbor-interpolation
 * (scripts/backfillStationCoords.ts), use Seoul Open Data lat/long
 * (src/data/stationCoordinates.json) with a linear canvas transform.
 *
 * NOTE: LiveMetro's canvas (4900×4400) is a schematic transit map
 * (octolinear, design-driven), NOT a linear lat/long projection.
 * Linear-fit residual is ~400 px (median). Resulting positions are
 * approximate — much better than (0,0) origin, but ~half a station
 * grid square off from the design ideal.
 *
 * Design map authoritative positions should be backfilled manually
 * for each station, but this script gets all stations into rough
 * geographic position so SubwayMapView no longer stacks them at origin.
 *
 * Usage:
 *   npx ts-node scripts/backfillFromLatLong.ts          # dry-run
 *   npx ts-node scripts/backfillFromLatLong.ts --apply  # write
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

interface SeoulStation {
  station_cd: string;
  station_nm: string;
  line_num: string;
}

const STATIONS_PATH = path.join(__dirname, '..', 'src', 'data', 'stations.json');
const COORDS_PATH = path.join(__dirname, '..', 'src', 'data', 'stationCoordinates.json');
const SEOUL_PATH = path.join(__dirname, '..', 'src', 'data', 'seoulStations.json');

const stations: Record<string, StationData> = JSON.parse(
  fs.readFileSync(STATIONS_PATH, 'utf-8'),
);
const coords: Record<string, { latitude: number; longitude: number }> = JSON.parse(
  fs.readFileSync(COORDS_PATH, 'utf-8'),
);
const seoulData: { DATA: SeoulStation[] } = JSON.parse(
  fs.readFileSync(SEOUL_PATH, 'utf-8'),
);

// Build name → code lookup (Seoul stations)
const seoulNameToCode = new Map<string, string[]>();
for (const row of seoulData.DATA) {
  const list = seoulNameToCode.get(row.station_nm) ?? [];
  list.push(row.station_cd);
  seoulNameToCode.set(row.station_nm, list);
}

const sPattern = /^s_(\d+)$/;
const isZero = (s: StationData): boolean => s.x === 0 && s.y === 0;

interface TrainingSample {
  x: number;
  y: number;
  lat: number;
  long: number;
}

// Build training set: stations with valid (x, y) AND lat/long
const training: TrainingSample[] = [];
for (const st of Object.values(stations)) {
  if (isZero(st)) continue;
  // Try direct s_NNNN code
  const m = sPattern.exec(st.id);
  let code: string | undefined;
  if (m) {
    code = m[1];
  } else {
    // Slug: name lookup via seoulStations
    const codes = seoulNameToCode.get(st.name);
    if (codes && codes.length > 0) code = codes[0];
  }
  if (code) {
    const cc = coords[code];
    if (cc) {
      training.push({ x: st.x, y: st.y, lat: cc.latitude, long: cc.longitude });
    }
  }
}

function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dxv = (xs[i] ?? 0) - mx;
    num += dxv * ((ys[i] ?? 0) - my);
    den += dxv * dxv;
  }
  if (den === 0) return { slope: 0, intercept: my };
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

const { slope: ax, intercept: bx } = linearFit(
  training.map((t) => t.long),
  training.map((t) => t.x),
);
const { slope: cy, intercept: dy } = linearFit(
  training.map((t) => t.lat),
  training.map((t) => t.y),
);

// Apply to (0,0) stations
interface Update {
  id: string;
  name: string;
  newX: number;
  newY: number;
}

const updates: Update[] = [];
const skipped: Array<{ id: string; name: string; reason: string }> = [];

for (const st of Object.values(stations)) {
  if (!isZero(st)) continue;
  const m = sPattern.exec(st.id);
  let code: string | undefined;
  if (m) {
    code = m[1];
  } else {
    const codes = seoulNameToCode.get(st.name);
    if (codes && codes.length > 0) code = codes[0];
  }
  const c = code ? coords[code] : undefined;
  if (!c) {
    skipped.push({ id: st.id, name: st.name, reason: 'no Seoul coord' });
    continue;
  }
  const newX = Math.round(ax * c.longitude + bx);
  const newY = Math.round(cy * c.latitude + dy);
  updates.push({ id: st.id, name: st.name, newX, newY });
}

/* eslint-disable no-console */
console.log('=== Coordinate Backfill from Seoul Open Data Lat/Long ===\n');
console.log(`Training samples: ${training.length}`);
console.log(`Linear transform:`);
console.log(`  x = ${ax.toFixed(2)} * long + ${bx.toFixed(2)}`);
console.log(`  y = ${cy.toFixed(2)} * lat  + ${dy.toFixed(2)}`);
console.log();
console.log(`Updates: ${updates.length}`);
console.log(`Skipped: ${skipped.length}`);
if (skipped.length > 0) {
  console.log('Skipped sample:');
  for (const s of skipped.slice(0, 5)) console.log(`  ${s.id} (${s.name}): ${s.reason}`);
}
console.log();

const isApply = process.argv.includes('--apply');
if (isApply) {
  for (const u of updates) {
    const s = stations[u.id];
    if (s) {
      s.x = u.newX;
      s.y = u.newY;
    }
  }
  fs.writeFileSync(STATIONS_PATH, JSON.stringify(stations, null, 2) + '\n');
  console.log(`[APPLIED] Wrote ${updates.length} updates to stations.json`);
} else {
  console.log('[DRY-RUN] Pass --apply to write changes.');
}
