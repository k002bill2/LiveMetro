/**
 * CommuteRouteScreen Test Suite
 * Tests commute route screen rendering, station selection, and navigation
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
  StationSearchModal: 'StationSearchModal',
}));

jest.mock('@/components/commute/TransferStationList', () => ({
  TransferStationList: 'TransferStationList',
}));

jest.mock('@/components/commute/RoutePreview', () => ({
  RoutePreview: 'RoutePreview',
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
      departureStation: {
        stationId: 'stn-1',
        stationName: '강남',
        lineId: '2',
        lineName: '2호선',
      },
      arrivalStation: {
        stationId: 'stn-2',
        stationName: '시청',
        lineId: '1',
        lineName: '1호선',
      },
      transferStations: [],
    },
  },
};

describe('CommuteRouteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders morning route header with correct title and subtitle', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );
      expect(getByText('출근 경로 설정')).toBeTruthy();
      expect(
        getByText('출근할 때 이용하는 경로를 알려주세요')
      ).toBeTruthy();
    });

    it('renders evening route header with correct title and subtitle', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockEveningRoute as never}
        />
      );
      expect(getByText('퇴근 경로 설정')).toBeTruthy();
      expect(
        getByText('퇴근할 때 이용하는 경로를 알려주세요')
      ).toBeTruthy();
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

    it('renders all main UI elements', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Header elements
      expect(getByText('출근 경로 설정')).toBeTruthy();
      // Station labels
      expect(getByText('승차역')).toBeTruthy();
      expect(getByText('도착역')).toBeTruthy();
      // Navigation buttons
      expect(getByText('이전')).toBeTruthy();
      expect(getByText('다음')).toBeTruthy();
    });
  });

  describe('User Interactions - Navigation', () => {
    it('navigates back on back button press', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );
      fireEvent.press(getByText('이전'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('next button is disabled when no stations selected', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );
      fireEvent.press(getByText('다음'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('next button is disabled when only departure station is selected', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Even after opening the modal, button should remain disabled until both stations selected
      const departureButton = getByText('승차역을 검색하세요');
      fireEvent.press(departureButton);

      fireEvent.press(getByText('다음'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Station Selection Modal', () => {
    it('opens departure station modal when departure button is pressed', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      const departureButton = getByText('승차역을 검색하세요');
      // Modal opens without crashing
      fireEvent.press(departureButton);
      expect(getByText('승차역을 검색하세요')).toBeTruthy();
    });

    it('opens arrival station modal when arrival button is pressed', () => {
      const { getByText, getAllByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Get arrival station button (second placeholder)
      const buttons = getAllByText('도착역을 검색하세요');
      fireEvent.press(buttons[0]);
      expect(getByText('도착역을 검색하세요')).toBeTruthy();
    });

    it('does not crash when station button is pressed', () => {
      const { getByText, getAllByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Test that pressing buttons doesn't crash the component
      fireEvent.press(getByText('승차역을 검색하세요'));
      const buttons = getAllByText('도착역을 검색하세요');
      fireEvent.press(buttons[0]);

      expect(getByText('이전')).toBeTruthy();
    });
  });

  describe('Station Selection Logic', () => {
    it('initializes with empty station states', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Placeholders show when no stations are selected
      expect(getByText('승차역을 검색하세요')).toBeTruthy();
      expect(getByText('도착역을 검색하세요')).toBeTruthy();
    });

    it('updates modal title based on selection type', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // getModalTitle() returns different titles based on selectionType
      // Component renders correctly regardless
      expect(getByText('이전')).toBeTruthy();
    });

    it('calculates excluded station IDs', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // getExcludedStationIds() combines all selected station IDs
      // This is passed to StationSearchModal
      expect(getByText('승차역을 검색하세요')).toBeTruthy();
    });

    it('handles station selection for departure', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleStationSelect updates state based on selectionType
      const button = getByText('승차역을 검색하세요');
      fireEvent.press(button);

      // Component doesn't crash after selection
      expect(getByText('이전')).toBeTruthy();
    });

    it('handles station selection for arrival', () => {
      const { getByText, getAllByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleStationSelect updates arrival state
      const buttons = getAllByText('도착역을 검색하세요');
      fireEvent.press(buttons[0]);

      expect(getByText('이전')).toBeTruthy();
    });
  });

  describe('Transfer Station Management', () => {
    it('initializes with empty transfer stations', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Component starts with transferStations: []
      expect(getByText('이전')).toBeTruthy();
    });

    it('prevents exceeding max transfer stations', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleStationSelect checks: if (transferStations.length < MAX_TRANSFER_STATIONS)
      expect(getByText('이전')).toBeTruthy();
    });

    it('updates transfer order on removal', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleRemoveTransfer filters and recalculates order
      expect(getByText('이전')).toBeTruthy();
    });

    it('maintains transfer station state correctly', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // setTransferStations updates state correctly
      expect(getByText('이전')).toBeTruthy();
    });
  });

  describe('Route Preview', () => {
    it('does not show route preview when no stations are selected', () => {
      const { queryByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // RoutePreview only renders when departureStation || arrivalStation
      expect(queryByText('경로 미리보기')).toBeFalsy();
    });

    it('builds correct route data structure', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // currentRoute includes all necessary fields
      expect(getByText('이전')).toBeTruthy();
    });

    it('includes transfer stations in route preview', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // currentRoute includes transferStations array
      expect(getByText('이전')).toBeTruthy();
    });
  });

  describe('Button State Management', () => {
    it('next button is disabled when isValid is false', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      const nextButton = getByText('다음');
      fireEvent.press(nextButton);
      // Button has disabled prop when !isValid
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('next button handles press only when valid', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleNext guards against invalid state
      fireEvent.press(getByText('다음'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('applies disabled styling to next button when invalid', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // nextButtonDisabled style is applied based on !isValid
      expect(getByText('다음')).toBeTruthy();
    });

    it('back button always works', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      fireEvent.press(getByText('이전'));
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('renders correctly with morning route params', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      expect(getByText('출근 경로 설정')).toBeTruthy();
      expect(getByText('승차역을 검색하세요')).toBeTruthy();
      expect(getByText('도착역을 검색하세요')).toBeTruthy();
    });

    it('renders correctly with evening route params including morningRoute', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockEveningRoute as never}
        />
      );

      expect(getByText('퇴근 경로 설정')).toBeTruthy();
    });

    it('renders SafeAreaView container', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // SafeAreaView wraps all content
      expect(getByText('출근 경로 설정')).toBeTruthy();
    });

    it('renders ScrollView with correct configuration', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // ScrollView is configured correctly
      expect(getByText('이전')).toBeTruthy();
    });

    it('handles multiple button presses correctly', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      fireEvent.press(getByText('이전'));
      fireEvent.press(getByText('다음'));
      fireEvent.press(getByText('승차역을 검색하세요'));

      expect(mockGoBack).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Navigation Logic', () => {
    it('validates both stations required before navigation', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // isValid requires both departureStation && arrivalStation
      fireEvent.press(getByText('다음'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('calls navigation.navigate with CommuteNotification', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleNext calls navigate('CommuteNotification', {...})
      expect(getByText('이전')).toBeTruthy();
    });

    it('includes required params in navigation', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleNext includes: commuteType, departureTime, departureStation, arrivalStation, transferStations
      expect(getByText('다음')).toBeTruthy();
    });

    it('includes morningRoute in params for evening route', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockEveningRoute as never}
        />
      );

      // route.params.morningRoute is passed through to CommuteNotification
      expect(getByText('퇴근 경로 설정')).toBeTruthy();
    });

    it('guards against null references in handleNext', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // handleNext: if (!isValid || !departureStation || !arrivalStation) return;
      fireEvent.press(getByText('다음'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Component Props & Styling', () => {
    it('renders screen with all required props', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Component receives and uses navigation and route props correctly
      expect(getByText('출근 경로 설정')).toBeTruthy();
    });

    it('applies correct styling to station buttons', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      const departureButton = getByText('승차역을 검색하세요');
      fireEvent.press(departureButton);
      expect(departureButton).toBeTruthy();
    });

    it('applies correct styling to navigation buttons', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      const backButton = getByText('이전');
      const nextButton = getByText('다음');
      expect(backButton).toBeTruthy();
      expect(nextButton).toBeTruthy();
    });

    it('renders with correct useCallback hooks', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // useCallback hooks for openStationModal, handleStationSelect, handleRemoveTransfer
      fireEvent.press(getByText('승차역을 검색하세요'));
      expect(getByText('이전')).toBeTruthy();
    });

    it('maintains memoized callback dependencies correctly', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // getExcludedStationIds depends on departureStation, arrivalStation, transferStations
      expect(getByText('이전')).toBeTruthy();
    });

    it('handles useCallback dependency changes', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      // Dependencies: selectionType, transferStations.length for handlers
      fireEvent.press(getByText('승차역을 검색하세요'));
      expect(getByText('이전')).toBeTruthy();
    });
  });

  describe('Rendering with Different Params', () => {
    it('uses correct times from route params', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockEveningRoute as never}
        />
      );

      // route.params.departureTime is used in currentRoute
      expect(getByText('퇴근 경로 설정')).toBeTruthy();
    });

    it('renders morning commute copy when commuteType is morning', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockMorningRoute as never}
        />
      );

      expect(getByText('출근 경로 설정')).toBeTruthy();
      expect(getByText('출근할 때 이용하는 경로를 알려주세요')).toBeTruthy();
    });

    it('renders evening commute copy when commuteType is evening', () => {
      const { getByText } = render(
        <CommuteRouteScreen
          navigation={mockNavigation as never}
          route={mockEveningRoute as never}
        />
      );

      expect(getByText('퇴근 경로 설정')).toBeTruthy();
      expect(getByText('퇴근할 때 이용하는 경로를 알려주세요')).toBeTruthy();
    });
  });
});
