/**
 * Stations Data Service
 * Provides local station data as fallback when Firebase is unavailable
 * Uses Seoul Metro official station data
 */

import seoulStationsData from '../../data/seoulStations.json';
import { Station } from '../../models/train';

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
  if (match) {
    return match[1];
  }
  // Handle special lines like "경의중앙선", "분당선", etc.
  return lineNum.replace('호선', '');
};

/**
 * Convert Seoul Metro station data to Station model
 */
const convertSeoulStationToModel = (data: SeoulStationData): Station => {
  return {
    id: data.station_cd,
    name: data.station_nm,
    nameEn: data.station_nm_eng,
    lineId: convertLineNumToLineId(data.line_num),
    coordinates: {
      latitude: 37.5665, // Default Seoul coordinates
      longitude: 126.9780,
    },
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

  console.log(`✅ Loaded stations from Seoul Metro data (${stationsByLineCache.size} lines)`);
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
