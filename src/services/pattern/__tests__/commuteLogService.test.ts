/**
 * Commute Log Service Tests
 */

import { doc } from 'firebase/firestore';
import { commuteLogService } from '../commuteLogService';
import { DayOfWeek, getCurrentTimeString } from '@/models/pattern';

// `doc()` is the only seam that reveals *which* log document a write targets.
const mockDocRef = doc as jest.Mock;

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mockCollectionRef'),
  doc: jest.fn(() => 'mockDocRef'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => ({ type: 'where', args })),
  orderBy: jest.fn((...args) => ({ type: 'orderBy', args })),
  limit: jest.fn((n) => ({ type: 'limit', value: n })),
  Timestamp: {
    fromDate: jest.fn((date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

// Mock pattern model
jest.mock('@/models/pattern', () => ({
  DayOfWeek: 0,
  MAX_LOG_AGE_DAYS: 30,
  getDayOfWeek: jest.fn(() => 1), // Monday
  formatDateString: jest.fn((date) => date.toISOString().split('T')[0]),
  getCurrentTimeString: jest.fn(() => '08:30'),
  // Inline (not a captured jest.fn) — a factory may not close over outer refs.
  // Mirrors the real helper so the staleness bound is exercised, not stubbed.
  parseTimeToMinutes: (time: string) => {
    const parts = String(time).split(':').map(Number);
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  },
  fromCommuteLogDoc: jest.fn((id, userId, data) => ({
    id,
    userId,
    date: data.date,
    dayOfWeek: data.dayOfWeek,
    departureTime: data.departureTime,
    arrivalTime: data.arrivalTime,
    departureStationId: data.departureStationId,
    departureStationName: data.departureStationName,
    arrivalStationId: data.arrivalStationId,
    arrivalStationName: data.arrivalStationName,
    lineIds: data.lineIds,
    wasDelayed: data.wasDelayed,
    delayMinutes: data.delayMinutes,
    isManual: data.isManual,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: new Date(),
  })),
}));

describe('CommuteLogService', () => {
  const mockLogInput = {
    departureStationId: 'gangnam',
    departureStationName: '강남',
    arrivalStationId: 'jamsil',
    arrivalStationName: '잠실',
    lineIds: ['2'],
    departureTime: '08:30',
    arrivalTime: '09:00',
    wasDelayed: false,
  };

  const mockLogDoc = {
    id: 'log-123',
    data: () => ({
      date: '2024-01-15',
      dayOfWeek: 1,
      departureTime: '08:30',
      arrivalTime: '09:00',
      departureStationId: 'gangnam',
      departureStationName: '강남',
      arrivalStationId: 'jamsil',
      arrivalStationName: '잠실',
      lineIds: ['2'],
      wasDelayed: false,
      isManual: true,
      createdAt: { toDate: () => new Date('2024-01-15T08:30:00') },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logCommute', () => {
    it('should log a commute successfully', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-log-id' });

      const result = await commuteLogService.logCommute('user-123', mockLogInput);

      expect(result.id).toBe('new-log-id');
      expect(result.departureStationName).toBe('강남');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should use current time if departure time not provided', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-log-id' });

      const inputWithoutTime = {
        ...mockLogInput,
        departureTime: undefined,
      };

      const result = await commuteLogService.logCommute('user-123', inputWithoutTime);

      expect(result.departureTime).toBe('08:30'); // mocked current time
    });

    it('should not write undefined field values to Firestore', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-log-id' });

      // Omit optional arrivalTime and delayMinutes entirely.
      await commuteLogService.logCommute('user-123', {
        departureStationId: 'gangnam',
        departureStationName: '강남',
        arrivalStationId: 'jamsil',
        arrivalStationName: '잠실',
        lineIds: ['2'],
        isManual: false,
      });

      const payload = mockAddDoc.mock.calls[0][1];
      const undefinedKeys = Object.entries(payload)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      expect(undefinedKeys).toEqual([]);
    });
  });

  describe('getCommuteLogs', () => {
    it('should return commute logs', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.getCommuteLogs('user-123');

      expect(result).toHaveLength(1);
    });

    it('should filter by dayOfWeek', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.getCommuteLogs('user-123', {
        dayOfWeek: 1 as DayOfWeek,
      });

      expect(result).toHaveLength(1);
    });

    it('should respect maxResults', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [mockLogDoc, mockLogDoc],
      });

      await commuteLogService.getCommuteLogs('user-123', {
        maxResults: 10,
      });

      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('getRecentLogsForAnalysis', () => {
    it('should return recent logs', async () => {
      // Mock with today's date to pass the filter
      const todayLogDoc = {
        ...mockLogDoc,
        data: () => ({
          ...mockLogDoc.data(),
          date: new Date().toISOString().split('T')[0],
        }),
      };
      mockGetDocs.mockResolvedValue({
        docs: [todayLogDoc],
      });

      const result = await commuteLogService.getRecentLogsForAnalysis('user-123');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getLogsForDayOfWeek', () => {
    it('should return logs for specific day', async () => {
      // Mock with today's date to pass the filter
      const todayLogDoc = {
        ...mockLogDoc,
        data: () => ({
          ...mockLogDoc.data(),
          date: new Date().toISOString().split('T')[0],
        }),
      };
      mockGetDocs.mockResolvedValue({
        docs: [todayLogDoc],
      });

      const result = await commuteLogService.getLogsForDayOfWeek('user-123', 1 as DayOfWeek);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('updateLog', () => {
    it('should update log properties', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      await commuteLogService.updateLog('user-123', 'log-123', {
        arrivalTime: '09:15',
        wasDelayed: true,
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  describe('deleteLog', () => {
    it('should delete a log', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await commuteLogService.deleteLog('user-123', 'log-123');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('hasLoggedToday', () => {
    it('should return true if logged today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.hasLoggedToday('user-123');

      expect(result).toBe(true);
    });

    it('should return false if not logged today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await commuteLogService.hasLoggedToday('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getTodayLog', () => {
    it('should return today\'s log if exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.getTodayLog('user-123');

      expect(result).not.toBeNull();
    });

    it('should return null if no log today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await commuteLogService.getTodayLog('user-123');

      expect(result).toBeNull();
    });
  });

  describe('autoLogIfAppropriate', () => {
    it('should create new log for departure if no log today', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });
      mockAddDoc.mockResolvedValue({ id: 'auto-log-id' });

      const result = await commuteLogService.autoLogIfAppropriate(
        'user-123',
        'gangnam',
        '강남',
        '2',
        'departure'
      );

      expect(result).not.toBeNull();
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should not create log if already logged today for departure', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockLogDoc],
      });

      const result = await commuteLogService.autoLogIfAppropriate(
        'user-123',
        'gangnam',
        '강남',
        '2',
        'departure'
      );

      expect(result).toBeNull();
    });

    // Regression: the arrival stamp used to land on getTodayLog() — a limit(1),
    // unordered date query with no leg filter. The log it returned was almost
    // always the morning departure stub, so an evening station view produced a
    // measured duration of 08:05 → 18:40 = 635min instead of 18:05 → 18:40 =
    // 35min. That number is then averaged into baselineMinutes ("평균 출퇴근
    // 시간") and shown as the hero ETA.
    describe('arrival leg pairing', () => {
      // Morning departure stub (autoLogIfAppropriate 'departure'): destination
      // unknown, still open. Listed FIRST so getTodayLog()'s docs[0] picks it.
      const openMorningStubDoc = {
        id: 'morning-stub',
        data: () => ({
          date: '2024-01-15',
          dayOfWeek: 1,
          departureTime: '08:05',
          departureStationId: 'sindorim',
          departureStationName: '신도림',
          arrivalStationId: '',
          arrivalStationName: '',
          lineIds: ['2'],
          wasDelayed: false,
          isManual: false,
          createdAt: { toDate: () => new Date('2024-01-15T08:05:00') },
        }),
      };

      // Evening leg heading to 신도림 — the log the 18:40 stamp belongs to.
      const openEveningLegDoc = {
        id: 'evening-open',
        data: () => ({
          date: '2024-01-15',
          dayOfWeek: 1,
          departureTime: '18:05',
          departureStationId: 'gangnam',
          departureStationName: '강남',
          arrivalStationId: 'sindorim',
          arrivalStationName: '신도림',
          lineIds: ['2'],
          wasDelayed: false,
          isManual: false,
          createdAt: { toDate: () => new Date('2024-01-15T18:05:00') },
        }),
      };

      beforeEach(() => {
        (getCurrentTimeString as jest.Mock).mockReturnValue('18:40');
      });

      afterEach(() => {
        // Restore the suite-wide default so later tests aren't polluted.
        (getCurrentTimeString as jest.Mock).mockReturnValue('08:30');
      });

      it('stamps the evening leg (18:05→18:40 = 35min), not the morning stub (08:05→18:40 = 635min)', async () => {
        mockGetDocs.mockResolvedValue({
          empty: false,
          docs: [openMorningStubDoc, openEveningLegDoc],
        });

        const result = await commuteLogService.autoLogIfAppropriate(
          'user-123',
          'sindorim',
          '신도림',
          '2',
          'arrival'
        );

        expect(result?.id).toBe('evening-open');
        expect(result?.arrivalTime).toBe('18:40');
        expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
        // Which document was written is the whole point — a mocked seam that
        // only proves "updateDoc was called" would pass with the bug intact.
        expect(mockDocRef).toHaveBeenCalledWith(
          expect.anything(),
          'commuteLogs',
          'user-123',
          'logs',
          'evening-open'
        );
      });

      it('writes nothing when no open log is heading to the viewed station', async () => {
        mockGetDocs.mockResolvedValue({
          empty: false,
          docs: [openMorningStubDoc],
        });

        const result = await commuteLogService.autoLogIfAppropriate(
          'user-123',
          'sindorim',
          '신도림',
          '2',
          'arrival'
        );

        expect(result).toBeNull();
        expect(mockUpdateDoc).not.toHaveBeenCalled();
      });

      it('does not re-stamp a leg that already has an arrivalTime', async () => {
        const completedLegDoc = {
          id: 'evening-done',
          data: () => ({
            ...openEveningLegDoc.data(),
            arrivalTime: '18:38',
          }),
        };
        mockGetDocs.mockResolvedValue({
          empty: false,
          docs: [completedLegDoc],
        });

        const result = await commuteLogService.autoLogIfAppropriate(
          'user-123',
          'sindorim',
          '신도림',
          '2',
          'arrival'
        );

        expect(result).toBeNull();
        expect(mockUpdateDoc).not.toHaveBeenCalled();
      });

      // Regression: adoption had no staleness bound, so an open log from hours
      // earlier was still completable. Observed in prod: a 12:45 log adopted at
      // 18:54 recorded a 369-min "commute" into baselineMinutes.
      it('refuses an open log too old to yield a plausible commute (08:00 → 18:40 = 640min)', async () => {
        const staleOpenDoc = {
          id: 'stale-open',
          data: () => ({
            ...openEveningLegDoc.data(),
            departureTime: '08:00',
          }),
        };
        mockGetDocs.mockResolvedValue({ empty: false, docs: [staleOpenDoc] });

        const result = await commuteLogService.autoLogIfAppropriate(
          'user-123',
          'sindorim',
          '신도림',
          '2',
          'arrival'
        );

        expect(result).toBeNull();
        // The stale log is left open and untouched, never back-filled.
        expect(mockUpdateDoc).not.toHaveBeenCalled();
      });

      it('still adopts an open log inside the bound (17:25 → 18:40 = 75min)', async () => {
        const freshOpenDoc = {
          id: 'fresh-open',
          data: () => ({
            ...openEveningLegDoc.data(),
            departureTime: '17:25',
          }),
        };
        mockGetDocs.mockResolvedValue({ empty: false, docs: [freshOpenDoc] });

        const result = await commuteLogService.autoLogIfAppropriate(
          'user-123',
          'sindorim',
          '신도림',
          '2',
          'arrival'
        );

        expect(result?.id).toBe('fresh-open');
        expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      });

      it('adopts exactly at the bound (15:40 → 18:40 = 180min)', async () => {
        const boundaryDoc = {
          id: 'boundary-open',
          data: () => ({
            ...openEveningLegDoc.data(),
            departureTime: '15:40',
          }),
        };
        mockGetDocs.mockResolvedValue({ empty: false, docs: [boundaryDoc] });

        const result = await commuteLogService.autoLogIfAppropriate(
          'user-123',
          'sindorim',
          '신도림',
          '2',
          'arrival'
        );

        expect(result?.id).toBe('boundary-open');
        expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      });

      it('propagates a Firestore read failure to the caller', async () => {
        mockGetDocs.mockRejectedValue(new Error('firestore unavailable'));

        await expect(
          commuteLogService.autoLogIfAppropriate(
            'user-123',
            'sindorim',
            '신도림',
            '2',
            'arrival'
          )
        ).rejects.toThrow('firestore unavailable');
        expect(mockUpdateDoc).not.toHaveBeenCalled();
      });
    });
  });

  describe('autoLogCommuteRoute', () => {
    const mockRoute = {
      departureTime: '08:00',
      departureStationId: 'sindorim',
      departureStationName: '신도림',
      departureLineId: '2',
      transferStations: [],
      arrivalStationId: 'gangnam',
      arrivalStationName: '강남',
      arrivalLineId: '2',
      notifications: {
        transferAlert: false,
        arrivalAlert: false,
        delayAlert: false,
        incidentAlert: false,
        alertMinutesBefore: 5,
      },
      bufferMinutes: 10,
    };

    // Same-leg fixtures: departure AND arrival match mockRoute (신도림 → 강남) so
    // the destination-aware leg matcher adopts/dedups them.
    const sameLegOpenDoc = {
      id: 'log-123',
      data: () => ({
        ...mockLogDoc.data(),
        departureStationName: '신도림',
        arrivalStationName: '강남',
        arrivalTime: undefined,
      }),
    };

    const sameLegCompletedDoc = {
      id: 'log-123',
      data: () => ({
        ...mockLogDoc.data(),
        departureStationName: '신도림',
        arrivalStationName: '강남',
      }),
    };

    it('should create a full-route log for departure when no log exists today', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'route-log-id' });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'departure'
      );

      expect(result).not.toBeNull();
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload.departureStationId).toBe('sindorim');
      expect(payload.arrivalStationId).toBe('gangnam');
      expect(payload.lineIds).toEqual(['2']);
      expect(payload.isManual).toBe(false);

      const undefinedKeys = Object.entries(payload)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      expect(undefinedKeys).toEqual([]);
    });

    it('should not create a departure log if already logged this leg today', async () => {
      mockGetDocs.mockResolvedValue({ empty: false, docs: [sameLegCompletedDoc] });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'departure'
      );

      expect(result).toBeNull();
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should fill arrivalTime on this leg\'s open log for arrival', async () => {
      mockGetDocs.mockResolvedValue({ empty: false, docs: [sameLegOpenDoc] });
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).not.toBeNull();
      expect(result?.arrivalTime).toBe('08:30'); // mocked current time
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should create a new log for arrival when nothing was logged today', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
      mockAddDoc.mockResolvedValue({ id: 'evening-log-id' });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).not.toBeNull();
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload.departureStationId).toBe('sindorim');
      expect(payload.isManual).toBe(false);
      expect(mockUpdateDoc).not.toHaveBeenCalled();

      const undefinedKeys = Object.entries(payload)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      expect(undefinedKeys).toEqual([]);
    });

    it('should do nothing for arrival when this leg\'s log already has arrivalTime', async () => {
      mockGetDocs.mockResolvedValue({ empty: false, docs: [sameLegCompletedDoc] });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).toBeNull();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should not touch a different-leg open log on arrival, creating a solo evening log (bug3)', async () => {
      // Morning leg (departure 강남) still open; evening route departs 신도림.
      const otherLegOpenDoc = {
        id: 'morning-log',
        data: () => ({
          ...mockLogDoc.data(),
          departureStationName: '강남',
          arrivalTime: undefined,
        }),
      };
      mockGetDocs.mockResolvedValue({ empty: false, docs: [otherLegOpenDoc] });
      mockAddDoc.mockResolvedValue({ id: 'evening-log-id' });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).not.toBeNull();
      // The morning doc must not be modified…
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      // …and a fresh evening leg log is created instead.
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload.departureStationName).toBe('신도림');
      expect(payload.arrivalStationName).toBe('강남');
    });

    it('should not fill a same-departure open log heading to a different destination (leg match)', async () => {
      // Same departure (신도림) but different destination (역삼) than the route (강남).
      const otherDestinationOpenDoc = {
        id: 'other-dest-log',
        data: () => ({
          ...mockLogDoc.data(),
          departureStationName: '신도림',
          arrivalStationName: '역삼',
          arrivalTime: undefined,
        }),
      };
      mockGetDocs.mockResolvedValue({ empty: false, docs: [otherDestinationOpenDoc] });
      mockAddDoc.mockResolvedValue({ id: 'evening-log-id' });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).not.toBeNull();
      // The other-destination doc must not be adopted/filled…
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      // …a fresh log for this leg is created instead.
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc.mock.calls[0][1].arrivalStationName).toBe('강남');
    });

    it('should repair a destination-less stub on arrival and not create a new doc', async () => {
      // autoLogIfAppropriate stub: same departure, empty arrival, still open.
      const stubDoc = {
        id: 'stub-log',
        data: () => ({
          ...mockLogDoc.data(),
          departureStationName: '신도림',
          arrivalStationId: '',
          arrivalStationName: '',
          arrivalTime: undefined,
        }),
      };
      mockGetDocs.mockResolvedValue({ empty: false, docs: [stubDoc] });
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).not.toBeNull();
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);

      const updatePayload = mockUpdateDoc.mock.calls[0][1];
      // Repair fields present…
      expect(updatePayload.arrivalStationId).toBe('gangnam');
      expect(updatePayload.arrivalStationName).toBe('강남');
      expect(updatePayload.lineIds).toEqual(['2']);
      expect(updatePayload.arrivalTime).toBe('08:30'); // mocked current time
      // …and no undefined keys reach Firestore.
      const undefinedKeys = Object.entries(updatePayload)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      expect(undefinedKeys).toEqual([]);
    });

    it('should not create a duplicate when a completed stub for this leg already exists', async () => {
      // A stub (arrivalStationName '') that already got its arrivalTime filled
      // counts as this leg being done — the same-leg predicate must treat it as
      // a completed match, not an unrelated log.
      const completedStubDoc = {
        id: 'completed-stub',
        data: () => ({
          ...mockLogDoc.data(),
          departureStationName: '신도림',
          arrivalStationId: '',
          arrivalStationName: '',
          // arrivalTime inherited from mockLogDoc ('09:00') → completed.
        }),
      };
      mockGetDocs.mockResolvedValue({ empty: false, docs: [completedStubDoc] });

      const result = await commuteLogService.autoLogCommuteRoute(
        'user-123',
        mockRoute,
        'arrival'
      );

      expect(result).toBeNull();
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    // Same staleness bound as autoLogIfAppropriate — this path writes
    // arrivalTime too, so an abandoned open log must not be back-filled here
    // either. Prod evidence: 12:45 log adopted at 18:54 → 369min recorded.
    describe('open-log staleness bound', () => {
      afterEach(() => {
        (getCurrentTimeString as jest.Mock).mockReturnValue('08:30');
      });

      it('starts a fresh log instead of back-filling a stale one, leaving it open', async () => {
        (getCurrentTimeString as jest.Mock).mockReturnValue('18:54');
        const staleOpenDoc = {
          id: 'stale-open',
          data: () => ({
            ...sameLegOpenDoc.data(),
            departureTime: '12:45',
          }),
        };
        mockGetDocs.mockResolvedValue({ empty: false, docs: [staleOpenDoc] });
        mockAddDoc.mockResolvedValue({ id: 'fresh-evening-log' });

        const result = await commuteLogService.autoLogCommuteRoute(
          'user-123',
          mockRoute,
          'arrival'
        );

        // The abandoned 12:45 log keeps its open state — no fabricated arrival.
        expect(mockUpdateDoc).not.toHaveBeenCalled();
        // A standalone evening log starts instead, stamped at the current time.
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        expect(mockAddDoc.mock.calls[0][1].departureTime).toBe('18:54');
        expect(mockAddDoc.mock.calls[0][1].arrivalTime).toBeUndefined();
        expect(result).not.toBeNull();
      });

      it('still adopts an open log inside the bound', async () => {
        (getCurrentTimeString as jest.Mock).mockReturnValue('18:54');
        const freshOpenDoc = {
          id: 'fresh-open',
          data: () => ({
            ...sameLegOpenDoc.data(),
            departureTime: '17:40',
          }),
        };
        mockGetDocs.mockResolvedValue({ empty: false, docs: [freshOpenDoc] });

        const result = await commuteLogService.autoLogCommuteRoute(
          'user-123',
          mockRoute,
          'arrival'
        );

        expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
        expect(mockAddDoc).not.toHaveBeenCalled();
        expect(result?.arrivalTime).toBe('18:54');
      });
    });
  });

  describe('getTodayLogsByDeparture', () => {
    it('returns only today\'s logs matching the departure station', async () => {
      const sindorimDoc = {
        id: 'log-sindorim',
        data: () => ({ ...mockLogDoc.data(), departureStationName: '신도림' }),
      };
      const gangnamDoc = {
        id: 'log-gangnam',
        data: () => ({ ...mockLogDoc.data(), departureStationName: '강남' }),
      };
      mockGetDocs.mockResolvedValue({ docs: [sindorimDoc, gangnamDoc] });

      const result = await commuteLogService.getTodayLogsByDeparture('user-123', '신도림');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('log-sindorim');
      expect(result[0]?.departureStationName).toBe('신도림');
    });

    it('does not add an orderBy clause (composite-index avoidance)', async () => {
      const { orderBy } = jest.requireMock('firebase/firestore') as {
        orderBy: jest.Mock;
      };
      mockGetDocs.mockResolvedValue({ docs: [] });

      await commuteLogService.getTodayLogsByDeparture('user-123', '신도림');

      expect(orderBy).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old logs', async () => {
      const mockDocRefs = [
        { ref: { id: 'old-log-1' } },
        { ref: { id: 'old-log-2' } },
      ];
      mockGetDocs.mockResolvedValue({
        docs: mockDocRefs,
      });
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await commuteLogService.cleanupOldLogs('user-123');

      expect(result).toBe(2);
    });

    it('should return 0 if no old logs', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
      });

      const result = await commuteLogService.cleanupOldLogs('user-123');

      expect(result).toBe(0);
    });
  });
});
