/**
 * Background location bridge for active route guidance.
 *
 * Route guidance remains time-based because subway GPS is unreliable
 * underground, but registering a native background location task keeps the OS
 * aware that a commute guidance session is active. The task stores a tiny
 * heartbeat snapshot for diagnostics and future arrival heuristics.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const GUIDANCE_BACKGROUND_LOCATION_TASK = 'livemetro-guidance-background-location';
export const GUIDANCE_BACKGROUND_LOCATION_STORAGE_KEY = '@livemetro/guidance_background_location';

interface GuidanceBackgroundLocationTaskData {
  readonly locations?: readonly Location.LocationObject[];
}

interface StoredLocationSnapshot {
  readonly recordedAt: number;
  readonly locations: readonly {
    readonly timestamp: number;
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracy: number | null;
  }[];
}

const storeBackgroundLocationSnapshot = async (
  locations: readonly Location.LocationObject[]
): Promise<void> => {
  if (locations.length === 0) return;
  const snapshot: StoredLocationSnapshot = {
    recordedAt: Date.now(),
    locations: locations.map(location => ({
      timestamp: location.timestamp,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? null,
    })),
  };
  await AsyncStorage.setItem(
    GUIDANCE_BACKGROUND_LOCATION_STORAGE_KEY,
    JSON.stringify(snapshot)
  );
};

if (!TaskManager.isTaskDefined(GUIDANCE_BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<GuidanceBackgroundLocationTaskData>(
    GUIDANCE_BACKGROUND_LOCATION_TASK,
    ({ data, error }) => {
      if (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[guidanceBackgroundLocationTask] task error:', error);
        }
        return;
      }
      void storeBackgroundLocationSnapshot(data?.locations ?? []).catch((storageError) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[guidanceBackgroundLocationTask] snapshot persist failed:', storageError);
        }
      });
    }
  );
}

const hasPermissionForBackgroundUpdates = async (): Promise<boolean> => {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;

  const background = await Location.getBackgroundPermissionsAsync();
  return background.status === 'granted';
};

export const startGuidanceBackgroundLocation = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;

  try {
    const available = await Location.isBackgroundLocationAvailableAsync();
    if (!available) return false;

    const hasPermission = await hasPermissionForBackgroundUpdates();
    if (!hasPermission) return false;

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      GUIDANCE_BACKGROUND_LOCATION_TASK
    );
    if (alreadyStarted) return true;

    await Location.startLocationUpdatesAsync(GUIDANCE_BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      activityType: Location.ActivityType.OtherNavigation,
      timeInterval: 60_000,
      distanceInterval: 200,
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 200,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'LiveMetro 길안내 실행 중',
        notificationBody: '출퇴근 경로 진행 상태를 유지하고 있어요.',
        notificationColor: '#0066FF',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[guidanceBackgroundLocationTask] start failed:', error);
    }
    return false;
  }
};

export const stopGuidanceBackgroundLocation = async (): Promise<void> => {
  if (Platform.OS === 'web') return;

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(
      GUIDANCE_BACKGROUND_LOCATION_TASK
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(GUIDANCE_BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[guidanceBackgroundLocationTask] stop failed:', error);
    }
  }
};
