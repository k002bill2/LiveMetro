/**
 * Tests for CurrentStationAlertService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentStationAlertService } from '../currentStationAlertService';
import { locationService } from '@services/location/locationService';
import { notificationService } from '@services/notification/notificationService';
import { Station } from '@models/train';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@services/location/locationService', () => ({
  locationService: {
    initialize: jest.fn().mockResolvedValue(true),
    isWithinStationVicinity: jest.fn().mockReturnValue(false),
  },
}));
jest.mock('@services/notification/notificationService', () => ({
  notificationService: {
    initialize: jest.fn().mockResolvedValue(true),
    sendLocalNotification: jest.fn().mockResolvedValue('notification-id'),
  },
  NotificationType: {
    ARRIVAL_REMINDER: 'arrival_reminder',
  },
}));

describe('CurrentStationAlertService', () => {
  const mockStation: Station = {
    id: 'station-1',
    name: '강남',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: {
      latitude: 37.498,
      longitude: 127.028,
    },
    transfers: [],
  };

  const mockLocation = {
    latitude: 37.498,
    longitude: 127.028,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    // Reset service state by initializing with fresh config
    await currentStationAlertService.initialize();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await currentStationAlertService.initialize();
      expect(result).toBe(true);
    });

    it('should load saved config from AsyncStorage', async () => {
      const savedConfig = {
        enabled: true,
        stationIds: ['station-1'],
        radius: 150,
        cooldownMinutes: 45,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(savedConfig));

      await currentStationAlertService.initialize();
      const config = currentStationAlertService.getConfig();

      expect(config.stationIds).toContain('station-1');
      expect(config.radius).toBe(150);
    });
  });

  describe('config management', () => {
    it('should update config', async () => {
      await currentStationAlertService.setConfig({
        radius: 200,
        cooldownMinutes: 60,
      });

      const config = currentStationAlertService.getConfig();
      expect(config.radius).toBe(200);
      expect(config.cooldownMinutes).toBe(60);
    });

    it('should get current config', () => {
      const config = currentStationAlertService.getConfig();

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('stationIds');
      expect(config).toHaveProperty('radius');
      expect(config).toHaveProperty('cooldownMinutes');
    });
  });

  describe('station management', () => {
    it('should add station to monitoring list', async () => {
      await currentStationAlertService.addStation('station-1');

      const monitored = currentStationAlertService.getMonitoredStations();
      expect(monitored).toContain('station-1');
      expect(currentStationAlertService.isStationMonitored('station-1')).toBe(true);
    });

    it('should not add duplicate stations', async () => {
      await currentStationAlertService.addStation('station-1');
      await currentStationAlertService.addStation('station-1');

      const monitored = currentStationAlertService.getMonitoredStations();
      expect(monitored.filter(id => id === 'station-1')).toHaveLength(1);
    });

    it('should remove station from monitoring list', async () => {
      await currentStationAlertService.addStation('station-1');
      await currentStationAlertService.removeStation('station-1');

      const monitored = currentStationAlertService.getMonitoredStations();
      expect(monitored).not.toContain('station-1');
    });
  });

  describe('monitoring', () => {
    it('should start monitoring with valid permissions', async () => {
      await currentStationAlertService.startMonitoring([mockStation]);
      expect(locationService.initialize).toHaveBeenCalled();
    });

    it('should not start monitoring if disabled', async () => {
      await currentStationAlertService.setConfig({ enabled: false });
      await currentStationAlertService.startMonitoring([mockStation]);

      expect(locationService.initialize).not.toHaveBeenCalled();
    });

    it('should stop monitoring', async () => {
      await currentStationAlertService.startMonitoring([mockStation]);
      currentStationAlertService.stopMonitoring();

      // Verify by trying to check proximity - should not trigger anything
      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);
      expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
    });
  });

  describe('proximity detection', () => {
    beforeEach(async () => {
      // Ensure enabled and clear previous state
      await currentStationAlertService.setConfig({ enabled: true, stationIds: [] });
      await currentStationAlertService.clearAllHistory();
      await currentStationAlertService.addStation('station-1');
      await currentStationAlertService.startMonitoring([mockStation]);
    });

    it('should send notification when near monitored station', async () => {
      (locationService.isWithinStationVicinity as jest.Mock).mockReturnValue(true);

      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);

      expect(notificationService.sendLocalNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '역에 도착했습니다',
          body: expect.stringContaining('강남'),
        })
      );
    });

    it('should not send notification when not near station', async () => {
      (locationService.isWithinStationVicinity as jest.Mock).mockReturnValue(false);

      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);

      expect(notificationService.sendLocalNotification).not.toHaveBeenCalled();
    });

    it('should respect cooldown period', async () => {
      (locationService.isWithinStationVicinity as jest.Mock).mockReturnValue(true);

      // First notification should be sent
      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);
      expect(notificationService.sendLocalNotification).toHaveBeenCalledTimes(1);

      // Second notification within cooldown should be skipped
      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);
      expect(notificationService.sendLocalNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('notification history', () => {
    beforeEach(async () => {
      // Ensure enabled and clear previous state
      await currentStationAlertService.setConfig({ enabled: true, stationIds: [] });
      await currentStationAlertService.clearAllHistory();
      await currentStationAlertService.addStation('station-1');
      await currentStationAlertService.startMonitoring([mockStation]);
    });

    it('should record notification time', async () => {
      (locationService.isWithinStationVicinity as jest.Mock).mockReturnValue(true);

      const beforeTime = Date.now();
      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);
      const afterTime = Date.now();

      const lastNotified = currentStationAlertService.getLastNotificationTime('station-1');
      expect(lastNotified).toBeGreaterThanOrEqual(beforeTime);
      expect(lastNotified).toBeLessThanOrEqual(afterTime);
    });

    it('should clear station history', async () => {
      (locationService.isWithinStationVicinity as jest.Mock).mockReturnValue(true);

      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);
      expect(currentStationAlertService.getLastNotificationTime('station-1')).not.toBeNull();

      await currentStationAlertService.clearStationHistory('station-1');
      expect(currentStationAlertService.getLastNotificationTime('station-1')).toBeNull();
    });

    it('should clear all history', async () => {
      (locationService.isWithinStationVicinity as jest.Mock).mockReturnValue(true);

      await currentStationAlertService.checkStationProximity(mockLocation, [mockStation]);
      expect(currentStationAlertService.getLastNotificationTime('station-1')).not.toBeNull();

      await currentStationAlertService.clearAllHistory();
      expect(currentStationAlertService.getLastNotificationTime('station-1')).toBeNull();
    });
  });
});
