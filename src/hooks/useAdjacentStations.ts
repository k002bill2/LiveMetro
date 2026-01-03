/**
 * useAdjacentStations Hook
 * Find previous and next stations in a subway line sequence
 */

import { useMemo } from 'react';
import { Station } from '@/models/train';
import { getLocalStationsByLine } from '@/services/data/stationsDataService';

interface AdjacentStations {
  prevStation: Station | null;
  nextStation: Station | null;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Hook to get adjacent (previous/next) stations for navigation
 * @param stationName - Current station name (Korean)
 * @param lineId - Current subway line ID
 * @returns Object with prev/next stations and availability flags
 */
export const useAdjacentStations = (
  stationName: string,
  lineId: string
): AdjacentStations => {
  return useMemo(() => {
    // Get all stations for this line in sequence order
    const stations = getLocalStationsByLine(lineId);

    if (!stations || stations.length === 0) {
      return {
        prevStation: null,
        nextStation: null,
        hasPrev: false,
        hasNext: false,
      };
    }

    // Find current station index by name
    const currentIndex = stations.findIndex(
      (station) => station.name === stationName
    );

    // Station not found in this line
    if (currentIndex === -1) {
      return {
        prevStation: null,
        nextStation: null,
        hasPrev: false,
        hasNext: false,
      };
    }

    // Check if this is a circular line (Line 2)
    const isCircularLine = lineId === '2';

    let prevStation: Station | null = null;
    let nextStation: Station | null = null;
    let hasPrev = false;
    let hasNext = false;

    // Calculate previous station
    if (currentIndex > 0) {
      prevStation = stations[currentIndex - 1] || null;
      hasPrev = true;
    } else if (isCircularLine) {
      // For circular line, first station's previous is last station
      prevStation = stations[stations.length - 1] || null;
      hasPrev = true;
    }

    // Calculate next station
    if (currentIndex < stations.length - 1) {
      nextStation = stations[currentIndex + 1] || null;
      hasNext = true;
    } else if (isCircularLine) {
      // For circular line, last station's next is first station
      nextStation = stations[0] || null;
      hasNext = true;
    }

    return {
      prevStation,
      nextStation,
      hasPrev,
      hasNext,
    };
  }, [stationName, lineId]);
};

export default useAdjacentStations;
