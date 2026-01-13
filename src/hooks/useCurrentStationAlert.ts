/**
 * Hook for managing current station arrival alerts
 */

import { useState, useEffect, useCallback } from 'react';
import {
  currentStationAlertService,
  CurrentStationAlertConfig,
} from '@services/notification/currentStationAlertService';

interface UseCurrentStationAlertResult {
  isMonitored: boolean;
  addStation: () => Promise<void>;
  removeStation: () => Promise<void>;
  toggleStation: () => Promise<void>;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  config: CurrentStationAlertConfig;
  updateConfig: (config: Partial<CurrentStationAlertConfig>) => Promise<void>;
  lastNotificationTime: number | null;
  clearHistory: () => Promise<void>;
}

/**
 * Hook for managing current station arrival alerts for a single station
 */
export function useCurrentStationAlert(stationId: string): UseCurrentStationAlertResult {
  const [isMonitored, setIsMonitored] = useState(false);
  const [config, setConfig] = useState<CurrentStationAlertConfig>(
    currentStationAlertService.getConfig()
  );
  const [lastNotificationTime, setLastNotificationTime] = useState<number | null>(null);

  useEffect(() => {
    const checkMonitored = (): void => {
      const monitored = currentStationAlertService.isStationMonitored(stationId);
      setIsMonitored(monitored);

      const lastTime = currentStationAlertService.getLastNotificationTime(stationId);
      setLastNotificationTime(lastTime);
    };

    checkMonitored();
    const interval = setInterval(checkMonitored, 5000);

    return () => clearInterval(interval);
  }, [stationId]);

  useEffect(() => {
    const syncConfig = (): void => {
      const currentConfig = currentStationAlertService.getConfig();
      setConfig(currentConfig);
    };

    syncConfig();
    const interval = setInterval(syncConfig, 5000);

    return () => clearInterval(interval);
  }, []);

  const addStation = useCallback(async () => {
    await currentStationAlertService.addStation(stationId);
    setIsMonitored(true);
  }, [stationId]);

  const removeStation = useCallback(async () => {
    await currentStationAlertService.removeStation(stationId);
    setIsMonitored(false);
  }, [stationId]);

  const toggleStation = useCallback(async () => {
    if (isMonitored) {
      await removeStation();
    } else {
      await addStation();
    }
  }, [isMonitored, addStation, removeStation]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await currentStationAlertService.setConfig({ enabled });
    setConfig((prev) => ({ ...prev, enabled }));
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<CurrentStationAlertConfig>) => {
    await currentStationAlertService.setConfig(newConfig);
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const clearHistory = useCallback(async () => {
    await currentStationAlertService.clearStationHistory(stationId);
    setLastNotificationTime(null);
  }, [stationId]);

  return {
    isMonitored,
    addStation,
    removeStation,
    toggleStation,
    isEnabled: config.enabled,
    setEnabled,
    config,
    updateConfig,
    lastNotificationTime,
    clearHistory,
  };
}

/**
 * Hook for managing all station alerts at once
 */
export function useCurrentStationAlerts(): {
  monitoredStations: string[];
  addStation: (stationId: string) => Promise<void>;
  removeStation: (stationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  config: CurrentStationAlertConfig;
  updateConfig: (config: Partial<CurrentStationAlertConfig>) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  isEnabled: boolean;
} {
  const [monitoredStations, setMonitoredStations] = useState<string[]>([]);
  const [config, setConfig] = useState<CurrentStationAlertConfig>(
    currentStationAlertService.getConfig()
  );

  useEffect(() => {
    const syncStations = (): void => {
      const stations = currentStationAlertService.getMonitoredStations();
      setMonitoredStations(stations);

      const currentConfig = currentStationAlertService.getConfig();
      setConfig(currentConfig);
    };

    syncStations();
    const interval = setInterval(syncStations, 5000);

    return () => clearInterval(interval);
  }, []);

  const addStation = useCallback(async (stationId: string) => {
    await currentStationAlertService.addStation(stationId);
    setMonitoredStations((prev) => [...prev, stationId]);
  }, []);

  const removeStation = useCallback(async (stationId: string) => {
    await currentStationAlertService.removeStation(stationId);
    setMonitoredStations((prev) => prev.filter((id) => id !== stationId));
  }, []);

  const clearAll = useCallback(async () => {
    const stations = [...monitoredStations];
    for (const stationId of stations) {
      await currentStationAlertService.removeStation(stationId);
    }
    setMonitoredStations([]);
  }, [monitoredStations]);

  const updateConfig = useCallback(async (newConfig: Partial<CurrentStationAlertConfig>) => {
    await currentStationAlertService.setConfig(newConfig);
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const clearAllHistory = useCallback(async () => {
    await currentStationAlertService.clearAllHistory();
  }, []);

  return {
    monitoredStations,
    addStation,
    removeStation,
    clearAll,
    config,
    updateConfig,
    clearAllHistory,
    isEnabled: config.enabled,
  };
}
