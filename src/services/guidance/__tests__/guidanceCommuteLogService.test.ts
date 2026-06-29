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

jest.mock('@/services/pattern/commuteLogService', () => ({
  commuteLogService: {
    logCommute: jest.fn(),
    updateLog: jest.fn(),
  },
}));

const mockedLogCommute = commuteLogService.logCommute as jest.Mock;
const mockedUpdateLog = commuteLogService.updateLog as jest.Mock;

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
});
