/**
 * StationNavigatorScreen Test Suite
 * Tests station navigator screen rendering, loading, error, and navigation
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render } from '@testing-library/react-native';
import { StationNavigatorScreen } from '../StationNavigatorScreen';
import { useStationNavigation } from '@/hooks/useStationNavigation';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  Minus: 'Minus',
  ChevronRight: 'ChevronRight',
  AlertCircle: 'AlertCircle',
  ArrowLeft: 'ArrowLeft',
  RefreshCw: 'RefreshCw',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Flag: 'Flag',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {
      stationId: 'gangnam',
      lineId: '2',
      mode: 'browse',
    },
  })),
}));

const mockRefresh = jest.fn(() => Promise.resolve());
const mockGoToPrevious = jest.fn();
const mockGoToNext = jest.fn();
const mockRefreshTrains = jest.fn(() => Promise.resolve());

const defaultStationNavigationReturn = {
  currentStation: {
    id: 'gangnam',
    name: '강남',
    nameEn: 'Gangnam',
    lineId: '2',
    transfers: [],
  },
  previousStation: {
    id: 'yeoksam',
    name: '역삼',
    nameEn: 'Yeoksam',
    lineId: '2',
    transfers: [],
  },
  nextStation: {
    id: 'seolleung',
    name: '선릉',
    nameEn: 'Seolleung',
    lineId: '2',
    transfers: [],
  },
  currentIndex: 1,
  allStations: [
    { id: 'yeoksam', name: '역삼', lineId: '2', transfers: [] },
    { id: 'gangnam', name: '강남', lineId: '2', transfers: [] },
    { id: 'seolleung', name: '선릉', lineId: '2', transfers: [] },
  ],
  loading: false,
  error: null,
  goToPrevious: mockGoToPrevious,
  goToNext: mockGoToNext,
  refresh: mockRefresh,
};

jest.mock('@/hooks/useStationNavigation', () => ({
  useStationNavigation: jest.fn(() => defaultStationNavigationReturn),
}));
jest.mock('@/hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(() => ({
    loading: false,
    refetch: mockRefreshTrains,
  })),
}));
jest.mock('@/components/train/TrainArrivalList', () => ({
  TrainArrivalList: () => 'TrainArrivalList',
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown;

const mockRouteParams = {
  params: {
    stationId: 'gangnam',
    lineId: '2',
    mode: 'browse' as const,
  },
};

describe('StationNavigatorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to default state for each test
    (useStationNavigation as jest.Mock).mockReturnValue(
      defaultStationNavigationReturn
    );
  });

  it('renders current station name in header', () => {
    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('Line 2')).toBeTruthy();
    expect(getByText('2 of 3')).toBeTruthy();
  });

  it('renders current station label', () => {
    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('Current Station')).toBeTruthy();
  });

  it('shows previous and next section labels in browse mode', () => {
    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('Previous')).toBeTruthy();
    expect(getByText('Next')).toBeTruthy();
  });

  it('renders station names including in chips list', () => {
    const { getAllByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    // Station names appear in station cards AND in the full route chips
    expect(getAllByText('강남').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('역삼').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('선릉').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading state', () => {
    (useStationNavigation as jest.Mock).mockReturnValue({
      currentStation: null,
      previousStation: null,
      nextStation: null,
      currentIndex: -1,
      allStations: [],
      loading: true,
      error: null,
      goToPrevious: mockGoToPrevious,
      goToNext: mockGoToNext,
      refresh: mockRefresh,
    });

    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('역 정보 로딩중')).toBeTruthy();
  });

  it('shows error state with retry button', () => {
    (useStationNavigation as jest.Mock).mockReturnValue({
      currentStation: null,
      previousStation: null,
      nextStation: null,
      currentIndex: -1,
      allStations: [],
      loading: false,
      error: '네트워크 오류',
      goToPrevious: mockGoToPrevious,
      goToNext: mockGoToNext,
      refresh: mockRefresh,
    });

    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('네트워크 오류')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('shows full route label and realtime arrivals', () => {
    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('전체 경로')).toBeTruthy();
    expect(getByText('실시간 도착')).toBeTruthy();
  });

  it('shows English station name', () => {
    const { getByText } = render(
      <StationNavigatorScreen
        navigation={mockNavigation as never}
        route={mockRouteParams as never}
      />
    );
    expect(getByText('Gangnam')).toBeTruthy();
  });
});
