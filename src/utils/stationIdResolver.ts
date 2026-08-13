/**
 * stationIdResolver — external station_cd → internal slug
 *
 * Two ID systems live in this codebase:
 *   - Internal slug ("seolleung", "s_ec82b0ea") — used by stations.json,
 *     lines.json, routeService graph nodes.
 *   - External Seoul Metro station_cd ("0220", "3762") — used by Firestore
 *     stations collection, seoulStations.json, and persisted in user
 *     commute settings (onboarding writes raw OpenAPI codes).
 *
 * routeService.calculateRoute() requires internal slugs. Calling it with an
 * external code returns null because getStationKeys() looks up STATIONS[id]
 * directly. This resolver bridges the two universes at the boundary so the
 * graph layer can stay slug-only.
 *
 * Join path (same shape as stationCoordinateLookup.ts):
 *   seoulStations.json (station_cd) → station_nm
 *   stations.json      (name)        → internal slug
 *
 * Multi-line stations (e.g. 선릉 = station_cd 0220 line 2, 1023 분당선) share
 * one station_nm and therefore collapse to a single slug, matching how
 * stations.json represents them via `lines: ['2', 'bundang']`.
 */

import stationsJson from '@/data/stations.json';
import seoulStationsJson from '@/data/seoulStations.json';
import { resolveLineKey } from '@/utils/subwayMapData';

interface SeoulStationRecord {
  readonly station_cd: string;
  readonly station_nm: string;
  readonly line_num: string;
}

interface SeoulStationsJsonShape {
  readonly DATA: readonly SeoulStationRecord[];
}

interface StationsRecord {
  readonly id: string;
  readonly name: string;
  readonly lines?: readonly string[];
}

/**
 * seoulStations.json line_num → lines.json key. Numeric trunk lines arrive
 * zero-padded ('05호선' → '5'); named lines go through resolveLineKey
 * ('경의선' → 'gyeongui').
 */
const lineNumToGraphKey = (lineNum: string): string => {
  const numeric = /^0*(\d+)호선$/.exec(lineNum);
  if (numeric?.[1]) return numeric[1];
  return resolveLineKey(lineNum);
};

const buildExternalCodeToSlug = (): Map<string, string> => {
  // Keep ALL graph entries per name: true duplicate-name stations (동명이역,
  // e.g. 양평 5호선 vs 양평 경의선) are distinct nodes sharing one station_nm,
  // so a first-wins name join would send one station_cd to the wrong node.
  const nameToEntries = new Map<string, StationsRecord[]>();
  for (const record of Object.values(
    stationsJson as Record<string, StationsRecord>,
  )) {
    const entries = nameToEntries.get(record.name);
    if (entries) {
      entries.push(record);
    } else {
      nameToEntries.set(record.name, [record]);
    }
  }

  const codeToSlug = new Map<string, string>();
  for (const record of (seoulStationsJson as unknown as SeoulStationsJsonShape)
    .DATA) {
    const entries = nameToEntries.get(record.station_nm);
    if (!entries || entries.length === 0) continue;
    let chosen = entries[0]!;
    if (entries.length > 1) {
      // Disambiguate by the record's own line. Transfer stations are a single
      // entry (lines: ['2','bundang']) and never reach this branch; only true
      // duplicate-name stations do. Fall back to the first entry so an
      // unmapped line_num degrades to the old behavior instead of dropping.
      const lineKey = lineNumToGraphKey(record.line_num);
      chosen = entries.find((entry) => entry.lines?.includes(lineKey)) ?? chosen;
    }
    codeToSlug.set(record.station_cd, chosen.id);
  }
  return codeToSlug;
};

const EXTERNAL_CODE_TO_SLUG = buildExternalCodeToSlug();
const INTERNAL_SLUGS = new Set<string>(
  Object.keys(stationsJson as Record<string, unknown>),
);

/**
 * Resolve any station identifier to an internal slug usable by routeService.
 *
 * - If `id` is already an internal slug → returned as-is.
 * - If `id` is a Seoul Metro station_cd → mapped to its slug.
 * - Otherwise → null.
 *
 * Falsy/empty inputs short-circuit to null without touching the maps.
 */
export function resolveInternalStationId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (INTERNAL_SLUGS.has(id)) return id;
  return EXTERNAL_CODE_TO_SLUG.get(id) ?? null;
}
