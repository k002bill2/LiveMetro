import { createRoute, type RouteSegment } from '@/models/route';
import {
  buildGuidanceCommuteLogInput,
  completeGuidanceCommuteLog,
  startGuidanceCommuteLog,
} from '../guidanceCommuteLogService';
import {
  clearGuidanceSession,
  getGuidanceSession,
  setGuidanceSession,
} from '../guidanceSessionStore';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import type { GuidanceSession } from '@/models/guidance';

// findAdoptableOpenLog is a pure helper; reimplement it inline rather than
// requireActual (which would load the real firebase config module side effects).
jest.mock('@/services/pattern/commuteLogService', () => ({
  commuteLogService: {
    logCommute: jest.fn(),
    updateLog: jest.fn(),
    getTodayLogsByDeparture: jest.fn(),
  },
  findAdoptableOpenLog: (
    logs: readonly { arrivalStationName?: string; arrivalTime?: string }[],
    arrivalStationName: string
  ) => {
    const open = logs.filter((log) => !log.arrivalTime);
    const exact = open.find((log) => log.arrivalStationName === arrivalStationName);
    if (exact) return { log: exact, needsRepair: false };
    const stub = open.find((log) => log.arrivalStationName === '');
    if (stub) return { log: stub, needsRepair: true };
    return null;
  },
}));

const mockedLogCommute = commuteLogService.logCommute as jest.Mock;
const mockedUpdateLog = commuteLogService.updateLog as jest.Mock;
const mockedGetTodayLogsByDeparture =
  commuteLogService.getTodayLogsByDeparture as jest.Mock;

const hop = (
  fromStationId: string,
  fromStationName: string,
  toStationId: string,
  toStationName: string,
  lineId: string,
  estimatedMinutes: number
): RouteSegment => ({
  fromStationId,
  fromStationName,
  toStationId,
  toStationName,
  lineId,
  lineName: `${lineId}호선`,
  estimatedMinutes,
  isTransfer: false,
});

const transfer = (stationId: string, stationName: string): RouteSegment => ({
  fromStationId: stationId,
  fromStationName: stationName,
  toStationId: stationId,
  toStationName: stationName,
  lineId: '7',
  lineName: '7호선',
  estimatedMinutes: 4,
  isTransfer: true,
});

const STARTED_AT = new Date(2026, 5, 29, 8, 7, 30).getTime();
const COMPLETED_AT = new Date(2026, 5, 29, 8, 42, 10).getTime();

const makeSession = (overrides: Partial<GuidanceSession> = {}): GuidanceSession => ({
  route: createRoute([
    hop('0201', '시청', '0202', '을지로입구', '2', 2),
    transfer('0202', '을지로입구'),
    hop('0701', '을지로입구', '0702', '건대입구', '7', 3),
  ]),
  fromStationName: '시청',
  toStationName: '건대입구',
  startedAt: STARTED_AT,
  ...overrides,
});

describe('guidanceCommuteLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearGuidanceSession();
    // Default: no pre-existing same-leg log (leg-aware adoption lookup).
    mockedGetTodayLogsByDeparture.mockResolvedValue([]);
  });

  afterEach(() => {
    clearGuidanceSession();
  });

  it('builds a commute log input from a guidance session', () => {
    const input = buildGuidanceCommuteLogInput(makeSession(), COMPLETED_AT);
    expect(input).toEqual(
      expect.objectContaining({
        departureStationId: '0201',
        departureStationName: '시청',
        arrivalStationId: '0702',
        arrivalStationName: '건대입구',
        lineIds: ['2', '7'],
        departureTime: '08:07',
        arrivalTime: '08:42',
        isManual: false,
      })
    );
  });

  it('creates a departure log and stores its id on the active session', async () => {
    const session = makeSession();
    setGuidanceSession(session);
    mockedLogCommute.mockResolvedValue({ id: 'log-1' });

    await startGuidanceCommuteLog('user-1', session);

    expect(mockedLogCommute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        departureTime: '08:07',
      })
    );
    expect(mockedLogCommute.mock.calls[0]?.[1]).not.toHaveProperty('arrivalTime');
    expect(getGuidanceSession()?.commuteLogId).toBe('log-1');
  });

  it('updates arrivalTime on an existing commute log when guidance completes', async () => {
    const session = makeSession({ commuteLogId: 'log-1' });
    setGuidanceSession(session);
    mockedUpdateLog.mockResolvedValue(undefined);

    await completeGuidanceCommuteLog('user-1', session, COMPLETED_AT);

    expect(mockedUpdateLog).toHaveBeenCalledWith('user-1', 'log-1', {
      arrivalTime: '08:42',
    });
    expect(getGuidanceSession()).toEqual(
      expect.objectContaining({
        commuteLogId: 'log-1',
        commuteLogCompletedAt: COMPLETED_AT,
      })
    );
  });

  it('creates a complete log if the departure log id is not available', async () => {
    const session = makeSession();
    setGuidanceSession(session);
    mockedLogCommute.mockResolvedValue({ id: 'log-2' });

    await completeGuidanceCommuteLog('user-1', session, COMPLETED_AT);

    expect(mockedLogCommute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        departureTime: '08:07',
        arrivalTime: '08:42',
      })
    );
    expect(getGuidanceSession()?.commuteLogId).toBe('log-2');
  });

  it('adopts an existing same-leg open log instead of creating a duplicate (bug1)', async () => {
    const session = makeSession();
    setGuidanceSession(session);
    // Settings auto-log already created an open log for this leg (시청→건대입구),
    // with a different id domain but the same departure and destination.
    mockedGetTodayLogsByDeparture.mockResolvedValue([
      {
        id: 'auto-log',
        departureStationName: '시청',
        arrivalStationName: '건대입구',
        arrivalTime: undefined,
      },
    ]);
    mockedUpdateLog.mockResolvedValue(undefined);

    await startGuidanceCommuteLog('user-1', session);

    expect(mockedGetTodayLogsByDeparture).toHaveBeenCalledWith('user-1', '시청');
    // No new doc — adopt the existing one and refresh its measured departure.
    // Exact destination match → only departureTime is touched (no route repair).
    expect(mockedLogCommute).not.toHaveBeenCalled();
    expect(mockedUpdateLog).toHaveBeenCalledWith('user-1', 'auto-log', {
      departureTime: '08:07',
    });
    expect(getGuidanceSession()?.commuteLogId).toBe('auto-log');
  });

  it('repairs a destination-less stub on adoption (departure + route fields)', async () => {
    const session = makeSession();
    setGuidanceSession(session);
    // autoLogIfAppropriate stub: same departure, empty destination, still open.
    mockedGetTodayLogsByDeparture.mockResolvedValue([
      {
        id: 'stub-log',
        departureStationName: '시청',
        arrivalStationId: '',
        arrivalStationName: '',
        arrivalTime: undefined,
      },
    ]);
    mockedUpdateLog.mockResolvedValue(undefined);

    await startGuidanceCommuteLog('user-1', session);

    expect(mockedLogCommute).not.toHaveBeenCalled();
    expect(mockedUpdateLog).toHaveBeenCalledWith('user-1', 'stub-log', {
      departureTime: '08:07',
      arrivalStationId: '0702',
      arrivalStationName: '건대입구',
      lineIds: ['2', '7'],
    });
    expect(getGuidanceSession()?.commuteLogId).toBe('stub-log');
  });

  it('does not adopt a same-departure open log heading elsewhere (leg match)', async () => {
    const session = makeSession();
    setGuidanceSession(session);
    // Same departure (시청) but a different destination than this session.
    mockedGetTodayLogsByDeparture.mockResolvedValue([
      {
        id: 'other-dest-log',
        departureStationName: '시청',
        arrivalStationName: '왕십리',
        arrivalTime: undefined,
      },
    ]);
    mockedLogCommute.mockResolvedValue({ id: 'log-new' });

    await startGuidanceCommuteLog('user-1', session);

    // The other-destination log is left untouched; a fresh log is created.
    expect(mockedUpdateLog).not.toHaveBeenCalled();
    expect(mockedLogCommute).toHaveBeenCalledTimes(1);
    expect(getGuidanceSession()?.commuteLogId).toBe('log-new');
  });

  it('uses the live store session commuteLogId when the arg session lacks it (bug2)', async () => {
    // Screen froze a session snapshot without commuteLogId; the store gained it
    // asynchronously (same startedAt).
    const argSession = makeSession();
    setGuidanceSession(makeSession({ commuteLogId: 'log-live' }));
    mockedUpdateLog.mockResolvedValue(undefined);

    await completeGuidanceCommuteLog('user-1', argSession, COMPLETED_AT);

    expect(mockedUpdateLog).toHaveBeenCalledWith('user-1', 'log-live', {
      arrivalTime: '08:42',
    });
    expect(mockedLogCommute).not.toHaveBeenCalled();
  });

  it('adopts a same-leg open log on complete when no session id is present', async () => {
    const session = makeSession();
    setGuidanceSession(session);
    mockedGetTodayLogsByDeparture.mockResolvedValue([
      {
        id: 'open-log',
        departureStationName: '시청',
        arrivalStationName: '건대입구',
        arrivalTime: undefined,
      },
    ]);
    mockedUpdateLog.mockResolvedValue(undefined);

    await completeGuidanceCommuteLog('user-1', session, COMPLETED_AT);

    expect(mockedUpdateLog).toHaveBeenCalledWith('user-1', 'open-log', {
      arrivalTime: '08:42',
    });
    expect(mockedLogCommute).not.toHaveBeenCalled();
  });
});
