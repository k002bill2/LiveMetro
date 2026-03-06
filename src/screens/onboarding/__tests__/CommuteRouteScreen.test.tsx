/**
 * CommuteRouteScreen Test Suite
 * Tests commute route screen rendering and station selection UI
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteRouteScreen } from '../CommuteRouteScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  GitBranch: 'GitBranch',
  MapPin: 'MapPin',
  Flag: 'Flag',
  ChevronRight: 'ChevronRight',
  Search: 'Search',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));
jest.mock('@/components/commute/StationSearchModal', () => ({
  StationSearchModal: ({ visible }: { visible: boolean }) =>
    visible ? 'StationSearchModal' : null,
}));
jest.mock('@/components/commute/TransferStationList', () => ({
  TransferStationList: () => 'TransferStationList',
}));
jest.mock('@/components/commute/RoutePreview', () => ({
  RoutePreview: () => 'RoutePreview',
}));
jest.mock('@/models/commute', () => ({
  MAX_TRANSFER_STATIONS: 3,
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown;

const mockMorningRoute = {
  params: {
    commuteType: 'morning' as const,
    departureTime: '08:30',
  },
};

const mockEveningRoute = {
  params: {
    commuteType: 'evening' as const,
    departureTime: '18:00',
    morningRoute: {
      departureTime: '08:30',
      departureStation: { stationId: 'stn-1', stationName: '강남', lineId: '2', lineName: '2호선' },
      arrivalStation: { stationId: 'stn-2', stationName: '시청', lineId: '1', lineName: '1호선' },
      transferStations: [],
    },
  },
};

describe('CommuteRouteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders morning route header', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );
    expect(getByText('출근 경로 설정')).toBeTruthy();
    expect(getByText('출근할 때 이용하는 경로를 알려주세요')).toBeTruthy();
  });

  it('renders evening route header', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockEveningRoute as never}
      />
    );
    expect(getByText('퇴근 경로 설정')).toBeTruthy();
    expect(getByText('퇴근할 때 이용하는 경로를 알려주세요')).toBeTruthy();
  });

  it('shows station selection placeholders', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );
    expect(getByText('승차역을 검색하세요')).toBeTruthy();
    expect(getByText('도착역을 검색하세요')).toBeTruthy();
  });

  it('shows station labels', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );
    expect(getByText('승차역')).toBeTruthy();
    expect(getByText('도착역')).toBeTruthy();
  });

  it('shows back and next buttons', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );
    expect(getByText('이전')).toBeTruthy();
    expect(getByText('다음')).toBeTruthy();
  });

  it('navigates back on back button press', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );
    fireEvent.press(getByText('이전'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('next button is disabled when no stations selected', () => {
    const { getByText } = render(
      <CommuteRouteScreen
        navigation={mockNavigation as never}
        route={mockMorningRoute as never}
      />
    );
    // The next button should be rendered but pressing it should not navigate
    fireEvent.press(getByText('다음'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
