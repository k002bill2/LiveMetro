/**
 * Stations Data Service
 * Provides local station data as fallback when Firebase is unavailable
 */

import stationsData from '../../data/stations.json';
import linesData from '../../data/lines.json';
import { Station } from '../../models/train';

// Type for local station data structure
interface LocalStationData {
  id: string;
  name: string;
  nameEn?: string;
  x: number;
  y: number;
  lines: string[];
}

/**
 * Convert local station data to Station model
 */
const convertLocalStationToModel = (
  stationId: string,
  localData: LocalStationData
): Station => {
  // Use first line as lineId, or empty string if no lines
  const lineId = localData.lines?.[0] || '';

  return {
    id: stationId,
    name: localData.name,
    nameEn: localData.nameEn || '',
    lineId,
    coordinates: {
      // Convert SVG coordinates to approximate lat/lng
      // This is a rough conversion - actual coordinates should come from Firebase
      latitude: 37.5 + (localData.y / 10000),
      longitude: 126.9 + (localData.x / 10000),
    },
    transfers: localData.lines.slice(1), // Other lines are transfers
  };
};

/**
 * Get station by ID from local data
 */
export const getLocalStation = (stationId: string): Station | null => {
  try {
    const localData = stationsData as Record<string, LocalStationData>;
    const stationData = localData[stationId];

    if (!stationData) {
      console.warn(`Station ${stationId} not found in local data`);
      return null;
    }

    return convertLocalStationToModel(stationId, stationData);
  } catch (error) {
    console.error('Error loading local station data:', error);
    return null;
  }
};

/**
 * Search stations by name from local data
 */
export const searchLocalStations = (query: string): Station[] => {
  try {
    const localData = stationsData as Record<string, LocalStationData>;
    const searchQuery = query.toLowerCase().trim();

    if (!searchQuery) {
      return [];
    }

    const matchingStations: Station[] = [];

    Object.entries(localData).forEach(([stationId, stationData]) => {
      const nameMatch = stationData.name.toLowerCase().includes(searchQuery);
      const nameEnMatch = stationData.nameEn?.toLowerCase().includes(searchQuery);

      if (nameMatch || nameEnMatch) {
        matchingStations.push(convertLocalStationToModel(stationId, stationData));
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
    const localData = stationsData as Record<string, LocalStationData>;

    return Object.entries(localData).map(([stationId, stationData]) =>
      convertLocalStationToModel(stationId, stationData)
    );
  } catch (error) {
    console.error('Error loading all local stations:', error);
    return [];
  }
};

/**
 * Get stations by line from local data
 * Uses lines.json to maintain correct station sequence
 */
export const getLocalStationsByLine = (lineId: string): Station[] => {
  try {
    const localStationsData = stationsData as Record<string, LocalStationData>;
    const lines = linesData as { stations: Record<string, string[]> };

    // Get the ordered station IDs for this line
    const stationIds = lines.stations[lineId];

    if (!stationIds || stationIds.length === 0) {
      console.warn(`No station sequence found for line ${lineId} in lines.json`);
      return [];
    }

    // Map station IDs to Station objects in the correct order
    const stationsInLine: Station[] = [];

    stationIds.forEach((stationId) => {
      const stationData = localStationsData[stationId];
      if (stationData) {
        stationsInLine.push(convertLocalStationToModel(stationId, stationData));
      } else {
        console.warn(`Station ${stationId} not found in stations.json`);
      }
    });

    return stationsInLine;
  } catch (error) {
    console.error('Error loading stations by line:', error);
    return [];
  }
};
