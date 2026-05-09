/**
 * CommuteSettingsScreen Tests
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { CommuteSettingsScreen } from '../CommuteSettingsScreen';
import { useAuth } from '@/services/auth/AuthContext';
import { loadCommuteRoutes } from '@/services/commute/commuteService';

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
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockLoadCommuteRoutes = loadCommuteRoutes as jest.MockedFunction<typeof loadCommuteRoutes>;

const createProps = (): any => ({
  navigation: { navigate: jest.fn(), goBack: jest.fn() },
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
      updateUserProfile: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as any);
    mockLoadCommuteRoutes.mockResolvedValue(null);
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
      expect(getByText('오늘 출근 예측')).toBeTruthy();
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
    expect(getAllByText('08:00').length).toBeGreaterThan(0);
    expect(getAllByText('수정하기').length).toBe(1);
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
      updateUserProfile: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
    } as any);

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      expect(getByText('오늘 출근 예측')).toBeTruthy();
    });
  });

  it('handles load error gracefully', async () => {
    mockLoadCommuteRoutes.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    await waitFor(() => {
      expect(getByText('오늘 출근 예측')).toBeTruthy();
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
      createdAt: null,
      updatedAt: null,
    });

    const { getByText } = render(<CommuteSettingsScreen {...createProps()} />);
    // The transfer station now appears in the RouteWithTransfer atom or
    // the recommended-routes panel; the legacy "역" suffix is gone.
    await waitFor(() => {
      expect(getByText('신도림')).toBeTruthy();
    });
  });
});
