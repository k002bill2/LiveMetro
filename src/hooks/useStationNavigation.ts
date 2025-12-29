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

      // Set initial station index
      if (initialStationId) {
        const index = stations.findIndex(s => s.id === initialStationId);
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
   * Navigate to specific station
   */
  const goToStation = useCallback((stationId: string) => {
    const index = allStations.findIndex(s => s.id === stationId);
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
