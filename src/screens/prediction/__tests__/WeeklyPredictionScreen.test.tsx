/**
 * WeeklyPredictionScreen Test Suite
 *
 * Phase 7 redesign — single hero answering "오늘 지금 출발하면 몇 분?".
 * Tests target the post-redesign surface: testIDs and stable section
 * titles. Avoid asserting on animated count-up values or dynamic copy
 * that depends on locale/time formatting.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WeeklyPredictionScreen } from '../WeeklyPredictionScreen';
import type { PredictedCommute } from '@/models/pattern';
import { useCommutePattern } from '@/hooks/useCommutePattern';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Auto-map every lucide icon to its name so redesign icon swaps don't break
// the test (Phase 7 imports differ from earlier revisions).
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_, prop: string) => (prop === '__esModule' ? false : prop),
    },
  ),
);

// Animated.timing fires a JS-driven listener that updates state after mount.
// Without taming it, the timer fires after Jest tears down the test env and
// emits noisy ReferenceErrors. Replacing `start` with an immediate callback
// keeps the screen's count-up effect synchronous and side-effect free.
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = jest.fn(() => ({
    start: (cb?: () => void) => cb && cb(),
    stop: jest.fn(),
    reset: jest.fn(),
  }));
  return RN;
});

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
  })),
  NavigationProp: {},
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
    isDark: false,
  })),
  ThemeColors: {},
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', preferences: {} },
  })),
}));

jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: jest.fn(() => ({
    prediction: null,
  })),
}));

// Task 20 / Section 6 wiring: SegmentBreakdownSection consumes
// useCommutePattern. The real hook fetches from Firestore on mount, so a
// minimal stub keeps the test offline.
jest.mock('@/hooks/useCommutePattern', () => ({
  useCommutePattern: jest.fn(() => ({
    todayPrediction: null,
    patterns: [],
    weekPredictions: [],
    recentLogs: [],
    notificationSettings: null,
    todayNotification: null,
    loading: false,
    error: null,
  })),
}));

jest.mock('@/services/train/trainService', () => ({
  trainService: {
    getStation: jest.fn(() => Promise.resolve(null)),
  },
}));

// Task 7 / Section 8 wiring: usePredictionFactors fires off weather/
// congestion/delay service requests on mount. Keep the test offline by
// returning a stable empty-factors snapshot (component still renders the
// section title, which is the assertion this suite cares about).
jest.mock('@/hooks/usePredictionFactors', () => ({
  usePredictionFactors: jest.fn(() => ({ factors: [], loading: false })),
}));

// CTA wire-up: useIntegratedAlerts internally consumes useAuth + subscribes
// to delay/notification services. Stub with a resolved-null scheduleDepartureAlert
// so the CTA press path stays offline and deterministic.
jest.mock('@/hooks/useIntegratedAlerts', () => ({
  useIntegratedAlerts: jest.fn(() => ({
    scheduleDepartureAlert: jest.fn(() => Promise.resolve(null)),
  })),
}));

// Task 10 / Section 7 wiring: congestionService.getHourlyForecast queries
// Firestore historical congestion docs. Stub it with a deterministic
// 7-slot snapshot whose 4th slotTime matches the current rounded HH:MM
// so the "지금" highlight assertion below stays stable. The test mocks
// `Date.now`-style behavior implicitly via `currentTime` derived in the
// screen — to keep the highlight present, we recompute the snapped slot
// time the same way the real service does.
jest.mock('@/services/congestion/congestionService', () => {
  const SLOT_MIN = 15;
  const formatHHMM = (d: Date): string => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  const snapToSlot = (d: Date): Date => {
    const out = new Date(d);
    out.setSeconds(0, 0);
    out.setMinutes(Math.floor(out.getMinutes() / SLOT_MIN) * SLOT_MIN);
    return out;
  };
  return {
    congestionService: {
      getHourlyForecast: jest.fn(() => {
        const now = snapToSlot(new Date());
        const start = new Date(now.getTime() - 3 * SLOT_MIN * 60_000);
        const slots = Array.from({ length: 7 }, (_, i) => {
          const t = new Date(start.getTime() + i * SLOT_MIN * 60_000);
          return {
            slotTime: formatHHMM(t),
            congestionPercent: 40 + i * 5,
            level: 'moderate' as const,
          };
        });
        return Promise.resolve(slots);
      }),
    },
  };
});

describe('WeeklyPredictionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useCommutePattern to its default no-prediction stub.
    // Some tests below use mockReturnValue (persistent) to keep the
    // hook output stable across re-renders triggered by async state
    // updates (Section 7 hourly slots). Re-apply the default here so
    // each test starts from a clean baseline.
    (useCommutePattern as jest.Mock).mockReturnValue({
      todayPrediction: null,
      patterns: [],
      weekPredictions: [],
      recentLogs: [],
      notificationSettings: null,
      todayNotification: null,
      loading: false,
      error: null,
    });
  });

  it('renders the screen container with stable testID', () => {
    const { getByTestId } = render(<WeeklyPredictionScreen />);
    expect(getByTestId('commute-prediction-screen')).toBeTruthy();
  });

  it('renders top bar with back button labelled 뒤로 가기', () => {
    const { getByLabelText, getByTestId } = render(<WeeklyPredictionScreen />);
    expect(getByLabelText('뒤로 가기')).toBeTruthy();
    expect(getByTestId('commute-prediction-back')).toBeTruthy();
  });

  it('renders ML 예측 tag in the hero header', () => {
    const { getByTestId, getByText } = render(<WeeklyPredictionScreen />);
    expect(getByTestId('commute-prediction-tag')).toBeTruthy();
    expect(getByText('ML 예측')).toBeTruthy();
  });

  it('renders hero lead text', () => {
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('오늘 출근, 약')).toBeTruthy();
  });

  it('renders big number card with 분 unit and confidence section', () => {
    const { getByTestId, getByText } = render(<WeeklyPredictionScreen />);
    expect(getByTestId('commute-prediction-minutes')).toBeTruthy();
    expect(getByText('분')).toBeTruthy();
    expect(getByText('예측 신뢰도')).toBeTruthy();
  });

  // With no PredictedCommute, the screen falls back to the model's
  // walk/wait/walk defaults (4+3+3) plus a 10-min ride default = 20 min,
  // with a ±2 range band. Asserting the constants is intentional — a
  // change in fallbacks is a design-contract change that must be reviewed.
  it('renders range labels using fallback when prediction is unavailable', () => {
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('최단 18분')).toBeTruthy();
    expect(getByText('최장 22분')).toBeTruthy();
    expect(getByText('예상 20분')).toBeTruthy();
  });

  it('reflects prediction values in range labels and CTA when data is loaded', () => {
    (useCommutePattern as jest.Mock).mockReturnValueOnce({
      todayPrediction: {
        date: '2026-05-12',
        dayOfWeek: 2,
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:15',
        predictedMinutes: 45,
        predictedMinutesRange: [43, 47] as const,
        direction: 'up' as const,
        route: {
          departureStationId: '0150', departureStationName: '서울역',
          arrivalStationId: '0220', arrivalStationName: '강남역',
          lineIds: ['1'],
        },
        confidence: 0.9,
        suggestedAlertTime: '08:15',
      },
      patterns: [],
      weekPredictions: [],
      recentLogs: [],
      notificationSettings: null,
      todayNotification: null,
      loading: false,
      error: null,
    });

    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('최단 43분')).toBeTruthy();
    expect(getByText('예상 45분')).toBeTruthy();
    expect(getByText('최장 47분')).toBeTruthy();
    expect(getByText('출발 시간에 알려드릴게요 (09:15)')).toBeTruthy();
  });

  it('renders hourly congestion forecast and prediction factors sections', async () => {
    // Task 10 (2026-05-12) replaced the inline Section 7 placeholder
    // with HourlyCongestionChart wired to congestionService. The chart
    // title renders synchronously; the "지금" current-slot marker only
    // appears after the async getHourlyForecast resolves and slots are
    // committed via useState — hence findByText.
    // Final-review fix: the hourly chart is now gated on a known
    // direction (producer returns undefined for loop/branched lines —
    // see deriveDirection in pattern.ts and spec §7.1). Provide a
    // prediction with a concrete direction so the chart renders.
    // Use mockReturnValue (not Once) because the screen re-renders on
    // async slot state updates and each render re-reads the hook.
    (useCommutePattern as jest.Mock).mockReturnValue({
      todayPrediction: {
        date: '2026-05-12',
        dayOfWeek: 2,
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:15',
        predictedMinutes: 45,
        predictedMinutesRange: [43, 47] as const,
        direction: 'up' as const,
        route: {
          departureStationId: '0150',
          departureStationName: '서울역',
          arrivalStationId: '0220',
          arrivalStationName: '강남역',
          lineIds: ['1'],
        },
        confidence: 0.9,
        suggestedAlertTime: '08:15',
      },
      patterns: [],
      weekPredictions: [],
      recentLogs: [],
      notificationSettings: null,
      todayNotification: null,
      loading: false,
      error: null,
    });
    const { getByText, findByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('시간대별 혼잡도 예측')).toBeTruthy();
    expect(await findByText('지금')).toBeTruthy();
    expect(getByText('예측에 반영된 요소')).toBeTruthy();
  });

  it('hides hourly congestion forecast section when direction is undefined', () => {
    // Final-review fix: when the producer signals "unknown direction"
    // (loop line 2, Bundang, Shinbundang, branched lines), the
    // direction-keyed chart subtitle "<line>호선 <direction> 방면" has
    // no honest neutral form, so the entire section is hidden rather
    // than papering over with a fake 'up'. Default mock returns
    // todayPrediction: null, which propagates to direction undefined.
    const { queryByText, getByText } = render(<WeeklyPredictionScreen />);
    expect(queryByText('시간대별 혼잡도 예측')).toBeNull();
    // Other direction-independent sections still render.
    expect(getByText('예측에 반영된 요소')).toBeTruthy();
  });

  it('renders CTA pressable with departure-alert label', () => {
    const { getByTestId, getByLabelText } = render(<WeeklyPredictionScreen />);
    expect(getByTestId('commute-prediction-cta')).toBeTruthy();
    expect(getByLabelText('출발 시간에 알림 예약')).toBeTruthy();
  });

  it('navigates back when the back button is pressed', () => {
    const { getByTestId } = render(<WeeklyPredictionScreen />);
    fireEvent.press(getByTestId('commute-prediction-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('WeeklyPredictionScreen — model field consumption', () => {
  const richPrediction: PredictedCommute = {
    date: '2026-05-12',
    dayOfWeek: 2,
    predictedDepartureTime: '08:00',
    predictedArrivalTime: '08:30',
    predictedMinutes: 30,
    predictedMinutesRange: [27, 33],
    direction: 'up',
    walkToStationMinutes: 4,
    waitMinutes: 3,
    walkToDestinationMinutes: 3,
    transitSegments: [{
      fromStationId: '0150', fromStationName: '서울역',
      toStationId: '0220', toStationName: '강남역',
      lineId: '1', lineName: '1호선',
      estimatedMinutes: 20, isTransfer: false,
    }],
    route: {
      departureStationId: '0150', departureStationName: '서울역',
      arrivalStationId: '0220', arrivalStationName: '강남역',
      lineIds: ['1'],
    },
    confidence: 0.8,
    suggestedAlertTime: '07:45',
  };

  const mockHookWithPrediction = (): void => {
    (useCommutePattern as jest.Mock).mockReturnValueOnce({
      todayPrediction: richPrediction,
      patterns: [],
      weekPredictions: [richPrediction],
      recentLogs: [],
      notificationSettings: null,
      todayNotification: null,
      loading: false,
      error: null,
    });
  };

  it('renders predictedMinutes from model, not heuristic', () => {
    mockHookWithPrediction();
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText(/예상 30분/)).toBeTruthy();
  });

  it('renders predictedMinutesRange from model, not ±2/±4 heuristic', () => {
    mockHookWithPrediction();
    const { getByText } = render(<WeeklyPredictionScreen />);
    // Range UI text should show 27/33 (model range), not 28/32 (±2 heuristic).
    expect(getByText('최단 27분')).toBeTruthy();
    expect(getByText('최장 33분')).toBeTruthy();
  });
});
