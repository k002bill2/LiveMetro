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

jest.mock('lucide-react-native', () => ({
  CloudOff: () => null, MapPin: () => null, ChevronRight: () => null,
  TrainFront: () => null, RefreshCw: () => null,
}));

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
  SPACING: { sm: 4, md: 8, lg: 16, xl: 24, '2xl': 32 },
  RADIUS: { sm: 4, md: 8, lg: 12, full: 999 },
  TYPOGRAPHY: {
    fontSize: { sm: 12, base: 14, lg: 16, xl: 18, '2xl': 24 },
    fontWeight: { normal: '400', semibold: '600', bold: '700' },
    letterSpacing: { tight: -0.5 },
    lineHeight: { relaxed: 1.5 },
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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('shows subtitle', async () => {
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('실시간 지하철 정보를 확인하세요')).toBeTruthy());
    });

    it('shows CommutePredictionCard and Toast', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => {
        expect(getByTestId('prediction-card')).toBeTruthy();
        expect(getByTestId('toast')).toBeTruthy();
      });
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
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('즐겨찾기에 추가된 역이 없습니다')).toBeTruthy());
    });

    it('shows empty state with permission granted but no nearby stations', async () => {
      mockLocationRequest.mockResolvedValue({ status: 'granted' });
      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('주변에 지하철역이 없습니다')).toBeTruthy());
    });

    it('shows nearby stations from hook when permission granted', async () => {
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

  describe('Location Permission', () => {
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
    it('loads favorite stations via getStation when permission denied', async () => {
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

    it('auto-selects first favorite and shows TrainArrivalList', async () => {
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Fav A'))
        .mockResolvedValueOnce(null);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('train-arrival-list-fav-1')).toBeTruthy());
    });

    it('shows detail button and refresh button for selected station', async () => {
      mockGetStation.mockResolvedValueOnce(mockStation('fav-1', 'Fav A')).mockResolvedValueOnce(null);

      const { getByText, getByTestId } = render(<HomeScreen />);
      await waitFor(() => {
        expect(getByText('상세보기')).toBeTruthy();
        expect(getByTestId('refresh-button')).toBeTruthy();
      });
    });

    it('shows station name in real-time info header', async () => {
      mockGetStation.mockResolvedValueOnce(mockStation('fav-1', 'My Fav')).mockResolvedValueOnce(null);

      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('My Fav 실시간 정보')).toBeTruthy());
    });

    it('handles getStation returning null for all favorites', async () => {
      mockGetStation.mockResolvedValue(null);

      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('즐겨찾기에 추가된 역이 없습니다')).toBeTruthy());
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

      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText('즐겨찾기에 추가된 역이 없습니다')).toBeTruthy());
    });
  });

  // ---------- Station Interactions (lines 152-173) ----------

  describe('Station Interactions', () => {
    beforeEach(() => {
      mockGetStation
        .mockResolvedValueOnce(mockStation('fav-1', 'Station A'))
        .mockResolvedValueOnce(null);
    });

    it('onStationSelect navigates to StationNavigator', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('station-card-fav-1')).toBeTruthy());

      fireEvent.press(getByTestId('station-card-fav-1'));
      expect(mockNavigate).toHaveBeenCalledWith('StationNavigator', {
        stationId: 'fav-1', lineId: 'line-2',
      });
    });

    it('handleSetStart navigates with departure mode', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('set-start-fav-1')).toBeTruthy());

      fireEvent.press(getByTestId('set-start-fav-1'));
      expect(mockNavigate).toHaveBeenCalledWith('StationNavigator', {
        stationId: 'fav-1', lineId: 'line-2', mode: 'departure',
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

  describe('Refresh', () => {
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
    it('schedule alert calls scheduleDepartureAlert(15)', async () => {
      mockScheduleDepartureAlert.mockResolvedValue({ alertTime: '08:00' });

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('schedule-alert-btn')).toBeTruthy());

      fireEvent.press(getByTestId('schedule-alert-btn'));
      await waitFor(() => expect(mockScheduleDepartureAlert).toHaveBeenCalledWith(15));
    });

    it('shows success toast when alert scheduled', async () => {
      mockScheduleDepartureAlert.mockResolvedValue({ alertTime: '08:00' });

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('schedule-alert-btn')).toBeTruthy());

      fireEvent.press(getByTestId('schedule-alert-btn'));
      await waitFor(() =>
        expect(mockShowSuccess).toHaveBeenCalledWith('08:00에 출발 알림이 예약되었습니다')
      );
    });

    it('does not show toast when alert returns null', async () => {
      mockScheduleDepartureAlert.mockResolvedValue(null);

      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('schedule-alert-btn')).toBeTruthy());

      fireEvent.press(getByTestId('schedule-alert-btn'));
      await waitFor(() => expect(mockScheduleDepartureAlert).toHaveBeenCalled());
      expect(mockShowSuccess).not.toHaveBeenCalled();
    });

    it('view details navigates to WeeklyPrediction', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('view-details-btn')).toBeTruthy());

      fireEvent.press(getByTestId('view-details-btn'));
      expect(mockNavigate).toHaveBeenCalledWith('WeeklyPrediction');
    });
  });

  // ---------- Delay Alert Banner (lines 305-323) ----------

  describe('Delay Alert Banner', () => {
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

      const { getByText } = render(<HomeScreen />);
      await waitFor(() => expect(getByText(/사용자님/)).toBeTruthy());
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

  describe('Debug Panel', () => {
    it('shows LocationDebugPanel in dev mode', async () => {
      const { getByTestId } = render(<HomeScreen />);
      await waitFor(() => expect(getByTestId('debug-panel')).toBeTruthy());
    });
  });
});
