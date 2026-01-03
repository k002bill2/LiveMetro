/**
 * useCommuteSetup Hook
 * Manages state for the commute onboarding flow
 */

import { useState, useCallback, useMemo } from 'react';
import {
  CommuteRoute,
  CommuteOnboardingState,
  OnboardingStep,
  CommuteType,
  TransferStation,
  StationSelection,
  DEFAULT_COMMUTE_NOTIFICATIONS,
  createInitialOnboardingState,
  isCommuteRouteComplete,
  MAX_TRANSFER_STATIONS,
} from '@/models/commute';

interface UseCommuteSetupReturn {
  // State
  state: CommuteOnboardingState;
  currentRoute: Partial<CommuteRoute>;

  // Navigation
  currentStep: OnboardingStep;
  commuteType: CommuteType;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  stepProgress: number;

  // Time
  setDepartureTime: (time: string) => void;

  // Stations
  setDepartureStation: (station: StationSelection) => void;
  setArrivalStation: (station: StationSelection) => void;
  addTransferStation: (station: StationSelection) => void;
  removeTransferStation: (index: number) => void;

  // Notifications
  setNotificationSetting: (key: keyof CommuteRoute['notifications'], value: boolean | number) => void;

  // Validation
  isRouteValid: boolean;
  isMorningComplete: boolean;
  isEveningComplete: boolean;

  // Actions
  reset: () => void;
  getMorningRoute: () => Partial<CommuteRoute>;
  getEveningRoute: () => Partial<CommuteRoute>;
  skipOnboarding: () => void;
}

const STEP_ORDER: OnboardingStep[] = [
  'morning_time',
  'morning_route',
  'morning_notification',
  'evening_time',
  'evening_route',
  'evening_notification',
  'complete',
];

export const useCommuteSetup = (): UseCommuteSetupReturn => {
  const [state, setState] = useState<CommuteOnboardingState>(
    createInitialOnboardingState()
  );

  // Get current route based on commute type
  const currentRoute = useMemo(() => {
    return state.commuteType === 'morning'
      ? state.morningRoute
      : state.eveningRoute;
  }, [state.commuteType, state.morningRoute, state.eveningRoute]);

  // Current step and type
  const currentStep = state.currentStep;
  const commuteType = state.commuteType;

  // Step progress (0-1)
  const stepProgress = useMemo(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    return currentIndex / (STEP_ORDER.length - 1);
  }, [currentStep]);

  // Update route for current commute type
  const updateCurrentRoute = useCallback(
    (updates: Partial<CommuteRoute>) => {
      setState((prev) => ({
        ...prev,
        ...(prev.commuteType === 'morning'
          ? { morningRoute: { ...prev.morningRoute, ...updates } }
          : { eveningRoute: { ...prev.eveningRoute, ...updates } }),
      }));
    },
    []
  );

  // Set departure time
  const setDepartureTime = useCallback(
    (time: string) => {
      updateCurrentRoute({ departureTime: time });
    },
    [updateCurrentRoute]
  );

  // Set departure station
  const setDepartureStation = useCallback(
    (station: StationSelection) => {
      updateCurrentRoute({
        departureStationId: station.stationId,
        departureStationName: station.stationName,
        departureLineId: station.lineId,
      });
    },
    [updateCurrentRoute]
  );

  // Set arrival station
  const setArrivalStation = useCallback(
    (station: StationSelection) => {
      updateCurrentRoute({
        arrivalStationId: station.stationId,
        arrivalStationName: station.stationName,
        arrivalLineId: station.lineId,
      });
    },
    [updateCurrentRoute]
  );

  // Add transfer station
  const addTransferStation = useCallback(
    (station: StationSelection) => {
      const currentTransfers = currentRoute.transferStations || [];
      if (currentTransfers.length >= MAX_TRANSFER_STATIONS) return;

      const newTransfer: TransferStation = {
        stationId: station.stationId,
        stationName: station.stationName,
        lineId: station.lineId,
        lineName: station.lineName,
        order: currentTransfers.length,
      };

      updateCurrentRoute({
        transferStations: [...currentTransfers, newTransfer],
      });
    },
    [currentRoute.transferStations, updateCurrentRoute]
  );

  // Remove transfer station
  const removeTransferStation = useCallback(
    (index: number) => {
      const currentTransfers = currentRoute.transferStations || [];
      const newTransfers = currentTransfers
        .filter((_, i) => i !== index)
        .map((t, i) => ({ ...t, order: i }));

      updateCurrentRoute({ transferStations: newTransfers });
    },
    [currentRoute.transferStations, updateCurrentRoute]
  );

  // Set notification setting
  const setNotificationSetting = useCallback(
    (key: keyof CommuteRoute['notifications'], value: boolean | number) => {
      const currentNotifications =
        currentRoute.notifications || DEFAULT_COMMUTE_NOTIFICATIONS;

      updateCurrentRoute({
        notifications: {
          ...currentNotifications,
          [key]: value,
        },
      });
    },
    [currentRoute.notifications, updateCurrentRoute]
  );

  // Validation
  const isRouteValid = useMemo(() => {
    const route = currentRoute;
    // For time step, just need time
    if (currentStep.endsWith('_time')) {
      return !!route.departureTime;
    }
    // For route step, need departure and arrival
    if (currentStep.endsWith('_route')) {
      return !!route.departureStationId && !!route.arrivalStationId;
    }
    // Notification step is always valid
    return true;
  }, [currentRoute, currentStep]);

  const isMorningComplete = useMemo(
    () => isCommuteRouteComplete(state.morningRoute),
    [state.morningRoute]
  );

  const isEveningComplete = useMemo(
    () => isCommuteRouteComplete(state.eveningRoute),
    [state.eveningRoute]
  );

  // Navigation
  const canGoNext = isRouteValid;
  const canGoPrevious = STEP_ORDER.indexOf(currentStep) > 0;

  const goToNextStep = useCallback(() => {
    if (!canGoNext) return;

    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const nextStep = STEP_ORDER[currentIndex + 1];
    if (currentIndex < STEP_ORDER.length - 1 && nextStep) {
      const newCommuteType: CommuteType = nextStep.startsWith('evening')
        ? 'evening'
        : nextStep === 'complete'
        ? state.commuteType
        : 'morning';

      setState((prev) => ({
        ...prev,
        currentStep: nextStep,
        commuteType: newCommuteType,
        isComplete: nextStep === 'complete',
      }));
    }
  }, [canGoNext, currentStep, state.commuteType]);

  const goToPreviousStep = useCallback(() => {
    if (!canGoPrevious) return;

    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const prevStep = STEP_ORDER[currentIndex - 1];
    if (currentIndex > 0 && prevStep) {
      const newCommuteType: CommuteType = prevStep.startsWith('evening')
        ? 'evening'
        : 'morning';

      setState((prev) => ({
        ...prev,
        currentStep: prevStep,
        commuteType: newCommuteType,
        isComplete: false,
      }));
    }
  }, [canGoPrevious, currentStep]);

  // Reset
  const reset = useCallback(() => {
    setState(createInitialOnboardingState());
  }, []);

  // Get routes
  const getMorningRoute = useCallback(() => state.morningRoute, [state.morningRoute]);
  const getEveningRoute = useCallback(() => state.eveningRoute, [state.eveningRoute]);

  // Skip onboarding
  const skipOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: 'complete',
      isComplete: true,
    }));
  }, []);

  return {
    state,
    currentRoute,
    currentStep,
    commuteType,
    goToNextStep,
    goToPreviousStep,
    canGoNext,
    canGoPrevious,
    stepProgress,
    setDepartureTime,
    setDepartureStation,
    setArrivalStation,
    addTransferStation,
    removeTransferStation,
    setNotificationSetting,
    isRouteValid,
    isMorningComplete,
    isEveningComplete,
    reset,
    getMorningRoute,
    getEveningRoute,
    skipOnboarding,
  };
};

export default useCommuteSetup;
