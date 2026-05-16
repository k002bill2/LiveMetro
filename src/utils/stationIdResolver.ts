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

interface SeoulStationRecord {
  readonly station_cd: string;
  readonly station_nm: string;
}

interface SeoulStationsJsonShape {
  readonly DATA: readonly SeoulStationRecord[];
}

interface StationsRecord {
  readonly id: string;
  readonly name: string;
}

const buildExternalCodeToSlug = (): Map<string, string> => {
  const nameToSlug = new Map<string, string>();
  for (const record of Object.values(
    stationsJson as Record<string, StationsRecord>,
  )) {
    if (!nameToSlug.has(record.name)) {
      nameToSlug.set(record.name, record.id);
    }
  }

  const codeToSlug = new Map<string, string>();
  for (const record of (seoulStationsJson as unknown as SeoulStationsJsonShape)
    .DATA) {
    const slug = nameToSlug.get(record.station_nm);
    if (slug) {
      codeToSlug.set(record.station_cd, slug);
    }
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
