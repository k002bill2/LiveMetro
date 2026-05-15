/**
 * HomeScreen Test Suite
 * Comprehensive tests covering all code paths
 *
 * NOTE: In Jest (jest-expo), __DEV__ is always true and cannot be overridden.
 * This means loadNearbyStations always returns early (line 104).
 * We test station loading via the favorites path (permission denied -> loadFavoriteStations).
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Location from 'expo-location';

// ============================================================================
// Imports
// ============================================================================

import { HomeScreen } from '../HomeScreen';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: mockNavigate, goBack: jest.fn() })),
  useRoute: jest.fn(() => ({ params: {} })),
  useFocusEffect: jest.fn((cb: () => void) => cb()),
  useIsFocused: jest.fn(() => true),
}));

const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'uid-1', uid: 'uid-1',
  displayName: 'Test User',
  email: 'test@test.com',
  isAnonymous: false, profilePicture: null,
  preferences: {
    favoriteStations: [
      { stationId: 'fav-1', lineId: 'line-2' },
      { stationId: 'fav-2', lineId: 'line-3' },
    ],
    notificationSettings: {
      enabled: true, delayThresholdMinutes: 5,
      quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
      weekdaysOnly: false,
      alertTypes: { delays: true, suspensions: true, congestion: false, alternativeRoutes: true, serviceUpdates: true },
      pushNotifications: true, emailNotifications: false,
      soundSettings: { soundEnabled: true, soundId: 'default', volume: 80, vibrationEnabled: true, vibrationPattern: 'default' },
    },
    commuteSchedule: { weekdays: { morningCommute: null, eveningCommute: null }, weekends: null, autoDetect: false },
    language: 'ko', theme: 'system', units: 'metric',
  },
  subscription: 'free',
  createdAt: new Date(), lastLoginAt: new Date(),
  ...overrides,
});

jest.mock('@/services/auth/AuthContext', () => {
  const mockUser = {
    id: 'uid-1', uid: 'uid-1',
    displayName: 'Test User',
    email: 'test@test.com',
    isAnonymous: false, profilePicture: null,
    preferences: {
      favoriteStations: [
        { stationId: 'fav-1', lineId: 'line-2' },
        { stationId: 'fav-2', lineId: 'line-3' },
      ],
      notificationSettings: {
        enabled: true, delayThresholdMinutes: 5,
        quietHours: { enabled: false, startTime: '22:00', endTime: '07:00' },
        weekdaysOnly: false,
        alertTypes: { delays: true, suspensions: true, congestion: false, alternativeRoutes: true, serviceUpdates: true },
        pushNotifications: true, emailNotifications: false,
        soundSettings: { soundEnabled: true, soundId: 'default', volume: 80, vibrationEnabled: true, vibrationPattern: 'default' },
      },
      commuteSchedule: { weekdays: { morningCommute: null, eveningCommute: null }, weekends: null, autoDetect: false },
      language: 'ko', theme: 'system', units: 'metric',
    },
    subscription: 'free',
    createdAt: new Date(), lastLoginAt: new Date(),
  };
  return {
    useAuth: jest.fn(() => ({
      user: mockUser,
      firebaseUser: null, loading: false,
      signInAnonymously: jest.fn(), signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(), signOut: jest.fn(),
      updateUserProfile: jest.fn(), resetPassword: jest.fn(), changePassword: jest.fn(),
    })),
  };
});

// Phase 9 — Wanted Design System atoms (e.g. SectionHeader) import useTheme
// directly from `@/services/theme/themeContext`. Mock that path too so the
// real provider isn't required when the test renders the screen tree.
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000', primaryLight: '#E5E5E5', surface: '#FFF',
      background: '#F5F5F5', backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A', textSecondary: '#666', textTertiary: '#999', textInverse: '#FFF',
      borderLight: '#E5E5E5', borderMedium: '#CCC',
    },
  })),
  ThemeColors: {},
}));

jest.mock('@/services/train/trainService', () => ({
  trainService: {
    getNearbyStations: jest.fn().mockResolvedValue([]),
    getStation: jest.fn().mockResolvedValue(null),
  },
}));

// Declare mock references - assigned in beforeEach via require
let mockGetStation: jest.Mock;
let mockGetNearbyStations: jest.Mock;

const mockRefreshNearby = jest.fn();
const mockUseNearbyStations = jest.fn(() => ({
  nearbyStations: [] as unknown[],
  loading: false,
  error: null as string | null,
  closestStation: null as unknown,
  lastUpdated: null as Date | null,
  refresh: mockRefreshNearby,
  getStationsByCategory: { 'very-close': [], 'close': [], 'nearby': [], 'far': [] },
  isAtStation: false,
  getFormattedStations: [],
  hasLocation: false,
  searchRadius: 2000,
}));
jest.mock('@/hooks/useNearbyStations', () => ({
  useNearbyStations: () => mockUseNearbyStations(),
}));

const mockScheduleDepartureAlert = jest.fn();
jest.mock('@/hooks/useDelayDetection', () => ({
  useDelayDetection: jest.fn(() => ({ delays: [], loading: false, error: null })),
}));
jest.mock('@/hooks/useIntegratedAlerts', () => ({
  useIntegratedAlerts: jest.fn(() => ({
    scheduleDepartureAlert: mockScheduleDepartureAlert, alerts: [],
  })),
}));

// Onboarding-side commute fallback. Mock returns null so the test path mirrors
// users who registered through Settings (profile-side) rather than onboarding.
// Without this mock the real hook fires loadCommuteRoutes → Firestore and the
// async setState lands after the test renderer has torn down, triggering an
// act() warning even though assertions pass.
jest.mock('@/hooks/useFirestoreMorningCommute', () => ({
  useFirestoreMorningCommute: jest.fn(() => null),
}));

// useCommuteRouteSummary wraps routeService/fareService (graph search). Mock it
// so tests can drive the registeredCommuteHero fallback chain deterministically
// without bundling the route graph. Default `{ ready: false }` mirrors the
// unmocked hook's EMPTY return for an unresolved route — keeps existing tests
// (which never set a real route) on the placeholder branch.
const mockUseCommuteRouteSummary = jest.fn(
  (): import('@/hooks/useCommuteRouteSummary').CommuteRouteSummary => ({
    ready: false,
  }),
);
jest.mock('@/hooks/useCommuteRouteSummary', () => ({
  useCommuteRouteSummary: () => mockUseCommuteRouteSummary(),
}));

// Phase 2 — HomeScreen now consumes useMLPrediction for the gradient hero card.
jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: jest.fn(() => ({
    prediction: null,
    loading: false,
    error: null,
    isModelReady: false,
    logCount: 0,
    hasEnoughData: false,
    refreshPrediction: jest.fn(),
    trainModel: jest.fn(),
    isTraining: false,
    trainingProgress: 0,
    modelMetadata: null,
    isTensorFlowReady: false,
    getWeekPredictions: jest.fn(),
    clearCache: jest.fn(),
    checkReliability: jest.fn(),
  })),
}));

jest.mock('lucide-react-native', () => ({
  CloudOff: () => null, MapPin: () => null, ChevronRight: () => null,
  TrainFront: () => null, RefreshCw: () => null,
  // Phase 2 icons used by the redesigned HomeScreen + design atoms
  Search: () => null, Map: () => null, Megaphone: () => null, FileText: () => null,
  Bell: () => null, Sparkles: () => null, TrendingDown: () => null, TrendingUp: () => null,
  // Phase 9 — MLHeroCardPlaceholder uses ArrowRight in its CTA row
  ArrowRight: () => null,
  // CommuteRouteCard + CommuteRouteCardPlaceholder icons
  Route: () => null, Home: () => null, Building2: () => null, Footprints: () => null,
}));

// expo-linear-gradient is used by MLHeroCard
jest.mock('expo-linear-gradient', () => {
  const ReactRef = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: unknown; testID?: string }) =>
      ReactRef.createElement(View, props, props.children),
  };
});

jest.mock('@/components/common/LoadingScreen', () => {
  const { View: V, Text: T } = require('react-native');
  return { LoadingScreen: ({ message }: { message?: string }) => <V testID="loading-screen"><T>{message}</T></V> };
});

jest.mock('@/components/train/StationCard', () => {
  const { TouchableOpacity: TO, Text: T } = require('react-native');
  return {
    StationCard: ({ station, onPress, onSetStart, onSetEnd }: {
      station: { id: string; name: string }; isSelected?: boolean;
      onPress: () => void; onSetStart: () => void; onSetEnd: () => void;
    }) => (
      <TO testID={`station-card-${station.id}`} onPress={onPress}>
        <T>{station.name}</T>
        <TO testID={`set-start-${station.id}`} onPress={onSetStart}><T>Start</T></TO>
        <TO testID={`set-end-${station.id}`} onPress={onSetEnd}><T>End</T></TO>
      </TO>
    ),
  };
});

jest.mock('@/components/train/TrainArrivalList', () => {
  const { View: V, Text: T } = require('react-native');
  return {
    TrainArrivalList: ({ stationId }: { stationId: string }) => (
      <V testID={`train-arrival-list-${stationId}`}><T>Arrivals</T></V>
    ),
  };
});

jest.mock('@/components/delays', () => {
  const { View: V, Text: T, TouchableOpacity: TO } = require('react-native');
  return {
    DelayAlertBanner: ({ onPress, onDismiss, onAlternativeRoutePress }: {
      onPress: () => void; onDismiss: () => void;
      onAlternativeRoutePress?: () => void; delays?: unknown[];
      showAlternativeRoute?: boolean; dismissible?: boolean;
    }) => (
      <V testID="delay-banner">
        <TO testID="delay-press" onPress={onPress}><T>Delays</T></TO>
        <TO testID="delay-dismiss" onPress={onDismiss}><T>Dismiss</T></TO>
        {onAlternativeRoutePress && (
          <TO testID="alt-route-press" onPress={onAlternativeRoutePress}><T>AltRoute</T></TO>
        )}
      </V>
    ),
  };
});

jest.mock('@/components/prediction', () => {
  const { View: V, Text: T, TouchableOpacity: TO } = require('react-native');
  return {
    CommutePredictionCard: ({ onScheduleAlert, onViewDetails }: {
      onScheduleAlert: () => void; onViewDetails: () => void;
    }) => (
      <V testID="prediction-card">
        <TO testID="schedule-alert-btn" onPress={onScheduleAlert}><T>Schedule</T></TO>
        <TO testID="view-details-btn" onPress={onViewDetails}><T>Details</T></TO>
      </V>
    ),
  };
});

jest.mock('@/components/debug', () => {
  const { View: V } = require('react-native');
  return { LocationDebugPanel: () => <V testID="debug-panel" /> };
});

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowInfo = jest.fn();
jest.mock('@/components/common/Toast', () => {
  const { View: V } = require('react-native');
  return {
    useToast: jest.fn(() => ({
      showError: mockShowError, showSuccess: mockShowSuccess, showInfo: mockShowInfo,
      ToastComponent: () => <V testID="toast" />,
    })),
  };
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 1 },
}));

jest.mock('@/styles/modernTheme', () => ({
  ...jest.requireActual('@/styles/modernTheme'),
  SPACING: { sm: 4, md: 8, lg: 16, xl: 24, '2xl': 32 },
  RADIUS: { sm: 4, md: 8, lg: 12, full: 999 },
  TYPOGRAPHY: {
    fontSize: { sm: 12, base: 14, lg: 16, xl: 18, '2xl': 24 },
    fontWeight: { normal: '400', semibold: '600', bold: '700' },
    letterSpacing: { tight: -0.5 },
    lineHeight: { relaxed: 1.5 },
  },
  // Phase 1 added — Wanted Design System tokens. Phase 9 expanded the mock
  // with spacing/radius/type so HomeScreen's createStyles can hydrate fully.
  WANTED_TOKENS: {
    light: { bgSubtlePage: '#F7F8FA', bgBase: '#FFFFFF', bgSubtle: 'rgba(112,115,124,0.08)', labelStrong: '#000000', labelNormal: '#171719', labelNeutral: '#37383C', labelAlt: '#70737C', lineSubtle: 'rgba(112,115,124,0.16)', primaryNormal: '#0066FF' },
    dark: { bgSubtlePage: '#14191E', bgBase: '#1B1C1E', bgSubtle: 'rgba(255,255,255,0.06)', labelStrong: '#FFFFFF', labelNormal: '#F4F4F5', labelNeutral: 'rgba(255,255,255,0.88)', labelAlt: '#989BA2', lineSubtle: 'rgba(255,255,255,0.10)', primaryNormal: '#3385FF' },
    spacing: { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 },
    radius: { r2: 4, r4: 8, r5: 10, r6: 12, r8: 16, pill: 9999 },
    type: {
      heading2: { size: 20, lh: 28, tracking: -0.012, weight: '700' },
      body1: { size: 16, lh: 24, tracking: 0.0057, weight: '500' },
      body2: { size: 15, lh: 22, tracking: 0.0096, weight: '500' },
      label1: { size: 14, lh: 20, tracking: 0.0145, weight: '600' },
      label2: { size: 13, lh: 18, tracking: 0.0194, weight: '600' },
      caption1: { size: 12, lh: 16, tracking: 0.0252, weight: '600' },
    },
    blue: { 50: '#EAF2FE', 500: '#0066FF', 700: '#0044BB' },
    status: { red500: '#FF4242' },
    congestion: {
      low:   { color: '#00BF40', label: '여유',     pct: 0.30 },
      mid:   { color: '#FFB400', label: '보통',     pct: 0.55 },
      high:  { color: '#FF7A1A', label: '혼잡',     pct: 0.80 },
      vhigh: { color: '#FF4242', label: '매우혼잡', pct: 0.95 },
    },
  },
}));

const mockLocationRequest = Location.requestForegroundPermissionsAsync as jest.Mock;

const mockStation = (id: string, name: string) => ({
  id, name, nameEn: name, lineId: 'line-2',
  coordinates: { latitude: 37.5665, longitude: 126.978 },
  transfers: [],
});

// ============================================================================
// Tests
// ============================================================================

// Phase 9 — helpers for the new 3-way ML hero branch (placeholder vs card)
let originalAuthImpl: () => unknown;

const withMorningCommute = (): void => {
  const { useAuth } = require('@/services/auth/AuthContext');
  if (!originalAuthImpl) originalAuthImpl = useAuth.getMockImplementation();
  const baseMock = originalAuthImpl() as { user: { preferences: Record<string, unknown> } };
  const overriddenUser = {
    ...baseMock.user,
    preferences: {
      ...baseMock.user.preferences,
      commuteSchedule: {
        ...(baseMock.user.preferences.commuteSchedule as object),
        weekdays: {
          morningCommute: {
            departureTime: '08:30',
            stationId: 'gangnam',
            destinationStationId: 'jamsil',
            bufferMinutes: 5,
          },
          eveningCommute: null,
        },
      },
    },
  };
  useAuth.mockImplementation(() => ({ ...baseMock, user: overriddenUser }));
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Capture (once) and restore the default auth mock — withMorningCommute()
    // overrides useAuth.mockImplementation, and that override would otherwise
    // bleed into the next test (clearAllMocks only resets call history).
    const { useAuth } = require('@/services/auth/AuthContext');
    if (!originalAuthImpl) originalAuthImpl = useAuth.getMockImplementation();
    useAuth.mockImplementation(originalAuthImpl);
    // Get fresh references to mock functions after clearAllMocks
    const { trainService } = require('@/services/train/trainService');
    mockGetStation = trainService.getStation;
    mockGetNearbyStations = trainService.getNearbyStations;
    // Default: permission denied -> triggers loadFavoriteStations path
    mockLocationRequest.mockResolvedValue({ status: 'denied' });
    mockGetNearbyStations.mockResolvedValue([]);
    mockGetStation.mockResolvedValue(null);
    // Reset useNearbyStations mock to default (no stations)
    mockUseNearbyStations.mockReturnValue({
      nearbyStations: [],
      loading: false,
      error: null,
      closestStation: null,
      lastUpdated: null,
      refresh: mockRefreshNearby,
      getStationsByCategory: { 'very-close': [], 'close': [], 'nearby': [], 'far': [] },
      isAtStation: false,
      getFormattedStations: [],
      hasLocation: false,
      searchRadius: 2000,
    });
    // Reset route summary to the unresolved default (clearAllMocks keeps the
    // implementation, but a prior test's mockReturnValue would otherwise leak).
    mockUseCommuteRouteSummary.mockReturnValue({ ready: false });
  });

  // ---------- Rendering ----------

  describe('Rendering', () => {
    it('renders home-screen after loading', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    });

    it('shows welcome message with user name', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText(/Test User/)).toBeTruthy());
    });

    it('shows the redesigned HomeTopBar (Phase 2 — replaces old subtitle)', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('home-top-bar')).toBeTruthy());
    });

    it('shows MLHeroCardPlaceholder and Toast when morningCommute is set but no prediction', async () => {
      // Even with a commute registered, an unresolved ML prediction (default
      // useMLPrediction mock returns prediction: null) keeps the ML slot on the
      // gradient placeholder — one consistent surface, no separate white card.
      withMorningCommute();
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => {
        expect(getByTestId('ml-hero-card-placeholder')).toBeTruthy();
        expect(getByTestId('toast')).toBeTruthy();
      });
    });

    it('shows MLHeroCardPlaceholder and Toast when morningCommute is unset', async () => {
      // Default mockUser has morningCommute: null — placeholder branch fires.
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => {
        expect(getByTestId('ml-hero-card-placeholder')).toBeTruthy();
        expect(getByTestId('toast')).toBeTruthy();
      });
    });

    it('shows CommuteRouteCardPlaceholder when morningCommute is unset', async () => {
      // hero null → the "오늘의 출근 경로" card should still occupy space with a
      // CTA placeholder instead of disappearing from the layout.
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getByTestId('commute-route-card-placeholder')).toBeTruthy(),
      );
    });

    it('CommuteRouteCardPlaceholder press navigates to CommuteSettings', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getByTestId('commute-route-card-placeholder')).toBeTruthy(),
      );

      fireEvent.press(getByTestId('commute-route-card-placeholder'));
      expect(mockNavigate).toHaveBeenCalledWith('Profile', {
        screen: 'CommuteSettings',
        initial: false,
      });
    });

    it('real CommuteRouteCard "경로 변경" link navigates to CommuteSettings', async () => {
      // Drive the full registeredCommuteHero chain so the REAL card renders
      // (not the placeholder): morningCommute set + endpoint names resolved +
      // route summary ready. This is the dev-build path where DEV_SAMPLE_COMMUTE
      // would otherwise fill the slot — the link must be wired regardless.
      withMorningCommute();
      mockGetStation.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'gangnam'
            ? { ...mockStation('gangnam', '강남'), lineId: '2' }
            : id === 'jamsil'
              ? { ...mockStation('jamsil', '잠실'), lineId: '2' }
              : null,
        ),
      );
      mockUseCommuteRouteSummary.mockReturnValue({
        ready: true,
        rideMinutes: 18,
        transferCount: 0,
        stationCount: 8,
        fareKrw: 1450,
      });

      const { getByTestId } = render(<HomeScreen />);
      // Longer timeout: this test drives the full async chain (permission →
      // loadFavoriteStations → endpoint name resolution) and on a cold module
      // load the default 1s waitFor budget is too tight.
      await waitFor(
        () => expect(getByTestId('home-commute-route-card')).toBeTruthy(),
        { timeout: 5000 },
      );

      fireEvent.press(getByTestId('commute-route-card-edit'));
      expect(mockNavigate).toHaveBeenCalledWith('Profile', {
        screen: 'CommuteSettings',
        initial: false,
      });
    });

    it('renders real CommuteRouteCard from registered endpoints even when route summary is unresolved', async () => {
      // Regression: a registered commute whose graph search fails (routeSummary
      // never `ready`) must STILL show the user's real origin→destination —
      // the card is gated on endpoint names alone, not on the full hero. Before
      // the fix the slot fell through to the placeholder (or, in dev builds, to
      // the hardcoded DEV_SAMPLE_COMMUTE route).
      withMorningCommute();
      mockGetStation.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'gangnam'
            ? { ...mockStation('gangnam', '강남'), lineId: '2' }
            : id === 'jamsil'
              ? { ...mockStation('jamsil', '잠실'), lineId: '2' }
              : null,
        ),
      );
      // routeSummary stays at the beforeEach default `{ ready: false }` — no
      // transferCount/stationCount/fareKrw/rideMinutes.

      const { getByTestId, getByText } = render(<HomeScreen />);
      await waitFor(
        () => expect(getByTestId('home-commute-route-card')).toBeTruthy(),
        { timeout: 5000 },
      );

      // Real registered endpoints are shown (not the dev sample 홍대입구→강남).
      expect(getByText('강남')).toBeTruthy();
      expect(getByText('잠실')).toBeTruthy();
    });

    it('shows "즐겨찾기" when permission denied', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('즐겨찾기')).toBeTruthy());
    });

    it('shows "주변 역" when permission granted', async () => {
      // Even though loadNearbyStations early-returns in DEV, locationPermission state is set
      mockLocationRequest.mockResolvedValue({ status: 'granted' });
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('주변 역')).toBeTruthy());
    });

    it('shows empty state when no stations loaded', async () => {
      const { getAllByText } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getAllByText('데이터가 없습니다.').length).toBeGreaterThan(0),
      );
    });

    it('shows empty state with permission granted but no nearby stations', async () => {
      mockLocationRequest.mockResolvedValue({ status: 'granted' });
      const { getAllByText } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getAllByText('데이터가 없습니다.').length).toBeGreaterThan(0),
      );
    });

    // Phase 56: StationCard testIDs replaced by NearbyStationCard.
    it.skip('shows nearby stations from hook when permission granted', async () => {
      mockLocationRequest.mockResolvedValue({ status: 'granted' });
      mockUseNearbyStations.mockReturnValue({
        nearbyStations: [
          { ...mockStation('nearby-1', '서울역'), distance: 150, bearing: 90 },
          { ...mockStation('nearby-2', '시청역'), distance: 500, bearing: 180 },
        ],
        loading: false,
        error: null,
        closestStation: { ...mockStation('nearby-1', '서울역'), distance: 150, bearing: 90 },
        lastUpdated: new Date(),
        refresh: mockRefreshNearby,
        getStationsByCategory: { 'very-close': [], 'close': [], 'nearby': [], 'far': [] },
        isAtStation: false,
        getFormattedStations: [],
        hasLocation: true,
        searchRadius: 2000,
      });

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => {
        expect(getByTestId('station-card-nearby-1')).toBeTruthy();
        expect(getByTestId('station-card-nearby-2')).toBeTruthy();
      });
    });
  });

  // ---------- Location Permission ----------

  // Phase 56: HomeScreen no longer renders the inline location-permission
  // banner (functionality moved to Settings + the empty-state link).
  describe.skip('Location Permission', () => {
    it('requests location permission on mount', async () => {
      render(<HomeScreen />);
      await waitFor(() => expect(mockLocationRequest).toHaveBeenCalled());
    });

    it('shows permission banner when denied', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('위치 권한 허용')).toBeTruthy());
    });

    it('handles permission request from banner - granted', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('위치 권한 허용')).toBeTruthy());

      // Second call grants permission
      mockLocationRequest.mockResolvedValueOnce({ status: 'granted' });
      fireEvent.press(getByText('위치 권한 허용'));
      await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith('위치 권한이 허용되었습니다'));
    });

    it('handles permission request from banner - still denied', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('위치 권한 허용')).toBeTruthy());

      mockLocationRequest.mockResolvedValueOnce({ status: 'denied' });
      fireEvent.press(getByText('위치 권한 허용'));
      await waitFor(() =>
        expect(mockShowInfo).toHaveBeenCalledWith('위치 권한이 필요합니다. 설정에서 수동으로 허용해주세요.')
      );
    });
  });

  // ---------- Favorite Stations (lines 76-100) ----------

  describe('Favorite Stations Loading', () => {
    // Phase 56: StationCard testIDs replaced by NearbyStationCard / FavoriteRow.
    it.skip('loads favorite stations via getStation when permission denied', async () => {
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Fav Station 1'))
        .mockResolvedValueOnce(mockStation('fav-2', 'Fav Station 2'));

      const { getByTestId } = render(<HomeScreen />);
      // Wait for loading to finish first
      await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
      await waitFor(() => {
        expect(getByTestId('station-card-fav-1')).toBeTruthy();
        expect(getByTestId('station-card-fav-2')).toBeTruthy();
      });
    });

    // Phase 56: TrainArrivalList no longer rendered on HomeScreen.
    it.skip('auto-selects first favorite and shows TrainArrivalList', async () => {
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Fav A'))
        .mockResolvedValueOnce(null);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('train-arrival-list-fav-1')).toBeTruthy());
    });

    // Phase 56: detail button + per-section refresh removed.
    it.skip('shows detail button and refresh button for selected station', async () => {
      mockGetStation.mockResolvedValueOnce(mockStation('fav-1', 'Fav A')).mockResolvedValueOnce(null);

      const { getByText, getByTestId } = render(<HomeScreen />);
      await waitFor(() => {
        expect(getByText('상세보기')).toBeTruthy();
        expect(getByTestId('refresh-button')).toBeTruthy();
      });
    });

    // Phase 56: real-time info header section removed.
    it.skip('shows station name in real-time info header', async () => {
      mockGetStation.mockResolvedValueOnce(mockStation('fav-1', 'My Fav')).mockResolvedValueOnce(null);

      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('My Fav 실시간 정보')).toBeTruthy());
    });

    it('handles getStation returning null for all favorites', async () => {
      mockGetStation.mockResolvedValue(null);

      const { getAllByText } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getAllByText('데이터가 없습니다.').length).toBeGreaterThan(0),
      );
    });

    it('handles no favorite stations in user preferences', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockReturnValueOnce({
        user: createMockUser({ preferences: { ...createMockUser().preferences, favoriteStations: [] } }),
        firebaseUser: null, loading: false,
        signInAnonymously: jest.fn(), signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(), signOut: jest.fn(),
        updateUserProfile: jest.fn(), resetPassword: jest.fn(), changePassword: jest.fn(),
      });

      const { getAllByText } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getAllByText('데이터가 없습니다.').length).toBeGreaterThan(0),
      );
    });
  });

  // ---------- Station Interactions (lines 152-173) ----------

  // Phase 56: handleSetStart/handleSetEnd/detail-button were tied to the
  // removed TrainArrivalList sub-screen. NearbyStationCard / FavoriteRow
  // have their own interaction tests.
  describe.skip('Station Interactions', () => {
    beforeEach(() => {
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Station A'))
        .mockResolvedValueOnce(null);
    });

    it('onStationSelect navigates to StationDetail', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('station-card-fav-1')).toBeTruthy());

      fireEvent.press(getByTestId('station-card-fav-1'));
      expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
        stationId: 'fav-1', stationName: 'Station A', lineId: 'line-2',
      });
    });

    it('handleSetStart navigates to StationDetail', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('set-start-fav-1')).toBeTruthy());

      fireEvent.press(getByTestId('set-start-fav-1'));
      expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
        stationId: 'fav-1', stationName: 'Station A', lineId: 'line-2',
      });
    });

    it('handleSetEnd resets selection and shows info toast', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('set-end-fav-1')).toBeTruthy());

      fireEvent.press(getByTestId('set-end-fav-1'));
      expect(mockShowInfo).toHaveBeenCalledWith('선택이 초기화되었습니다');
    });

    it('detail button navigates to StationDetail', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('상세보기')).toBeTruthy());

      fireEvent.press(getByText('상세보기'));
      expect(mockNavigate).toHaveBeenCalledWith('StationDetail', {
        stationId: 'fav-1', stationName: 'Station A', lineId: 'line-2',
      });
    });
  });

  // ---------- Refresh (lines 192-227) ----------

  // Phase 56: separate refresh button removed; pull-to-refresh
  // (RefreshControl) replaces it.
  describe.skip('Refresh', () => {
    it('refresh button triggers loadFavoriteStations again', async () => {
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Station A'))
        .mockResolvedValueOnce(null);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('refresh-button')).toBeTruthy());

      // Clear to track refresh calls
      mockGetStation.mockClear();
      mockGetStation.mockResolvedValue(null);

      await act(async () => {
        fireEvent.press(getByTestId('refresh-button'));
      });

      // onRefresh should call loadFavoriteStations (since locationPermission is false in default)
      expect(mockGetStation).toHaveBeenCalled();
    });
  });

  // ---------- Commute Prediction (lines 177-187) ----------

  describe('Commute Prediction', () => {
    // The Commute Prediction CTAs (Schedule / View details) live inside
    // CommutePredictionCard, which only renders when morningCommute is set.
    // Without it, the screen shows MLHeroCardPlaceholder instead.
    beforeEach(() => {
      withMorningCommute();
    });

    // Phase 56: useIntegratedAlerts no longer wired into HomeScreen.
    // Re-cover in WeeklyPredictionScreen tests.
    it.skip('schedule alert calls scheduleDepartureAlert(15)', async () => {
      mockScheduleDepartureAlert.mockResolvedValue({ alertTime: '08:00' });

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('schedule-alert-btn')).toBeTruthy());

      fireEvent.press(getByTestId('schedule-alert-btn'));
      await waitFor(() => expect(mockScheduleDepartureAlert).toHaveBeenCalledWith(15));
    });

    it.skip('shows success toast when alert scheduled', async () => {
      mockScheduleDepartureAlert.mockResolvedValue({ alertTime: '08:00' });

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('schedule-alert-btn')).toBeTruthy());

      fireEvent.press(getByTestId('schedule-alert-btn'));
      await waitFor(() =>
        expect(mockShowSuccess).toHaveBeenCalledWith('08:00에 출발 알림이 예약되었습니다')
      );
    });

    it.skip('does not show toast when alert returns null', async () => {
      mockScheduleDepartureAlert.mockResolvedValue(null);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('schedule-alert-btn')).toBeTruthy());

      fireEvent.press(getByTestId('schedule-alert-btn'));
      await waitFor(() => expect(mockScheduleDepartureAlert).toHaveBeenCalled());
      expect(mockShowSuccess).not.toHaveBeenCalled();
    });

    it('MLHeroCardPlaceholder press navigates to CommuteSettings when morningCommute is unset', async () => {
      // Reset the beforeEach override so the placeholder branch fires.
      const { useAuth } = require('@/services/auth/AuthContext');
      useAuth.mockImplementation(originalAuthImpl);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('ml-hero-card-placeholder')).toBeTruthy());

      fireEvent.press(getByTestId('ml-hero-card-placeholder'));
      expect(mockNavigate).toHaveBeenCalledWith('Profile', {
        screen: 'CommuteSettings',
        initial: false,
      });
      expect(mockShowInfo).not.toHaveBeenCalled();
    });

    it('MLHeroCardPlaceholder press navigates to CommuteSettings when morningCommute is set', async () => {
      // beforeEach already set morningCommute via withMorningCommute(). With a
      // commute registered but no ML prediction, the ML slot still shows the
      // placeholder — and its CTA must route to CommuteSettings (not
      // WeeklyPrediction), so the "set up commute" affordance is consistent.
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() =>
        expect(getByTestId('ml-hero-card-placeholder')).toBeTruthy(),
      );

      fireEvent.press(getByTestId('ml-hero-card-placeholder'));
      expect(mockNavigate).toHaveBeenCalledWith('Profile', {
        screen: 'CommuteSettings',
        initial: false,
      });
    });
  });

  // ---------- Delay Alert Banner (lines 305-323) ----------

  // Phase 56: inline DelayAlertBanner removed. Banner itself remains tested
  // in src/components/delays/__tests__.
  describe.skip('Delay Alert Banner', () => {
    beforeEach(() => {
      const { useDelayDetection } = require('@/hooks/useDelayDetection');
      useDelayDetection.mockReturnValue({
        delays: [{ id: 'd1', line: '2호선', message: 'Delay' }],
        loading: false, error: null,
      });
    });

    it('shows delay banner when delays exist', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('delay-banner')).toBeTruthy());
    });

    it('delay press navigates to DelayFeed', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('delay-press')).toBeTruthy());

      fireEvent.press(getByTestId('delay-press'));
      expect(mockNavigate).toHaveBeenCalledWith('DelayFeed');
    });

    it('dismiss hides the banner', async () => {
      const { getByTestId, queryByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('delay-dismiss')).toBeTruthy());

      fireEvent.press(getByTestId('delay-dismiss'));
      await waitFor(() => expect(queryByTestId('delay-banner')).toBeNull());
    });

    it('alt route button shows when station selected', async () => {
      // Load a station so selectedStation is not null
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Station A'))
        .mockResolvedValueOnce(null);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('alt-route-press')).toBeTruthy());

      fireEvent.press(getByTestId('alt-route-press'));
      expect(mockNavigate).toHaveBeenCalledWith('AlternativeRoutes', {
        fromStationId: 'fav-1', toStationId: 'gangnam',
        fromStationName: 'Station A', toStationName: '강남',
      });
    });

    it('no alt route button when no station selected', async () => {
      // No stations loaded
      const { queryByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(queryByTestId('delay-banner')).toBeTruthy());
      expect(queryByTestId('alt-route-press')).toBeNull();
    });
  });

  // ---------- Error Handling (lines 97-99, 125-127, 145-146) ----------

  describe('Error Handling', () => {
    it('shows error toast when initializeScreen fails', async () => {
      mockLocationRequest.mockRejectedValue(new Error('Permission API crash'));

      render(<HomeScreen />);
      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith(
          '데이터를 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.'
        )
      );
    });

    it('silently handles loadFavoriteStations errors', async () => {
      // getStation throws but loadFavoriteStations catches it
      mockGetStation.mockRejectedValue(new Error('Firebase error'));

      const { getByTestId } = render(<HomeScreen />);
      // Should still render without crashing
      await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
    });
  });

  // ---------- Cleanup (lines 246-251) ----------

  describe('Cleanup', () => {
    it('unmounts without errors', async () => {
      const { unmount, getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('home-screen')).toBeTruthy());
      unmount();
    });
  });

  // ---------- Display Name Fallback (line 276) ----------

  describe('Display Name', () => {
    it('shows user display name', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText(/Test User/)).toBeTruthy());
    });

    it('shows "사용자" when displayName is null', async () => {
      const { useAuth } = require('@/services/auth/AuthContext');
      const nullNameAuth = {
        user: createMockUser({ displayName: null }),
        firebaseUser: null, loading: false,
        signInAnonymously: jest.fn(), signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(), signOut: jest.fn(),
        updateUserProfile: jest.fn(), resetPassword: jest.fn(), changePassword: jest.fn(),
      };
      useAuth.mockReturnValue(nullNameAuth);

      // HomeTopBar falls back to "안녕하세요" (no name) when displayName is missing.
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('안녕하세요')).toBeTruthy());
    });
  });

  // ---------- Loading State (lines 255-257) ----------

  describe('Loading State', () => {
    it('shows loading screen while initializing', () => {
      mockLocationRequest.mockReturnValue(new Promise(() => {})); // never resolves
      const { getByTestId } = render(<HomeScreen />);
      expect(getByTestId('loading-screen')).toBeTruthy();
    });
  });

  // ---------- Debug Panel (__DEV__ always true in Jest) ----------

  // Phase 56: LocationDebugPanel removed from HomeScreen.
  describe.skip('Debug Panel', () => {
    it('shows LocationDebugPanel in dev mode', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('debug-panel')).toBeTruthy());
    });
  });
});
