import * as Location from 'expo-location';
import {
  GUIDANCE_BACKGROUND_LOCATION_TASK,
  startGuidanceBackgroundLocation,
  stopGuidanceBackgroundLocation,
} from '../guidanceBackgroundLocationTask';

jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false),
  defineTask: jest.fn(),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  ActivityType: { OtherNavigation: 4 },
  isBackgroundLocationAvailableAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

const mockIsBackgroundLocationAvailableAsync =
  Location.isBackgroundLocationAvailableAsync as jest.MockedFunction<
    typeof Location.isBackgroundLocationAvailableAsync
  >;
const mockGetForegroundPermissionsAsync =
  Location.getForegroundPermissionsAsync as jest.MockedFunction<
    typeof Location.getForegroundPermissionsAsync
  >;
const mockGetBackgroundPermissionsAsync =
  Location.getBackgroundPermissionsAsync as jest.MockedFunction<
    typeof Location.getBackgroundPermissionsAsync
  >;
const mockHasStartedLocationUpdatesAsync =
  Location.hasStartedLocationUpdatesAsync as jest.MockedFunction<
    typeof Location.hasStartedLocationUpdatesAsync
  >;
const mockStartLocationUpdatesAsync =
  Location.startLocationUpdatesAsync as jest.MockedFunction<
    typeof Location.startLocationUpdatesAsync
  >;
const mockStopLocationUpdatesAsync =
  Location.stopLocationUpdatesAsync as jest.MockedFunction<
    typeof Location.stopLocationUpdatesAsync
  >;

describe('guidanceBackgroundLocationTask', () => {
  beforeEach(() => {
    mockIsBackgroundLocationAvailableAsync.mockReset();
    mockGetForegroundPermissionsAsync.mockReset();
    mockGetBackgroundPermissionsAsync.mockReset();
    mockHasStartedLocationUpdatesAsync.mockReset();
    mockStartLocationUpdatesAsync.mockReset();
    mockStopLocationUpdatesAsync.mockReset();
    mockIsBackgroundLocationAvailableAsync.mockResolvedValue(true);
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as Awaited<
      ReturnType<typeof Location.getForegroundPermissionsAsync>
    >);
    mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as Awaited<
      ReturnType<typeof Location.getBackgroundPermissionsAsync>
    >);
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(false);
    mockStartLocationUpdatesAsync.mockResolvedValue(undefined);
    mockStopLocationUpdatesAsync.mockResolvedValue(undefined);
  });

  it('starts native background location updates when permissions are granted', async () => {
    const started = await startGuidanceBackgroundLocation();

    expect(started).toBe(true);
    expect(mockStartLocationUpdatesAsync).toHaveBeenCalledWith(
      GUIDANCE_BACKGROUND_LOCATION_TASK,
      expect.objectContaining({
        accuracy: 3,
        activityType: 4,
        foregroundService: expect.objectContaining({
          notificationTitle: 'LiveMetro 길안내 실행 중',
          killServiceOnDestroy: false,
        }),
      })
    );
  });

  it('does not start when background permission is missing', async () => {
    mockGetBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as Awaited<
      ReturnType<typeof Location.getBackgroundPermissionsAsync>
    >);

    const started = await startGuidanceBackgroundLocation();

    expect(started).toBe(false);
    expect(mockStartLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('stops native background location updates when they are running', async () => {
    mockHasStartedLocationUpdatesAsync.mockResolvedValue(true);

    await stopGuidanceBackgroundLocation();

    expect(mockStopLocationUpdatesAsync).toHaveBeenCalledWith(
      GUIDANCE_BACKGROUND_LOCATION_TASK
    );
  });
});
