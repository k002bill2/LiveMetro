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

  // 26/28/32 are the screen's explicit warming-up fallback constants
  // (WeeklyPredictionScreen.tsx:116, 125). Asserting them is intentional —
  // a change in fallbacks is a design-contract change that must be reviewed.
  it('renders range labels using fallback when prediction is unavailable', () => {
    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('최단 26분')).toBeTruthy();
    expect(getByText('최장 32분')).toBeTruthy();
    expect(getByText('예상 28분')).toBeTruthy();
  });

  it('reflects prediction values in range labels and CTA when data is loaded', () => {
    const { useMLPrediction } = require('@/hooks/useMLPrediction');
    (useMLPrediction as jest.Mock).mockReturnValueOnce({
      prediction: {
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:15',
        confidence: 0.9,
        delayProbability: 0.1,
      },
    });

    const { getByText } = render(<WeeklyPredictionScreen />);
    // 45 min commute, confidence ≥0.7 ⇒ ±2 spread ⇒ [43, 47]
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
    const { getByText, findByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('시간대별 혼잡도 예측')).toBeTruthy();
    expect(await findByText('지금')).toBeTruthy();
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
