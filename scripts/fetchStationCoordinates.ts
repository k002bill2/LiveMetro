#!/usr/bin/env npx ts-node
/**
 * Fetch Station Coordinates Script
 *
 * 서울 열린데이터광장 API에서 지하철역 좌표를 가져와
 * src/data/stationCoordinates.json 파일을 생성합니다.
 *
 * API: http://openapi.seoul.go.kr:8088/{API_KEY}/json/subwayStationMaster
 *
 * Usage:
 *   SEOUL_API_KEY=your_key npx ts-node scripts/fetchStationCoordinates.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Types for API response
interface StationMasterRow {
  STATN_ID: string;      // 역 ID
  STATN_NM: string;      // 역 이름 (한글)
  STLE_CO: string;       // 호선
  LAT: string;           // 위도
  LOT: string;           // 경도
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

// Types for seoulStations.json
interface SeoulStationData {
  line_num: string;
  station_nm: string;
  station_nm_eng: string;
  station_nm_chn: string;
  station_nm_jpn: string;
  station_cd: string;
  fr_code: string;
}

interface SeoulStationsJson {
  DESCRIPTION: Record<string, string>;
  DATA: SeoulStationData[];
}

interface CoordinateData {
  latitude: number;
  longitude: number;
}

const API_KEY = process.env.SEOUL_API_KEY || process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY;

const normalizeStationName = (name: string): string => {
  // Remove parenthetical info, spaces, and special chars for matching
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .replace(/역$/g, '')
    .trim();
};

const fetchStationCoordinates = async (): Promise<Map<string, CoordinateData>> => {
  if (!API_KEY) {
    throw new Error('SEOUL_API_KEY or EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY environment variable required');
  }

  const coordinates = new Map<string, CoordinateData>();

  // Fetch from subwayStationMaster API
  // API returns max 1000 per request, we need to paginate
  const pageSize = 1000;
  let start = 1;
  let hasMore = true;

  console.log('Fetching station coordinates from Seoul Open Data API...');

  while (hasMore) {
    const end = start + pageSize - 1;
    const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/subwayStationMaster/${start}/${end}/`;

    console.log(`  Fetching ${start} to ${end}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as SubwayStationMasterResponse;

      if (data.subwayStationMaster?.RESULT?.CODE !== 'INFO-000') {
        console.warn(`  API Warning: ${data.subwayStationMaster?.RESULT?.MESSAGE}`);
        hasMore = false;
        continue;
      }

      const rows = data.subwayStationMaster.row || [];
      console.log(`  Retrieved ${rows.length} stations`);

      for (const row of rows) {
        const lat = parseFloat(row.LAT);
        const lot = parseFloat(row.LOT);

        if (isNaN(lat) || isNaN(lot) || lat === 0 || lot === 0) {
          continue;
        }

        const normalizedName = normalizeStationName(row.STATN_NM);
        const key = `${normalizedName}_${row.STLE_CO}`;

        coordinates.set(key, {
          latitude: lat,
          longitude: lot,
        });
      }

      if (rows.length < pageSize) {
        hasMore = false;
      } else {
        start = end + 1;
      }
    } catch (error) {
      console.error(`  Error fetching page ${start}-${end}:`, error);
      hasMore = false;
    }
  }

  console.log(`Total unique coordinates fetched: ${coordinates.size}`);
  return coordinates;
};

const matchCoordinatesToStations = (
  seoulStations: SeoulStationsJson,
  apiCoordinates: Map<string, CoordinateData>
): Record<string, CoordinateData> => {
  const result: Record<string, CoordinateData> = {};
  let matchedCount = 0;
  const unmatchedStations: string[] = [];

  const lineNumToCode: Record<string, string> = {
    '01호선': '1',
    '02호선': '2',
    '03호선': '3',
    '04호선': '4',
    '05호선': '5',
    '06호선': '6',
    '07호선': '7',
    '08호선': '8',
    '09호선': '9',
    '경의중앙선': '경의중앙',
    '분당선': '분당',
    '신분당선': '신분당',
    '경춘선': '경춘',
    '공항철도': '공항',
    '수인선': '수인',
    '우이신설경전철': '우이신설',
  };

  for (const station of seoulStations.DATA) {
    const normalizedName = normalizeStationName(station.station_nm);
    const lineCode = lineNumToCode[station.line_num] || station.line_num.replace('호선', '');

    // Try different matching strategies
    const keys = [
      `${normalizedName}_${lineCode}호선`,
      `${normalizedName}_${lineCode}`,
      `${normalizedName}_0${lineCode}호선`,
    ];

    let matched = false;
    for (const key of keys) {
      const coords = apiCoordinates.get(key);
      if (coords) {
        result[station.station_cd] = coords;
        matchedCount++;
        matched = true;
        break;
      }
    }

    // Try fuzzy matching by name only if not matched
    if (!matched) {
      for (const [apiKey, coords] of apiCoordinates.entries()) {
        if (apiKey.startsWith(normalizedName + '_')) {
          result[station.station_cd] = coords;
          matchedCount++;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      unmatchedStations.push(`${station.station_nm} (${station.line_num}, ${station.station_cd})`);
    }
  }

  console.log(`\nMatched ${matchedCount} of ${seoulStations.DATA.length} stations`);
  if (unmatchedStations.length > 0) {
    console.log(`\nUnmatched stations (${unmatchedStations.length}):`);
    unmatchedStations.slice(0, 20).forEach((s) => console.log(`  - ${s}`));
    if (unmatchedStations.length > 20) {
      console.log(`  ... and ${unmatchedStations.length - 20} more`);
    }
  }

  return result;
};

const main = async (): Promise<void> => {
  try {
    // Load seoulStations.json
    const seoulStationsPath = path.join(__dirname, '../src/data/seoulStations.json');
    const seoulStationsData = JSON.parse(
      fs.readFileSync(seoulStationsPath, 'utf-8')
    ) as SeoulStationsJson;

    console.log(`Loaded ${seoulStationsData.DATA.length} stations from seoulStations.json\n`);

    // Fetch coordinates from API
    const apiCoordinates = await fetchStationCoordinates();

    // Match coordinates to stations
    const stationCoordinates = matchCoordinatesToStations(seoulStationsData, apiCoordinates);

    // Write to file
    const outputPath = path.join(__dirname, '../src/data/stationCoordinates.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify(stationCoordinates, null, 2),
      'utf-8'
    );

    console.log(`\nWrote ${Object.keys(stationCoordinates).length} station coordinates to:`);
    console.log(`  ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main();
