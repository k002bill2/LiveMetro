/**
 * Pattern Analysis Service Tests
 */

import { patternAnalysisService } from '../patternAnalysisService';
import {
  DayOfWeek,
  DEFAULT_WALK_TO_STATION_MIN,
  DEFAULT_WAIT_MIN,
  DEFAULT_WALK_TO_DEST_MIN,
  calculateAverageTime,
} from '@/models/pattern';
import * as routeService from '@/services/route/routeService';
import { loadCommuteRoutesOrThrow } from '@/services/commute/commuteService';
import { doc as firestoreDoc } from 'firebase/firestore';

import { commuteLogService } from '../commuteLogService';

jest.mock('@/services/route/routeService');
const mockedCalculateRoute = routeService.calculateRoute as jest.MockedFunction<
  typeof routeService.calculateRoute
>;

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mockDocRef'),
  collection: jest.fn(() => 'mockCollectionRef'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

// Mock pattern model — partial mock: keep real constants & derived helpers
// (DEFAULT_*_MIN, computeArrivalTime, deriveDirection) via requireActual so
// producer logic uses canonical values, but override unit-level helpers we
// stub for test ergonomics.
jest.mock('@/models/pattern', () => {
  const actual = jest.requireActual('@/models/pattern');
  return {
    ...actual,
    DayOfWeek: 0,
    // Mirrors the real SSOT (pattern.ts) lowered 3 → 1: a single log now
    // establishes a weekday pattern (notification gate stays protected by
    // hasTodayPattern's confidence >= 0.5, exercised in pattern.test.ts).
    MIN_LOGS_FOR_PATTERN: 1,
    getDayOfWeek: jest.fn(() => 1),
    formatDateString: jest.fn((date) => date.toISOString().split('T')[0]),
    isWeekday: jest.fn((day: number) => day >= 1 && day <= 5),
    calculateAverageTime: jest.fn(() => '08:30'),
    calculateTimeStdDev: jest.fn(() => 10),
    calculateConfidence: jest.fn(() => 0.8),
    calculateAlertTime: jest.fn(() => '08:00'),
    fromCommutePatternDoc: jest.fn((userId: string, data: any) => ({
      userId,
      dayOfWeek: data.dayOfWeek,
      avgDepartureTime: data.avgDepartureTime,
      stdDevMinutes: data.stdDevMinutes,
      frequentRoute: data.frequentRoute,
      confidence: data.confidence,
      sampleCount: data.sampleCount,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    })),
  };
});

// Mock commuteLogService
jest.mock('../commuteLogService', () => ({
  commuteLogService: {
    getRecentLogsForAnalysis: jest.fn(),
  },
  RECENT_LOGS_ANALYSIS_LIMIT: 100,
}));

// Pattern building scopes logs to the configured morning OD. Default: no
// settings (fallback path); tests that need an OD use mockResolvedValueOnce
// so the override never leaks into neighboring tests. The strict variant is
// used so a read FAILURE (reject) is distinguishable from absence (null).
jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutesOrThrow: jest.fn(async () => null),
}));

// Mirror the real analysis fetch cap — the sweep must detect truncation.
const ANALYSIS_LIMIT = 100;

describe('PatternAnalysisService', () => {
  const mockLogs = [
    {
      id: 'log-1',
      userId: 'user-123',
      date: '2024-01-15',
      dayOfWeek: 1 as DayOfWeek,
      departureTime: '08:30',
      arrivalTime: '09:00',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      id: 'log-2',
      userId: 'user-123',
      date: '2024-01-22',
      dayOfWeek: 1 as DayOfWeek,
      departureTime: '08:25',
      arrivalTime: '08:55',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: new Date('2024-01-22'),
      updatedAt: new Date('2024-01-22'),
    },
    {
      id: 'log-3',
      userId: 'user-123',
      date: '2024-01-29',
      dayOfWeek: 1 as DayOfWeek,
      departureTime: '08:35',
      arrivalTime: '09:05',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: new Date('2024-01-29'),
      updatedAt: new Date('2024-01-29'),
    },
  ];

  const mockPatternDoc = {
    exists: () => true,
    data: () => ({
      dayOfWeek: 1,
      avgDepartureTime: '08:30',
      stdDevMinutes: 10,
      frequentRoute: {
        departureStationId: 'gangnam',
        departureStationName: '강남',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
      },
      confidence: 0.8,
      sampleCount: 3,
      lastUpdated: { toDate: () => new Date('2024-01-29') },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeAndUpdatePatterns', () => {
    it('should analyze logs and return patterns', async () => {
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(mockLogs);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.dayOfWeek).toBe(1);
    });

    it('should return empty array if no logs', async () => {
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([]);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toEqual([]);
    });

    // OD 스코핑 픽스처 — 같은 요일(월)에 아침 강남→잠실 3건 + 저녁 잠실→강남 3건.
    // 패턴 통계가 leg를 섞으면 avg/표본이 무의미해진다 (prod: avgDep 13:15, ±311분).
    const odLog = (
      id: string,
      departureTime: string,
      dep: { id: string; name: string },
      arr: { id: string; name: string },
    ) => ({
      ...mockLogs[0]!,
      id,
      departureTime,
      departureStationId: dep.id,
      departureStationName: dep.name,
      arrivalStationId: arr.id,
      arrivalStationName: arr.name,
    });
    const GANGNAM = { id: 'gangnam', name: '강남' };
    const JAMSIL = { id: 'jamsil', name: '잠실' };
    const mixedLegLogs = [
      odLog('m1', '08:30', GANGNAM, JAMSIL),
      odLog('m2', '08:25', GANGNAM, JAMSIL),
      odLog('m3', '08:35', GANGNAM, JAMSIL),
      odLog('e1', '18:50', JAMSIL, GANGNAM),
      odLog('e2', '18:55', JAMSIL, GANGNAM),
      odLog('e3', '19:05', JAMSIL, GANGNAM),
    ];

    it('scopes pattern stats to the configured morning OD — no leg mixing', async () => {
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '2',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: '2',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        mixedLegLogs,
      );
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(3);
      expect(result[0]?.frequentRoute.departureStationName).toBe('강남');
      expect(result[0]?.frequentRoute.arrivalStationName).toBe('잠실');
      // The average is computed over morning departures ONLY — the direct
      // proof that evening rows were excluded before any math ran.
      expect(calculateAverageTime).toHaveBeenCalledWith(['08:30', '08:25', '08:35']);
    });

    it('falls back to the dominant OD when no commute settings exist', async () => {
      // loadCommuteRoutes default mock → null. Dominant OD = 잠실→강남 (3 vs 2).
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        odLog('e1', '18:50', JAMSIL, GANGNAM),
        odLog('e2', '18:55', JAMSIL, GANGNAM),
        odLog('e3', '19:05', JAMSIL, GANGNAM),
        odLog('m1', '08:30', GANGNAM, JAMSIL),
        odLog('m2', '08:25', GANGNAM, JAMSIL),
      ]);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(3);
      expect(result[0]?.frequentRoute.departureStationName).toBe('잠실');
    });

    it('never deletes pattern docs on the no-settings fallback path (Codex P1)', async () => {
      // loadCommuteRoutes returns null for BOTH "no settings" and "transient
      // read error" — indistinguishable by contract. A destructive sweep on
      // that path could wipe a valid morning model over a network blip, so
      // deletion requires an actually-loaded morning OD.
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        mixedLegLogs,
      );
      mockSetDoc.mockResolvedValue(undefined);

      await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('excludes destination-less stubs from the dominant-OD fallback (Codex P2)', async () => {
      // autoLogIfAppropriate stubs carry arrivalStationName '' — if they
      // outnumber complete logs the fallback would persist an "origin→(empty)"
      // pattern that no route calculation can ever serve.
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        odLog('s1', '08:20', GANGNAM, { id: '', name: '' }),
        odLog('s2', '08:22', GANGNAM, { id: '', name: '' }),
        odLog('s3', '08:24', GANGNAM, { id: '', name: '' }),
        odLog('m1', '08:30', GANGNAM, JAMSIL),
        odLog('m2', '08:25', GANGNAM, JAMSIL),
      ]);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(2);
      expect(result[0]?.frequentRoute.arrivalStationName).toBe('잠실');
    });

    it('yields no patterns (and clears all days) when settings exist but no log matches the morning OD', async () => {
      // Honest empty beats mislabeled data: with a configured morning OD and
      // only other-leg logs, publishing the dominant (evening) OD would put
      // evening stats behind a morning-commute surface. Docs are cleared so
      // stale mixed-leg patterns stop serving.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: '3762',
          departureStationName: '산곡',
          departureLineId: '7',
          arrivalStationId: '1023',
          arrivalStationName: '선릉',
          arrivalLineId: 'bundang',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        mixedLegLogs, // 강남↔잠실뿐 — 산곡→선릉 매칭 0건
      );
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toEqual([]);
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockDeleteDoc).toHaveBeenCalledTimes(7);
    });

    it('matches the morning OD by station NAME so writer id domains do not split it', async () => {
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '2',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: '2',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      // Same physical OD logged by two writers with different id domains.
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        odLog('a', '08:30', { id: 'gangnam', name: '강남' }, { id: 'jamsil', name: '잠실' }),
        odLog('b', '08:25', { id: '0222', name: '강남' }, { id: '0216', name: '잠실' }),
        odLog('c', '18:50', JAMSIL, GANGNAM),
      ]);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(2);
    });

    it('clears stale pattern docs for weekdays absent from the recomputed set (Codex P2)', async () => {
      // Pre-scoping recomputes wrote a doc for every day that had ANY log.
      // After OD scoping, days whose logs were all the other leg produce no
      // pattern — their old mixed-leg docs must be deleted, or getPatternForDay
      // keeps serving the contaminated stats this change exists to kill.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '2',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: '2',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        mixedLegLogs,
      );
      mockSetDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      // Only day 1 survived scoping — the other six days are invalidated.
      expect(mockDeleteDoc).toHaveBeenCalledTimes(6);
      const docDayArgs = (firestoreDoc as jest.Mock).mock.calls.map(
        (call) => call[call.length - 1],
      );
      expect(docDayArgs).toEqual(
        expect.arrayContaining(['0', '2', '3', '4', '5', '6']),
      );
    });

    it('does not delete any pattern doc when the log fetch comes back empty', async () => {
      // getRecentLogsForAnalysis returns [] on errors too (error-handling
      // rule) — a transient empty read must never wipe existing patterns.
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([]);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toEqual([]);
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('serves stored patterns untouched when the settings read fails (Codex P1)', async () => {
      // Unreadable ≠ absent: recomputing on the fallback during a transient
      // outage could publish the wrong leg over a valid morning model. On a
      // settings read failure nothing is written or deleted — the stored
      // patterns are returned as-is.
      (loadCommuteRoutesOrThrow as jest.Mock).mockRejectedValueOnce(
        new Error('firestore unavailable'),
      );
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => mockPatternDoc.data() }],
      });

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.dayOfWeek).toBe(1);
      expect(commuteLogService.getRecentLogsForAnalysis).not.toHaveBeenCalled();
      expect(mockSetDoc).not.toHaveBeenCalled();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('treats an incomplete morningRoute as no settings — fallback scoping, no sweep (Codex P1)', async () => {
      // Legacy/partial settings docs can carry a truthy morningRoute with
      // empty station names. Treating that as a real OD would match zero logs
      // and turn EVERY recompute into a 7-day doc wipe.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: { departureStationName: '', arrivalStationName: '' },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        mixedLegLogs,
      );
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(3);
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('shares one in-flight recompute between concurrent callers (Codex P2)', async () => {
      // WeeklyPredictionScreen mounts useCommutePattern twice (directly and
      // via usePredictionFactors); two interleaved recomputes could let the
      // older run finish last and clobber the newer run's saves.
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        mockLogs[0],
      ]);
      mockSetDoc.mockResolvedValue(undefined);

      const [first, second] = await Promise.all([
        patternAnalysisService.analyzeAndUpdatePatterns('user-123'),
        patternAnalysisService.analyzeAndUpdatePatterns('user-123'),
      ]);

      expect(commuteLogService.getRecentLogsForAnalysis).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('counts departure-matching stubs as morning samples and takes the route from settings (Codex P1)', async () => {
      // A destination-less stub whose departure matches the morning OD is most
      // plausibly an arrival-never-stamped morning commute (same semantics as
      // findAdoptableOpenLog). It contributes a departure-time sample, and the
      // persisted route comes from the settings themselves — by definition the
      // morning route — so stub arrival '' can never be persisted.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '2',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: '2',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        odLog('m1', '08:30', GANGNAM, JAMSIL),
        odLog('s1', '08:20', GANGNAM, { id: '', name: '' }),
        odLog('s2', '08:25', GANGNAM, { id: '', name: '' }),
        odLog('e1', '18:50', JAMSIL, GANGNAM),
      ]);
      mockSetDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(3);
      expect(result[0]?.frequentRoute.arrivalStationName).toBe('잠실');
      expect(result[0]?.frequentRoute.arrivalStationId).toBe('jamsil');
    });

    it('does not wipe all patterns when only departure-matching stubs remain (Codex P1)', async () => {
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '2',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: '2',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        odLog('s1', '08:20', GANGNAM, { id: '', name: '' }),
        odLog('s2', '08:25', GANGNAM, { id: '', name: '' }),
      ]);
      mockSetDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      // Day 1 keeps a pattern (2 stub departures); only the other 6 are swept.
      expect(result).toHaveLength(1);
      expect(result[0]?.sampleCount).toBe(2);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(6);
    });

    it('includes transfer-station lines in the settings-derived route (Codex P2)', async () => {
      // Delay checks consume frequentRoute.lineIds as "lines to watch" — a
      // 7→2→분당 route must not silently drop the middle line.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '7',
          transferStations: [
            { stationId: 'x1', stationName: '환승1', lineId: '2', lineName: '2호선', order: 1 },
          ],
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: 'bundang',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        odLog('m1', '08:30', GANGNAM, JAMSIL),
      ]);
      mockSetDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result[0]?.frequentRoute.lineIds).toEqual(['7', '2', 'bundang']);
    });

    it('skips the stale-day sweep when the log fetch hit the query cap (Codex P2)', async () => {
      // At exactly the fetch limit, older days may have been paged out of the
      // window — "absent from the result" no longer proves "no logs exist",
      // so deleting those days would destroy valid patterns.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationId: 'gangnam',
          departureStationName: '강남',
          departureLineId: '2',
          arrivalStationId: 'jamsil',
          arrivalStationName: '잠실',
          arrivalLineId: '2',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      const cappedLogs = Array.from({ length: ANALYSIS_LIMIT }, (_, i) =>
        odLog(`m${i}`, '08:30', GANGNAM, JAMSIL),
      );
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        cappedLogs,
      );
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(mockSetDoc).toHaveBeenCalled();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('treats a morningRoute with names but missing ids as no settings (Codex P2)', async () => {
      // settingsRoute would otherwise carry undefined station ids into
      // setDoc, which Firestore rejects client-side (the #291 undefined-field
      // class) — recomputation would fail on every run instead of falling
      // back to log-derived data.
      (loadCommuteRoutesOrThrow as jest.Mock).mockResolvedValueOnce({
        morningRoute: {
          departureStationName: '강남',
          arrivalStationName: '잠실',
        },
        eveningRoute: null,
        eveningEnabled: true,
        createdAt: null,
        updatedAt: null,
      });
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue(
        mixedLegLogs,
      );
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.frequentRoute.departureStationId).toBe('gangnam');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('creates a pattern from a single log now that the threshold is 1', async () => {
      // MIN_LOGS_FOR_PATTERN lowered 3 → 1: one log on a weekday is enough to
      // key that day, so the analysis surfaces a pattern instead of nothing.
      (commuteLogService.getRecentLogsForAnalysis as jest.Mock).mockResolvedValue([
        mockLogs[0],
      ]);
      mockSetDoc.mockResolvedValue(undefined);

      const result = await patternAnalysisService.analyzeAndUpdatePatterns('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.dayOfWeek).toBe(1);
      expect(result[0]?.sampleCount).toBe(1);
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => mockPatternDoc.data() }],
      });

      const result = await patternAnalysisService.getPatterns('user-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('getPatternForDay', () => {
    it('should return pattern for specific day', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getPatternForDay('user-123', 1 as DayOfWeek);

      expect(result).not.toBeNull();
      expect(result?.avgDepartureTime).toBe('08:30');
    });

    it('should return null if pattern not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.getPatternForDay('user-123', 6 as DayOfWeek);

      expect(result).toBeNull();
    });
  });

  describe('predictCommute', () => {
    it('should return prediction based on pattern', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.predictCommute('user-123');

      expect(result).not.toBeNull();
      expect(result?.predictedDepartureTime).toBe('08:30');
    });

    it('should return null if no pattern exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.predictCommute('user-123');

      expect(result).toBeNull();
    });
  });

  describe('predictCommute — derived fields on route success', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('populates transitSegments, walk/wait scalars, predictedMinutes, predictedArrivalTime, range, direction', async () => {
      const stubPattern = {
        userId: 'u1',
        dayOfWeek: 2 as DayOfWeek,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: '0150',
          departureStationName: '서울역',
          arrivalStationId: '0220',
          arrivalStationName: '강남역',
          lineIds: ['1'],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date('2026-05-12'),
      };
      jest
        .spyOn(patternAnalysisService, 'getPatternForDay')
        .mockResolvedValueOnce(stubPattern);

      mockedCalculateRoute.mockReturnValueOnce({
        segments: [
          {
            fromStationId: '0150', fromStationName: '서울역',
            toStationId: '0151', toStationName: '시청',
            lineId: '1', lineName: '1호선',
            estimatedMinutes: 20, isTransfer: false,
          },
        ],
        totalMinutes: 20,
        transferCount: 0,
        lineIds: ['1'],
      });

      const result = await patternAnalysisService.predictCommute(
        'u1',
        new Date('2026-05-12'),
      );

      expect(result).not.toBeNull();
      expect(result?.transitSegments).toHaveLength(1);
      expect(result?.transitSegments?.[0]?.congestionForecast).toBeUndefined();
      expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
      expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
      expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
      expect(result?.predictedMinutes).toBe(4 + 3 + 3 + 20); // 30
      expect(result?.predictedArrivalTime).toBe('08:30');
      expect(result?.predictedMinutesRange).toEqual([27, 33]);
      expect(result?.direction).toBe('up');
    });

    it('resolves external station_cd ids (prod pattern docs) to internal slugs for the route graph', async () => {
      // Prod commutePatterns docs persist Seoul API station_cd ids ("3762"
      // 산곡 / "1023" 선릉) because logs carry that domain. The route graph is
      // slug-keyed, so unresolved ids made every weekday prediction lose its
      // duration (weekly trend fell back to a fabricated 30min).
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 4 as DayOfWeek,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: '3762',
          departureStationName: '산곡',
          arrivalStationId: '1023',
          arrivalStationName: '선릉',
          lineIds: ['7', '수인분당선'],
        },
        confidence: 0.5,
        sampleCount: 8,
        lastUpdated: new Date('2026-08-13'),
      });
      mockedCalculateRoute.mockReturnValueOnce({
        segments: [
          {
            fromStationId: 's_ec82b0ea', fromStationName: '산곡',
            toStationId: 'seolleung', toStationName: '선릉',
            lineId: '7', lineName: '7호선',
            estimatedMinutes: 68, isTransfer: false,
          },
        ],
        totalMinutes: 68,
        transferCount: 0,
        lineIds: ['7'],
      });

      const result = await patternAnalysisService.predictCommute(
        'u1',
        new Date('2026-08-13'),
      );

      // Real join through stationIdResolver's data files — not a mock.
      expect(mockedCalculateRoute).toHaveBeenCalledWith('s_ec82b0ea', 'seolleung');
      expect(result?.predictedMinutes).toBe(4 + 3 + 3 + 68);
    });

    it('passes unresolvable ids through unchanged (soft-fail path stays reachable)', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as DayOfWeek,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: 'no-such-id',
          departureStationName: 'X',
          arrivalStationId: 'also-unknown',
          arrivalStationName: 'Y',
          lineIds: [],
        },
        confidence: 0.5,
        sampleCount: 8,
        lastUpdated: new Date('2026-08-13'),
      });
      mockedCalculateRoute.mockReturnValueOnce(null);

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(mockedCalculateRoute).toHaveBeenCalledWith('no-such-id', 'also-unknown');
      expect(result?.predictedMinutes).toBeUndefined();
    });

    it('returns base fields with transit/total/range undefined when calculateRoute returns null', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as const,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: 'unknown-from',
          departureStationName: 'X',
          arrivalStationId: 'unknown-to',
          arrivalStationName: 'Y',
          lineIds: [],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockReturnValueOnce(null);

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(result).not.toBeNull();
      expect(result?.transitSegments).toBeUndefined();
      expect(result?.predictedMinutes).toBeUndefined();
      expect(result?.predictedArrivalTime).toBeUndefined();
      expect(result?.predictedMinutesRange).toBeUndefined();
      expect(result?.direction).toBeUndefined();
      expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
      expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
      expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
      expect(result?.predictedDepartureTime).toBe('08:00');
      expect(result?.confidence).toBe(0.8);
    });

    it('soft-fails to base when calculateRoute throws', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as const,
        avgDepartureTime: '08:00',
        stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: 'a', departureStationName: 'A',
          arrivalStationId: 'b', arrivalStationName: 'B',
          lineIds: ['1'],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(result).not.toBeNull();
      expect(result?.transitSegments).toBeUndefined();
      expect(result?.predictedMinutes).toBeUndefined();
      expect(result?.predictedArrivalTime).toBeUndefined();
      expect(result?.predictedMinutesRange).toBeUndefined();
      expect(result?.direction).toBeUndefined();
      expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
      expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
      expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
      expect(result?.predictedDepartureTime).toBe('08:00');
      expect(result?.confidence).toBe(0.8);
    });

    it('returns predictedMinutesRange undefined when stdDevMinutes is 0', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1',
        dayOfWeek: 2 as const,
        avgDepartureTime: '08:00',
        stdDevMinutes: 0,
        frequentRoute: {
          departureStationId: '0150', departureStationName: '서울역',
          arrivalStationId: '0151', arrivalStationName: '시청',
          lineIds: ['1'],
        },
        confidence: 0.8,
        sampleCount: 10,
        lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockReturnValueOnce({
        segments: [{
          fromStationId: '0150', fromStationName: '서울역',
          toStationId: '0151', toStationName: '시청',
          lineId: '1', lineName: '1호선',
          estimatedMinutes: 10, isTransfer: false,
        }],
        totalMinutes: 10,
        transferCount: 0,
        lineIds: ['1'],
      });

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      expect(result?.predictedMinutes).toBe(20);
      expect(result?.predictedMinutesRange).toBeUndefined();
      expect(result?.transitSegments).toHaveLength(1);
      expect(result?.predictedArrivalTime).toBe('08:20'); // 08:00 + 20 min
      expect(result?.direction).toBe('up'); // 0150 < 0151 on line 1
      expect(result?.walkToStationMinutes).toBe(DEFAULT_WALK_TO_STATION_MIN);
      expect(result?.waitMinutes).toBe(DEFAULT_WAIT_MIN);
      expect(result?.walkToDestinationMinutes).toBe(DEFAULT_WALK_TO_DEST_MIN);
      expect(result?.deltaMinutes).toBeUndefined();
    });

    it('always sets deltaMinutes to undefined in 1st cut (no historical baseline)', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1', dayOfWeek: 2 as const,
        avgDepartureTime: '08:00', stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: '0150', departureStationName: '서울역',
          arrivalStationId: '0151', arrivalStationName: '시청',
          lineIds: ['1'],
        },
        confidence: 0.8, sampleCount: 10, lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockReturnValueOnce({
        segments: [{
          fromStationId: '0150', fromStationName: '서울역',
          toStationId: '0151', toStationName: '시청',
          lineId: '1', lineName: '1호선',
          estimatedMinutes: 10, isTransfer: false,
        }],
        totalMinutes: 10, transferCount: 0, lineIds: ['1'],
      });

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      // Primary contract: deltaMinutes must be undefined (1st cut, no baseline)
      expect(result?.deltaMinutes).toBeUndefined();

      // Adjacent fields are populated (so the test exercises a fully-resolved
      // happy path, not a degraded one — proves the deltaMinutes=undefined is
      // intentional rather than a side effect of soft-fail).
      expect(result?.predictedMinutes).toBe(20); // 4+3+3+10
      expect(result?.predictedArrivalTime).toBe('08:20');
      expect(result?.predictedMinutesRange).toEqual([17, 23]); // ±3 from stdDev
      expect(result?.transitSegments).toHaveLength(1);
      expect(result?.direction).toBe('up');
    });

    it('always sets transitSegments[*].congestionForecast to undefined (filled by Phase d)', async () => {
      jest.spyOn(patternAnalysisService, 'getPatternForDay').mockResolvedValueOnce({
        userId: 'u1', dayOfWeek: 2 as const,
        avgDepartureTime: '08:00', stdDevMinutes: 3,
        frequentRoute: {
          departureStationId: '0150', departureStationName: '서울역',
          arrivalStationId: '0152', arrivalStationName: '종각',
          lineIds: ['1'],
        },
        confidence: 0.8, sampleCount: 10, lastUpdated: new Date(),
      });
      mockedCalculateRoute.mockReturnValueOnce({
        segments: [
          {
            fromStationId: '0150', fromStationName: '서울역',
            toStationId: '0151', toStationName: '시청',
            lineId: '1', lineName: '1호선',
            estimatedMinutes: 2, isTransfer: false,
          },
          {
            fromStationId: '0151', fromStationName: '시청',
            toStationId: '0152', toStationName: '종각',
            lineId: '1', lineName: '1호선',
            estimatedMinutes: 2, isTransfer: false,
          },
        ],
        totalMinutes: 4, transferCount: 0, lineIds: ['1'],
      });

      const result = await patternAnalysisService.predictCommute('u1', new Date('2026-05-12'));

      // Primary contract: every segment's congestionForecast is undefined
      expect(result?.transitSegments).toHaveLength(2);
      expect(result?.transitSegments?.every((s) => s.congestionForecast === undefined)).toBe(true);

      // Sibling fields are populated (proves congestionForecast=undefined is
      // intentional, not a soft-fail side effect).
      expect(result?.predictedMinutes).toBe(14); // 4+3+3 + (2+2)
      expect(result?.transitSegments?.[0]?.estimatedMinutes).toBe(2);
      expect(result?.transitSegments?.[1]?.estimatedMinutes).toBe(2);
    });
  });

  describe('getWeekPredictions', () => {
    it('should return predictions for weekdays', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getWeekPredictions('user-123', false);

      // Should have predictions for weekdays
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include weekends if specified', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getWeekPredictions('user-123', true);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('hasTodayPattern', () => {
    it('should return true if pattern exists with sufficient confidence', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.hasTodayPattern('user-123');

      expect(result).toBe(true);
    });

    it('should return false if no pattern', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.hasTodayPattern('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getTodaySuggestedAlertTime', () => {
    it('should return suggested alert time', async () => {
      mockGetDoc.mockResolvedValue(mockPatternDoc);

      const result = await patternAnalysisService.getTodaySuggestedAlertTime('user-123');

      expect(result).toBe('08:00');
    });

    it('should return null if no pattern', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await patternAnalysisService.getTodaySuggestedAlertTime('user-123');

      expect(result).toBeNull();
    });
  });
});
