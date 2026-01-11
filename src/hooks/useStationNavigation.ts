/**
 * useStationNavigation Hook
 * Manages navigation between stations in a subway line
 */

import { useState, useEffect, useCallback } from 'react';
import { trainService } from '../services/train/trainService';
import { Station } from '../models/train';

export interface UseStationNavigationResult {
  currentStation: Station | null;
  previousStation: Station | null;
  nextStation: Station | null;
  allStations: Station[];
  currentIndex: number;
  loading: boolean;
  error: string | null;
  goToPrevious: () => void;
  goToNext: () => void;
  goToStation: (stationId: string) => void;
  refresh: () => Promise<void>;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

interface UseStationNavigationOptions {
  initialStationId?: string;
  lineId: string;
}

/**
 * Normalize string for comparison (remove spaces, special chars, lowercase)
 */
const normalizeForComparison = (str: string): string => {
  return str.toLowerCase().replace(/[\s\-_().]/g, '');
};

/**
 * Find station index with multiple matching strategies
 * Handles ID format inconsistencies between data sources:
 * - seoulStations.json uses station_cd (e.g., "0151", "0222")
 * - stations.json uses custom IDs (e.g., "city_hall_1", "gangnam")
 * - Legacy favorites may use station names
 */
const findStationIndex = (stations: Station[], stationId: string): number => {
  if (!stationId) return -1;

  // 1. Exact ID match (station_cd from seoulStations.json)
  let index = stations.findIndex(s => s.id === stationId);
  if (index >= 0) return index;

  // 2. stationCode (fr_code) match
  index = stations.findIndex(s => s.stationCode === stationId);
  if (index >= 0) return index;

  // 3. Exact name match (stationId might be a Korean station name)
  index = stations.findIndex(s => s.name === stationId);
  if (index >= 0) return index;

  // 4. English name match (case-insensitive)
  const lowerStationId = stationId.toLowerCase();
  index = stations.findIndex(s => s.nameEn?.toLowerCase() === lowerStationId);
  if (index >= 0) return index;

  // 5. Normalized name match for legacy stations.json IDs
  // e.g., "city_hall_1" should match "City Hall", "gangnam" should match "Gangnam"
  const normalizedStationId = normalizeForComparison(stationId);
  index = stations.findIndex(s => {
    const normalizedName = normalizeForComparison(s.name);
    const normalizedNameEn = normalizeForComparison(s.nameEn || '');
    return normalizedName === normalizedStationId ||
           normalizedNameEn === normalizedStationId ||
           normalizedNameEn.includes(normalizedStationId) ||
           normalizedStationId.includes(normalizedNameEn);
  });
  if (index >= 0) return index;

  // 6. Partial name match as last resort
  // For IDs like "jongno3ga_5" → extract "jongno3ga" and match "종로3가"
  const cleanedId = stationId.replace(/_\d+$/, ''); // Remove trailing "_N" suffix
  if (cleanedId !== stationId) {
    const normalizedCleanedId = normalizeForComparison(cleanedId);
    index = stations.findIndex(s => {
      const normalizedNameEn = normalizeForComparison(s.nameEn || '');
      return normalizedNameEn.includes(normalizedCleanedId) ||
             normalizedCleanedId.includes(normalizedNameEn);
    });
    if (index >= 0) return index;
  }

  return -1;
};

/**
 * Hook for navigating between stations in a line
 */
export const useStationNavigation = (
  options: UseStationNavigationOptions
): UseStationNavigationResult => {
  const { initialStationId, lineId } = options;

  const [allStations, setAllStations] = useState<Station[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load all stations for the line
   */
  const loadStations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const stations = await trainService.getStationsByLine(lineId);

      if (stations.length === 0) {
        setError('이 노선에 역 정보가 없습니다.');
        return;
      }

      setAllStations(stations);

      // Set initial station index using multi-match strategy
      if (initialStationId) {
        const index = findStationIndex(stations, initialStationId);
        if (index < 0) {
          console.warn(`Station not found: ${initialStationId}, defaulting to first station`);
        }
        setCurrentIndex(index >= 0 ? index : 0);
      } else {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Error loading stations:', err);
      setError('역 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [lineId, initialStationId]);

  /**
   * Navigate to previous station
   */
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  /**
   * Navigate to next station
   */
  const goToNext = useCallback(() => {
    if (currentIndex < allStations.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, allStations.length]);

  /**
   * Navigate to specific station using multi-match strategy
   */
  const goToStation = useCallback((stationId: string) => {
    const index = findStationIndex(allStations, stationId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
  }, [allStations]);

  /**
   * Refresh station list
   */
  const refresh = useCallback(async () => {
    await loadStations();
  }, [loadStations]);

  // Load stations on mount
  useEffect(() => {
    loadStations();
  }, [loadStations]);

  // Derived values
  const currentStation = allStations[currentIndex] || null;
  const previousStation = currentIndex > 0 ? allStations[currentIndex - 1] || null : null;
  const nextStation = currentIndex < allStations.length - 1 ? allStations[currentIndex + 1] || null : null;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < allStations.length - 1;

  return {
    currentStation,
    previousStation,
    nextStation,
    allStations,
    currentIndex,
    loading,
    error,
    goToPrevious,
    goToNext,
    goToStation,
    refresh,
    canGoPrevious,
    canGoNext,
  };
};
