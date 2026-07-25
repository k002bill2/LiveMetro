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
  getDepartedTrainLog,
  type DepartedTrainEntry,
} from '@/services/guidance/departedTrainLog';
import { recordDetectionEpisode } from '@/services/guidance/guidanceDetectionMetrics';
import { updateBoardingPreferences } from '@/services/commute/commuteService';
import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { createRoute, type RouteSegment } from '@/models/route';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useGuidanceBackgroundPermissionPrompt } from '@/hooks/useGuidanceBackgroundPermissionPrompt';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import { stopGuidanceBackgroundLocation } from '@/services/guidance/guidanceBackgroundLocationTask';

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

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

// The bg-permission hook pulls in the native background-location task chain
// (expo-task-manager). Mock it at the hook boundary so the screen never loads
// that chain; hook behavior is covered by its own test.
jest.mock('@/hooks/useGuidanceBackgroundPermissionPrompt', () => ({
  useGuidanceBackgroundPermissionPrompt: jest.fn(() => ({
    status: 'hidden',
    requestPermission: jest.fn(),
    dismiss: jest.fn(),
    openSettings: jest.fn(),
  })),
}));

// 실제 스토어를 추적하도록 mock (beforeEach에서 getGuidanceSession에 연결) — wake-lock
// 게이트의 세션 반응성을 setGuidanceSession + 명시 rerender로 제어한다.
jest.mock('@/hooks/useGuidanceSession', () => ({
  useGuidanceSession: jest.fn(),
}));

// 화면이 로컬 완료(isAtEnd) 시 백그라운드 추적을 중지/재시도(S1) — 네이티브 태스크
// 체인(expo-task-manager)을 mock해 화면 테스트가 그걸 로드하지 않게 한다.
jest.mock('@/services/guidance/guidanceBackgroundLocationTask', () => ({
  startGuidanceBackgroundLocation: jest.fn(() => Promise.resolve(true)),
  stopGuidanceBackgroundLocation: jest.fn(() => Promise.resolve()),
}));

// Detection-metrics recording is fire-and-forget from the screen — mock at the
// module boundary so the screen never touches AsyncStorage; assert call payloads.
jest.mock('@/services/guidance/guidanceDetectionMetrics', () => ({
  recordDetectionEpisode: jest.fn(() => Promise.resolve()),
}));

// 종점행 선호 write-back(출퇴근 세션)의 원격 저장 경계 — commuteService는 Firebase를
// 끌어오므로 모듈 경계에서 mock하고 호출 페이로드만 검증한다.
jest.mock('@/services/commute/commuteService', () => ({
  updateBoardingPreferences: jest.fn(() => Promise.resolve({ success: true })),
  loadCommuteRoutes: jest.fn(() => Promise.resolve(null)),
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

// '5'는 분기 노선(마천·하남검단산) 픽스처용 — 기존 '2' 항목은 그대로 두어 기존
// 케이스의 방면 도출(산곡)이 바뀌지 않는다.
jest.mock('@/utils/subwayMapData', () => ({
  LINE_STATIONS: { '2': [['s1', 's2', 's3']], '5': [['p1', 'p2', 'p3']] },
  STATIONS: {
    s1: { name: '을지로3가' },
    s2: { name: '시청' },
    s3: { name: '산곡' },
    p1: { name: '광화문' },
    p2: { name: '강동' },
    p3: { name: '하남검단산' },
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

/** A train on an arbitrary line, for the 5호선 분기(마천·하남검단산) 픽스처. */
const trainOnLine = (
  id: string,
  etaSec: number,
  finalDestination: string,
  lineId: string,
  direction: 'up' | 'down' = 'up'
) => ({
  id,
  lineId,
  direction,
  arrivalTime: new Date(T0 + etaSec * 1000),
  finalDestination,
});

/** 광화문에서 5호선 탑승(방면=하남검단산) → 강동 하차. boardingKey = 'p1|5'. */
const seedBranchSession = (extra?: {
  readonly destinationPreferences?: Readonly<Record<string, readonly string[]>>;
  readonly sourceCommuteType?: 'morning' | 'evening';
  readonly ownerUid?: string;
}): void => {
  setGuidanceSession({
    route: createRoute([lineHop('p1', '광화문', 'p2', '강동', '5', 4)]),
    fromStationName: '광화문',
    toStationName: '강동',
    startedAt: T0,
    ...extra,
  });
};

/** 분기 노선 도착 스냅샷: 마천행 2분(선호 밖) + 하남검단산행 5분(방면 일치). */
const branchTrains = (): readonly ReturnType<typeof trainOnLine>[] => [
  trainOnLine('MC', 120, '마천', '5'),
  trainOnLine('HN', 300, '하남검단산', '5'),
];

/** Board on an EXTENDED line absent from the map mock → step.direction is null. */
const seedExtendedBoardSession = (): void => {
  setGuidanceSession({
    route: createRoute([lineHop('s1', '대곡', 's2', '능곡', '경의중앙선', 3)]),
    fromStationName: '대곡',
    toStationName: '능곡',
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
    (recordDetectionEpisode as jest.Mock).mockClear();
    (updateBoardingPreferences as jest.Mock).mockClear();
    // Default: bg-permission nudge hidden — wiring tests override per case.
    (useGuidanceBackgroundPermissionPrompt as jest.Mock).mockReturnValue({
      status: 'hidden',
      requestPermission: jest.fn(),
      dismiss: jest.fn(),
      openSettings: jest.fn(),
    });
    // wake-lock 게이트용 — 실제 스토어를 추적하고, focus는 기본 true로 리셋.
    (useGuidanceSession as jest.Mock).mockImplementation(() => getGuidanceSession());
    (useIsFocused as jest.Mock).mockReturnValue(true);
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

  it('records arrival via the localCompletedAt marker, NOT a direct completion write (AA2)', () => {
    // Completion ownership moved to the app-level useGuidanceCommuteLogSync hook
    // (Z1). The screen only marks local completion; it must never call
    // completeGuidanceCommuteLog itself (that raced the hook on the same emit).
    seedSession();
    const { getByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-next'));
    act(() => {
      jest.advanceTimersByTime(5 * 60_000 + 1_000);
    });
    expect(typeof getGuidanceSession()?.localCompletedAt).toBe('number');
    expect(completeGuidanceCommuteLog).not.toHaveBeenCalled();
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
    // dedup은 대기 컨텍스트(context+sessionKey+역+variant) 단위 — trainId를 넘기지
    // 않는다. context='guidance' + sessionKey(고정 세션 키)는 세션 정리/고아 sweep
    // 대상임을 표시한다(H1/H2).
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'guidance',
        sessionKey: String(T0),
        stationName: '을지로3가',
        variant: 'board',
      })
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
    // 칩은 진행 방향 열차(90초) 기준 — 반대 방향(60초)이 아님. 종점행을 알면 칩이
    // 그 열차를 "OO행"으로 지칭한다(종점행 필터 도입).
    expect(getByText('산곡행 1분 30초 후 도착')).toBeTruthy();
    // trainId를 넘기지 않으므로 방향 판별은 finalDestination으로 확인한다
    // (진행 방향 T1='산곡' vs 반대 방향 OPP='을지로3가').
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ finalDestination: '산곡' })
    );
    expect(scheduleBoardingAlert).not.toHaveBeenCalledWith(
      expect.objectContaining({ finalDestination: '을지로3가' })
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
    expect(getByText('시청행 1분 00초 후 도착')).toBeTruthy();
    expect(scheduleBoardingAlert).toHaveBeenCalledWith(
      expect.objectContaining({ finalDestination: '시청' })
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

  const dirEntry = (
    trainId: string,
    finalDestination: string,
    stationName = '을지로3가',
    lineId = '2'
  ): DepartedTrainEntry => ({
    trainId,
    finalDestination,
    lineId,
    stationName,
    departedAtMs: T0,
    confidence: 'observed',
  });

  it('ranks travel-direction matches first but keeps same-direction short-turns (no drop)', () => {
    seedSession(); // board direction = 산곡 (line 2, s1→s2 endpoint in the map mock)
    // Append SHORT before MATCH so base order is [SHORT, MATCH] — ranking must
    // reorder MATCH to the front WITHOUT dropping the short-turn candidate.
    appendDepartedTrains([dirEntry('SHORT', '시청'), dirEntry('MATCH', '산곡')], T0);
    const { getByTestId, getAllByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-open-train-select'));
    const ids = getAllByTestId(/^train-select-item-/).map((n) => n.props.testID);
    expect(ids).toEqual(['train-select-item-MATCH', 'train-select-item-SHORT']);
  });

  it('falls back to all sheet candidates when none match the direction (단축운행 종착)', () => {
    seedSession();
    appendDepartedTrains([dirEntry('SHORT1', '시청'), dirEntry('SHORT2', '충정로')], T0);
    const { getByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-item-SHORT1')).toBeTruthy();
    expect(getByTestId('train-select-item-SHORT2')).toBeTruthy();
  });

  it('does not filter sheet candidates by direction when the step direction is unknown', () => {
    seedExtendedBoardSession(); // board on 경의중앙선 → direction null
    appendDepartedTrains(
      [dirEntry('A', '문산', '대곡', '경의중앙선'), dirEntry('B', '지평', '대곡', '경의중앙선')],
      T0
    );
    const { getByTestId } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-item-A')).toBeTruthy();
    expect(getByTestId('train-select-item-B')).toBeTruthy();
  });

  it('does not record estimated departures with an empty station when confirming a non-waiting (ride) step', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, rerender } = render(<RouteGuidanceScreen />);
    fireEvent.press(getByTestId('guidance-next')); // board → ride (confirm at 을지로3가)
    // useRealtimeTrains keeps a non-empty array even after boarding (disabled) —
    // a DISTINCT train so any '' entry can't be masked by trainId dedup.
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T2', 10)],
      loading: false,
      error: null,
    });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    fireEvent.press(getByTestId('guidance-next')); // ride → alight (must NOT log at '')
    expect(getDepartedTrainLog().some((e) => e.stationName === '')).toBe(false);
  });

  it('does not arm the soft-confirm auto-advance while the train-select sheet is open', () => {
    seedSession();
    mockedUseRealtimeTrains.mockReturnValue({
      trains: [trainOf('T1', 10)],
      loading: false,
      error: null,
    });
    const { getByTestId, getByText, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
    // Open the sheet first (context captured on the board step).
    fireEvent.press(getByTestId('guidance-open-train-select'));
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    // Next poll: T1 departs while the sheet is open.
    mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
    act(() => {
      rerender(<RouteGuidanceScreen />);
    });
    // Soft-confirm must NOT arm behind the modal.
    expect(queryByTestId('guidance-soft-confirm')).toBeNull();
    // Past the grace window: no auto-advance — still on board, sheet still open.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getByText('탑승 대기')).toBeTruthy();
    expect(getByTestId('train-select-sheet')).toBeTruthy();
    // The newly observed departure is still logged and appears in the open sheet.
    expect(getByTestId('train-select-item-T1')).toBeTruthy();
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

  describe('시간 보정 — 역 선택 (station rebase)', () => {
    it('opens the station-rebase sheet from the ride 시간 보정 link and rebases the next stop to the picked station', () => {
      seedSession(); // board → ride(을지로3가→시청 2m→산곡 3m) → alight
      const { getByTestId, queryByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-next')); // board → ride
      // Right after boarding the next stop is 시청.
      expect(getByTestId('guidance-next-station')).toHaveTextContent('시청');
      // Sheet closed until the link is pressed.
      expect(queryByTestId('station-rebase-sheet')).toBeNull();
      fireEvent.press(getByTestId('guidance-rebase-station'));
      expect(getByTestId('station-rebase-sheet')).toBeTruthy();
      // "내 열차는 지금 시청" → anchor rebased so 시청 is passed, next stop is 산곡.
      fireEvent.press(getByTestId('station-rebase-item-s2'));
      expect(getByTestId('guidance-next-station')).toHaveTextContent('산곡');
      // Sheet closes after the pick.
      expect(queryByTestId('station-rebase-sheet')).toBeNull();
    });

    it('marks the estimated current position (last-reached station) with a 지금 여기 badge', () => {
      seedSession();
      const { getByTestId, queryByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-next')); // board → ride (elapsed 0)
      fireEvent.press(getByTestId('guidance-rebase-station'));
      // Just boarded → current position is the origin (을지로3가, s1), NOT the
      // next stop 시청 — picking the marked station must never over-advance.
      expect(getByTestId('station-rebase-here-s1')).toBeTruthy();
      expect(queryByTestId('station-rebase-here-s2')).toBeNull();
    });

    it('does not expose the station-rebase link while waiting on a board step', () => {
      seedSession();
      const { queryByTestId } = render(<RouteGuidanceScreen />);
      // Board hold — no ride body, so no station-rebase entry point.
      expect(queryByTestId('guidance-rebase-station')).toBeNull();
    });

    it('reaches the destination via 하차역 rebase without any screen-driven completion write (AA2)', () => {
      // Pre-AA2 this guarded against the screen double-completing across the
      // rebase path. The screen no longer writes completion at all (the hook's
      // in-flight guard owns the "exactly once" invariant), so assert the marker
      // is set once and the screen never calls completeGuidanceCommuteLog.
      seedSession();
      const { getByTestId, getByText } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-next')); // board → ride
      fireEvent.press(getByTestId('guidance-rebase-station'));
      // Pick the final 하차역 (산곡, s3) → full ride duration → advances to alight.
      fireEvent.press(getByTestId('station-rebase-item-s3'));
      expect(getByText('산곡 도착 · 하차하세요')).toBeTruthy();
      expect(typeof getGuidanceSession()?.localCompletedAt).toBe('number');
      expect(completeGuidanceCommuteLog).not.toHaveBeenCalled();
    });
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
          sessionKey: String(T0),
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

  describe('진행 anchor 복원 (progressAnchor restore)', () => {
    const seedSessionWithAnchor = (
      progressAnchor: { stepIndex: number; atMs: number }
    ): void => {
      setGuidanceSession({
        route: createRoute([
          hop('s1', '을지로3가', 's2', '시청', 2),
          hop('s2', '시청', 's3', '산곡', 3),
        ]),
        fromStationName: '을지로3가',
        toStationName: '산곡',
        startedAt: T0,
        progressAnchor,
      });
    };

    it('저장된 ride anchor로 마운트하면 첫 board 홀드가 아니라 그 ride 스텝으로 복원한다', () => {
      // ride(index 1)를 T0에 탑승한 것으로 복원 — 복원되면 '탑승 중', 미배선이면
      // 첫 board 홀드('탑승 대기')로 되감김(RED).
      seedSessionWithAnchor({ stepIndex: 1, atMs: T0 });
      const { getByText, getByTestId } = render(<RouteGuidanceScreen />);
      expect(getByText('탑승 중')).toBeTruthy();
      expect(getByTestId('guidance-next-station')).toHaveTextContent('시청');
    });

    it('스텝 범위를 벗어난 무효 anchor는 무시하고 기본 board 스텝에서 시작한다', () => {
      seedSessionWithAnchor({ stepIndex: 99, atMs: T0 });
      const { getByText } = render(<RouteGuidanceScreen />);
      expect(getByText('탑승 대기')).toBeTruthy();
    });

    it('미래 시각 anchor는 무시하고 기본 board 스텝에서 시작한다', () => {
      seedSessionWithAnchor({ stepIndex: 1, atMs: T0 + 60_000 });
      const { getByText } = render(<RouteGuidanceScreen />);
      expect(getByText('탑승 대기')).toBeTruthy();
    });

    it('소수 stepIndex anchor는 무시하고 기본 board 스텝에서 시작한다 (steps[0.5] 크래시 방지)', () => {
      seedSessionWithAnchor({ stepIndex: 0.5, atMs: T0 });
      const { getByText } = render(<RouteGuidanceScreen />);
      expect(getByText('탑승 대기')).toBeTruthy();
    });
  });

  describe('unmount 시 알림 취소 안 함 (세션 존속)', () => {
    it('화면 언마운트 시 탑승/하차 알림을 취소하지 않는다 (세션 종료 훅으로 책임 이동)', () => {
      seedSession();
      const { unmount } = render(<RouteGuidanceScreen />);
      // 마운트 시 board 홀드의 취소 호출(하차 alight effect)을 지워 언마운트 경로만 격리.
      (cancelBoardingAlert as jest.Mock).mockClear();
      (cancelAlightAlert as jest.Mock).mockClear();
      unmount();
      // 세션이 살아있는데 화면만 닫힌 경우 — 절대시각 하차 알림은 유효해야 한다.
      expect(cancelBoardingAlert).not.toHaveBeenCalled();
      expect(cancelAlightAlert).not.toHaveBeenCalled();
    });
  });

  describe('화면 꺼짐 방지 (keep-awake)', () => {
    it('네이티브에서 활성 세션 + 포커스 시 activateKeepAwakeAsync를 호출한다', () => {
      seedSession();
      render(<RouteGuidanceScreen />);
      expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    });

    it('세션이 없으면 wake lock을 걸지 않는다 (P1)', () => {
      // seedSession 안 함 → 세션 없음(복원/딥링크 방어 경로).
      render(<RouteGuidanceScreen />);
      expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    });

    it('blur 전이 시 wake lock을 해제한다 (P1)', () => {
      seedSession();
      const { rerender } = render(<RouteGuidanceScreen />);
      expect(activateKeepAwakeAsync).toHaveBeenCalled();
      (deactivateKeepAwake as jest.Mock).mockClear();
      (useIsFocused as jest.Mock).mockReturnValue(false); // 위에 다른 화면 push → blur
      rerender(<RouteGuidanceScreen />);
      expect(deactivateKeepAwake).toHaveBeenCalled();
    });

    it('여정 완료 전이 시 wake lock을 해제한다 (P1)', () => {
      seedSession();
      const { rerender } = render(<RouteGuidanceScreen />);
      expect(activateKeepAwakeAsync).toHaveBeenCalled();
      (deactivateKeepAwake as jest.Mock).mockClear();
      // 목적지 도착 — commuteLogCompletedAt 설정(같은 startedAt 유지).
      const current = getGuidanceSession();
      if (current) {
        act(() => {
          setGuidanceSession({ ...current, commuteLogCompletedAt: T0 + 300_000 });
        });
      }
      rerender(<RouteGuidanceScreen />);
      expect(deactivateKeepAwake).toHaveBeenCalled();
    });

    it('로컬 완료(isAtEnd) 도달 시 원격 기록과 무관하게 wake lock을 해제한다 (R1)', () => {
      // completeGuidanceCommuteLog는 mocked(resolve)라 commuteLogCompletedAt이
      // 설정되지 않는다 → 세션은 여전히 활성이지만 로컬 isAtEnd로 해제돼야 한다
      // (오프라인/지하 완주 시 원격 완료 write가 안 떨어지는 시나리오).
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      expect(activateKeepAwakeAsync).toHaveBeenCalled();
      (deactivateKeepAwake as jest.Mock).mockClear();
      fireEvent.press(getByTestId('guidance-next')); // board → ride
      act(() => {
        jest.advanceTimersByTime(5 * 60_000 + 1_000); // ride 5분 경과 → isAtEnd
      });
      // 세션은 활성 유지(원격 기록 미도착)인데도 로컬 완료로 해제.
      expect(getGuidanceSession()?.commuteLogCompletedAt).toBeUndefined();
      expect(deactivateKeepAwake).toHaveBeenCalled();
    });

    it('언마운트 시 deactivateKeepAwake로 wake lock을 해제한다', () => {
      seedSession();
      const { unmount } = render(<RouteGuidanceScreen />);
      (deactivateKeepAwake as jest.Mock).mockClear();
      unmount();
      expect(deactivateKeepAwake).toHaveBeenCalled();
    });

    it('웹에서는 wake lock을 걸지 않는다 (unhandled rejection 방지)', () => {
      const originalOS = Platform.OS;
      (Platform as { OS: string }).OS = 'web';
      try {
        seedSession();
        render(<RouteGuidanceScreen />);
        expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
      } finally {
        (Platform as { OS: string }).OS = originalOS;
      }
    });

    it('activate가 reject해도 화면이 크래시하지 않는다', () => {
      (activateKeepAwakeAsync as jest.Mock).mockRejectedValueOnce(new Error('no wake lock'));
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      expect(getByTestId('route-guidance-screen')).toBeTruthy();
    });
  });

  describe('로컬 완료 시 백그라운드 추적 중지 (S1)', () => {
    it('로컬 완료(isAtEnd) 전이 시 stopGuidanceBackgroundLocation을 호출한다', () => {
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-next')); // board → ride
      (stopGuidanceBackgroundLocation as jest.Mock).mockClear();
      act(() => {
        jest.advanceTimersByTime(5 * 60_000 + 1_000); // ride 5분 경과 → isAtEnd(alight)
      });
      // 원격 완료(commuteLogCompletedAt)와 무관하게 로컬 완주로 추적 중지.
      expect(stopGuidanceBackgroundLocation).toHaveBeenCalled();
    });

    it('진행 중 마운트에서는 stop을 호출하지 않는다 (전이 기반)', () => {
      seedSession();
      render(<RouteGuidanceScreen />);
      expect(stopGuidanceBackgroundLocation).not.toHaveBeenCalled();
    });

    it('isAtEnd=true로 복원된 첫 렌더에서 stop을 1회 호출한다 (T2)', () => {
      // ride를 10분 전에 탑승한 것으로 복원 → 5분 ride 초과 → 첫 렌더부터 isAtEnd(alight).
      setGuidanceSession({
        route: createRoute([
          hop('s1', '을지로3가', 's2', '시청', 2),
          hop('s2', '시청', 's3', '산곡', 3),
        ]),
        fromStationName: '을지로3가',
        toStationName: '산곡',
        startedAt: T0,
        progressAnchor: { stepIndex: 1, atMs: T0 - 10 * 60_000 },
      });
      render(<RouteGuidanceScreen />);
      expect(stopGuidanceBackgroundLocation).toHaveBeenCalledTimes(1);
    });

    it('로컬 완료(isAtEnd) 전이 시 세션에 localCompletedAt 마커를 영속한다 (W1)', () => {
      // 원격 기록(completeGuidanceCommuteLog)은 mock이라 스토어에 쓰지 않으므로,
      // 로컬 완주 마커만으로 세션이 비활성으로 표시돼 재시작 후 추적 부활을 막는다.
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-next')); // board → ride
      expect(getGuidanceSession()?.localCompletedAt).toBeUndefined();
      act(() => {
        jest.advanceTimersByTime(5 * 60_000 + 1_000); // ride 5분 경과 → isAtEnd(alight)
      });
      expect(typeof getGuidanceSession()?.localCompletedAt).toBe('number');
    });
  });

  describe('백그라운드 권한 유도 배너 (background permission banner)', () => {
    it('status가 hidden이면 배너를 렌더하지 않는다', () => {
      seedSession();
      const { queryByTestId } = render(<RouteGuidanceScreen />);
      expect(queryByTestId('guidance-bg-permission-banner')).toBeNull();
    });

    it('prompt 모드면 배너를 렌더하고 허용 CTA가 requestPermission을 호출한다', () => {
      const requestPermission = jest.fn();
      (useGuidanceBackgroundPermissionPrompt as jest.Mock).mockReturnValue({
        status: 'prompt',
        requestPermission,
        dismiss: jest.fn(),
        openSettings: jest.fn(),
      });
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      expect(getByTestId('guidance-bg-permission-banner')).toBeTruthy();
      fireEvent.press(getByTestId('guidance-bg-permission-primary'));
      expect(requestPermission).toHaveBeenCalledTimes(1);
    });

    it('settings 모드면 주 CTA가 openSettings를 호출한다', () => {
      const openSettings = jest.fn();
      (useGuidanceBackgroundPermissionPrompt as jest.Mock).mockReturnValue({
        status: 'settings',
        requestPermission: jest.fn(),
        dismiss: jest.fn(),
        openSettings,
      });
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-bg-permission-primary'));
      expect(openSettings).toHaveBeenCalledTimes(1);
    });

    it('보조 CTA가 dismiss를 호출한다', () => {
      const dismiss = jest.fn();
      (useGuidanceBackgroundPermissionPrompt as jest.Mock).mockReturnValue({
        status: 'prompt',
        requestPermission: jest.fn(),
        dismiss,
        openSettings: jest.fn(),
      });
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-bg-permission-dismiss'));
      expect(dismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('감지 적중률 계측 (detection metrics)', () => {
    it('records a manual resolution when the bottom confirm button is tapped on a board hold', () => {
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      // Manual confirm on the board hold — no soft-confirm fired, no dismissals.
      fireEvent.press(getByTestId('guidance-next'));
      expect(recordDetectionEpisode).toHaveBeenCalledTimes(1);
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: 'manual',
          softFired: false,
          dismissedCount: 0,
          stepKind: 'board',
          stationName: '을지로3가',
          lineId: '2',
          sessionKey: String(T0),
        })
      );
    });

    it('records an auto resolution with softFired when the detected departure auto-advances', () => {
      seedSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainOf('T1', 10)],
        loading: false,
        error: null,
      });
      const { rerender } = render(<RouteGuidanceScreen />);
      // Train departs → soft-confirm arms.
      mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      // No tap → auto-advance after the grace window.
      act(() => {
        jest.advanceTimersByTime(4100);
      });
      expect(recordDetectionEpisode).toHaveBeenCalledTimes(1);
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: 'auto',
          softFired: true,
          dismissedCount: 0,
        })
      );
    });

    it('counts a dismissal before a later manual confirm (softFired + dismissedCount)', () => {
      seedSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainOf('T1', 10)],
        loading: false,
        error: null,
      });
      const { getByTestId, rerender } = render(<RouteGuidanceScreen />);
      // Departure → soft-confirm prompt (softFired=true).
      mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      // Dismiss "아직이에요" (dismissedCount=1), then confirm manually.
      fireEvent.press(getByTestId('guidance-soft-confirm-notyet'));
      fireEvent.press(getByTestId('guidance-next'));
      expect(recordDetectionEpisode).toHaveBeenCalledTimes(1);
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: 'manual',
          softFired: true,
          dismissedCount: 1,
        })
      );
    });

    it('does NOT count opening the sheet via 다른 열차예요 as a dismissal (dismissedCount 0, train-select)', () => {
      // Fix R2-1: opening the train-select sheet from the soft-confirm "다른 열차예요"
      // link routes through openTrainSelect → dismissSoftConfirm, which must not
      // inflate dismissedCount. The same 'train-select' outcome must record
      // dismissedCount 0 regardless of whether the sheet was opened from the
      // waiting-card link or the soft-confirm prompt.
      seedSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainOf('T1', 10)],
        loading: false,
        error: null,
      });
      const { getByTestId, rerender } = render(<RouteGuidanceScreen />);
      // Departure → soft-confirm prompt (softFired=true).
      mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      // "다른 열차예요" opens the sheet (previously this inflated dismissedCount to 1).
      fireEvent.press(getByTestId('guidance-soft-confirm-other'));
      expect(getByTestId('train-select-sheet')).toBeTruthy();
      // Board via the "방금 출발했어요" fallback → train-select confirm.
      fireEvent.press(getByTestId('train-select-now'));
      expect(recordDetectionEpisode).toHaveBeenCalledTimes(1);
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: 'train-select',
          softFired: true,
          dismissedCount: 0,
        })
      );
    });

    it('does not record a detection episode when the bottom button is tapped on a ride step (isWaitingStep gate)', () => {
      // Fix R2-3: only board/transfer holds are detection episodes. The ride
      // "하차했어요"/"환승역에 도착했어요" correction button must never record.
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-next')); // board → ride (records the board hold)
      (recordDetectionEpisode as jest.Mock).mockClear();
      fireEvent.press(getByTestId('guidance-next')); // ride → alight (must NOT record)
      expect(recordDetectionEpisode).not.toHaveBeenCalled();
    });

    it('does not carry a train-select resolution into a later hold (cross-hold resolution reset)', () => {
      // Fix R2-2: after boarding one hold via a train-select pick (resolution
      // 'train-select'), a subsequent hold's manual confirm records 'manual' —
      // never the stale 'train-select'. This asserts the OBSERVABLE cross-hold
      // invariant (resolution never leaks between holds), enforced by the ref
      // reset inside confirmBoardedAt AND the step-transition reset effect. It is
      // NOT a white-box test of handleTrainSelected's mismatch early-return: that
      // branch is a sub-frame defensive guard the reset effect keeps unreachable
      // via UI events (any currentIndex change closes the sheet before a pick),
      // and pendingResolutionRef is assigned only AFTER that guard, so the branch
      // structurally cannot pollute the resolution tag.
      seedTransferSession(); // board(0) → ride(1,2m) → transfer(2)@시청 → ride(3) → alight(4)
      const { getByTestId } = render(<RouteGuidanceScreen />);
      // board(0): confirm via the train-select sheet → records 'train-select'.
      fireEvent.press(getByTestId('guidance-open-train-select'));
      fireEvent.press(getByTestId('train-select-now'));
      expect(recordDetectionEpisode).toHaveBeenLastCalledWith(
        expect.objectContaining({ resolution: 'train-select', stepKind: 'board' })
      );
      // ride(1) is 2min — advance past it so the tick lands on the transfer hold.
      act(() => {
        jest.advanceTimersByTime(2 * 60_000 + 1_000);
      });
      (recordDetectionEpisode as jest.Mock).mockClear();
      // transfer(2): manual confirm → must record 'manual', NOT the earlier 'train-select'.
      fireEvent.press(getByTestId('guidance-next'));
      expect(recordDetectionEpisode).toHaveBeenCalledTimes(1);
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'manual', stepKind: 'transfer' })
      );
    });

    it('excludes the retroactive gap from waitedSec on a train-select pick (R6-1)', () => {
      seedSession();
      // A train that departed 2min after guidance start — the rider actually boarded then.
      appendDepartedTrains([logEntry('T1', T0 + 120_000)], T0);
      const { getByTestId } = render(<RouteGuidanceScreen />);
      // Hold on the board step for 5 minutes before retroactively confirming.
      act(() => {
        jest.advanceTimersByTime(5 * 60_000);
      });
      fireEvent.press(getByTestId('guidance-open-train-select'));
      fireEvent.press(getByTestId('train-select-item-T1'));
      // elapsed at confirm ≈ 300s, boarding atMs = T0+120s → the 180s gap between
      // boarding and confirming is excluded → waitedSec = 120 (actual platform wait).
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'train-select', waitedSec: 120 })
      );
    });

    it('keeps waitedSec = full elapsed on an immediate manual confirm (R6-1 unchanged path)', () => {
      seedSession();
      const { getByTestId } = render(<RouteGuidanceScreen />);
      act(() => {
        jest.advanceTimersByTime(5 * 60_000);
      });
      fireEvent.press(getByTestId('guidance-next'));
      // atMs ≈ now → no retroactive gap → waitedSec equals the full 300s elapsed.
      expect(recordDetectionEpisode).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: 'manual', waitedSec: 300 })
      );
    });
  });

  describe('종점행 선호 (destination preference)', () => {
    /** 나열 한 줄의 최종 색 — isMatch(강조/흐림) 배선을 스타일 비교로 검증한다. */
    const textColorOf = (style: unknown): unknown =>
      (StyleSheet.flatten(style as StyleProp<TextStyle>) as TextStyle | undefined)?.color;

    it('종점행 선호가 있으면 칩 카운트다운이 선호 열차 기준이고 보조 나열은 전체를 보여준다', () => {
      seedBranchSession({ destinationPreferences: { 'p1|5': ['하남검단산'] } });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId, getByText } = render(<RouteGuidanceScreen />);
      // 칩 = 선호(하남검단산, 5분) 기준 — 더 먼저 오는 마천(2분)이 아니다.
      expect(getByTestId('guidance-live-chip')).toHaveTextContent('하남검단산행 5분 00초 후 도착');
      // 보조 나열은 선호와 무관하게 진행 방향 전체(마천 포함)를 도착 순으로 보여준다.
      const preview = getByTestId('guidance-wait-preview');
      // 한 줄에 라벨("다음")+항목들이 모이므로 부분 일치(정규식) 관용구 — 문자열 매처는 exact.
      expect(preview).toHaveTextContent(/마천행 2분/);
      expect(preview).toHaveTextContent(/하남검단산행 5분/);
      // 선호 밖(마천)은 흐림 처리 — isMatch=false가 화면에서 실제로 전달됐다는 증거.
      expect(textColorOf(getByText('마천행 2분').props.style)).not.toBe(
        textColorOf(getByText('하남검단산행 5분').props.style)
      );
      expect(getByTestId('guidance-destination-badge')).toHaveTextContent('하남검단산행만');
      // 알림도 선호 열차 기준.
      expect(scheduleBoardingAlert).toHaveBeenCalledWith(
        expect.objectContaining({ finalDestination: '하남검단산' })
      );
    });

    it('선호 매칭 열차가 없으면 "선택한 종점행 열차가 없어요"를 칩에 표시한다', () => {
      // 저장된 선호(강동)가 현재 도착 리스트(마천·하남검단산)에 없는 상태.
      seedBranchSession({ destinationPreferences: { 'p1|5': ['강동'] } });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId } = render(<RouteGuidanceScreen />);
      expect(getByTestId('guidance-live-chip')).toHaveTextContent('선택한 종점행 열차가 없어요');
      // 나열은 여전히 실제 도착 열차를 보여준다 (정보 은폐 금지).
      const preview = getByTestId('guidance-wait-preview');
      // 한 줄에 라벨("다음")+항목들이 모이므로 부분 일치(정규식) 관용구 — 문자열 매처는 exact.
      expect(preview).toHaveTextContent(/마천행 2분/);
      expect(preview).toHaveTextContent(/하남검단산행 5분/);
      // 선호 밖 열차로는 탑승 알림을 발사하지 않는다.
      expect(scheduleBoardingAlert).not.toHaveBeenCalled();
    });

    it('선호 매칭이 0대로 바뀌면 예약된 pending 탑승 알림을 취소한다', () => {
      // 스펙 §4: 임박 알림은 매칭 열차에만 발사(0대면 미발사). 예약해 둔 알림이
      // 남아 사용자가 제외한 열차로 발사되면 안 된다.
      seedBranchSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId, rerender } = render(<RouteGuidanceScreen />);
      // ① 선호 없음 → 방면 매칭(하남검단산) 열차로 예약된 상태.
      expect(scheduleBoardingAlert).toHaveBeenCalledWith(
        expect.objectContaining({ finalDestination: '하남검단산' })
      );
      // ② 시트에서 마천 선택 → 추적 대상이 마천으로 교체(재예약).
      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      fireEvent.press(getByTestId('destination-option-마천'));
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      expect(scheduleBoardingAlert).toHaveBeenCalledWith(
        expect.objectContaining({ finalDestination: '마천' })
      );
      // ③ 다음 폴링에서 마천이 사라짐 → 추적 0대 전이.
      (cancelBoardingAlert as jest.Mock).mockClear();
      const scheduleCallsBefore = (scheduleBoardingAlert as jest.Mock).mock.calls.length;
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainOnLine('HN', 300, '하남검단산', '5')],
        loading: false,
        error: null,
      });
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      expect(cancelBoardingAlert).toHaveBeenCalled();
      // 남은 하남검단산(선호 밖)으로 새 알림을 예약하지도 않는다.
      expect((scheduleBoardingAlert as jest.Mock).mock.calls.length).toBe(scheduleCallsBefore);
      expect(getByTestId('guidance-live-chip')).toHaveTextContent('선택한 종점행 열차가 없어요');
    });

    it('시트에서 토글하면 세션 선호가 갱신되고 출퇴근 세션이면 updateBoardingPreferences가 호출된다', () => {
      seedBranchSession({ sourceCommuteType: 'morning', ownerUid: 'user-1' });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
      // 선호 없음 → 칩은 기존 방면 매칭(하남검단산) 최선두.
      expect(getByTestId('guidance-live-chip')).toHaveTextContent('하남검단산행 5분 00초 후 도착');
      expect(queryByTestId('destination-filter-sheet')).toBeNull();

      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      expect(getByTestId('destination-filter-sheet')).toBeTruthy();
      fireEvent.press(getByTestId('destination-option-마천'));

      expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'p1|5': ['마천'] });
      // 원격은 맵이 아니라 방금 건드린 키 하나만 받는다 (형제 키 clobber 방지).
      expect(updateBoardingPreferences).toHaveBeenCalledWith('user-1', 'morning', 'p1|5', [
        '마천',
      ]);
      // 세션 사본이 실제로 화면 추적에 반영되는지 (mocked 훅은 비반응형이라 명시 rerender).
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      expect(getByTestId('guidance-live-chip')).toHaveTextContent('마천행 2분 00초 후 도착');
      expect(getByTestId('guidance-destination-badge')).toHaveTextContent('마천행만');
    });

    it('원격 write-back은 토글한 구간 키만 대상이다 (형제 키 무접촉)', () => {
      // attach가 늦게 도착/실패해 세션 사본이 원격 전체를 담고 있지 않은 상태에서
      // 토글해도, 맵 전체 치환이 아니라 키 하나만 쓰므로 같은 leg의 다른 구간 키
      // ('s9|8')가 원격에서 소멸할 수 없다.
      seedBranchSession({
        sourceCommuteType: 'morning',
        ownerUid: 'user-1',
        destinationPreferences: { 's9|8': ['암사'] },
      });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      fireEvent.press(getByTestId('destination-option-마천'));

      expect(updateBoardingPreferences).toHaveBeenCalledTimes(1);
      expect(updateBoardingPreferences).toHaveBeenCalledWith('user-1', 'morning', 'p1|5', [
        '마천',
      ]);
      // 로컬 세션 사본은 형제 키를 그대로 유지한다.
      expect(getGuidanceSession()?.destinationPreferences).toEqual({
        's9|8': ['암사'],
        'p1|5': ['마천'],
      });
      // 같은 옵션을 다시 탭 = 해제 → 그 키만 null(=원격 삭제)로 보낸다.
      fireEvent.press(getByTestId('destination-option-마천'));
      expect(updateBoardingPreferences).toHaveBeenLastCalledWith(
        'user-1',
        'morning',
        'p1|5',
        null
      );
      expect(getGuidanceSession()?.destinationPreferences).toEqual({ 's9|8': ['암사'] });
    });

    it('일반 검색 세션(sourceCommuteType 없음)은 시트 토글해도 원격 저장하지 않는다', () => {
      seedBranchSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      fireEvent.press(getByTestId('destination-option-마천'));
      // 세션 한정 적용 — 원본(CommuteRoute)에는 쓰지 않는다.
      expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'p1|5': ['마천'] });
      expect(updateBoardingPreferences).not.toHaveBeenCalled();
    });

    it('다른 계정이 시작한 세션(ownerUid 불일치)은 원격 저장하지 않고 세션 한정으로 강등한다', () => {
      // 영속 세션이 로그아웃/계정 전환을 넘겨 살아남은 상태 — 재개 후 토글이 이전
      // 탑승자의 선택을 현재 계정(user-1)의 commuteSettings에 기록하면 안 된다.
      seedBranchSession({ sourceCommuteType: 'morning', ownerUid: 'other-user' });
      mockedUseRealtimeTrains.mockReturnValue({
        trains: branchTrains(),
        loading: false,
        error: null,
      });
      const { getByTestId } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      fireEvent.press(getByTestId('destination-option-마천'));
      expect(updateBoardingPreferences).not.toHaveBeenCalled();
      // 필터 자체는 살아 있다 — 원격 쓰기만 막고 세션 한정으로 강등(기능 무력화 아님).
      expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'p1|5': ['마천'] });
    });

    it('종점행 선택 시트가 열려 있는 동안에는 soft-confirm 자동 진행을 걸지 않는다', () => {
      // 열차 선택 시트와 같은 원칙 — 시트 뒤에서 여정이 자동 진행되면 시트가 강제로
      // 닫히고 사용자가 고르던 선택이 사라진다.
      seedSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainOf('T1', 10)],
        loading: false,
        error: null,
      });
      const { getByTestId, getByText, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      expect(getByTestId('destination-filter-sheet')).toBeTruthy();
      // 시트가 열린 동안 T1이 출발한 스냅샷이 도착.
      mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      expect(queryByTestId('guidance-soft-confirm')).toBeNull();
      // 유예 창을 지나도 자동 진행 없음 — 여전히 탑승 대기, 시트도 열린 채.
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(getByText('탑승 대기')).toBeTruthy();
      expect(getByTestId('destination-filter-sheet')).toBeTruthy();
      // 출발 기록은 계속 쌓인다 (감지 억제 ≠ 로깅 중단).
      fireEvent.press(getByTestId('guidance-open-train-select'));
      expect(getByTestId('train-select-item-T1')).toBeTruthy();
    });

    it('이미 걸린 soft-confirm 자동 진행을 종점행 시트를 열 때 해제한다', () => {
      // arm 가드는 새 arm만 막는다 — 감지가 먼저 타이머를 걸어둔 뒤 시트를 열면
      // 모달 뒤에서 자동 진행이 발화해 시트가 stale 스텝을 가리키게 된다.
      seedSession();
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [trainOf('T1', 10)],
        loading: false,
        error: null,
      });
      const { getByTestId, getByText, queryByTestId, rerender } = render(<RouteGuidanceScreen />);
      // 두 번째 스냅샷: T1 사라짐 → soft-confirm 표시(4초 타이머 armed).
      mockedUseRealtimeTrains.mockReturnValue({ trains: [], loading: false, error: null });
      act(() => {
        rerender(<RouteGuidanceScreen />);
      });
      expect(getByTestId('guidance-soft-confirm')).toBeTruthy();
      // 유예 타이머가 pending인 상태에서 종점행 시트를 연다.
      fireEvent.press(getByTestId('guidance-open-destination-filter'));
      expect(getByTestId('destination-filter-sheet')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(queryByTestId('guidance-soft-confirm')).toBeNull();
      // 자동 진행 없음(여전히 탑승 대기) + 시트도 강제로 닫히지 않는다.
      expect(getByText('탑승 대기')).toBeTruthy();
      expect(getByTestId('destination-filter-sheet')).toBeTruthy();
    });

    it('선호 없음이면 기존 방면 필터 동작 그대로다 (칩=방면 매칭 최선두)', () => {
      seedSession(); // 2호선 을지로3가→시청, 방면 = 산곡
      mockedUseRealtimeTrains.mockReturnValue({
        trains: [
          trainOf('OPP', 60, '을지로3가'), // 반대 방면 — 더 먼저 도착
          trainOf('T1', 90, '산곡'), // 진행 방면
        ],
        loading: false,
        error: null,
      });
      const { getByTestId, queryByTestId } = render(<RouteGuidanceScreen />);
      // 칩·알림은 기존과 동일하게 방면 매칭 열차(90초) 기준.
      expect(getByTestId('guidance-live-chip')).toHaveTextContent('산곡행 1분 30초 후 도착');
      expect(scheduleBoardingAlert).toHaveBeenCalledWith(
        expect.objectContaining({ finalDestination: '산곡' })
      );
      // 필터 미선택 → 뱃지 없음.
      expect(queryByTestId('guidance-destination-badge')).toBeNull();
    });
  });
});
