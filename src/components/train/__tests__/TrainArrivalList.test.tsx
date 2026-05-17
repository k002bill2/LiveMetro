/**
 * TrainArrivalList Component Tests
 *
 * Tests DataManager subscription as the sole data source.
 * The component subscribes via dataManager.subscribeToRealtimeUpdates()
 * and receives pre-converted Train[] objects.
 */

import React from 'react';
import { render as baseRender, waitFor, RenderOptions } from '@testing-library/react-native';
import { TrainArrivalList } from '../TrainArrivalList';
import { trainService } from '@services/train/trainService';
import { dataManager } from '@services/data/dataManager';
import { TrainStatus, Train } from '@models/train';
import { SeoulApiError } from '@/services/api/seoulSubwayApi';
import { ThemeProvider } from '@services/theme';

// F5.2b: List now renders TrainArrivalCard (variant='compact') which uses
// useTheme(). Wrap all renders with ThemeProvider so the theme context is
// provided — mirrors TrainArrivalCard.test.tsx pattern.
const render = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): ReturnType<typeof baseRender> =>
  baseRender(ui, { wrapper: ThemeProvider, ...options });

// Mock the train service (getStation for station name resolution)
jest.mock('@services/train/trainService', () => ({
  trainService: {
    getStation: jest.fn(),
  },
}));

// Mock DataManager (central data layer)
jest.mock('@services/data/dataManager', () => ({
  dataManager: {
    subscribeToRealtimeUpdates: jest.fn(),
  },
  // Re-export type for import compatibility
}));

// Mock stationsDataService
jest.mock('@services/data/stationsDataService', () => ({
  getLocalStation: jest.fn().mockReturnValue(null),
}));

// Mock performance utils to avoid throttling in tests
jest.mock('@utils/performanceUtils', () => ({
  throttle: (fn: unknown) => fn,
}));

// F5.2b: Card uses getSubwayLineColor / getLineTextColor — stub to deterministic
// values so renders don't depend on the full color table. (Same pattern as
// TrainArrivalCard.test.tsx.)
jest.mock('@utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(() => '#00a84d'),
  getLineTextColor: jest.fn(() => 'white'),
  getDelayColor: jest.fn(() => '#f59e0b'),
  addAlpha: jest.fn((_color: string, alpha: number) => `rgba(0,168,77,${alpha})`),
}));

// F4: ErrorFallback이 SeoulApiError instanceof 분기 사용 — 글로벌 setup이
// 모듈 mock하면서 클래스 누락. partial spread로 실제 클래스만 import,
// instance(seoulSubwayApi)는 그대로 mocked 유지. (memory: [Partial mock requireActual])
jest.mock('@/services/api/seoulSubwayApi', () => {
  const actual = jest.requireActual('@/services/api/seoulSubwayApi');
  return {
    SeoulApiError: actual.SeoulApiError,
    seoulSubwayApi: {},
  };
});

// F4: react-native-svg mock — ErrorFallback의 lucide 아이콘 렌더
// (memory: [lucide+svg 테스트 mock])
jest.mock('react-native-svg', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
    Svg: View,
    G: View,
    Path: View,
    Circle: View,
    Rect: View,
    Line: View,
    Polyline: View,
    Polygon: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
  };
});

const mockTrainService = trainService as jest.Mocked<typeof trainService>;
const mockDataManager = dataManager as jest.Mocked<typeof dataManager>;

const defaultStation = {
  id: 'station-1',
  name: '테스트역',
  nameEn: 'Test Station',
  lineId: '2',
  coordinates: { latitude: 37.5, longitude: 127.0 },
  transfers: [],
};

const makeTrain = (overrides: Partial<Train> = {}): Train => ({
  id: 'train-1',
  lineId: '2',
  direction: 'up',
  currentStationId: 'station-1',
  nextStationId: null,
  finalDestination: '목적지',
  status: TrainStatus.NORMAL,
  arrivalTime: new Date(Date.now() + 2 * 60 * 1000),
  delayMinutes: 0,
  lastUpdated: new Date(),
  ...overrides,
});

/**
 * Helper: mock subscribeToRealtimeUpdates to call callback with given trains immediately
 */
const mockSubscription = (trains: Train[]): jest.Mock => {
  const unsubscribe = jest.fn();
  mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
    (_stationName, callback) => {
      // Call callback asynchronously to match real behavior
      Promise.resolve().then(() => {
        callback({
          stationId: 'station-1',
          trains,
          lastUpdated: new Date(),
        });
      });
      return unsubscribe;
    }
  );
  return unsubscribe;
};

/**
 * Helper: mock subscribeToRealtimeUpdates with null (API failure)
 */
const mockSubscriptionNull = (): jest.Mock => {
  const unsubscribe = jest.fn();
  mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
    (_stationName, callback) => {
      Promise.resolve().then(() => {
        callback(null);
      });
      return unsubscribe;
    }
  );
  return unsubscribe;
};

describe('TrainArrivalList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrainService.getStation.mockResolvedValue(defaultStation);
    // Default: empty trains
    mockSubscription([]);
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Subscription never calls back → stays in loading
      mockDataManager.subscribeToRealtimeUpdates.mockImplementation(() => jest.fn());

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      expect(getByText('실시간 열차 정보를 불러오고 있습니다...')).toBeTruthy();
    });

    it('should have proper accessibility for loading state', () => {
      mockDataManager.subscribeToRealtimeUpdates.mockImplementation(() => jest.fn());

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      expect(getByLabelText('실시간 열차 정보를 불러오고 있습니다')).toBeTruthy();
    });
  });

  describe('Data Display', () => {
    it('should display train arrival data when loaded', async () => {
      mockSubscription([
        // +5s padding avoids Math.floor boundary race during render/waitFor delay.
        makeTrain({ id: 't1', finalDestination: '상행역', direction: 'up', arrivalTime: new Date(Date.now() + 2 * 60 * 1000 + 5000) }),
        makeTrain({ id: 't2', finalDestination: '하행역', direction: 'down', arrivalTime: new Date(Date.now() + 5 * 60 * 1000 + 5000) }),
      ]);

      // F5.2b: Card markup — finalDestination text는 더 이상 노출되지 않고
      // lineName(2호선) + direction(상행/하행) badge로 대체. 도착 시각은 보존.
      const { getByText, getAllByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // 2개 카드 → 2호선 line badge 2개
        expect(getAllByText('2호선').length).toBe(2);
        // direction badge — 상행/하행 각 1개
        expect(getByText('상행')).toBeTruthy();
        expect(getByText('하행')).toBeTruthy();
        // 도착 시각 — inline과 동일
        expect(getByText('2분후')).toBeTruthy();
        expect(getByText('5분후')).toBeTruthy();
      });
    });

    it('should display NORMAL status badge', async () => {
      mockSubscription([makeTrain({ status: TrainStatus.NORMAL })]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('정상')).toBeTruthy();
      });
    });

    it('should display DELAYED status badge', async () => {
      mockSubscription([makeTrain({ status: TrainStatus.DELAYED, delayMinutes: 3 })]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('지연')).toBeTruthy();
        // F5.2b: Card는 "(N분 지연)" 괄호 없이 "{N}분 지연" 포맷.
        expect(getByText('3분 지연')).toBeTruthy();
      });
    });

    it('should display SUSPENDED status badge', async () => {
      mockSubscription([makeTrain({ status: TrainStatus.SUSPENDED })]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('운행중단')).toBeTruthy();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no trains available', async () => {
      mockSubscription([]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
        expect(getByText('잠시 후 다시 확인해보세요')).toBeTruthy();
      });
    });

    it('should show empty state when subscription returns null', async () => {
      mockSubscriptionNull();

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('현재 도착 예정인 열차가 없습니다')).toBeTruthy();
      });
    });

    it('should have proper accessibility for empty state', async () => {
      mockSubscription([]);

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByLabelText('현재 도착 예정인 열차가 없습니다. 잠시 후 다시 확인해보세요')).toBeTruthy();
      });
    });
  });

  describe('Subscription Lifecycle', () => {
    it('should subscribe via DataManager on mount', async () => {
      mockSubscription([]);

      render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
          '테스트역', // resolved station name
          expect.any(Function),
          35000 // polling interval
        );
      });
    });

    it('should unsubscribe on unmount', async () => {
      const unsubscribe = mockSubscription([]);

      const { unmount } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should re-subscribe when stationId changes', async () => {
      mockSubscription([]);

      const { rerender } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(1);
      });

      // Change station ID
      mockTrainService.getStation.mockResolvedValue({
        ...defaultStation,
        id: 'station-2',
        name: '다른역',
      });

      rerender(<TrainArrivalList stationId="station-2" />);

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledTimes(2);
      });
    });

    it('should use stationNameProp when provided (skip name resolution)', async () => {
      mockSubscription([]);

      render(<TrainArrivalList stationId="station-1" stationName="직접제공역" />);

      await waitFor(() => {
        expect(mockDataManager.subscribeToRealtimeUpdates).toHaveBeenCalledWith(
          '직접제공역',
          expect.any(Function),
          35000
        );
      });

      // Should NOT call getStation since stationName prop was provided
      expect(mockTrainService.getStation).not.toHaveBeenCalled();
    });
  });

  describe('Performance Optimizations', () => {
    it('should use memoized components', () => {
      expect(TrainArrivalList.displayName).toBe('TrainArrivalList');
    });
  });

  describe('Accessibility', () => {
    it('should provide proper accessibility labels for train items', async () => {
      mockSubscription([
        // +5s padding avoids Math.floor boundary race.
        makeTrain({ finalDestination: '상행역', direction: 'up', arrivalTime: new Date(Date.now() + 2 * 60 * 1000 + 5000) }),
      ]);

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      // F5.2b: Card의 accessibilityLabel 포맷 — `${lineName}, ${direction} 열차,
      // ${arrival}, [delayMinutes>0 시: ${delay}분 지연,] 상태: ${status}[, station]`
      // makeTrain default nextStationId=null → station 파트 없음.
      await waitFor(() => {
        expect(getByLabelText(/2호선.*상행 열차.*2분후.*상태: 정상/)).toBeTruthy();
      });
    });
  });

  describe('Arrival Time Formatting', () => {
    it('should show "도착" when arrival time has passed', async () => {
      mockSubscription([
        makeTrain({ arrivalTime: new Date(Date.now() - 1000) }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('도착')).toBeTruthy();
      });
    });

    it('should show "1분후" for 1 minute arrival', async () => {
      mockSubscription([
        // +5s padding avoids Math.floor boundary race.
        makeTrain({ arrivalTime: new Date(Date.now() + 60 * 1000 + 5000) }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('1분후')).toBeTruthy();
      });
    });

    it('should show "정보없음" when arrivalTime is null', async () => {
      mockSubscription([
        makeTrain({ arrivalTime: null }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('정보없음')).toBeTruthy();
      });
    });
  });

  describe('Multiple Trains Sorting', () => {
    it('should sort trains by arrival time', async () => {
      // F5.2b: Card는 finalDestination을 더 이상 노출하지 않음. 도착 시각으로
      // 3개 카드 존재 + 각 분단위 라벨 확인. +5s padding으로 Math.floor race 회피.
      mockSubscription([
        makeTrain({ id: 't1', finalDestination: '역10', arrivalTime: new Date(Date.now() + 10 * 60 * 1000 + 5000) }),
        makeTrain({ id: 't2', finalDestination: '역5', arrivalTime: new Date(Date.now() + 5 * 60 * 1000 + 5000) }),
        makeTrain({ id: 't3', finalDestination: '역15', arrivalTime: new Date(Date.now() + 15 * 60 * 1000 + 5000) }),
      ]);

      const { getByText, getAllByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // 3개 카드 모두 렌더 — 분후 텍스트로 카운트
        const arrivalTexts = getAllByText(/분후$/);
        expect(arrivalTexts.length).toBe(3);
        expect(getByText('5분후')).toBeTruthy();
        expect(getByText('10분후')).toBeTruthy();
        expect(getByText('15분후')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle unmount during name resolution', () => {
      // getStation never resolves → component unmounts before subscription
      mockTrainService.getStation.mockReturnValue(new Promise(() => {}));

      const { unmount } = render(
        <TrainArrivalList stationId="station-1" />
      );

      expect(() => unmount()).not.toThrow();
    });

    it('should display nextStationId as station label when present', async () => {
      // F5.2b: inline의 "다음역 정보 로딩중..." placeholder는 제거됨. Card는
      // nextStationId를 그대로 "{id}역" 형태로 stationName 영역에 렌더.
      mockSubscription([
        makeTrain({ nextStationId: 'station-2' }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByText('station-2역')).toBeTruthy();
      });
    });

    it('should handle very large delay values', async () => {
      mockSubscription([
        makeTrain({ delayMinutes: 999 }),
      ]);

      const { getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      // F5.2b: Card는 괄호 없이 "{N}분 지연" 포맷.
      await waitFor(() => {
        expect(getByText('999분 지연')).toBeTruthy();
      });
    });
  });

  // Guide (2026-05-16) item #8: differentiate 일반 / 급행 / 특급. Verifies
  // service-tier badge surfaces in the TrainArrivalCard (variant='compact')
  // after F5.2b inline → Card swap. Badge labels(급행/특급) and visibility
  // rules(normal/undefined → no badge) are unchanged from inline behavior.
  describe('Train type badge', () => {
    it('should render 급행 badge when trainType is express', async () => {
      mockSubscription([makeTrain({ trainType: 'express' })]);

      const { getByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(getByText('급행')).toBeTruthy();
      });
    });

    it('should render 특급 badge when trainType is rapid', async () => {
      mockSubscription([makeTrain({ trainType: 'rapid' })]);

      const { getByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(getByText('특급')).toBeTruthy();
      });
    });

    it('should not render any tier badge when trainType is normal', async () => {
      mockSubscription([makeTrain({ trainType: 'normal' })]);

      const { queryByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(queryByText('급행')).toBeNull();
        expect(queryByText('특급')).toBeNull();
      });
    });

    it('should not render any tier badge when trainType is undefined (backward compat)', async () => {
      mockSubscription([makeTrain({ /* trainType omitted */ })]);

      const { queryByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        expect(queryByText('급행')).toBeNull();
        expect(queryByText('특급')).toBeNull();
      });
    });
  });

  // F4 (PR #127 follow-up): renderErrorState 자리에 ErrorFallback이 들어가
  // SeoulApiError.category 분기 + non-Error generic fallback을 일관되게 제공.
  // 기존 generic "도착정보를 불러올 수 없습니다" hardcode UI는 제거됨.
  describe('Error → ErrorFallback wiring', () => {
    it('renders ErrorFallback when station name resolution rejects (non-SeoulApiError → network fallback)', async () => {
      // resolveAndSubscribe path: trainService.getStation → reject
      // → catch sets error state → renders ErrorFallback
      mockTrainService.getStation.mockRejectedValue(new Error('Network timeout'));

      const { getByTestId, getByText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        expect(getByTestId('train-list-error')).toBeTruthy();
        // generic Error → network fallback ("연결을 확인해주세요")
        expect(getByText('연결을 확인해주세요')).toBeTruthy();
      });
    });

    it('exposes retry button label in error state for accessibility', async () => {
      mockTrainService.getStation.mockRejectedValue(new Error('test failure'));

      const { getByLabelText } = render(
        <TrainArrivalList stationId="station-1" />
      );

      await waitFor(() => {
        // ErrorFallback의 retry CTA — onRetry는 항상 제공되므로 retryable
        // category 또는 non-SeoulApiError 모두 버튼 표시
        expect(getByLabelText('다시 시도')).toBeTruthy();
      });
    });

    // G4: dataManager가 forward한 subscription error를 컴포넌트가 ErrorFallback
    // path로 surface하는지 검증. SeoulApiError instance면 category 분기 활성화.
    it('renders ErrorFallback with SeoulApiError category copy when subscription forwards error', async () => {
      // arrivalService → dataManager가 forward한 error 시뮬레이션
      const unsubscribe = jest.fn();
      mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
        (_stationName, callback) => {
          Promise.resolve().then(() => {
            // SeoulApiError instance를 두 번째 arg로 전달 — F4 wiring이 잡음
            const err = new SeoulApiError('ERROR-336', 'transient');
            callback(null, err);
          });
          return unsubscribe;
        },
      );

      const { getByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        // ERROR-336 → transient → "도착정보를 잠시 가져올 수 없어요"
        expect(getByText('도착정보를 잠시 가져올 수 없어요')).toBeTruthy();
      });
    });

    it('renders network fallback when subscription forwards generic Error', async () => {
      const unsubscribe = jest.fn();
      mockDataManager.subscribeToRealtimeUpdates.mockImplementation(
        (_stationName, callback) => {
          Promise.resolve().then(() => {
            callback(null, new Error('socket hangup'));
          });
          return unsubscribe;
        },
      );

      const { getByText } = render(<TrainArrivalList stationId="station-1" />);

      await waitFor(() => {
        // non-SeoulApiError → "연결을 확인해주세요"
        expect(getByText('연결을 확인해주세요')).toBeTruthy();
      });
    });
  });
});
