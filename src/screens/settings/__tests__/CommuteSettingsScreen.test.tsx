/**
 * CommuteSettingsScreen Tests
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { CommuteSettingsScreen } from '../CommuteSettingsScreen';
import { useAuth } from '@/services/auth/AuthContext';
import {
  loadCommuteRoutes,
  saveCommuteRoutes,
  updateEveningEnabled,
} from '@/services/commute/commuteService';
import { useCommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';
import { selectCommuteRoute } from '@/services/route/selectCommuteRoute';
import { commuteReminderService, notificationService } from '@/services/notification';

jest.mock('@/services/notification', () => ({
  commuteReminderService: {
    scheduleCommuteReminders: jest.fn(),
    cancelCommuteReminders: jest.fn(),
  },
  notificationService: { requestPermissions: jest.fn() },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    resetOnboarding: jest.fn(),
  }),
}));

// RouteWithTransfer (introduced in Topic 2) reads theme directly via
// `@/services/theme/themeContext`. Without this mock the atom's useTheme()
// throws "must be used within a ThemeProvider" when CommuteSettingsScreen
// renders a populated route.
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: 'LineBadge',
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLocal = require('react');
  const { Pressable } = require('react-native');

  return {
    __esModule: true,
    default: ({
      testID,
      onChange,
    }: {
      testID?: string;
      onChange: (event: { type: 'set' }, selectedDate?: Date) => void;
    }) =>
      ReactLocal.createElement(Pressable, {
        testID,
        onPress: () => onChange({ type: 'set' }, new Date(2020, 0, 1, 8, 1)),
      }),
  };
});

jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
  saveCommuteRoutes: jest.fn(),
  updateEveningEnabled: jest.fn(),
}));

// The RouteCard transfer summary now prefers the SSOT-derived route
// (selectCommuteRoute → routeToGuidanceSteps, via useCommuteRouteSteps) over
// the stored transferStations field. Mock the pure selectCommuteRoute seam so
// tests deterministically drive the derivation: null → stored-field fallback,
// a real Route fixture → the reshape runs and derived names win. Default null
// in beforeEach so every existing test hits the stored-field path unchanged.
jest.mock('@/services/route/selectCommuteRoute', () => ({
  __esModule: true,
  selectCommuteRoute: jest.fn(() => null),
  default: jest.fn(() => null),
}));

// Mock the Toast hook so the "저장" confirmation can be asserted without
// pulling in the real Animated-driven Toast component. `showSuccessMock` is
// created inside the factory (hoist-safe) and re-exported for assertions.
jest.mock('@/components/common/Toast', () => {
  const showSuccessMock = jest.fn();
  return {
    useToast: () => ({
      showSuccess: showSuccessMock,
      showError: jest.fn(),
      showWarning: jest.fn(),
      showInfo: jest.fn(),
      ToastComponent: () => null,
    }),
    showSuccessMock,
  };
});

// Hero ETA wires up useMLPrediction. Stub it to a "no data yet" state so
// tests don't pull in TF-disabled paths or async firestore subscriptions.
jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: () => ({
    prediction: null,
    baselineMinutes: null,
    loading: false,
    error: null,
    modelMetadata: null,
    isModelReady: false,
    isTensorFlowReady: false,
    trainingProgress: 0,
    isTraining: false,
    logCount: 0,
    hasEnoughData: false,
    refreshPrediction: jest.fn(),
    trainModel: jest.fn(),
    getWeekPredictions: jest.fn(),
    clearCache: jest.fn(),
    checkReliability: jest.fn(() => false),
  }),
}));

// Hero ETA also reads the shared graph estimate (useCommuteRouteSummary) for
// the configured route. Default to "no route resolved" so the placeholder
// path runs; the parity test overrides it with a concrete rideMinutes.
jest.mock('@/hooks/useCommuteRouteSummary', () => ({
  useCommuteRouteSummary: jest.fn(() => ({ ready: false })),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockLoadCommuteRoutes = loadCommuteRoutes as jest.MockedFunction<typeof loadCommuteRoutes>;
const mockSaveCommuteRoutes = saveCommuteRoutes as jest.MockedFunction<typeof saveCommuteRoutes>;
const mockUpdateEveningEnabled = updateEveningEnabled as jest.MockedFunction<
  typeof updateEveningEnabled
>;
const { showSuccessMock } = jest.requireMock('@/components/common/Toast') as {
  showSuccessMock: jest.Mock;
};

const createProps = (): any => ({
  navigation: {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
    setOptions: jest.fn(),
  },
  route: { params: {}, key: 'CommuteSettings', name: 'CommuteSettings' as const },
});

describe('CommuteSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', displayName: 'Test', email: 'test@test.com' },
      firebaseUser: null,
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserPreferences: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as any);
    mockLoadCommuteRoutes.mockResolvedValue(null);
    mockSaveCommuteRoutes.mockResolvedValue({ success: true });
    mockUpdateEveningEnabled.mockResolvedValue({ success: true });
    (useCommuteRouteSummary as jest.Mock).mockReturnValue({ ready: false });
    // Default: derivation yields nothing → RouteCard falls back to the stored
    // transferStations field (preserves every pre-existing test's expectation).
    (selectCommuteRoute as jest.Mock).mockReturnValue(null);
  });

  it('renders loading state initially', () => {
    mockLoadCommuteRoutes.mockImplementation(() => new Promise(() => {}));
    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    expect(getByText('출퇴근 설정을 불러오는 중...')).toBeTruthy();
  });

  it('renders empty route state when no routes exist', async () => {
    mockLoadCommuteRoutes.mockResolvedValue(null);
    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    // The in-body title was removed (SettingsNavigator header now owns it,
    // post Wanted handoff cascade). The Hero ETA card's eyebrow is the
    // post-redesign always-rendered sentinel.
    await waitFor(() => {
      // Hero eyebrow shows "예측 준비 중" when useMLPrediction has no
      // baseline yet (mocked default), falls back to "오늘 출근 예측"
      // when baseline is available. Either is acceptable as a render
      // sentinel post-Hero-ETA wiring.
      expect(getByText('예측 준비 중')).toBeTruthy();
    });
  });

  it('renders route data when routes are loaded', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:00',
        departureStationId: 's1',
        departureStationName: '강남',
        departureLineId: '2',
        arrivalStationId: 's2',
        arrivalStationName: '시청',
        arrivalLineId: '1',
        transferStations: [],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });

    const { getAllByText } = render(<CommuteSettingsScreen {...createProps()} />);
    // RouteWithTransfer renders bare station names (no '역' suffix); the
    // legacy '{station}역' string disappeared with the Topic 2 redesign.
    // Post Wanted-handoff redesign, the Hero card also surfaces the morning
    // route's departure/arrival names, so '강남'/'시청' appear twice — assert
    // presence via getAllByText rather than the multi-match-failing getByText.
    await waitFor(() => {
      expect(getAllByText('강남').length).toBeGreaterThan(0);
    });
    expect(getAllByText('시청').length).toBeGreaterThan(0);
    // Footer text post-redesign concatenates time + " 출발", so '08:00'
    // is no longer a standalone Text node. Match the concatenated form.
    expect(getAllByText('08:00 출발').length).toBeGreaterThan(0);
    // Legacy "수정하기" button replaced with the "편집" link in the
    // morning RouteCard header (Wanted handoff).
    expect(getAllByText('편집').length).toBe(1);
  });

  // Regression guard for the "편집" link wiring. RouteCard lives at module
  // scope (hoisted out of the screen body) so a parent re-render — e.g. the
  // nav-prop identity churn of a cross-stack "경로 변경" entry — re-renders it
  // instead of remounting it, which is what kept these onPress handlers from
  // firing on device. JSDOM can't reproduce the remount/touch-delivery race,
  // but this proves both legs' press → navigate('EditCommuteRoute', …) contract.
  it('pressing the morning/evening "편집" links navigates to EditCommuteRoute with the right leg', async () => {
    const notifications = {
      transferAlert: true,
      arrivalAlert: true,
      delayAlert: true,
      incidentAlert: true,
      alertMinutesBefore: 5,
    };
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:30',
        departureStationId: 's1',
        departureStationName: '산곡',
        departureLineId: '1',
        arrivalStationId: 's2',
        arrivalStationName: '선릉',
        arrivalLineId: '2',
        transferStations: [
          { stationId: 's3', stationName: '강남구청', lineId: '7', lineName: '7호선', order: 1 },
        ],
        notifications,
        bufferMinutes: 10,
      },
      eveningRoute: {
        departureTime: '18:30',
        departureStationId: 's2',
        departureStationName: '선릉',
        departureLineId: '2',
        arrivalStationId: 's1',
        arrivalStationName: '산곡',
        arrivalLineId: '1',
        transferStations: [],
        notifications,
        bufferMinutes: 10,
      },
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });

    const props = createProps();
    const { getByLabelText } = render(<CommuteSettingsScreen {...props} />);
    await waitFor(() => {
      expect(getByLabelText('경로 편집')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('경로 편집'));
    expect(props.navigation.navigate).toHaveBeenCalledWith(
      'EditCommuteRoute',
      expect.objectContaining({
        kind: 'morning',
        initial: expect.objectContaining({
          departureStation: expect.objectContaining({ stationName: '산곡' }),
          arrivalStation: expect.objectContaining({ stationName: '선릉' }),
        }),
      }),
    );

    fireEvent.press(getByLabelText('퇴근 경로 편집'));
    expect(props.navigation.navigate).toHaveBeenCalledWith(
      'EditCommuteRoute',
      expect.objectContaining({
        kind: 'evening',
        initial: expect.objectContaining({
          departureStation: expect.objectContaining({ stationName: '선릉' }),
        }),
      }),
    );
  });

  it('handles no user gracefully', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      firebaseUser: null,
      loading: false,
      signInAnonymously: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      signOut: jest.fn(),
      updateUserPreferences: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as any);

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      // Hero eyebrow shows "예측 준비 중" when useMLPrediction has no
      // baseline yet (mocked default), falls back to "오늘 출근 예측"
      // when baseline is available. Either is acceptable as a render
      // sentinel post-Hero-ETA wiring.
      expect(getByText('예측 준비 중')).toBeTruthy();
    });
  });

  it('handles load error gracefully', async () => {
    mockLoadCommuteRoutes.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      // Hero eyebrow shows "예측 준비 중" when useMLPrediction has no
      // baseline yet (mocked default), falls back to "오늘 출근 예측"
      // when baseline is available. Either is acceptable as a render
      // sentinel post-Hero-ETA wiring.
      expect(getByText('예측 준비 중')).toBeTruthy();
    });
  });

  it('renders route with transfer stations', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:30',
        departureStationId: 's1',
        departureStationName: '잠실',
        departureLineId: '2',
        arrivalStationId: 's3',
        arrivalStationName: '홍대입구',
        arrivalLineId: '2',
        transferStations: [
          { stationId: 's2', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    // After the EditCommuteRoute redesign, the transfer row shows both
    // count and station name(s) — "환승 N회 · {names}" — because the
    // standalone "환승 추가" CTA + StationSearchModal flow was removed
    // (route changes go through the editor only).
    await waitFor(() => {
      expect(getByText('환승 1회 · 신도림')).toBeTruthy();
    });
  });

  // Task 1: RouteCard prefers the SSOT-derived transfer stations
  // (selectCommuteRoute → routeToGuidanceSteps) over the stored field, so
  // legacy/auto-saved docs with an empty transferStations field still show the
  // real transfer instead of "직행 · 환승 없음".
  it('SSOT 유도 환승역명을 카드에 표시한다 (저장 transferStations가 비어 있어도)', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:30',
        departureStationId: 's1',
        departureStationName: '잠실',
        departureLineId: '2',
        arrivalStationId: 's3',
        arrivalStationName: '홍대입구',
        arrivalLineId: '1',
        // Stored field is empty (legacy / auto-saved doc).
        transferStations: [],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });
    // A concrete Route with a transfer at 신도림 (ride 2호선 → transfer →
    // ride 1호선). The real routeToGuidanceSteps runs and yields a transfer
    // step whose stationName is the transfer segment's fromStationName.
    (selectCommuteRoute as jest.Mock).mockReturnValue({
      segments: [
        {
          fromStationId: '10',
          fromStationName: '잠실',
          toStationId: '20',
          toStationName: '신도림',
          lineId: '2',
          lineName: '2호선',
          estimatedMinutes: 10,
          isTransfer: false,
        },
        {
          fromStationId: '20',
          fromStationName: '신도림',
          toStationId: '20',
          toStationName: '신도림',
          lineId: '1',
          lineName: '1호선',
          estimatedMinutes: 4,
          isTransfer: true,
        },
        {
          fromStationId: '20',
          fromStationName: '신도림',
          toStationId: '30',
          toStationName: '홍대입구',
          lineId: '1',
          lineName: '1호선',
          estimatedMinutes: 10,
          isTransfer: false,
        },
      ],
      totalMinutes: 24,
      transferCount: 1,
      lineIds: ['2', '1'],
    });

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      expect(getByText('환승 1회 · 신도림')).toBeTruthy();
    });
  });

  // Round 2: the Hero summary and the morning RouteCard must derive their
  // transfer count from the SAME source (derived-preferred + stored-fallback),
  // so a legacy doc with an empty stored field never shows "직행 · 환승 0회" in
  // the Hero while the card below shows "환승 1회 · 신도림".
  it('저장 transferStations=[]+유도 성공 시 히어로와 RouteCard가 같은 환승 횟수를 표시한다', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:30',
        departureStationId: 's1',
        departureStationName: '잠실',
        departureLineId: '2',
        arrivalStationId: 's3',
        arrivalStationName: '홍대입구',
        arrivalLineId: '1',
        transferStations: [],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });
    (selectCommuteRoute as jest.Mock).mockReturnValue({
      segments: [
        {
          fromStationId: '10',
          fromStationName: '잠실',
          toStationId: '20',
          toStationName: '신도림',
          lineId: '2',
          lineName: '2호선',
          estimatedMinutes: 10,
          isTransfer: false,
        },
        {
          fromStationId: '20',
          fromStationName: '신도림',
          toStationId: '20',
          toStationName: '신도림',
          lineId: '1',
          lineName: '1호선',
          estimatedMinutes: 4,
          isTransfer: true,
        },
        {
          fromStationId: '20',
          fromStationName: '신도림',
          toStationId: '30',
          toStationName: '홍대입구',
          lineId: '1',
          lineName: '1호선',
          estimatedMinutes: 10,
          isTransfer: false,
        },
      ],
      totalMinutes: 24,
      transferCount: 1,
      lineIds: ['2', '1'],
    });

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      // RouteCard: derived name + count.
      expect(getByText('환승 1회 · 신도림')).toBeTruthy();
    });
    // Hero: same derived count (NOT the empty stored field's "환승 0회").
    expect(getByText('평일 08:30 출발 · 환승 1회')).toBeTruthy();
  });

  // Task 1 fallback: derivation fails (selectCommuteRoute → null) but a stored
  // transferStations value exists → the stored value is still shown (no
  // regression vs the pre-change behavior).
  it('유도 실패(null)면 저장된 transferStations를 표시한다', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:30',
        departureStationId: 's1',
        departureStationName: '잠실',
        departureLineId: '2',
        arrivalStationId: 's3',
        arrivalStationName: '홍대입구',
        arrivalLineId: '2',
        transferStations: [
          { stationId: 's2', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });
    (selectCommuteRoute as jest.Mock).mockReturnValue(null);

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      expect(getByText('환승 1회 · 신도림')).toBeTruthy();
    });
  });

  // Task 2: a legacy route document with NO transferStations field must not
  // crash when opening the editor (handleEditRoute maps over the field).
  it('transferStations 필드가 없는 레거시 route로 편집 진입 시 크래시하지 않는다', async () => {
    const legacyMorning = {
      departureTime: '08:30',
      departureStationId: 's1',
      departureStationName: '잠실',
      departureLineId: '2',
      arrivalStationId: 's3',
      arrivalStationName: '홍대입구',
      arrivalLineId: '2',
      // transferStations field intentionally absent (legacy doc).
      notifications: {
        transferAlert: true,
        arrivalAlert: true,
        delayAlert: true,
        incidentAlert: true,
        alertMinutesBefore: 5,
      },
      bufferMinutes: 10,
    };
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: legacyMorning as any,
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });

    const props = createProps();
    const { getByLabelText } = render(<CommuteSettingsScreen {...props} />);
    await waitFor(() => {
      expect(getByLabelText('경로 편집')).toBeTruthy();
    });

    expect(() => fireEvent.press(getByLabelText('경로 편집'))).not.toThrow();
    expect(props.navigation.navigate).toHaveBeenCalledWith(
      'EditCommuteRoute',
      expect.objectContaining({ kind: 'morning' }),
    );
  });

  it('hero ETA shows the shared graph ride estimate (parity with Home/WeeklyPrediction), not the placeholder', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:00',
        departureStationId: 's1',
        departureStationName: '을지로3가',
        departureLineId: '3',
        arrivalStationId: 's2',
        arrivalStationName: '신길',
        arrivalLineId: '1',
        transferStations: [
          { stationId: 's3', stationName: '충정로', lineId: '5', lineName: '5호선', order: 1 },
        ],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: null,
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });
    // baselineMinutes is null (global useMLPrediction mock), so the hero must
    // use the shared graph ride estimate (25) for the configured route — the
    // SAME number Home / WeeklyPrediction show — instead of the 32 placeholder.
    (useCommuteRouteSummary as jest.Mock).mockReturnValue({
      ready: true,
      rideMinutes: 25,
      transferCount: 1,
    });

    const { getByTestId } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      expect(getByTestId('commute-hero-eta-minutes')).toHaveTextContent('25');
    });
  });

  it('toggling the evening route switch persists eveningEnabled', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: {
        departureTime: '08:00',
        departureStationId: 's1',
        departureStationName: '강남',
        departureLineId: '2',
        arrivalStationId: 's2',
        arrivalStationName: '시청',
        arrivalLineId: '1',
        transferStations: [],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningRoute: {
        departureTime: '18:00',
        departureStationId: 's2',
        departureStationName: '시청',
        departureLineId: '1',
        arrivalStationId: 's1',
        arrivalStationName: '강남',
        arrivalLineId: '2',
        transferStations: [],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });

    const { getByLabelText } = render(<CommuteSettingsScreen {...createProps()} />);
    const toggle = await waitFor(() => getByLabelText('퇴근 경로 사용'));

    fireEvent(toggle, 'valueChange', false);

    await waitFor(() =>
      expect(mockUpdateEveningEnabled).toHaveBeenCalledWith('user-1', false),
    );
  });

  it('reverts the evening toggle when the Firestore write fails', async () => {
    mockLoadCommuteRoutes.mockResolvedValue({
      morningRoute: null,
      eveningRoute: {
        departureTime: '18:00',
        departureStationId: 's2',
        departureStationName: '시청',
        departureLineId: '1',
        arrivalStationId: 's1',
        arrivalStationName: '강남',
        arrivalLineId: '2',
        transferStations: [],
        notifications: {
          transferAlert: true,
          arrivalAlert: true,
          delayAlert: true,
          incidentAlert: true,
          alertMinutesBefore: 5,
        },
        bufferMinutes: 10,
      },
      eveningEnabled: true,
      createdAt: null,
      updatedAt: null,
    });
    mockUpdateEveningEnabled.mockResolvedValue({
      success: false,
      error: 'Firestore error',
    });

    const { getByLabelText } = render(<CommuteSettingsScreen {...createProps()} />);
    // Re-query each time — the toggle node is replaced on every re-render
    // (optimistic flip → failed write → revert).
    await waitFor(() =>
      expect(getByLabelText('퇴근 경로 사용').props.value).toBe(true),
    );

    fireEvent(getByLabelText('퇴근 경로 사용'), 'valueChange', false);

    // Optimistic flip is reverted once the failed write resolves.
    await waitFor(() =>
      expect(getByLabelText('퇴근 경로 사용').props.value).toBe(true),
    );
    expect(mockUpdateEveningEnabled).toHaveBeenCalledWith('user-1', false);
  });

  it('save button shows a success toast and navigates back after a short delay', async () => {
    const props = createProps();
    const { getByText } = render(<CommuteSettingsScreen {...props} />);
    await waitFor(() => expect(getByText('예측 준비 중')).toBeTruthy());

    // headerRight is registered via navigation.setOptions — extract and
    // render it, then press the "저장" button.
    const setOptionsCalls = (props.navigation.setOptions as jest.Mock).mock.calls;
    const lastOptions = setOptionsCalls[setOptionsCalls.length - 1][0];
    const header = render(lastOptions.headerRight());

    fireEvent.press(header.getByLabelText('저장하고 돌아가기'));

    // Confirmation toast fires immediately; navigation is deferred so the
    // toast stays visible briefly before the screen pops.
    expect(showSuccessMock).toHaveBeenCalledWith('출퇴근 설정이 저장되었습니다');
    expect(props.navigation.goBack).not.toHaveBeenCalled();

    await waitFor(
      () => expect(props.navigation.goBack).toHaveBeenCalledTimes(1),
      { timeout: 2000 },
    );
  });

  it('registers the header save button once and survives navigation-prop identity churn (cross-stack "경로 변경" loop guard)', () => {
    // Repro of the Home "경로 변경" entry — navigate('Profile', { screen:
    // 'CommuteSettings', initial: false }) hands this screen a NEW `navigation`
    // prop identity on every render. The setOptions layout effect must NOT
    // re-run on that churn: re-running looped setOptions → navigator re-render →
    // new nav prop → setOptions → "Maximum update depth exceeded".
    const setOptions = jest.fn();
    const route = {
      params: {},
      key: 'CommuteSettings',
      name: 'CommuteSettings' as const,
    };
    const makeNav = (): any => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: jest.fn(() => true),
      setOptions,
    });

    const { rerender } = render(
      <CommuteSettingsScreen navigation={makeNav()} route={route as any} />,
    );
    rerender(<CommuteSettingsScreen navigation={makeNav()} route={route as any} />);
    rerender(<CommuteSettingsScreen navigation={makeNav()} route={route as any} />);

    // Once on mount, never again — even though the navigation prop identity
    // changed on every render.
    expect(setOptions).toHaveBeenCalledTimes(1);
  });

  // ── 출근 시각 자동 알림 배선 (commuteReminderService) ──────────────
  const signedInUserWithSchedule = (alertEnabled: boolean): any => ({
    user: {
      id: 'user-1',
      displayName: 'Test',
      email: 'test@test.com',
      preferences: {
        commuteSchedule: { alertEnabled, activeDays: [true, true, true, true, true, false, false] },
      },
    },
    firebaseUser: null,
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserPreferences: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  });

  const morningOnlyRoutes = (): any => ({
    morningRoute: {
      departureTime: '08:00',
      departureStationId: 's1',
      departureStationName: '강남',
      departureLineId: '2',
      arrivalStationId: 's2',
      arrivalStationName: '시청',
      arrivalLineId: '1',
      transferStations: [],
      notifications: {
        transferAlert: true,
        arrivalAlert: true,
        delayAlert: true,
        incidentAlert: true,
        alertMinutesBefore: 5,
      },
      bufferMinutes: 10,
    },
    eveningRoute: null,
    eveningEnabled: true,
    createdAt: null,
    updatedAt: null,
  });

  it('알림 토글 ON + 권한 granted → scheduleCommuteReminders 호출', async () => {
    mockUseAuth.mockReturnValue(signedInUserWithSchedule(false));
    mockLoadCommuteRoutes.mockResolvedValue(morningOnlyRoutes());
    (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: true });

    const { getByTestId, getAllByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => expect(getAllByText('08:00 출발').length).toBeGreaterThan(0));

    fireEvent(getByTestId('commute-alert-toggle'), 'valueChange', true);

    await waitFor(() =>
      expect(commuteReminderService.scheduleCommuteReminders).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ departureTime: '08:00', activeDays: expect.any(Array) }),
      ),
    );
  });

  it('알림 토글 ON + 권한 denied → schedule 미호출', async () => {
    mockUseAuth.mockReturnValue(signedInUserWithSchedule(false));
    mockLoadCommuteRoutes.mockResolvedValue(morningOnlyRoutes());
    (notificationService.requestPermissions as jest.Mock).mockResolvedValue({ granted: false });

    const { getByTestId, getAllByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => expect(getAllByText('08:00 출발').length).toBeGreaterThan(0));

    fireEvent(getByTestId('commute-alert-toggle'), 'valueChange', true);

    await waitFor(() => expect(notificationService.requestPermissions).toHaveBeenCalled());
    expect(commuteReminderService.scheduleCommuteReminders).not.toHaveBeenCalled();
  });

  it('알림 토글 OFF → cancelCommuteReminders 호출', async () => {
    mockUseAuth.mockReturnValue(signedInUserWithSchedule(true));
    mockLoadCommuteRoutes.mockResolvedValue(morningOnlyRoutes());

    const { getByTestId, getAllByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => expect(getAllByText('08:00 출발').length).toBeGreaterThan(0));

    fireEvent(getByTestId('commute-alert-toggle'), 'valueChange', false);

    await waitFor(() =>
      expect(commuteReminderService.cancelCommuteReminders).toHaveBeenCalledWith('user-1'),
    );
  });

  it('출근 시간 선택기로 정해진 preset 외 1분 단위 시간을 저장한다', async () => {
    mockUseAuth.mockReturnValue(signedInUserWithSchedule(false));
    mockLoadCommuteRoutes.mockResolvedValue(morningOnlyRoutes());

    const { getByTestId, getAllByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => expect(getAllByText('08:00 출발').length).toBeGreaterThan(0));

    fireEvent.press(getByTestId('morning-time-picker-display'));
    fireEvent.press(getByTestId('morning-time-picker-native-picker'));

    await waitFor(() =>
      expect(mockSaveCommuteRoutes).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ departureTime: '08:01' }),
        expect.any(Object),
      ),
    );
  });
});
