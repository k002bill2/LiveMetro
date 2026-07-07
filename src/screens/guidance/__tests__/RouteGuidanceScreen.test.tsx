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
  scheduleAlightAlert,
  cancelAlightAlert,
} from '@/services/notification/alightAlertService';
import { completeGuidanceCommuteLog } from '@/services/guidance/guidanceCommuteLogService';
import {
  setGuidanceSession,
  clearGuidanceSession,
  getGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import {
  appendDepartedTrains,
  clearDepartedTrainLog,
  type DepartedTrainEntry,
} from '@/services/guidance/departedTrainLog';
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

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'user-1' } })),
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

jest.mock('@/services/notification/alightAlertService', () => ({
  scheduleAlightAlert: jest.fn(() => Promise.resolve('alight-1')),
  cancelAlightAlert: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/guidance/guidanceCommuteLogService', () => ({
  completeGuidanceCommuteLog: jest.fn(() => Promise.resolve()),
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
  X: 'X',
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
const trainOf = (id: string, etaSec: number, finalDestination = '산곡') => ({
  id,
  lineId: '2',
  direction: 'up' as const,
  arrivalTime: new Date(T0 + etaSec * 1000),
  finalDestination,
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

/** board(line2) → ride(line2) → transfer@왕십리 to an EXTENDED line → ride → alight. */
const seedExtendedTransferSession = (): void => {
  setGuidanceSession({
    route: createRoute([
      hop('s1', '을지로3가', 's2', '왕십리', 2),
      transferSegAt('s2', '왕십리', '경의중앙선', 4),
      lineHop('s2', '왕십리', 's3', '중랑', '경의중앙선', 3),
    ]),
    fromStationName: '을지로3가',
    toStationName: '중랑',
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
    (scheduleAlightAlert as jest.Mock).mockClear();
    (cancelAlightAlert as jest.Mock).mockClear();
    (completeGuidanceCommuteLog as jest.Mock).mockClear();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [],
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    clearGuidanceSession();
    clearDepartedTrainLog();
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

  it('records arrival when the guidance reaches the destination', () => {
    seedSession();
    const { getByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-next'));
    act(() => {
      jest.advanceTimersByTime(5 * 60_000 + 1_000);
    });
    expect(completeGuidanceCommuteLog).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        fromStationName: '을지로3가',
        toStationName: '산곡',
      }),
      expect.any(Number)
    );
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
    // trainId는 발사 이력 dedup 키 — 반드시 함께 전달돼야 한다.
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ stationName: '을지로3가', variant: 'board', trainId: 'T1' })
    );
    fireEvent.press(getByTestId('guidance-exit'));
    expect(cancelBoardingAlert).toHaveBeenCalled();
  });

  // ── 방향(방면) 우선 필터: 반대 방향 열차가 더 먼저 와도 칩/알림은 진행
  // 방향(을지로3가→시청 = '산곡' 방면) 열차 기준이어야 한다.
  it('prefers the travel-direction train over a sooner opposite-direction train', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [
        trainOf('OPP', 60, '을지로3가'), // 반대 방향 — 더 먼저 도착
        trainOf('T1', 90, '산곡'), // 진행 방향
      ],
      loading: false,
      error: null,
    });
    const { getByText } = render(<RouteGuidanceScreen />);
    // 칩은 진행 방향 열차(90초) 기준 — 반대 방향(60초)이 아님
    expect(getByText('다음 열차 1분 30초 후 도착')).toBeTruthy();
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ trainId: 'T1', finalDestination: '산곡' })
    );
    expect(scheduleBoardingAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ trainId: 'OPP' })
    );
  });

  it('falls back to line-filtered trains when no train matches the direction name (단축운행 종착 대비)', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      // 진행 방향이지만 단축 운행이라 종착역명이 방면명('산곡')과 다른 경우 —
      // 하드 필터였다면 칩/알림이 전멸했을 상황. 폴백으로 유지돼야 한다.
      trains: [trainOf('SHORT', 60, '시청')],
      loading: false,
      error: null,
    });
    const { getByText } = render(<RouteGuidanceScreen />);
    expect(getByText('다음 열차 1분 00초 후 도착')).toBeTruthy();
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ trainId: 'SHORT' })
    );
  });

  it('opens the train-select sheet from the waiting link and boards via the fallback', () => {
    seedSession();
    const { getByTestId, getByText, queryByTestId } = render(<RouteGuidanceScreen />);
    // Sheet is closed initially.
    expect(queryByTestId('train-select-sheet')).toBeNull();
    // "이미 탑승하셨나요? 열차 선택" opens it.
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    // "방금 출발했어요" fallback advances to riding (same as 탑승했어요, now-anchored).
    fireEvent.press(getByTestId('train-select-now'));
    expect(getByText('탑승 중')).toBeTruthy();
  });

  const logEntry = (trainId: string, departedAtMs: number): DepartedTrainEntry => ({
    trainId,
    finalDestination: '산곡',
    lineId: '2',
    stationName: '을지로3가',
    departedAtMs,
    confidence: 'observed',
  });

  it('hides log entries older than the retention window at read time', () => {
    seedSession(); // startedAt = T0, boarding station 을지로3가 (line 2)
    // Injected at T0 (not pruned on insert). After 16min the wall clock is
    // T0+16min → retention cutoff = T0+1min, so this T0+30s entry is stale.
    appendDepartedTrains([logEntry('STALE', T0 + 30_000)], T0);
    const { getByTestId, queryByTestId } = render(<RouteGuidanceScreen />);
    act(() => {
      jest.advanceTimersByTime(16 * 60_000); // still holding on the board step
    });
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    expect(queryByTestId('train-select-item-STALE')).toBeNull();
    expect(getByTestId('train-select-now')).toBeTruthy(); // fallback always present
  });

  it('shows a log entry still within the retention window at read time', () => {
    seedSession();
    // T0+2min: past the T0+1min cutoff after 16min elapsed → still visible.
    appendDepartedTrains([logEntry('FRESH', T0 + 2 * 60_000)], T0);
    const { getByTestId } = render(<RouteGuidanceScreen />);
    act(() => {
      jest.advanceTimersByTime(16 * 60_000);
    });
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-item-FRESH')).toBeTruthy();
  });

  it('cancels the pending soft-confirm auto-advance when the train-select link opens the sheet', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, getByText, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
    // second snapshot: train gone → soft-confirm prompt appears (auto timer armed)
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    expect(getByTestId('guidance-soft-confirm')).toBeTruthy();
    // Open the sheet via the waiting-card link while the grace timer is pending.
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    // Past the 4s grace window: the auto-advance must NOT fire behind the sheet.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
    expect(getByText('탑승 대기')).toBeTruthy(); // still on the board step, not riding
  });

  it('auto-closes the sheet and does not skip the transfer when the ride ends while it is open', () => {
    seedTransferSession(); // board → ride(line2, 2m) → transfer@시청(4m) → ride(line7) → alight
    const { getByText, getByTestId, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByText('탑승했어요')); // board → ride (index 1)
    expect(getByText('탑승 중')).toBeTruthy();
    // Open the mid-ride "열차 변경" sheet (context captured at ride, stepIndex 1).
    fireEvent.press(getByTestId('guidance-change-train'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    // Ride is 2min — advance past it so the 1Hz tick flips the step to transfer.
    act(() => {
      jest.advanceTimersByTime(2 * 60_000 + 1_000);
      rerender(<RouteGuidanceScreen />);
    });
    // Sheet auto-closes on the step change; parked on the transfer (NOT skipped).
    expect(queryByTestId('train-select-sheet')).toBeNull();
    expect(getByText('환승 중')).toBeTruthy();
  });

  it('preserves the soft-confirm cooldown when the sheet is opened while inactive', () => {
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
    // dismiss on 아직이에요 → cooldown keyed to T1
    fireEvent.press(getByTestId('guidance-soft-confirm-notyet'));
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
    // open the sheet while the soft-confirm is INACTIVE, then close it —
    // must not wipe the existing cooldown.
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    fireEvent.press(getByTestId('train-select-close'));
    // T1 re-appears arriving, then departs again — cooldown must still suppress.
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

  it('does not record previous-station trains as departures when a stale snapshot seeds a transfer step', () => {
    seedExtendedTransferSession();
    // Previous-station snapshot (extended line passes the numbered filter) —
    // useRealtimeTrains keeps this stale array until the new subscription delivers.
    const stale = { trains: [trainOf('STALE', 10, '천안')], loading: false, error: null };
    mockedUseRealtimeTrains.mockReturnValue(stale);
    const { getByTestId, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
    // board → ride → transfer via manual next (no clock advance; stale array kept).
    fireEvent.press(getByTestId('guidance-next')); // board → ride
    fireEvent.press(getByTestId('guidance-next')); // ride → transfer (왕십리)
    // Fresh snapshot for the NEW station arrives — different identity, empty.
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    // Open the sheet at the transfer: the stale train must NOT appear as a
    // 왕십리 departure (only the fallback exists).
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    expect(queryByTestId('train-select-item-STALE')).toBeNull();
    expect(getByTestId('train-select-now')).toBeTruthy();
  });

  it('opens the train-select sheet from the soft-confirm 다른 열차 link', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, rerender } = render(<RouteGuidanceScreen />);
    // second snapshot: train gone → soft-confirm prompt appears
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    fireEvent.press(getByTestId('guidance-soft-confirm-other'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
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

  describe('하차 임박 알림 (alight alert)', () => {
    it('ride 스텝 진입 시 다음 하차 지점 정보로 scheduleAlightAlert를 호출한다', () => {
      seedSession(); // board → ride(line2, 5m) → alight@산곡
      const { getByTestId } = render(<RouteGuidanceScreen />);
      // board 홀드에서는 아직 예약 없음.
      expect(scheduleAlightAlert).not.toHaveBeenCalled();
      // 탑승 확인 → ride 스텝 진입 → 다음 하차 지점(산곡)으로 예약.
      fireEvent.press(getByTestId('guidance-next'));
      expect(scheduleAlightAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          nextKind: expect.stringMatching(/^(transfer|alight)$/),
          stationName: '산곡',
          arrivalAtMs: expect.any(Number),
          stepKey: expect.stringMatching(/^\d+:\d+$/),
        })
      );
      // 도착 시각(rideAlightAtMs)은 1Hz 틱에 불변 → effect가 매초 재실행되지
      // 않는다: ride 안에서 시간이 흘러도 재예약이 발생하지 않아야 한다.
      const callsAfterEntry = (scheduleAlightAlert as jest.Mock).mock.calls.length;
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect((scheduleAlightAlert as jest.Mock).mock.calls.length).toBe(callsAfterEntry);
    });

    it('board 대기 스텝에서는 예약하지 않고 cancelAlightAlert를 호출한다', () => {
      seedSession();
      render(<RouteGuidanceScreen />);
      // board 홀드 상태 — ride가 아니므로 예약 없이 이전 pending을 취소한다.
      expect(scheduleAlightAlert).not.toHaveBeenCalled();
      expect(cancelAlightAlert).toHaveBeenCalled();
    });

    it('길안내 종료(handleExit) 시 cancelAlightAlert를 호출한다', () => {
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      // 마운트 시 board 홀드의 취소 호출을 지워 handleExit 경로만 격리한다.
      (cancelAlightAlert as jest.Mock).mockClear();
      fireEvent.press(getByTestId('guidance-exit'));
      expect(cancelAlightAlert).toHaveBeenCalled();
    });
  });
});
