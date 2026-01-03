/**
 * Fetch Station Data from Seoul Open API
 *
 * This script fetches real-time station information from Seoul's Open Data Portal
 * and compares it with our local data to detect new/changed stations.
 *
 * Usage: npx ts-node scripts/fetchStationData.ts
 *
 * API Documentation: http://data.seoul.go.kr/dataList/OA-12765/F/1/datasetView.do
 */

import * as fs from 'fs';
import * as path from 'path';

// Types for Seoul API response
interface SeoulApiStationInfo {
  STATION_CD: string;    // Station code
  STATION_NM: string;    // Station name (Korean)
  LINE_NUM: string;      // Line number
  FR_CODE: string;       // Station ID code
}

interface SeoulApiResponse {
  SearchInfoBySubwayNameService?: {
    list_total_count: number;
    RESULT: {
      CODE: string;
      MESSAGE: string;
    };
    row: SeoulApiStationInfo[];
  };
}

interface StationCompareResult {
  inLocalOnly: string[];
  inApiOnly: string[];
  matched: number;
}

// Load environment variables
const API_KEY = process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY || '';
const BASE_URL = 'http://openAPI.seoul.go.kr:8088';

/**
 * Fetch station list from Seoul Open API
 */
async function fetchStationsFromApi(): Promise<SeoulApiStationInfo[]> {
  if (!API_KEY) {
    console.log('⚠️  EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY not set. Using mock data for demonstration.');
    return [];
  }

  const url = `${BASE_URL}/${API_KEY}/json/SearchInfoBySubwayNameService/1/500/`;

  try {
    const response = await fetch(url);
    const data: SeoulApiResponse = await response.json();

    if (data.SearchInfoBySubwayNameService?.row) {
      return data.SearchInfoBySubwayNameService.row;
    }
    return [];
  } catch (error) {
    console.error('❌ Failed to fetch from API:', error);
    return [];
  }
}

/**
 * Load local station data
 */
function loadLocalStations(): Record<string, { name: string; lines: string[] }> {
  const stationsPath = path.join(__dirname, '..', 'src', 'data', 'stations.json');
  const data = JSON.parse(fs.readFileSync(stationsPath, 'utf-8'));
  return data;
}

/**
 * Compare API data with local data
 */
function compareStations(
  apiStations: SeoulApiStationInfo[],
  localStations: Record<string, { name: string; lines: string[] }>
): StationCompareResult {
  const localNames = new Set(Object.values(localStations).map(s => s.name));
  const apiNames = new Set(apiStations.map(s => s.STATION_NM));

  const inLocalOnly = [...localNames].filter(name => !apiNames.has(name));
  const inApiOnly = [...apiNames].filter(name => !localNames.has(name));
  const matched = [...localNames].filter(name => apiNames.has(name)).length;

  return { inLocalOnly, inApiOnly, matched };
}

/**
 * Generate report
 */
function generateReport(result: StationCompareResult): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Station Data Sync Report');
  console.log('='.repeat(70));

  console.log(`\n✅ Matched stations: ${result.matched}`);

  if (result.inApiOnly.length > 0) {
    console.log(`\n🆕 New stations in API (not in local data): ${result.inApiOnly.length}`);
    result.inApiOnly.slice(0, 10).forEach(name => {
      console.log(`   - ${name}`);
    });
    if (result.inApiOnly.length > 10) {
      console.log(`   ... and ${result.inApiOnly.length - 10} more`);
    }
  }

  if (result.inLocalOnly.length > 0) {
    console.log(`\n⚠️  Stations only in local data: ${result.inLocalOnly.length}`);
    result.inLocalOnly.slice(0, 10).forEach(name => {
      console.log(`   - ${name}`);
    });
    if (result.inLocalOnly.length > 10) {
      console.log(`   ... and ${result.inLocalOnly.length - 10} more`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🔍 Fetching station data from Seoul Open API...\n');

  const apiStations = await fetchStationsFromApi();
  const localStations = loadLocalStations();

  if (apiStations.length === 0) {
    console.log('📋 Local station count:', Object.keys(localStations).length);
    console.log('\nTo enable API comparison, set EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY environment variable.');
    console.log('Example: EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY=your_key npx ts-node scripts/fetchStationData.ts');
    return;
  }

  console.log(`📋 API station count: ${apiStations.length}`);
  console.log(`📋 Local station count: ${Object.keys(localStations).length}`);

  const result = compareStations(apiStations, localStations);
  generateReport(result);
}

main().catch(console.error);
