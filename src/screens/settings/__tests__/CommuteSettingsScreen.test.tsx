/**
 * CommuteSettingsScreen Tests
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { CommuteSettingsScreen } from '../CommuteSettingsScreen';
import { useAuth } from '@/services/auth/AuthContext';
import {
  loadCommuteRoutes,
  updateEveningEnabled,
} from '@/services/commute/commuteService';
import { useCommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';

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

jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
  updateEveningEnabled: jest.fn(),
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
    mockUpdateEveningEnabled.mockResolvedValue({ success: true });
    (useCommuteRouteSummary as jest.Mock).mockReturnValue({ ready: false });
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
});
