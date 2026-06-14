#!/usr/bin/env npx ts-node
/**
 * Fetch Station Coordinates Script
 *
 * 서울 열린데이터광장 subwayStationMaster API에서 지하철역 좌표를 가져와
 * src/data/stationCoordinates.json 을 생성/갱신합니다.
 *
 * API rows are keyed by BLDN_ID, which IS the station_cd used throughout the
 * app — so coordinates map DIRECTLY with no name/line matching. The previous
 * name-match + name-only fuzzy fallback mis-assigned ~350 stations' coordinates
 * by up to ~12km (e.g. 도심 3·4호선: 서울역/을지로3가/충무로 …); see memory
 * project_station_coordinates_line34_south_shift.
 *
 * The API (~784 rows) does NOT cover every Korail wide-area station the app
 * tracks, so results are MERGED into the existing file: API values are
 * authoritative for the station_cds it returns; station_cds absent from the API
 * keep their existing coordinate so coverage never regresses.
 *
 * API: http://openapi.seoul.go.kr:8088/{API_KEY}/json/subwayStationMaster
 *
 * Usage:
 *   SEOUL_API_KEY=your_key npx ts-node scripts/fetchStationCoordinates.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// subwayStationMaster row. BLDN_ID is the station_cd (e.g. "0150" = 서울역 1호선).
export interface StationMasterRow {
  BLDN_ID: string; // 역 코드 (= station_cd)
  BLDN_NM: string; // 역 이름 (한글)
  ROUTE: string;   // 호선 (예: "1호선")
  LAT: string;     // 위도
  LOT: string;     // 경도
}

interface SubwayStationMasterResponse {
  subwayStationMaster: {
    list_total_count: number;
    RESULT: {
      CODE: string;
      MESSAGE: string;
    };
    row: StationMasterRow[];
  };
}

export interface CoordinateData {
  latitude: number;
  longitude: number;
}

export type CoordinateMap = Record<string, CoordinateData>;

const API_KEY = process.env.SEOUL_API_KEY || process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY;
const PAGE_SIZE = 1000;

/**
 * Build a station_cd → coordinate map directly from API rows. Because BLDN_ID
 * IS the station_cd, no name/line matching is needed (eliminating the cross-line
 * mis-assignment that corrupted the old data). Rows with missing, zero, or
 * non-numeric coordinates are skipped.
 */
export const buildApiCoordMap = (rows: StationMasterRow[]): CoordinateMap => {
  const map: CoordinateMap = {};
  for (const row of rows) {
    const latitude = parseFloat(row.LAT);
    const longitude = parseFloat(row.LOT);
    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude === 0 ||
      longitude === 0
    ) {
      continue;
    }
    map[row.BLDN_ID] = { latitude, longitude };
  }
  return map;
};

/**
 * Merge freshly fetched API coordinates into the existing file. API values are
 * authoritative for the station_cds they cover; station_cds present only in the
 * existing file (Korail wide-area lines the API omits) are preserved so coverage
 * never regresses. Existing key order is kept (API-only codes append) to keep
 * the file diff minimal. Inputs are not mutated.
 */
export const mergeCoordinates = (
  existing: CoordinateMap,
  apiMap: CoordinateMap
): CoordinateMap => {
  return { ...existing, ...apiMap };
};

/**
 * Serialize the map to JSON with keys in deterministic string-sorted order.
 * A plain `JSON.stringify` reorders integer-like keys ("1001") ahead of
 * leading-zero codes ("0150") per JS object semantics, which churns the whole
 * file on every run. Building the string from sorted keys keeps the output
 * stable (and diffs minimal) across regenerations. Per-entry format matches
 * `JSON.stringify(value, null, 2)`.
 */
export const serializeCoordinateMap = (map: CoordinateMap): string => {
  const entries = Object.keys(map)
    .sort()
    .map(
      (key) =>
        `  ${JSON.stringify(key)}: ${JSON.stringify(map[key], null, 2)
          .split('\n')
          .join('\n  ')}`
    );
  return `{\n${entries.join(',\n')}\n}`;
};

const fetchStationRows = async (): Promise<StationMasterRow[]> => {
  if (!API_KEY) {
    throw new Error(
      'SEOUL_API_KEY or EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY environment variable required'
    );
  }

  const rows: StationMasterRow[] = [];
  let start = 1;

  console.log('Fetching station coordinates from Seoul Open Data (subwayStationMaster)...');

  // Paginate: the API returns up to PAGE_SIZE rows per request.
  for (;;) {
    const end = start + PAGE_SIZE - 1;
    const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/subwayStationMaster/${start}/${end}/`;
    console.log(`  Fetching ${start} to ${end}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as SubwayStationMasterResponse;
    const result = data.subwayStationMaster?.RESULT;
    if (result?.CODE !== 'INFO-000') {
      throw new Error(`API error: ${result?.CODE} ${result?.MESSAGE}`);
    }

    const page = data.subwayStationMaster.row || [];
    console.log(`  Retrieved ${page.length} stations`);
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
    start = end + 1;
  }

  console.log(`Total rows fetched: ${rows.length}`);
  return rows;
};

const main = async (): Promise<void> => {
  try {
    const outputPath = path.join(__dirname, '../src/data/stationCoordinates.json');
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as CoordinateMap;
    console.log(`Loaded ${Object.keys(existing).length} existing coordinates`);

    const rows = await fetchStationRows();
    const apiMap = buildApiCoordMap(rows);
    console.log(`Built ${Object.keys(apiMap).length} coordinates from API`);

    const merged = mergeCoordinates(existing, apiMap);

    const preserved = Object.keys(existing).filter((cd) => !apiMap[cd]).length;
    const added = Object.keys(apiMap).filter((cd) => !existing[cd]).length;
    console.log(
      `Merged ${Object.keys(merged).length} total ` +
      `(${Object.keys(apiMap).length} API-authoritative, ${preserved} existing preserved, ${added} new)`
    );

    fs.writeFileSync(outputPath, serializeCoordinateMap(merged), 'utf-8');
    console.log(`\nWrote ${Object.keys(merged).length} station coordinates to:`);
    console.log(`  ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Only run when invoked directly (so the pure functions above can be unit-tested
// via `npx ts-node scripts/__tests__/fetchStationCoordinates.test.ts` without
// triggering a live API fetch on import).
if (require.main === module) {
  main();
}
