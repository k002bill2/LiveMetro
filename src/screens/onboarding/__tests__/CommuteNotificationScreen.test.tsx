/**
 * CommuteNotificationScreen Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommuteNotificationScreen } from '../CommuteNotificationScreen';

jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_, name) => name })
);

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
  it('renders morning notification screen', () => {
    const { getByText } = render(<CommuteNotificationScreen {...createProps()} />);
    expect(getByText('출근 알림 설정')).toBeTruthy();
    expect(getByText('퇴근 설정하기')).toBeTruthy();
  });

  it('renders evening notification screen', () => {
    const props = createProps({
      commuteType: 'evening',
      morningRoute: { ...baseParams, notifications: undefined },
    });
    const { getByText } = render(<CommuteNotificationScreen {...props} />);
    expect(getByText('퇴근 알림 설정')).toBeTruthy();
    expect(getByText('완료')).toBeTruthy();
  });

  it('shows transfer alert setting when transfers exist', () => {
    const props = createProps({
      transferStations: [
        { stationId: 't1', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
      ],
    });
    const { getByText } = render(<CommuteNotificationScreen {...props} />);
    expect(getByText('환승역 미리알림')).toBeTruthy();
  });

  it('hides transfer alert setting when no transfers', () => {
    const { queryByText } = render(<CommuteNotificationScreen {...createProps()} />);
    expect(queryByText('환승역 미리알림')).toBeNull();
  });

  it('navigates back on back button press', () => {
    const props = createProps();
    const { getByText } = render(<CommuteNotificationScreen {...props} />);
    fireEvent.press(getByText('이전'));
    expect(props.navigation.goBack).toHaveBeenCalled();
  });

  it('navigates to evening setup on morning next press', () => {
    const props = createProps();
    const { getByText } = render(<CommuteNotificationScreen {...props} />);
    fireEvent.press(getByText('퇴근 설정하기'));
    expect(props.navigation.navigate).toHaveBeenCalledWith(
      'CommuteTime',
      expect.objectContaining({ commuteType: 'evening' })
    );
  });
});
