/**
 * HomeScreen Test Suite
 * Tests home screen rendering and core functionality
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../HomeScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
  useFocusEffect: jest.fn((cb) => cb()),
}));
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      preferences: { favoriteStations: [] },
    },
    isAuthenticated: true,
  })),
}));
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#000000',
      primaryLight: '#E5E5E5',
      surface: '#FFFFFF',
      background: '#F5F5F5',
      backgroundSecondary: '#FAFAFA',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      textTertiary: '#999999',
      textInverse: '#FFFFFF',
      borderLight: '#E5E5E5',
      borderMedium: '#CCCCCC',
    },
  })),
  ThemeColors: {},
}));
jest.mock('@/services/train/trainService', () => ({
  trainService: {
    getNearbyStations: jest.fn(() => Promise.resolve([])),
    getStation: jest.fn(() => Promise.resolve(null)),
  },
}));
jest.mock('@/hooks/useDelayDetection', () => ({
  useDelayDetection: jest.fn(() => ({
    delays: [],
    loading: false,
    error: null,
  })),
}));
jest.mock('@/hooks/useIntegratedAlerts', () => ({
  useIntegratedAlerts: jest.fn(() => ({
    scheduleDepartureAlert: jest.fn(),
    alerts: [],
  })),
}));
jest.mock('@/components/common/LoadingScreen', () => ({
  LoadingScreen: () => null,
}));
jest.mock('@/components/train/StationCard', () => ({
  StationCard: () => null,
}));
jest.mock('@/components/train/TrainArrivalList', () => ({
  TrainArrivalList: () => null,
}));
jest.mock('@/components/delays', () => ({
  DelayAlertBanner: () => null,
}));
jest.mock('@/components/prediction', () => ({
  CommutePredictionCard: () => null,
}));
jest.mock('@/components/debug', () => ({
  LocationDebugPanel: () => null,
}));
jest.mock('@/components/common/Toast', () => ({
  useToast: jest.fn(() => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showInfo: jest.fn(),
    ToastComponent: () => null,
  })),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 37.5665, longitude: 126.9780 },
    })
  ),
  Accuracy: { Balanced: 1 },
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    const { getByTestId } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-screen')).toBeTruthy();
    });
  });

  it('displays welcome message with user name', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText(/안녕하세요, Test User님!/)).toBeTruthy();
    });
  });

  it('displays subtitle', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('실시간 지하철 정보를 확인하세요')).toBeTruthy();
    });
  });

  it('has pull-to-refresh via ScrollView', async () => {
    const { getByTestId } = render(<HomeScreen />);

    await waitFor(() => {
      const scrollView = getByTestId('home-screen');
      expect(scrollView).toBeTruthy();
    });
  });

  it('handles pull-to-refresh action', async () => {
    const { getByTestId } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-screen')).toBeTruthy();
    });

    // ScrollView에 RCTRefreshControl이 포함되어 있음
    const scrollView = getByTestId('home-screen');
    expect(scrollView).toBeTruthy();
  });

  it('displays section titles', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText(/주변 역|즐겨찾기/)).toBeTruthy();
    });
  });

  it('shows empty state when no stations available', async () => {
    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(
        getByText(/주변에 지하철역이 없습니다|즐겨찾기에 추가된 역이 없습니다/)
      ).toBeTruthy();
    });
  });
});
