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
import { useCommutePattern } from '@/hooks/useCommutePattern';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useFirestoreMorningCommute } from '@/hooks/useFirestoreMorningCommute';
import { useCommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';
import { useCommuteRouteSteps } from '@/hooks/useCommuteRouteSteps';
import { trainService } from '@/services/train/trainService';
import { useAuth } from '@/services/auth/AuthContext';

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
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  })),
  NavigationProp: {},
}));

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
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
    baselineMinutes: null,
  })),
}));

// Store #2 (Firestore commuteSettings) bridge. Default null = no onboarding
// route; individual tests override to exercise the store-#1 ?? store-#2 path.
jest.mock('@/hooks/useFirestoreMorningCommute', () => ({
  useFirestoreMorningCommute: jest.fn(() => null),
}));

// useCommuteHeroEstimate (the new shared single source of truth for the
// headline number / arrival / departure) composes useCommuteRouteSummary
// internally. The REAL hook runs in these tests — driven by the sub-hook mocks
// above — so the screen and hook are exercised together (regression guard).
// Stub the graph search to stay offline; tests override rideMinutes to drive
// the shared headline.
jest.mock('@/hooks/useCommuteRouteSummary', () => ({
  useCommuteRouteSummary: jest.fn(() => ({ ready: false })),
}));

// Route-timeline source. The real hook runs graph search (getDiverseRoutes);
// stub it to a deterministic step list so the screen test stays offline and
// asserts the screen's wiring (isFirst/isLast/status), not the reshape logic
// (covered by useCommuteRouteSteps.test.ts + guidanceSteps.test.ts).
jest.mock('@/hooks/useCommuteRouteSteps', () => ({
  useCommuteRouteSteps: jest.fn(() => []),
}));

// GuidanceStepRow has its own test (GuidanceStepRow.test.tsx). Stub it to a
// testID + the props the screen controls so we verify the mapping without
// re-rendering LineBadge/icons here.
jest.mock('@/components/guidance', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    GuidanceStepRow: ({
      step,
      status,
      isFirst,
      isLast,
    }: {
      step: { id: string; kind: string };
      status: string;
      isFirst: boolean;
      isLast: boolean;
    }) =>
      React.createElement(
        View,
        { testID: `guidance-step-${step.id}` },
        React.createElement(
          Text,
          null,
          `${step.kind}|${status}|first=${isFirst}|last=${isLast}`,
        ),
      ),
  };
});

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
    // Re-apply the no-prediction default. clearAllMocks() wipes call records
    // but not mockReturnValue, so a persistent override in one test would
    // otherwise leak into the next.
    (useMLPrediction as jest.Mock).mockReturnValue({ prediction: null, baselineMinutes: null });
    // Same leak-guard for the new store-#2 + route-step seams and the station
    // name lookup (a per-test mockImplementation otherwise persists).
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue(null);
    (useCommuteRouteSummary as jest.Mock).mockReturnValue({ ready: false });
    (useCommuteRouteSteps as jest.Mock).mockReturnValue([]);
    (trainService.getStation as jest.Mock).mockResolvedValue(null);
    // Default auth: signed in, empty preferences (store #1 absent). Re-applied
    // here so a per-test override (the gate-discrimination test below) doesn't
    // leak into the next test.
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'test-user-id', preferences: {} },
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

  // Honest empty state: with no ML prediction AND no resolvable commute route,
  // the shared estimate is null. The old screen invented a 4+3+10+3=20 constant
  // here (diverging from HomeScreen, which showed the graph ride time); the
  // unified screen shows an em-dash and hides the range instead of a fabricated
  // number.
  it('renders an em-dash and hides the range when no shared estimate exists', () => {
    const { getByTestId, queryByText } = render(<WeeklyPredictionScreen />);
    expect(getByTestId('commute-prediction-minutes')).toHaveTextContent('—');
    expect(queryByText(/^예상 /)).toBeNull();
    expect(queryByText(/^최단 /)).toBeNull();
    expect(queryByText(/^최장 /)).toBeNull();
  });

  // The headline number is the user-visible contract that regressed: home and
  // this screen must show the SAME value. Both now read useCommuteHeroEstimate;
  // here the shared ML estimate (departure 08:30 → arrival 09:15 = 45 min)
  // drives the headline, range (±2 band), header timestamp and CTA together.
  it('reflects the shared ML estimate in headline, range, header and CTA', () => {
    (useMLPrediction as jest.Mock).mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:15',
        confidence: 0.9,
      },
      baselineMinutes: null,
    });

    const { getByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('예상 45분')).toBeTruthy();
    expect(getByText('최단 43분')).toBeTruthy();
    expect(getByText('최장 47분')).toBeTruthy();
    // (B) Header = 도착 시각 (same field as HomeScreen's card), NOT the current
    // wall-clock time. arrival 09:15 → "오늘 오전 9:15 도착".
    expect(getByText('오늘 오전 9:15 도착')).toBeTruthy();
    // CTA echoes the predicted arrival.
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

  // The top-bar gear is the always-available "change route" affordance.
  // WeeklyPrediction sits on the root stack (sibling to `Main`), so reaching
  // CommuteSettings is a 3-level nested navigation:
  //   Root('Main') → Tab('Profile'=SettingsNavigator) → Stack('CommuteSettings').
  // `initial: false` seeds [SettingsHome, CommuteSettings] so back lands on
  // SettingsHome rather than trapping the user (mirrors HomeScreen).
  it('navigates to commute settings when the settings gear is pressed', () => {
    const { getByTestId } = render(<WeeklyPredictionScreen />);
    fireEvent.press(getByTestId('commute-prediction-settings'));
    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Profile',
      params: { screen: 'CommuteSettings', initial: false },
    });
  });

  // Default mocks supply no commuteSchedule (useAuth preferences = {}) and
  // trainService.getStation → null, so routeNames stays empty. Instead of a
  // silent gap, the screen surfaces a tappable setup banner that explains the
  // empty sections ("경로 정보 없음" etc.) and routes to CommuteSettings.
  it('shows an actionable route-setup banner when no commute route is configured', () => {
    const { getByTestId, queryByTestId } = render(<WeeklyPredictionScreen />);
    expect(getByTestId('commute-prediction-route-setup')).toBeTruthy();
    // The configured-route row must be absent in the unconfigured state.
    expect(queryByTestId('commute-prediction-route-row')).toBeNull();
    fireEvent.press(getByTestId('commute-prediction-route-setup'));
    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Profile',
      params: { screen: 'CommuteSettings', initial: false },
    });
  });

  // Regression: the commute route is saved in two stores. Previously this
  // screen read only store #1 (profile.commuteSchedule), so a route registered
  // via CommuteSettings/onboarding (store #2, Firestore commuteSettings) showed
  // "출퇴근 경로를 설정해 주세요" even though HomeScreen rendered it. The screen
  // must fall back to store #2 just like HomeScreen does.
  it('resolves the commute route from store #2 (onboarding) when the profile store is empty', async () => {
    // useAuth default → preferences = {} (store #1 empty). Store #2 returns a
    // usable CommuteTime; station names resolve so the configured route row wins.
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue({
      stationId: '0150',
      destinationStationId: '0228',
      departureTime: '08:00',
      bufferMinutes: 0,
    });
    (trainService.getStation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(
        id === '0150'
          ? { id: '0150', name: '서울역' }
          : { id: '0228', name: '상계' },
      ),
    );

    const { findByTestId, queryByTestId } = render(<WeeklyPredictionScreen />);

    // Route row appears once the async station lookup resolves...
    expect(await findByTestId('commute-prediction-route-row')).toBeTruthy();
    // ...and the "set up your route" banner is gone.
    expect(queryByTestId('commute-prediction-route-setup')).toBeNull();
  });

  // Discriminates the isUsableCommuteTime GATE (not just the ?? fallback):
  // store #1 holds a non-null morningCommute with empty-string station ids —
  // exactly what NotificationTimeScreen can synthesize (project memory PR #114
  // "empty object shadows fallback"). The gate must drop it to null so store #2
  // wins. A plain `profileMorningCommute ?? onboarding` would let the empty
  // object win → getStation('') → null → setup banner. This test FAILS under
  // plain `??` and PASSES under the gate, so it guards the central new logic.
  it('falls back to store #2 when store #1 is a non-null but unusable commute (empty station ids)', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'test-user-id',
        preferences: {
          commuteSchedule: {
            weekdays: {
              morningCommute: {
                stationId: '',
                destinationStationId: '',
                departureTime: '08:00',
                bufferMinutes: 0,
              },
            },
          },
        },
      },
    });
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue({
      stationId: '0150',
      destinationStationId: '0228',
      departureTime: '08:00',
      bufferMinutes: 0,
    });
    // Only the store-#2 ids resolve; an empty/unknown id resolves to null
    // (mirrors trainService's falsy-id early return), so the broken `??` path
    // would surface the setup banner instead of a route row.
    (trainService.getStation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(
        id === '0150'
          ? { id: '0150', name: '서울역' }
          : id === '0228'
            ? { id: '0228', name: '상계' }
            : null,
      ),
    );

    const { findByTestId, queryByTestId } = render(<WeeklyPredictionScreen />);

    expect(await findByTestId('commute-prediction-route-row')).toBeTruthy();
    expect(queryByTestId('commute-prediction-route-setup')).toBeNull();
  });

  // The user-facing ask: show the configured route as a full timeline (like the
  // 길안내 screen) instead of "경로 정보 없음". When useCommuteRouteSteps yields
  // steps, the screen renders the 전체 경로 timeline with each step as a row,
  // all 'upcoming' (preview, not a live journey), first/last flags wired.
  it('renders the full-route timeline when commute route steps are available', () => {
    (useCommuteRouteSteps as jest.Mock).mockReturnValue([
      { kind: 'board', id: 'board-0' },
      { kind: 'ride', id: 'ride-1' },
      { kind: 'transfer', id: 'transfer-2' },
      { kind: 'alight', id: 'alight-3' },
    ]);

    const { getByTestId, getByText } = render(<WeeklyPredictionScreen />);

    expect(getByTestId('commute-prediction-route-timeline')).toBeTruthy();
    expect(getByText('전체 경로')).toBeTruthy();
    expect(getByTestId('guidance-step-board-0')).toBeTruthy();
    expect(getByTestId('guidance-step-ride-1')).toBeTruthy();
    expect(getByTestId('guidance-step-transfer-2')).toBeTruthy();
    expect(getByTestId('guidance-step-alight-3')).toBeTruthy();
    // Endpoint flags + neutral preview status are wired correctly.
    expect(getByText('board|upcoming|first=true|last=false')).toBeTruthy();
    expect(getByText('alight|upcoming|first=false|last=true')).toBeTruthy();
  });

  it('hides the route timeline when no commute route steps are available', () => {
    // Default mock → useCommuteRouteSteps returns [].
    const { queryByTestId } = render(<WeeklyPredictionScreen />);
    expect(queryByTestId('commute-prediction-route-timeline')).toBeNull();
  });

  // Edge: no real ML prediction yet (useMLPrediction → prediction: null, the
  // default mock). The hardcoded "87% · 지난 30일 학습" would be a false claim,
  // so the confidence slot reads "데이터 수집중" instead.
  it('shows "데이터 수집중" when no real ML prediction exists', () => {
    const { getByText, queryByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('데이터 수집중')).toBeTruthy();
    expect(queryByText('· 지난 30일 학습')).toBeNull();
  });

  // Happy: a real prediction (non-null) restores the percentage + learning
  // meta and removes the collecting label. Uses mockReturnValue (not Once)
  // because the screen re-renders on async slot state updates and each render
  // re-reads useMLPrediction — a one-shot override would be consumed by the
  // first render and revert to null before assertions run.
  it('shows confidence percentage and learning meta when a real prediction exists', () => {
    (useMLPrediction as jest.Mock).mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:23',
        predictedArrivalTime: '09:15',
        confidence: 0.92,
      },
      baselineMinutes: null,
    });
    const { getByText, queryByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('92%')).toBeTruthy();
    expect(getByText('· 지난 30일 학습')).toBeTruthy();
    expect(queryByText('데이터 수집중')).toBeNull();
  });
});

describe('WeeklyPredictionScreen — unified headline source', () => {
  // This block uses persistent mockReturnValue overrides; re-apply the
  // no-prediction / no-route defaults each test so they don't leak forward
  // (memory project_tdd_red_mock_once_leak).
  beforeEach(() => {
    jest.clearAllMocks();
    (useMLPrediction as jest.Mock).mockReturnValue({ prediction: null, baselineMinutes: null });
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
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue(null);
    (useCommuteRouteSummary as jest.Mock).mockReturnValue({ ready: false });
    (useCommuteRouteSteps as jest.Mock).mockReturnValue([]);
    (trainService.getStation as jest.Mock).mockResolvedValue(null);
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'test-user-id', preferences: {} } });
  });

  // The bug the user hit: this screen and HomeScreen showed different numbers.
  // The headline now reads the shared useCommuteHeroEstimate and must IGNORE the
  // useCommutePattern.todayPrediction.predictedMinutes it used to read (that
  // pipeline still drives the trend / factors / hourly sections, not the hero).
  it('renders the shared estimate minutes and ignores todayPrediction.predictedMinutes', () => {
    // Shared estimate (ML) = 45 min; todayPrediction carries a *different* 30.
    (useMLPrediction as jest.Mock).mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:30',
        predictedArrivalTime: '09:15',
        confidence: 0.8,
      },
      baselineMinutes: null,
    });
    (useCommutePattern as jest.Mock).mockReturnValue({
      todayPrediction: {
        date: '2026-05-12',
        dayOfWeek: 2,
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:30',
        predictedMinutes: 30,
        predictedMinutesRange: [27, 33],
        direction: 'up',
        route: {
          departureStationId: '0150', departureStationName: '서울역',
          arrivalStationId: '0220', arrivalStationName: '강남역',
          lineIds: ['1'],
        },
        confidence: 0.8,
        suggestedAlertTime: '07:45',
      },
      patterns: [],
      weekPredictions: [],
      recentLogs: [],
      notificationSettings: null,
      todayNotification: null,
      loading: false,
      error: null,
    });

    const { getByText, queryByText } = render(<WeeklyPredictionScreen />);
    expect(getByText('예상 45분')).toBeTruthy();
    expect(queryByText('예상 30분')).toBeNull();
  });

  it('falls back to graph ride minutes when no ML prediction exists (matches HomeScreen)', async () => {
    // No ML; a registered commute + graph route summary → ride minutes (26)
    // surface as the headline, exactly as HomeScreen derives it.
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue({
      stationId: '0150',
      destinationStationId: '0220',
      departureTime: '08:00',
      bufferMinutes: 0,
    });
    (useCommuteRouteSummary as jest.Mock).mockReturnValue({ ready: true, rideMinutes: 26 });
    (trainService.getStation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(
        id === '0150' ? { id: '0150', name: '서울역' } : { id: '0220', name: '강남역' },
      ),
    );

    const { findByText } = render(<WeeklyPredictionScreen />);
    expect(await findByText('예상 26분')).toBeTruthy();
  });
});
