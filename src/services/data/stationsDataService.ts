/**
 * Stations Data Service
 * Provides local station data as fallback when Firebase is unavailable
 * Uses Seoul Metro official station data
 */

import seoulStationsData from '../../data/seoulStations.json';
import stationsJsonData from '../../data/stations.json';
import stationCoordinates from '../../data/stationCoordinates.json';
import { Station } from '../../models/train';

// Type for station coordinates data
type CoordinateData = Record<string, { latitude: number; longitude: number }>;

// Type for Seoul Metro station data structure
interface SeoulStationData {
  line_num: string;      // "01호선", "02호선", etc.
  station_nm: string;    // Korean name
  station_nm_eng: string; // English name
  station_nm_chn: string; // Chinese name
  station_nm_jpn: string; // Japanese name
  station_cd: string;    // Station code
  fr_code: string;       // External code
}

interface SeoulStationsJson {
  DESCRIPTION: Record<string, string>;
  DATA: SeoulStationData[];
}

// Cache for faster lookups
let stationsCache: Map<string, Station> | null = null;
let stationsByLineCache: Map<string, Station[]> | null = null;

/**
 * Convert line_num to lineId format
 */
const convertLineNumToLineId = (lineNum: string): string => {
  // "01호선" -> "1", "02호선" -> "2", etc.
  const match = lineNum.match(/^0?(\d+)호선$/);
  if (match?.[1]) {
    return match[1];
  }
  // Handle special lines like "경의중앙선", "분당선", etc.
  return lineNum.replace('호선', '');
};

/**
 * Default Seoul City Hall coordinates (fallback)
 */
const DEFAULT_COORDINATES = {
  latitude: 37.5665,
  longitude: 126.9780,
};

/**
 * Convert Seoul Metro station data to Station model
 */
const convertSeoulStationToModel = (data: SeoulStationData): Station => {
  // Look up coordinates from stationCoordinates.json, fallback to default
  const coords = (stationCoordinates as CoordinateData)[data.station_cd] ?? DEFAULT_COORDINATES;

  return {
    id: data.station_cd,
    name: data.station_nm,
    nameEn: data.station_nm_eng,
    lineId: convertLineNumToLineId(data.line_num),
    coordinates: coords,
    transfers: [],
    stationCode: data.fr_code,
  };
};

/**
 * Normalize English name to ID format (lowercase, spaces to underscores)
 */
const normalizeNameToId = (name: string): string => {
  return name.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
};

/**
 * Parse fr_code (외부코드) for sorting
 * Examples: "130" → 130, "P164" → 164, "P157-1" → 157.1, "211-2" → 211.2
 */
const parseFrCode = (frCode: string): number => {
  if (!frCode) return 0;

  // Remove prefix letters (P, etc.)
  const cleaned = frCode.replace(/^[A-Z]+/, '');

  // Split by hyphen for sub-numbers (e.g., "157-1")
  const parts = cleaned.split('-');
  const mainStr = parts[0] ?? '0';
  const subStr = parts[1];
  const main = parseInt(mainStr, 10) || 0;
  const sub = subStr ? parseInt(subStr, 10) / 10 : 0;

  return main + sub;
};

/**
 * Initialize cache from Seoul Metro data
 */
const initializeCache = (): void => {
  if (stationsCache && stationsByLineCache) return;

  const jsonData = seoulStationsData as SeoulStationsJson;
  stationsCache = new Map();
  stationsByLineCache = new Map();

  jsonData.DATA.forEach((stationData) => {
    const station = convertSeoulStationToModel(stationData);

    // Add to stations cache (by multiple keys for backward compatibility)
    stationsCache!.set(station.id, station);                           // station_cd: "0222"
    stationsCache!.set(station.name, station);                         // Korean: "강남"
    stationsCache!.set(station.nameEn.toLowerCase(), station);         // English lowercase: "gangnam"
    stationsCache!.set(normalizeNameToId(station.nameEn), station);    // Normalized: "gangnam_gu_office"

    // Add to line cache
    const lineId = station.lineId;
    if (!stationsByLineCache!.has(lineId)) {
      stationsByLineCache!.set(lineId, []);
    }
    stationsByLineCache!.get(lineId)!.push(station);
  });

  // Sort stations by fr_code for each line
  stationsByLineCache.forEach((stations) => {
    stations.sort((a, b) => {
      const codeA = a.stationCode ?? '';
      const codeB = b.stationCode ?? '';
      return parseFrCode(codeA) - parseFrCode(codeB);
    });
  });

  // Also cache stations.json data for fallback (different ID format)
  // stations.json uses IDs like "s_ec82b0ea", "seoul", "city_hall_1"
  const stationsJson = stationsJsonData as Record<string, {
    id: string;
    name: string;
    lines?: string[];
    x?: number;
    y?: number;
  }>;

  let stationsJsonCount = 0;
  Object.values(stationsJson).forEach((stationData) => {
    // Skip if already cached (seoulStations.json takes priority)
    if (stationsCache!.has(stationData.id)) {
      return;
    }

    // Try to get coordinates from stationCoordinates.json using ID
    const coords = (stationCoordinates as CoordinateData)[stationData.id] ?? DEFAULT_COORDINATES;

    // Convert stations.json data to Station model
    const station: Station = {
      id: stationData.id,
      name: stationData.name,
      nameEn: stationData.name, // No English name, use Korean
      lineId: stationData.lines?.[0] || '',
      coordinates: coords,
      transfers: [],
    };

    stationsCache!.set(station.id, station);
    stationsJsonCount++;
  });

  console.log(`✅ Loaded stations from Seoul Metro data (${stationsByLineCache.size} lines, +${stationsJsonCount} from stations.json)`);
};

/**
 * Get station by ID or name from local data
 */
export const getLocalStation = (stationIdOrName: string): Station | null => {
  try {
    initializeCache();

    const station = stationsCache!.get(stationIdOrName);
    if (!station) {
      console.warn(`Station ${stationIdOrName} not found in local data`);
      return null;
    }

    return station;
  } catch (error) {
    console.error('Error loading local station data:', error);
    return null;
  }
};

/**
 * Get station by name from local data (exact match)
 */
export const getLocalStationByName = (stationName: string): Station | null => {
  return getLocalStation(stationName);
};

/**
 * Search stations by name from local data
 */
export const searchLocalStations = (query: string): Station[] => {
  try {
    initializeCache();
    const searchQuery = query.toLowerCase().trim();

    if (!searchQuery) {
      return [];
    }

    const jsonData = seoulStationsData as SeoulStationsJson;
    const matchingStations: Station[] = [];
    const seenIds = new Set<string>();

    jsonData.DATA.forEach((stationData) => {
      const nameMatch = stationData.station_nm.toLowerCase().includes(searchQuery);
      const nameEnMatch = stationData.station_nm_eng.toLowerCase().includes(searchQuery);

      if ((nameMatch || nameEnMatch) && !seenIds.has(stationData.station_cd)) {
        seenIds.add(stationData.station_cd);
        matchingStations.push(convertSeoulStationToModel(stationData));
      }
    });

    return matchingStations;
  } catch (error) {
    console.error('Error searching local stations:', error);
    return [];
  }
};

/**
 * Get all stations from local data
 */
export const getAllLocalStations = (): Station[] => {
  try {
    initializeCache();
    const jsonData = seoulStationsData as SeoulStationsJson;

    return jsonData.DATA.map((stationData) =>
      convertSeoulStationToModel(stationData)
    );
  } catch (error) {
    console.error('Error loading all local stations:', error);
    return [];
  }
};

/**
 * Get stations by line from local data
 */
export const getLocalStationsByLine = (lineId: string): Station[] => {
  try {
    initializeCache();

    const stations = stationsByLineCache!.get(lineId);
    if (!stations || stations.length === 0) {
      console.warn(`No stations found for line ${lineId} in local data`);
      return [];
    }

    return stations;
  } catch (error) {
    console.error('Error loading stations by line:', error);
    return [];
  }
};

/**
 * Line names for display
 */
const LINE_NAMES: Record<string, string> = {
  '1': '1호선',
  '2': '2호선',
  '3': '3호선',
  '4': '4호선',
  '5': '5호선',
  '6': '6호선',
  '7': '7호선',
  '8': '8호선',
  '9': '9호선',
};

/**
 * Station with line info for search modal
 */
export interface StationWithLineInfo {
  readonly id: string;       // station_cd (seoulStations.json)
  readonly name: string;     // Korean name
  readonly nameEn: string;   // English name
  readonly lineId: string;   // Line ID (1-9)
  readonly lineName: string; // Line name (1호선, 2호선, etc.)
}

/**
 * Get all stations with line info for search modal
 * Uses seoulStations.json (station_cd) for consistent ID format
 * Transfer stations appear once per line with unique station_cd
 */
export const getStationsWithLineInfo = (): StationWithLineInfo[] => {
  try {
    initializeCache();
    const jsonData = seoulStationsData as SeoulStationsJson;
    const result: StationWithLineInfo[] = [];

    // Only include lines 1-9
    const validLines = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    jsonData.DATA.forEach((stationData) => {
      const lineId = convertLineNumToLineId(stationData.line_num);

      // Skip non-numeric lines (경의중앙선, 분당선, etc.)
      if (!validLines.includes(lineId)) {
        return;
      }

      result.push({
        id: stationData.station_cd,           // station_cd for unique identification
        name: stationData.station_nm,
        nameEn: stationData.station_nm_eng,
        lineId,
        lineName: LINE_NAMES[lineId] || `${lineId}호선`,
      });
    });

    return result;
  } catch (error) {
    console.error('Error getting stations with line info:', error);
    return [];
  }
};

/**
 * Search stations with line info by name
 * Returns stations matching the query with their line info
 */
export const searchStationsWithLineInfo = (query: string): StationWithLineInfo[] => {
  if (!query.trim()) {
    return [];
  }

  const allStations = getStationsWithLineInfo();
  const searchQuery = query.toLowerCase().trim();

  return allStations.filter((station) =>
    station.name.toLowerCase().includes(searchQuery) ||
    station.nameEn.toLowerCase().includes(searchQuery)
  );
};

/**
 * Find station_cd by station name and lineId
 * Useful for migrating old IDs (station name) to new IDs (station_cd)
 */
export const findStationCdByNameAndLine = (
  stationName: string,
  lineId: string
): string | null => {
  try {
    initializeCache();
    const stations = stationsByLineCache!.get(lineId);

    if (!stations) {
      return null;
    }

    const station = stations.find(
      (s) => s.name === stationName || s.nameEn.toLowerCase() === stationName.toLowerCase()
    );

    return station?.id ?? null;
  } catch (error) {
    console.error('Error finding station_cd:', error);
    return null;
  }
};
