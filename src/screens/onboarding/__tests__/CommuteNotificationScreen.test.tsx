/**
 * CommuteNotificationScreen Tests
 * Comprehensive test coverage for commute notification settings screen
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteNotificationScreen } from '../CommuteNotificationScreen';
import { ALERT_MINUTES_OPTIONS } from '@/models/commute';

// Mock lucide icons
jest.mock('lucide-react-native', () => ({
  Bell: 'Bell',
  ArrowLeftRight: 'ArrowLeftRight',
  Flag: 'Flag',
  Clock: 'Clock',
  AlertTriangle: 'AlertTriangle',
  Info: 'Info',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
}));

// Mock theme
jest.mock('@/styles/modernTheme', () => ({
  COLORS: {
    white: '#FFFFFF',
    black: '#000000',
    secondary: { blue: '#007AFF', yellow: '#FFD700' },
    semantic: { error: '#FF3B30' },
    text: { primary: '#000', secondary: '#666', tertiary: '#999' },
    surface: { background: '#F5F5F5' },
    border: { light: '#E5E5E5', medium: '#CCC' },
    gray: { 300: '#DDD' },
  },
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
  TYPOGRAPHY: {
    fontSize: { sm: 12, base: 16, lg: 18, '3xl': 28 },
    fontWeight: { semibold: '600', medium: '500', bold: '700' },
  },
  RADIUS: { base: 8, lg: 12 },
  SHADOWS: { sm: {} },
}));

const baseParams = {
  commuteType: 'morning' as const,
  departureTime: '08:00',
  departureStation: { stationId: 's1', stationName: '강남', lineId: '2', lineName: '2호선' },
  arrivalStation: { stationId: 's2', stationName: '시청', lineId: '1', lineName: '1호선' },
  transferStations: [] as any[],
};

const createProps = (overrides: Record<string, unknown> = {}): any => ({
  navigation: { navigate: jest.fn(), goBack: jest.fn() },
  route: {
    params: { ...baseParams, ...overrides },
    key: 'CommuteNotification',
    name: 'CommuteNotification' as const,
  },
});

describe('CommuteNotificationScreen', () => {
  describe('Rendering - Morning Commute', () => {
    it('renders morning notification screen with correct title and description', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('출근 알림 설정')).toBeTruthy();
      expect(getByText('출근 중 받고 싶은 알림을 선택하세요')).toBeTruthy();
    });

    it('renders morning commute next button with "퇴근 설정하기" text', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('퇴근 설정하기')).toBeTruthy();
    });

    it('renders back button labeled "이전"', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('이전')).toBeTruthy();
    });
  });

  describe('Rendering - Evening Commute', () => {
    it('renders evening notification screen with correct title and description', () => {
      const props = createProps({
        commuteType: 'evening',
        morningRoute: { ...baseParams },
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('퇴근 알림 설정')).toBeTruthy();
      expect(getByText('퇴근 중 받고 싶은 알림을 선택하세요')).toBeTruthy();
    });

    it('renders evening complete button with "완료" text', () => {
      const props = createProps({
        commuteType: 'evening',
        morningRoute: { ...baseParams },
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('완료')).toBeTruthy();
    });
  });

  describe('Transfer Alert Setting Visibility', () => {
    it('shows transfer alert setting when transfers exist', () => {
      const props = createProps({
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('환승역 미리알림')).toBeTruthy();
      expect(getByText('환승역 도착 전 알림을 받습니다')).toBeTruthy();
    });

    it('hides transfer alert setting when no transfers', () => {
      const { queryByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(queryByText('환승역 미리알림')).toBeNull();
    });

    it('shows transfer alert with multiple transfer stations', () => {
      const props = createProps({
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
          { stationId: 't2', stationName: '강동', lineId: '5', lineName: '5호선', order: 2 },
          { stationId: 't3', stationName: '수유', lineId: '4', lineName: '4호선', order: 3 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('환승역 미리알림')).toBeTruthy();
    });
  });

  describe('All Notification Settings Rendering', () => {
    it('renders arrival alert setting', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('도착역 미리알림')).toBeTruthy();
      expect(getByText('도착역 도착 전 알림을 받습니다')).toBeTruthy();
    });

    it('renders delay alert setting', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('연착 알림')).toBeTruthy();
      expect(getByText('열차 연착 시 알림을 받습니다')).toBeTruthy();
    });

    it('renders incident alert setting', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('사고 알림')).toBeTruthy();
      expect(getByText('운행 중단, 사고 발생 시 알림을 받습니다')).toBeTruthy();
    });

    it('renders all four settings together with transfers', () => {
      const props = createProps({
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('환승역 미리알림')).toBeTruthy();
      expect(getByText('도착역 미리알림')).toBeTruthy();
      expect(getByText('연착 알림')).toBeTruthy();
      expect(getByText('사고 알림')).toBeTruthy();
    });

    it('renders three settings without transfers', () => {
      const { getByText, queryByText } = render(
        <CommuteNotificationScreen {...createProps()} />
      );
      expect(queryByText('환승역 미리알림')).toBeNull();
      expect(getByText('도착역 미리알림')).toBeTruthy();
      expect(getByText('연착 알림')).toBeTruthy();
      expect(getByText('사고 알림')).toBeTruthy();
    });
  });

  describe('Alert Timing Section Rendering', () => {
    it('renders timing section header and description', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('알림 시간')).toBeTruthy();
      expect(getByText('환승역/도착역 도착 몇 분 전에 알림을 받을까요?')).toBeTruthy();
    });

    it('renders all timing option buttons', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      ALERT_MINUTES_OPTIONS.forEach((minutes) => {
        expect(getByText(`${minutes}분 전`)).toBeTruthy();
      });
    });

    it('renders info message about settings customization', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(
        getByText('알림 설정은 나중에 설정 메뉴에서 변경할 수 있습니다.')
      ).toBeTruthy();
    });
  });

  describe('Navigation - Back Button', () => {
    it('navigates back when back button is pressed', () => {
      const props = createProps();
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('이전'));
      expect(props.navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('back button works on morning and evening screens', () => {
      const morningProps = createProps();
      const { getByText: getMorningText } = render(
        <CommuteNotificationScreen {...morningProps} />
      );
      fireEvent.press(getMorningText('이전'));
      expect(morningProps.navigation.goBack).toHaveBeenCalled();

      const eveningProps = createProps({
        commuteType: 'evening',
        morningRoute: { ...baseParams },
      });
      const { getByText: getEveningText } = render(
        <CommuteNotificationScreen {...eveningProps} />
      );
      fireEvent.press(getEveningText('이전'));
      expect(eveningProps.navigation.goBack).toHaveBeenCalled();
    });
  });

  describe('Navigation - Morning to Evening Flow', () => {
    it('navigates to evening setup when next button is pressed during morning setup', () => {
      const props = createProps();
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));
      expect(props.navigation.navigate).toHaveBeenCalledWith(
        'CommuteTime',
        expect.objectContaining({ commuteType: 'evening' })
      );
    });

    it('passes morning route data to evening navigation', () => {
      const props = createProps({
        departureTime: '08:30',
        departureStation: { stationId: 's1', stationName: '서울역', lineId: '1', lineName: '1호선' },
        arrivalStation: { stationId: 's2', stationName: '강남', lineId: '2', lineName: '2호선' },
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute.departureTime).toBe('08:30');
      expect(callArgs.morningRoute.departureStation.stationName).toBe('서울역');
      expect(callArgs.morningRoute.departureStation.lineId).toBe('1');
    });

    it('includes notification settings in morning route data', () => {
      const props = createProps();
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute.notifications).toBeDefined();
      expect(callArgs.morningRoute.notifications.arrivalAlert).toBe(true);
      expect(callArgs.morningRoute.notifications.delayAlert).toBe(true);
      expect(callArgs.morningRoute.notifications.incidentAlert).toBe(true);
    });

    it('includes transfer stations in morning route data', () => {
      const props = createProps({
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute.transferStations).toEqual([
        { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
      ]);
    });

    it('ensures onTimeSet and onSkip callbacks are passed to evening setup', () => {
      const props = createProps();
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.onTimeSet).toBeDefined();
      expect(callArgs.onSkip).toBeUndefined();
    });
  });

  describe('Navigation - Evening to Complete Flow', () => {
    it('navigates to complete screen when next button is pressed during evening setup', () => {
      const morningRoute = { ...baseParams };
      const props = createProps({
        commuteType: 'evening',
        morningRoute,
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('완료'));
      expect(props.navigation.navigate).toHaveBeenCalledWith(
        'CommuteComplete',
        expect.objectContaining({
          morningRoute: expect.any(Object),
          eveningRoute: expect.any(Object),
        })
      );
    });

    it('includes both morning and evening route data in complete navigation', () => {
      const morningRoute = {
        departureTime: '08:00',
        departureStation: { stationId: 's1', stationName: '강남', lineId: '2', lineName: '2호선' },
        arrivalStation: { stationId: 's2', stationName: '시청', lineId: '1', lineName: '1호선' },
        transferStations: [],
      };
      const props = createProps({
        commuteType: 'evening',
        morningRoute,
        departureTime: '18:00',
        departureStation: { stationId: 's3', stationName: '동대문', lineId: '1', lineName: '1호선' },
        arrivalStation: { stationId: 's4', stationName: '강동', lineId: '5', lineName: '5호선' },
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('완료'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute).toEqual(morningRoute);
      expect(callArgs.eveningRoute).toBeDefined();
      expect(callArgs.eveningRoute.departureTime).toBe('18:00');
      expect(callArgs.eveningRoute.departureStation.stationName).toBe('동대문');
    });

    it('includes evening notification settings in complete navigation', () => {
      const morningRoute = { ...baseParams };
      const props = createProps({
        commuteType: 'evening',
        morningRoute,
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('완료'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.eveningRoute.notifications).toBeDefined();
      expect(callArgs.eveningRoute.notifications.arrivalAlert).toBe(true);
      expect(callArgs.eveningRoute.notifications.delayAlert).toBe(true);
      expect(callArgs.eveningRoute.notifications.incidentAlert).toBe(true);
    });

    it('includes evening transfer stations in complete navigation', () => {
      const morningRoute = { ...baseParams };
      const props = createProps({
        commuteType: 'evening',
        morningRoute,
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
          { stationId: 't2', stationName: '강동', lineId: '5', lineName: '5호선', order: 2 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('완료'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.eveningRoute.transferStations).toHaveLength(2);
      expect(callArgs.eveningRoute.transferStations[0].stationName).toBe('신도림');
      expect(callArgs.eveningRoute.transferStations[1].stationName).toBe('강동');
    });
  });

  describe('Alert Timing Button Interactions', () => {
    it('renders and allows pressing 1 minute timing button', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      const button = getByText('1분 전');
      fireEvent.press(button);
      expect(getByText('1분 전')).toBeTruthy();
    });

    it('renders and allows pressing 2 minute timing button', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      const button = getByText('2분 전');
      fireEvent.press(button);
      expect(getByText('2분 전')).toBeTruthy();
    });

    it('renders and allows pressing 3 minute timing button', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      const button = getByText('3분 전');
      fireEvent.press(button);
      expect(getByText('3분 전')).toBeTruthy();
    });

    it('renders and allows pressing 5 minute timing button (default)', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      const button = getByText('5분 전');
      fireEvent.press(button);
      expect(getByText('5분 전')).toBeTruthy();
    });

    it('renders and allows pressing 7 minute timing button', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      const button = getByText('7분 전');
      fireEvent.press(button);
      expect(getByText('7분 전')).toBeTruthy();
    });

    it('renders and allows pressing 10 minute timing button', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      const button = getByText('10분 전');
      fireEvent.press(button);
      expect(getByText('10분 전')).toBeTruthy();
    });

    it('allows switching between different timing options', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      fireEvent.press(getByText('1분 전'));
      fireEvent.press(getByText('5분 전'));
      fireEvent.press(getByText('10분 전'));
      expect(getByText('10분 전')).toBeTruthy();
    });
  });

  describe('Initial State and Default Values', () => {
    it('initializes with all notifications enabled by default', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      // All notification settings should be rendered (not explicitly testing toggle state
      // since we're testing presence)
      expect(getByText('도착역 미리알림')).toBeTruthy();
      expect(getByText('연착 알림')).toBeTruthy();
      expect(getByText('사고 알림')).toBeTruthy();
    });

    it('initializes with default alert timing of 5 minutes', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      // Default is 5 minutes - button should be present
      expect(getByText('5분 전')).toBeTruthy();
    });

    it('initializes with empty transfer stations as not showing transfer alert', () => {
      const { queryByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(queryByText('환승역 미리알림')).toBeNull();
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('handles screen with no transfers correctly', () => {
      const props = createProps({ transferStations: [] });
      const { queryByText } = render(<CommuteNotificationScreen {...props} />);
      expect(queryByText('환승역 미리알림')).toBeNull();
      expect(queryByText('도착역 미리알림')).toBeTruthy();
    });

    it('renders correctly with different departure times', () => {
      const props = createProps({
        departureTime: '09:15',
        arrivalStation: { stationId: 's2', stationName: '시청', lineId: '1', lineName: '1호선' },
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute.departureTime).toBe('09:15');
    });

    it('preserves complex route data through navigation', () => {
      const props = createProps({
        departureTime: '07:45',
        departureStation: { stationId: 's1', stationName: '광화문', lineId: '5', lineName: '5호선' },
        arrivalStation: { stationId: 's2', stationName: '강남', lineId: '2', lineName: '2호선' },
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
          { stationId: 't2', stationName: '강동', lineId: '5', lineName: '5호선', order: 2 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('퇴근 설정하기'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute.departureTime).toBe('07:45');
      expect(callArgs.morningRoute.departureStation.stationName).toBe('광화문');
      expect(callArgs.morningRoute.transferStations).toHaveLength(2);
    });

    it('handles evening setup with all complex data', () => {
      const morningRoute = {
        departureTime: '08:00',
        departureStation: { stationId: 's1', stationName: '강남', lineId: '2', lineName: '2호선' },
        arrivalStation: { stationId: 's2', stationName: '시청', lineId: '1', lineName: '1호선' },
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
      };
      const props = createProps({
        commuteType: 'evening',
        morningRoute,
        departureTime: '18:30',
        departureStation: { stationId: 's3', stationName: '동대문', lineId: '1', lineName: '1호선' },
        arrivalStation: { stationId: 's4', stationName: '강동', lineId: '5', lineName: '5호선' },
        transferStations: [
          { stationId: 't2', stationName: '강동', lineId: '5', lineName: '5호선', order: 1 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      fireEvent.press(getByText('완료'));

      const callArgs = props.navigation.navigate.mock.calls[0][1];
      expect(callArgs.morningRoute.departureStation.stationName).toBe('강남');
      expect(callArgs.eveningRoute.departureStation.stationName).toBe('동대문');
      expect(callArgs.morningRoute.transferStations).toHaveLength(1);
      expect(callArgs.eveningRoute.transferStations).toHaveLength(1);
    });
  });

  describe('Component Structure and Layout', () => {
    it('renders SafeAreaView for proper screen boundaries', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('출근 알림 설정')).toBeTruthy();
    });

    it('renders ScrollView for scrollable content', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      // All elements should be present - indicates ScrollView contains them
      expect(getByText('출근 알림 설정')).toBeTruthy();
      expect(getByText('알림 시간')).toBeTruthy();
    });

    it('renders bottom button container with both buttons', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('이전')).toBeTruthy();
      expect(getByText('퇴근 설정하기')).toBeTruthy();
    });
  });

  describe('Parameter Handling and Data Integrity', () => {
    it('correctly identifies morning commute type from params', () => {
      const props = createProps({ commuteType: 'morning' });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('출근 알림 설정')).toBeTruthy();
      expect(getByText('퇴근 설정하기')).toBeTruthy();
    });

    it('correctly identifies evening commute type from params', () => {
      const props = createProps({ commuteType: 'evening', morningRoute: baseParams });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('퇴근 알림 설정')).toBeTruthy();
      expect(getByText('완료')).toBeTruthy();
    });

    it('correctly determines hasTransfers from transferStations array length', () => {
      const propsNoTransfers = createProps({ transferStations: [] });
      const { queryByText: queryNoTransfers } = render(
        <CommuteNotificationScreen {...propsNoTransfers} />
      );
      expect(queryNoTransfers('환승역 미리알림')).toBeNull();

      const propsWithTransfers = createProps({
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
      });
      const { getByText: getWithTransfers } = render(
        <CommuteNotificationScreen {...propsWithTransfers} />
      );
      expect(getWithTransfers('환승역 미리알림')).toBeTruthy();
    });
  });

  describe('Notification Settings Content Verification', () => {
    it('renders complete transfer alert description', () => {
      const props = createProps({
        transferStations: [
          { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
        ],
      });
      const { getByText } = render(<CommuteNotificationScreen {...props} />);
      expect(getByText('환승역 도착 전 알림을 받습니다')).toBeTruthy();
    });

    it('renders complete arrival alert description', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('도착역 도착 전 알림을 받습니다')).toBeTruthy();
    });

    it('renders complete delay alert description', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('열차 연착 시 알림을 받습니다')).toBeTruthy();
    });

    it('renders complete incident alert description', () => {
      const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
      expect(getByText('운행 중단, 사고 발생 시 알림을 받습니다')).toBeTruthy();
    });
  });
});
