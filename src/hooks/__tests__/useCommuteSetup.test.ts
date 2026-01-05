/**
 * useCommuteSetup Hook Tests
 * Tests for commute onboarding flow state management
 */

import { renderHook, act } from '@testing-library/react-native';
import { useCommuteSetup } from '../useCommuteSetup';
import {
  MAX_TRANSFER_STATIONS,
  DEFAULT_COMMUTE_NOTIFICATIONS,
  StationSelection,
} from '@/models/commute';

const mockStation: StationSelection = {
  stationId: 'station-1',
  stationName: '강남역',
  lineId: '2',
  lineName: '2호선',
};

const mockStation2: StationSelection = {
  stationId: 'station-2',
  stationName: '역삼역',
  lineId: '2',
  lineName: '2호선',
};

describe('useCommuteSetup', () => {
  describe('Initial State', () => {
    it('should initialize with morning_time step', () => {
      const { result } = renderHook(() => useCommuteSetup());
      expect(result.current.currentStep).toBe('morning_time');
    });

    it('should initialize with morning commute type', () => {
      const { result } = renderHook(() => useCommuteSetup());
      expect(result.current.commuteType).toBe('morning');
    });

    it('should initialize with empty morning and evening routes', () => {
      const { result } = renderHook(() => useCommuteSetup());
      expect(result.current.state.morningRoute.departureTime).toBe('');
      expect(result.current.state.eveningRoute.departureTime).toBe('');
    });

    it('should initialize with isComplete false', () => {
      const { result } = renderHook(() => useCommuteSetup());
      expect(result.current.state.isComplete).toBe(false);
    });

    it('should start with stepProgress at 0', () => {
      const { result } = renderHook(() => useCommuteSetup());
      expect(result.current.stepProgress).toBe(0);
    });

    it('should not be able to go previous from first step', () => {
      const { result } = renderHook(() => useCommuteSetup());
      expect(result.current.canGoPrevious).toBe(false);
    });
  });

  describe('Step Navigation', () => {
    it('should not allow goToNextStep when route is invalid', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('morning_time');
    });

    it('should navigate to morning_route after setting departure time', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('08:00');
      });

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('morning_route');
    });

    it('should navigate through all 7 steps in correct order', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Step 1: morning_time
      expect(result.current.currentStep).toBe('morning_time');

      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });

      // Step 2: morning_route
      expect(result.current.currentStep).toBe('morning_route');

      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });

      // Step 3: morning_notification
      expect(result.current.currentStep).toBe('morning_notification');

      act(() => {
        result.current.goToNextStep();
      });

      // Step 4: evening_time
      expect(result.current.currentStep).toBe('evening_time');
      expect(result.current.commuteType).toBe('evening');

      act(() => {
        result.current.setDepartureTime('18:00');
      });
      act(() => {
        result.current.goToNextStep();
      });

      // Step 5: evening_route
      expect(result.current.currentStep).toBe('evening_route');

      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });

      // Step 6: evening_notification
      expect(result.current.currentStep).toBe('evening_notification');

      act(() => {
        result.current.goToNextStep();
      });

      // Step 7: complete
      expect(result.current.currentStep).toBe('complete');
      expect(result.current.state.isComplete).toBe(true);
    });

    it('should update commuteType when entering evening steps', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Complete morning steps
      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.commuteType).toBe('evening');
    });

    it('should allow goToPreviousStep and update state correctly', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('morning_route');
      expect(result.current.canGoPrevious).toBe(true);

      act(() => {
        result.current.goToPreviousStep();
      });

      expect(result.current.currentStep).toBe('morning_time');
    });

    it('should calculate stepProgress correctly', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Step 0: morning_time -> progress = 0/6 = 0
      expect(result.current.stepProgress).toBeCloseTo(0);

      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });

      // Step 1: morning_route -> progress = 1/6
      expect(result.current.stepProgress).toBeCloseTo(1 / 6);

      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });

      // Step 2: morning_notification -> progress = 2/6
      expect(result.current.stepProgress).toBeCloseTo(2 / 6);
    });
  });

  describe('Time Management', () => {
    it('setDepartureTime should update current route departureTime', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('08:30');
      });

      expect(result.current.currentRoute.departureTime).toBe('08:30');
    });

    it('setDepartureTime should affect morning route when commuteType is morning', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('09:00');
      });

      expect(result.current.state.morningRoute.departureTime).toBe('09:00');
    });

    it('setDepartureTime should affect evening route when commuteType is evening', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Navigate to evening steps
      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.commuteType).toBe('evening');

      act(() => {
        result.current.setDepartureTime('18:30');
      });

      expect(result.current.state.eveningRoute.departureTime).toBe('18:30');
    });
  });

  describe('Station Selection', () => {
    it('setDepartureStation should set all departure fields', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureStation(mockStation);
      });

      expect(result.current.currentRoute.departureStationId).toBe('station-1');
      expect(result.current.currentRoute.departureStationName).toBe('강남역');
      expect(result.current.currentRoute.departureLineId).toBe('2');
    });

    it('setArrivalStation should set all arrival fields', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setArrivalStation(mockStation2);
      });

      expect(result.current.currentRoute.arrivalStationId).toBe('station-2');
      expect(result.current.currentRoute.arrivalStationName).toBe('역삼역');
      expect(result.current.currentRoute.arrivalLineId).toBe('2');
    });

    it('addTransferStation should append to transferStations array', () => {
      const { result } = renderHook(() => useCommuteSetup());
      const transferStation: StationSelection = {
        stationId: 'transfer-1',
        stationName: '을지로입구',
        lineId: '2',
        lineName: '2호선',
      };

      act(() => {
        result.current.addTransferStation(transferStation);
      });

      expect(result.current.currentRoute.transferStations).toHaveLength(1);
      expect(result.current.currentRoute.transferStations![0].stationId).toBe('transfer-1');
      expect(result.current.currentRoute.transferStations![0].order).toBe(0);
    });

    it('addTransferStation should respect MAX_TRANSFER_STATIONS limit', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Add MAX_TRANSFER_STATIONS
      for (let i = 0; i < MAX_TRANSFER_STATIONS; i++) {
        act(() => {
          result.current.addTransferStation({
            stationId: `transfer-${i}`,
            stationName: `환승역${i}`,
            lineId: '2',
            lineName: '2호선',
          });
        });
      }

      expect(result.current.currentRoute.transferStations).toHaveLength(MAX_TRANSFER_STATIONS);

      // Try to add one more
      act(() => {
        result.current.addTransferStation({
          stationId: 'transfer-extra',
          stationName: '추가역',
          lineId: '2',
          lineName: '2호선',
        });
      });

      // Should still be MAX
      expect(result.current.currentRoute.transferStations).toHaveLength(MAX_TRANSFER_STATIONS);
    });

    it('removeTransferStation should remove by index and reorder', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Add 3 transfer stations
      act(() => {
        result.current.addTransferStation({
          stationId: 'transfer-0',
          stationName: '환승역0',
          lineId: '2',
          lineName: '2호선',
        });
      });
      act(() => {
        result.current.addTransferStation({
          stationId: 'transfer-1',
          stationName: '환승역1',
          lineId: '2',
          lineName: '2호선',
        });
      });
      act(() => {
        result.current.addTransferStation({
          stationId: 'transfer-2',
          stationName: '환승역2',
          lineId: '2',
          lineName: '2호선',
        });
      });

      // Remove middle one
      act(() => {
        result.current.removeTransferStation(1);
      });

      expect(result.current.currentRoute.transferStations).toHaveLength(2);
      expect(result.current.currentRoute.transferStations![0].stationId).toBe('transfer-0');
      expect(result.current.currentRoute.transferStations![0].order).toBe(0);
      expect(result.current.currentRoute.transferStations![1].stationId).toBe('transfer-2');
      expect(result.current.currentRoute.transferStations![1].order).toBe(1);
    });
  });

  describe('Notification Settings', () => {
    it('setNotificationSetting should update specific notification field', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setNotificationSetting('transferAlert', false);
      });

      expect(result.current.currentRoute.notifications?.transferAlert).toBe(false);
    });

    it('should preserve DEFAULT_COMMUTE_NOTIFICATIONS for unset values', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setNotificationSetting('alertMinutesBefore', 10);
      });

      expect(result.current.currentRoute.notifications?.transferAlert).toBe(
        DEFAULT_COMMUTE_NOTIFICATIONS.transferAlert
      );
      expect(result.current.currentRoute.notifications?.arrivalAlert).toBe(
        DEFAULT_COMMUTE_NOTIFICATIONS.arrivalAlert
      );
      expect(result.current.currentRoute.notifications?.alertMinutesBefore).toBe(10);
    });
  });

  describe('Validation', () => {
    it('isRouteValid should be true when time is set for _time steps', () => {
      const { result } = renderHook(() => useCommuteSetup());

      expect(result.current.isRouteValid).toBe(false);

      act(() => {
        result.current.setDepartureTime('08:00');
      });

      expect(result.current.isRouteValid).toBe(true);
    });

    it('isRouteValid should be true when both stations set for _route steps', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Go to route step
      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('morning_route');
      expect(result.current.isRouteValid).toBe(false);

      act(() => {
        result.current.setDepartureStation(mockStation);
      });

      expect(result.current.isRouteValid).toBe(false);

      act(() => {
        result.current.setArrivalStation(mockStation2);
      });

      expect(result.current.isRouteValid).toBe(true);
    });

    it('notification step should always be valid', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Navigate to notification step
      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('morning_notification');
      expect(result.current.isRouteValid).toBe(true);
    });

    it('isMorningComplete should use isCommuteRouteComplete', () => {
      const { result } = renderHook(() => useCommuteSetup());

      expect(result.current.isMorningComplete).toBe(false);

      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });

      expect(result.current.isMorningComplete).toBe(true);
    });
  });

  describe('Actions', () => {
    it('reset should restore initial state', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentStep).toBe('morning_route');

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentStep).toBe('morning_time');
      expect(result.current.commuteType).toBe('morning');
      expect(result.current.state.isComplete).toBe(false);
    });

    it('getMorningRoute should return morningRoute', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('08:00');
      });

      const route = result.current.getMorningRoute();
      expect(route.departureTime).toBe('08:00');
    });

    it('getEveningRoute should return eveningRoute', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Navigate to evening and set time
      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureTime('18:00');
      });

      const route = result.current.getEveningRoute();
      expect(route.departureTime).toBe('18:00');
    });

    it('skipOnboarding should set step to complete and isComplete to true', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.skipOnboarding();
      });

      expect(result.current.currentStep).toBe('complete');
      expect(result.current.state.isComplete).toBe(true);
    });
  });

  describe('canGoNext', () => {
    it('should be true when route is valid', () => {
      const { result } = renderHook(() => useCommuteSetup());

      expect(result.current.canGoNext).toBe(false);

      act(() => {
        result.current.setDepartureTime('08:00');
      });

      expect(result.current.canGoNext).toBe(true);
    });
  });

  describe('currentRoute', () => {
    it('should return morningRoute when commuteType is morning', () => {
      const { result } = renderHook(() => useCommuteSetup());

      act(() => {
        result.current.setDepartureTime('07:00');
      });

      expect(result.current.currentRoute.departureTime).toBe('07:00');
      expect(result.current.state.morningRoute.departureTime).toBe('07:00');
    });

    it('should return eveningRoute when commuteType is evening', () => {
      const { result } = renderHook(() => useCommuteSetup());

      // Navigate to evening
      act(() => {
        result.current.setDepartureTime('08:00');
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureStation(mockStation);
      });
      act(() => {
        result.current.setArrivalStation(mockStation2);
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.goToNextStep();
      });
      act(() => {
        result.current.setDepartureTime('19:00');
      });

      expect(result.current.currentRoute.departureTime).toBe('19:00');
      expect(result.current.state.eveningRoute.departureTime).toBe('19:00');
    });
  });
});
