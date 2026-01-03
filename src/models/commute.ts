/**
 * Commute domain models and types
 * Handles commute route setup, transfer stations, and commute notifications
 */

/**
 * Transfer station in a commute route
 */
export interface TransferStation {
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly lineName: string;
  readonly order: number;
}

/**
 * Commute-specific notification settings
 */
export interface CommuteNotifications {
  readonly transferAlert: boolean; // Alert before transfer station
  readonly arrivalAlert: boolean; // Alert before arrival station
  readonly delayAlert: boolean; // Alert on delays
  readonly incidentAlert: boolean; // Alert on incidents/accidents
  readonly alertMinutesBefore: number; // Minutes before to send alert (1-10)
}

/**
 * Extended commute time with transfer stations and notifications
 */
export interface CommuteRoute {
  readonly departureTime: string; // HH:mm format
  readonly departureStationId: string;
  readonly departureStationName: string;
  readonly departureLineId: string;
  readonly transferStations: readonly TransferStation[];
  readonly arrivalStationId: string;
  readonly arrivalStationName: string;
  readonly arrivalLineId: string;
  readonly notifications: CommuteNotifications;
  readonly bufferMinutes: number;
}

/**
 * Complete commute schedule with morning and evening routes
 */
export interface CommuteScheduleExtended {
  readonly morningCommute: CommuteRoute | null;
  readonly eveningCommute: CommuteRoute | null;
  readonly weekendsEnabled: boolean;
  readonly autoDetect: boolean;
}

/**
 * Station selection info for the search modal
 */
export interface StationSelection {
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly lineName: string;
}

/**
 * Commute type enum for distinguishing morning/evening
 */
export type CommuteType = 'morning' | 'evening';

/**
 * Route step type for UI rendering
 */
export type RouteStepType = 'departure' | 'transfer' | 'arrival';

/**
 * Route step for preview component
 */
export interface RouteStep {
  readonly type: RouteStepType;
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly lineName: string;
  readonly order: number;
}

/**
 * Onboarding state for the commute setup flow
 */
export interface CommuteOnboardingState {
  readonly currentStep: OnboardingStep;
  readonly commuteType: CommuteType;
  readonly morningRoute: Partial<CommuteRoute>;
  readonly eveningRoute: Partial<CommuteRoute>;
  readonly isComplete: boolean;
}

/**
 * Onboarding step enum
 */
export type OnboardingStep =
  | 'morning_time'
  | 'morning_route'
  | 'morning_notification'
  | 'evening_time'
  | 'evening_route'
  | 'evening_notification'
  | 'complete';

/**
 * Default commute notification settings
 */
export const DEFAULT_COMMUTE_NOTIFICATIONS: CommuteNotifications = {
  transferAlert: true,
  arrivalAlert: true,
  delayAlert: true,
  incidentAlert: true,
  alertMinutesBefore: 5,
};

/**
 * Default buffer minutes for commute
 */
export const DEFAULT_BUFFER_MINUTES = 10;

/**
 * Maximum number of transfer stations allowed
 */
export const MAX_TRANSFER_STATIONS = 3;

/**
 * Alert minutes options for picker
 */
export const ALERT_MINUTES_OPTIONS = [1, 2, 3, 5, 7, 10] as const;

/**
 * Create empty commute route
 */
export const createEmptyCommuteRoute = (): Partial<CommuteRoute> => ({
  departureTime: '',
  departureStationId: '',
  departureStationName: '',
  departureLineId: '',
  transferStations: [],
  arrivalStationId: '',
  arrivalStationName: '',
  arrivalLineId: '',
  notifications: DEFAULT_COMMUTE_NOTIFICATIONS,
  bufferMinutes: DEFAULT_BUFFER_MINUTES,
});

/**
 * Create a complete commute route from partial data
 */
export const createCommuteRoute = (data: {
  departureTime: string;
  departureStationId: string;
  departureStationName: string;
  departureLineId: string;
  transferStations: readonly TransferStation[];
  arrivalStationId: string;
  arrivalStationName: string;
  arrivalLineId: string;
  notifications: CommuteNotifications;
  bufferMinutes: number;
}): CommuteRoute => ({
  departureTime: data.departureTime,
  departureStationId: data.departureStationId,
  departureStationName: data.departureStationName,
  departureLineId: data.departureLineId,
  transferStations: data.transferStations,
  arrivalStationId: data.arrivalStationId,
  arrivalStationName: data.arrivalStationName,
  arrivalLineId: data.arrivalLineId,
  notifications: data.notifications,
  bufferMinutes: data.bufferMinutes,
});

/**
 * Create initial onboarding state
 */
export const createInitialOnboardingState = (): CommuteOnboardingState => ({
  currentStep: 'morning_time',
  commuteType: 'morning',
  morningRoute: createEmptyCommuteRoute(),
  eveningRoute: createEmptyCommuteRoute(),
  isComplete: false,
});

/**
 * Validate if commute route is complete
 */
export const isCommuteRouteComplete = (
  route: Partial<CommuteRoute>
): route is CommuteRoute => {
  return !!(
    route.departureTime &&
    route.departureStationId &&
    route.departureStationName &&
    route.arrivalStationId &&
    route.arrivalStationName &&
    route.notifications
  );
};

/**
 * Convert route to steps for preview
 */
export const routeToSteps = (route: Partial<CommuteRoute>): RouteStep[] => {
  const steps: RouteStep[] = [];

  if (route.departureStationId && route.departureStationName) {
    steps.push({
      type: 'departure',
      stationId: route.departureStationId,
      stationName: route.departureStationName,
      lineId: route.departureLineId || '',
      lineName: '',
      order: 0,
    });
  }

  if (route.transferStations) {
    route.transferStations.forEach((transfer, index) => {
      steps.push({
        type: 'transfer',
        stationId: transfer.stationId,
        stationName: transfer.stationName,
        lineId: transfer.lineId,
        lineName: transfer.lineName,
        order: index + 1,
      });
    });
  }

  if (route.arrivalStationId && route.arrivalStationName) {
    steps.push({
      type: 'arrival',
      stationId: route.arrivalStationId,
      stationName: route.arrivalStationName,
      lineId: route.arrivalLineId || '',
      lineName: '',
      order: steps.length,
    });
  }

  return steps;
};
