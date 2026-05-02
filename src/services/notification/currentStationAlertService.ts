/**
 * Current Station Alert Service
 *
 * Monitors user's location and sends notifications when they arrive at
 * specific subway stations. Uses geofence-based detection to prevent
 * duplicate alerts and manage notification cooldowns.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { locationService, LocationCoordinates } from '@services/location/locationService';
import { notificationService, NotificationType } from '@services/notification/notificationService';
import { Station } from '@models/train';

/**
 * Configuration for current station alerts
 */
export interface CurrentStationAlertConfig {
  /** Whether alerts are enabled */
  enabled: boolean;
  /** List of station IDs to monitor */
  stationIds: string[];
  /** Radius in meters for station vicinity detection */
  radius: number;
  /** Cooldown period in minutes before allowing re-notification for same station */
  cooldownMinutes: number;
}

/**
 * Tracks when a station was last notified
 */
interface StationNotificationHistory {
  stationId: string;
  lastNotifiedAt: number;
}

const STORAGE_KEY = '@LiveMetro:currentStationAlertConfig';
const HISTORY_KEY = '@LiveMetro:stationNotificationHistory';

const DEFAULT_CONFIG: CurrentStationAlertConfig = {
  enabled: true,
  stationIds: [],
  radius: 100,
  cooldownMinutes: 30,
};

/**
 * Listener invoked whenever config, station list, or notification history changes.
 * Used by hooks to avoid polling-based state sync.
 */
export type CurrentStationAlertListener = () => void;

/**
 * Service for managing current station arrival notifications
 */
class CurrentStationAlertService {
  private config: CurrentStationAlertConfig = DEFAULT_CONFIG;
  private notificationHistory: Map<string, number> = new Map();
  private isMonitoring = false;
  private monitoringStations: Station[] = [];
  private listeners: Set<CurrentStationAlertListener> = new Set();

  /**
   * Subscribe to state changes (config / monitored stations / notification history).
   * Returns an unsubscribe function.
   */
  subscribe(listener: CurrentStationAlertListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all subscribers. Errors in listeners are isolated so one bad
   * subscriber cannot break the others.
   */
  private emit(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('CurrentStationAlertService listener error:', error);
      }
    });
  }

  /**
   * Initialize the service by loading saved configuration and history
   */
  async initialize(): Promise<boolean> {
    try {
      const configJson = await AsyncStorage.getItem(STORAGE_KEY);
      if (configJson) {
        const savedConfig = JSON.parse(configJson) as CurrentStationAlertConfig;
        this.config = { ...DEFAULT_CONFIG, ...savedConfig };
      }

      const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyJson) {
        const history = JSON.parse(historyJson) as StationNotificationHistory[];
        this.notificationHistory = new Map(
          history.map((h) => [h.stationId, h.lastNotifiedAt])
        );
      }

      await notificationService.initialize();
      console.log('CurrentStationAlertService initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize CurrentStationAlertService:', error);
      return false;
    }
  }

  /**
   * Update service configuration
   */
  async setConfig(config: Partial<CurrentStationAlertConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      this.emit();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CurrentStationAlertConfig {
    return { ...this.config };
  }

  /**
   * Add a station to the monitoring list
   */
  async addStation(stationId: string): Promise<void> {
    if (this.config.stationIds.includes(stationId)) {
      return;
    }
    this.config.stationIds.push(stationId);
    await this.saveConfig();
    this.emit();
  }

  /**
   * Remove a station from the monitoring list
   */
  async removeStation(stationId: string): Promise<void> {
    const index = this.config.stationIds.indexOf(stationId);
    if (index === -1) {
      return;
    }
    this.config.stationIds.splice(index, 1);
    await this.saveConfig();
    this.emit();
  }

  /**
   * Start monitoring user location for station arrivals
   */
  async startMonitoring(stations: Station[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.isMonitoring) {
      return;
    }

    this.monitoringStations = stations;
    this.isMonitoring = true;

    const initialized = await locationService.initialize();
    if (!initialized) {
      console.error('Location permission denied');
      this.isMonitoring = false;
      return;
    }

    console.log('Started monitoring station arrivals');
  }

  /**
   * Stop monitoring user location
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    this.isMonitoring = false;
    this.monitoringStations = [];
  }

  /**
   * Check if user is near any monitored stations and send notifications
   */
  async checkStationProximity(
    location: LocationCoordinates,
    stations?: Station[]
  ): Promise<void> {
    if (!this.isMonitoring || !this.config.enabled) {
      return;
    }

    const stationsToCheck = stations ?? this.monitoringStations;
    if (stationsToCheck.length === 0) {
      return;
    }

    const now = Date.now();
    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;

    for (const stationId of this.config.stationIds) {
      const lastNotified = this.notificationHistory.get(stationId);
      if (lastNotified && now - lastNotified < cooldownMs) {
        continue;
      }

      const station = stationsToCheck.find((s) => s.id === stationId);
      if (!station?.coordinates) {
        continue;
      }

      const isNearby = locationService.isWithinStationVicinity(
        location,
        station,
        this.config.radius
      );

      if (isNearby) {
        await this.sendStationArrivalNotification(station);
        this.notificationHistory.set(stationId, now);
        await this.saveNotificationHistory();
        this.emit();
      }
    }
  }

  /**
   * Clear notification history for a specific station
   */
  async clearStationHistory(stationId: string): Promise<void> {
    this.notificationHistory.delete(stationId);
    await this.saveNotificationHistory();
    this.emit();
  }

  /**
   * Clear all notification history
   */
  async clearAllHistory(): Promise<void> {
    this.notificationHistory.clear();
    await this.saveNotificationHistory();
    this.emit();
  }

  /**
   * Get list of stations being monitored
   */
  getMonitoredStations(): string[] {
    return [...this.config.stationIds];
  }

  /**
   * Check if a station is being monitored
   */
  isStationMonitored(stationId: string): boolean {
    return this.config.stationIds.includes(stationId);
  }

  /**
   * Get last notification time for a station
   */
  getLastNotificationTime(stationId: string): number | null {
    return this.notificationHistory.get(stationId) ?? null;
  }

  /**
   * Send notification that user has arrived at a station
   */
  private async sendStationArrivalNotification(station: Station): Promise<void> {
    try {
      await notificationService.sendLocalNotification({
        type: NotificationType.ARRIVAL_REMINDER,
        title: '역에 도착했습니다',
        body: `${station.name}역에 도착하셨습니다`,
        data: {
          stationId: station.id,
          stationName: station.name,
          lineId: station.lineId,
        },
      });
    } catch (error) {
      console.error('Failed to send station arrival notification:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  private async saveNotificationHistory(): Promise<void> {
    try {
      const history: StationNotificationHistory[] = Array.from(
        this.notificationHistory.entries()
      ).map(([stationId, lastNotifiedAt]) => ({
        stationId,
        lastNotifiedAt,
      }));
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }
}

export const currentStationAlertService = new CurrentStationAlertService();
