/**
 * RouteGuidanceScreen — orchestration tests. Presentational details are
 * covered in src/components/guidance/__tests__; here we verify session
 * loading, manual correction flow, live-wait wiring, and exit cleanup.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import RouteGuidanceScreen from '../RouteGuidanceScreen';
import { useRealtimeTrains } from '@/hooks/useRealtimeTrains';
import {
  setGuidanceSession,
  clearGuidanceSession,
  getGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import { createRoute, type RouteSegment } from '@/models/route';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    canGoBack: jest.fn(() => true),
  })),
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  DoorOpen: 'DoorOpen',
  Flag: 'Flag',
  Footprints: 'Footprints',
  MapPin: 'MapPin',
  MoveRight: 'MoveRight',
  Square: 'Square',
  TrainFront: 'TrainFront',
}));

jest.mock('@/components/design/LineBadge', () => ({
  LineBadge: () => null,
}));

jest.mock('@/utils/subwayMapData', () => ({
  LINE_STATIONS: { '2': [['s1', 's2', 's3']] },
  STATIONS: {
    s1: { name: '을지로3가' },
    s2: { name: '시청' },
    s3: { name: '산곡' },
  },
}));

const mockedUseRealtimeTrains = useRealtimeTrains as jest.Mock;

const hop = (
  fromId: string,
  fromName: string,
  toId: string,
  toName: string,
  minutes: number
): RouteSegment => ({
  fromStationId: fromId,
  fromStationName: fromName,
  toStationId: toId,
  toStationName: toName,
  lineId: '2',
  lineName: '2호선',
  estimatedMinutes: minutes,
  isTransfer: false,
});

const T0 = new Date(2026, 5, 11, 8, 0, 0).getTime();

const seedSession = (): void => {
  setGuidanceSession({
    route: createRoute([
      hop('s1', '을지로3가', 's2', '시청', 2),
      hop('s2', '시청', 's3', '산곡', 3),
    ]),
    fromStationName: '을지로3가',
    toStationName: '산곡',
    startedAt: T0,
  });
};

describe('RouteGuidanceScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    mockGoBack.mockClear();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    clearGuidanceSession();
    jest.useRealTimers();
  });

  it('goes back when no session is active', () => {
    render(<RouteGuidanceScreen />);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders the ETA header and full timeline from the session', () => {
    seedSession();
    const { getByText, getByTestId } = render(<RouteGuidanceScreen />);
    expect(getByText('산곡 도착 예정')).toBeTruthy();
    // board(0) + ride(5m) → 8:05 (platform wait excluded while holding)
    expect(getByTestId('guidance-eta-time')).toHaveTextContent('8:05');
    expect(getByText('을지로3가에서 2호선 탑승')).toBeTruthy();
    expect(getByText('산곡 하차')).toBeTruthy();
  });

  it('starts waiting to board with the live next-train chip', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [
        {
          lineId: '2',
          direction: 'up',
          arrivalTime: new Date(T0 + 90_000),
        },
      ],
      loading: false,
      error: null,
    });
    const { getByText } = render(<RouteGuidanceScreen />);
    expect(getByText('탑승 대기')).toBeTruthy();
    expect(getByText('다음 열차 1분 30초 후 도착')).toBeTruthy();
    // Waiting subscription targets the boarding station.
    expect(mockedUseRealtimeTrains).toHaveBeenCalledWith(
      '을지로3가',
      expect.objectContaining({ enabled: true, refetchInterval: 30000 })
    );
  });

  it('advances to riding via 탑승했어요 and shows the next stop', () => {
    seedSession();
    const { getByText, getByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-next'));
    expect(getByText('탑승 중')).toBeTruthy();
    expect(getByTestId('guidance-next-station')).toHaveTextContent('시청');
    // Riding → realtime subscription disabled (rate-limit budget).
    expect(mockedUseRealtimeTrains).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({ enabled: false })
    );
  });

  it('reaches the destination state after the ride time elapses', () => {
    seedSession();
    const { getByText, getByTestId, queryByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-next'));
    act(() => {
      jest.advanceTimersByTime(5 * 60_000 + 1_000);
    });
    expect(getByText('산곡 도착 · 하차하세요')).toBeTruthy();
    // Correction pair hidden at the end; only 안내 종료 remains.
    expect(queryByTestId('guidance-next')).toBeNull();
  });

  it('clears the session and goes back on 안내 종료', () => {
    seedSession();
    const { getByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-exit'));
    expect(getGuidanceSession()).toBeNull();
    expect(mockGoBack).toHaveBeenCalled();
  });
});
