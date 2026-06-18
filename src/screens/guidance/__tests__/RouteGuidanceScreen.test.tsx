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
  scheduleBoardingAlert,
  cancelBoardingAlert,
} from '@/services/notification/boardingAlertService';
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
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(),
}));

// boardingAlertService wraps expo-notifications — mock at the service boundary
// so the screen never loads the native module under jsdom.
jest.mock('@/services/notification/boardingAlertService', () => ({
  scheduleBoardingAlert: jest.fn(() => Promise.resolve('alert-id')),
  cancelBoardingAlert: jest.fn(() => Promise.resolve()),
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

const lineHop = (
  fromId: string,
  fromName: string,
  toId: string,
  toName: string,
  lineId: string,
  minutes: number
): RouteSegment => ({
  fromStationId: fromId,
  fromStationName: fromName,
  toStationId: toId,
  toStationName: toName,
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes: minutes,
  isTransfer: false,
});

const transferSegAt = (
  stationId: string,
  stationName: string,
  toLineId: string,
  minutes: number
): RouteSegment => ({
  fromStationId: stationId,
  fromStationName: stationName,
  toStationId: stationId,
  toStationName: stationName,
  lineId: toLineId,
  lineName: `${toLineId}호선`,
  estimatedMinutes: minutes,
  isTransfer: true,
});

/** A train on line 2 arriving `etaSec` from T0, keyed by a poll-stable id. */
const trainOf = (id: string, etaSec: number) => ({
  id,
  lineId: '2',
  direction: 'up' as const,
  arrivalTime: new Date(T0 + etaSec * 1000),
  finalDestination: '산곡',
});

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

/** board(line2) → ride(line2, 2m) → transfer@시청(4m) → ride(line7, 3m) → alight. */
const seedTransferSession = (): void => {
  setGuidanceSession({
    route: createRoute([
      hop('s1', '을지로3가', 's2', '시청', 2),
      transferSegAt('s2', '시청', '7', 4),
      lineHop('s2', '시청', 's3', '산곡', '7', 3),
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
    (scheduleBoardingAlert as jest.Mock).mockClear();
    (cancelBoardingAlert as jest.Mock).mockClear();
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

  it('shows the soft-confirm when the awaited train departs, then auto-advances', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, getByText, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
    // first snapshot: train arriving, no prompt yet
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
    // second snapshot: train gone → departure inferred → prompt appears, still on board
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    expect(getByTestId('guidance-soft-confirm-yes')).toBeTruthy();
    expect(getByTestId('guidance-next')).toBeTruthy();
    // no tap → auto-advances after the grace window
    act(() => {
      jest.advanceTimersByTime(4100);
    });
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
    expect(getByText('탑승 중')).toBeTruthy();
  });

  it('advances immediately when 예 is pressed in the soft-confirm', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, getByText, rerender } = render(<RouteGuidanceScreen />);
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    fireEvent.press(getByTestId('guidance-soft-confirm-yes'));
    expect(getByText('탑승 중')).toBeTruthy();
    expect(cancelBoardingAlert).toHaveBeenCalled();
  });

  it('dismisses on 아직이에요 without advancing and suppresses re-prompt for the same train', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    fireEvent.press(getByTestId('guidance-soft-confirm-notyet'));
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
    expect(getByTestId('guidance-next')).toBeTruthy(); // still on board

    // T1 re-appears arriving, then departs again — cooldown suppresses the re-prompt
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
  });

  it('advances exactly one step when 탑승했어요 is tapped during the soft-confirm window', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, getByText, queryByText, rerender } = render(<RouteGuidanceScreen />);
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    // manual tap while the auto timer is pending
    fireEvent.press(getByTestId('guidance-next'));
    // letting the (now-cleared) auto window pass must NOT advance a second step
    act(() => {
      jest.advanceTimersByTime(5100);
    });
    expect(getByText('탑승 중')).toBeTruthy(); // ride (index 1)
    expect(queryByText('산곡 도착 · 하차하세요')).toBeNull(); // not double-advanced to alight
  });

  it('schedules a boarding alert for the earliest train and cancels it on exit', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 90)],
      loading: false,
      error: null,
    });
    const { getByTestId } = render(<RouteGuidanceScreen />);
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ stationName: '을지로3가', variant: 'board' })
    );
    fireEvent.press(getByTestId('guidance-exit'));
    expect(cancelBoardingAlert).toHaveBeenCalled();
  });

  it('holds at a transfer step with a ticking (not frozen) walk countdown', () => {
    seedTransferSession();
    const { getByText, rerender } = render(<RouteGuidanceScreen />);
    // board(line2) → ride(line2) via 탑승했어요
    fireEvent.press(getByText('탑승했어요'));
    // ride is 2min; advance just past it to land on the transfer (index 2)
    act(() => {
      jest.advanceTimersByTime(2 * 60_000 + 1_000);
    });
    expect(getByText('환승 중')).toBeTruthy();
    // walk elapsed ≈ 1s → 3분 59초 남음 (NOT frozen at 4분 00초)
    expect(getByText('환승 도보 약 4분 — 3분 59초 남음')).toBeTruthy();
    // one more minute: countdown decreases and it STILL holds (no auto-advance)
    act(() => {
      jest.advanceTimersByTime(60_000);
      rerender(<RouteGuidanceScreen />);
    });
    expect(getByText('환승 중')).toBeTruthy();
    expect(getByText('환승 도보 약 4분 — 2분 59초 남음')).toBeTruthy();
  });
});
