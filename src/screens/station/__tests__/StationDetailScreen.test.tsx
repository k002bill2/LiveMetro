/**
 * StationDetailScreen Test Suite
 * Tests station detail screen rendering and functionality
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import StationDetailScreen from '../StationDetailScreen';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    push: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {
      stationId: 'gangnam',
      stationName: '강남',
      lineId: '2',
    },
  })),
  useFocusEffect: jest.fn((cb) => cb()),
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
      warning: '#FFA500',
      error: '#FF0000',
      errorLight: '#FFE5E5',
      success: '#00FF00',
      black: '#000000',
    },
  })),
  ThemeColors: {},
}));
jest.mock('@/hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(() => ({
    trains: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));
jest.mock('@/hooks/useAdjacentStations', () => ({
  useAdjacentStations: jest.fn(() => ({
    prevStation: null,
    nextStation: null,
    hasPrev: false,
    hasNext: false,
  })),
}));
jest.mock('@/hooks/useCongestion', () => ({
  useCongestion: jest.fn(() => ({
    trainCongestion: null,
    submitReport: jest.fn(),
    submitting: false,
  })),
}));
jest.mock('@/hooks/usePublicData', () => ({
  usePublicDataForStation: jest.fn(() => ({
    accessibility: null,
    exitInfo: [],
    alerts: [],
    loading: false,
  })),
}));
jest.mock('@/hooks/useTrainSchedule', () => ({
  useTrainSchedule: jest.fn(() => ({
    upcomingTrains: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  })),
}));
jest.mock('@/components/congestion/TrainCongestionView', () => ({
  TrainCongestionView: () => null,
}));
jest.mock('@/components/congestion/CongestionReportModal', () => ({
  CongestionReportModal: () => null,
}));
jest.mock('@/components/station/AccessibilitySection', () => ({
  AccessibilitySection: () => null,
}));
jest.mock('@/components/station/ExitInfoSection', () => ({
  ExitInfoSection: () => null,
}));
jest.mock('@/components/common/AlertBanner', () => ({
  AlertBanner: () => null,
}));
jest.mock('react-native-webview', () => ({
  WebView: () => null,
}));

describe('StationDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('강남')).toBeTruthy();
  });

  it('displays station name', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('강남')).toBeTruthy();
  });

  it('displays line badge', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('2')).toBeTruthy();
  });

  it('shows refresh button', () => {
    const { getByLabelText } = render(<StationDetailScreen />);
    expect(getByLabelText('시간 및 도착 정보 새로고침')).toBeTruthy();
  });

  it('displays GPS chip', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('GPS 동기화')).toBeTruthy();
  });

  it('shows empty state when no trains', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('현재 운행 중인 열차가 없습니다')).toBeTruthy();
    expect(getByText('운행 종료 시간대입니다')).toBeTruthy();
  });

  it('displays trains when available', () => {
    (useRealtimeTrains as jest.Mock).mockReturnValue({
      trains: [
        {
          id: 'train1',
          finalDestination: '잠실',
          arrivalTime: new Date(Date.now() + 120000), // 2 minutes from now
          delayMinutes: 0,
          direction: 'up',
        },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('잠실행')).toBeTruthy();
  });

  it('shows loading state', () => {
    (useRealtimeTrains as jest.Mock).mockReturnValue({
      trains: [],
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('열차 정보를 불러오는 중...')).toBeTruthy();
  });

  it('shows error state', () => {
    (useRealtimeTrains as jest.Mock).mockReturnValue({
      trains: [],
      loading: false,
      error: '데이터를 불러올 수 없습니다',
      refetch: jest.fn(),
    });

    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('데이터를 불러올 수 없습니다')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('handles refresh button press', () => {
    const mockRefetch = jest.fn();
    (useRealtimeTrains as jest.Mock).mockReturnValue({
      trains: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { getByLabelText } = render(<StationDetailScreen />);
    const refreshButton = getByLabelText('시간 및 도착 정보 새로고침');
    fireEvent.press(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('displays tab buttons', () => {
    const { getByText } = render(<StationDetailScreen />);
    expect(getByText('출발')).toBeTruthy();
    expect(getByText('도착')).toBeTruthy();
    expect(getByText('시간표')).toBeTruthy();
    expect(getByText('즐겨찾기')).toBeTruthy();
  });

  it('switches tabs on press', () => {
    const { getByText } = render(<StationDetailScreen />);

    fireEvent.press(getByText('도착'));
    expect(getByText('서울 지하철 노선도')).toBeTruthy();
  });
});
