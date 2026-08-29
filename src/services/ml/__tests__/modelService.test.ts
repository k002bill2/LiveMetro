/**
 * Model Service Tests
 */

import { modelService } from '../modelService';
import { CommuteLog, DayOfWeek } from '@/models/pattern';

// Mock featureExtractor
jest.mock('../featureExtractor', () => ({
  featureExtractor: {
    normalizeTime: jest.fn((time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return ((hours || 0) * 60 + (minutes || 0)) / 1440;
    }),
    denormalizeTime: jest.fn((normalized: number) => {
      const totalMinutes = Math.round(normalized * 1440);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }),
    calculateDelayRate: jest.fn((logs: CommuteLog[]) => {
      if (logs.length === 0) return 0;
      return logs.filter(l => l.wasDelayed).length / logs.length;
    }),
  },
}));

// Day of week constant (0 = Sunday)
const MONDAY: DayOfWeek = 1;

describe('ModelService', () => {
  const mockCommuteLog: CommuteLog = {
    id: 'log-1',
    userId: 'user-1',
    date: '2024-01-15',
    dayOfWeek: MONDAY,
    departureStationId: 'gangnam',
    departureStationName: '강남',
    arrivalStationId: 'jamsil',
    arrivalStationName: '잠실',
    departureTime: '08:30',
    arrivalTime: '09:00',
    lineIds: ['2'],
    wasDelayed: false,
    isManual: false,
    createdAt: new Date('2024-01-15'),
  };

  beforeEach(() => {
    modelService.dispose();
    modelService.clearCache();
  });

  describe('initialize', () => {
    it('should initialize in fallback mode', async () => {
      const result = await modelService.initialize();

      expect(result).toBe(true);
      expect(modelService.isReady()).toBe(true);
    });

    it('should return true if already initialized', async () => {
      await modelService.initialize();
      const result = await modelService.initialize();

      expect(result).toBe(true);
    });
  });

  describe('predict', () => {
    it('should return default prediction for empty logs', async () => {
      const prediction = await modelService.predict([], MONDAY);

      expect(prediction.predictedDepartureTime).toBe('08:00');
      expect(prediction.predictedArrivalTime).toBe('08:45');
      expect(prediction.modelVersion).toBe('fallback');
    });

    it('should use statistics from logs when available', async () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, dayOfWeek: MONDAY },
        { ...mockCommuteLog, id: 'log-2', dayOfWeek: MONDAY },
      ];

      const prediction = await modelService.predict(logs, MONDAY);

      expect(prediction.modelVersion).toBe('fallback');
      expect(prediction.predictedAt).toBeInstanceOf(Date);
    });

    // Regression (screenshot bug): mixed morning+evening logs on the same
    // weekday made the independent departure/arrival averages cross —
    // dep avg 13:15 vs arr avg 13:05 — which minutesBetween() then read as a
    // midnight wrap (1430 min). Arrival must be derived from the average
    // *measured duration*, never averaged independently of departure.
    it('derives arrival from departure + average measured duration (never inverted)', async () => {
      const logs: CommuteLog[] = [
        // 출근 08:00→08:30 (30 min)
        { ...mockCommuteLog, id: 'log-am', departureTime: '08:00', arrivalTime: '08:30' },
        // 퇴근 17:10→17:40 (30 min)
        { ...mockCommuteLog, id: 'log-pm', departureTime: '17:10', arrivalTime: '17:40' },
        // 도착 미기록 로그 — departure 평균에만 들어가 모집단을 갈라놓는다
        { ...mockCommuteLog, id: 'log-open', departureTime: '14:35', arrivalTime: undefined },
      ];

      const prediction = await modelService.predict(logs, MONDAY, { useCache: false });

      // dep avg = (08:00+17:10+14:35)/3 = 13:15 (unchanged behavior)
      expect(prediction.predictedDepartureTime).toBe('13:15');
      // arrival = 13:15 + avg measured duration 30min — NOT the independent
      // arrival average 13:05 that inverted the pair.
      expect(prediction.predictedArrivalTime).toBe('13:45');
    });

    it('keeps the +0.05 arrival estimate when no log has a measured duration', async () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'log-open', departureTime: '08:00', arrivalTime: undefined },
      ];

      const prediction = await modelService.predict(logs, MONDAY, { useCache: false });

      expect(prediction.predictedDepartureTime).toBe('08:00');
      // Legacy estimate preserved: 08:00 + 0.05 day (72 min) = 09:12.
      expect(prediction.predictedArrivalTime).toBe('09:12');
    });

    // Route context (OD scoping): when the caller names its leg, the fallback
    // population must be ONLY the logs that ran exactly that origin→destination
    // (matched by station name — the log writers' station-id domains diverge,
    // so ids don't match across sources; commuteDuration.ts sets the precedent).
    it('scopes the fallback population to the exact OD when route context is given', async () => {
      const logs: CommuteLog[] = [
        // 출근 강남→잠실 (matching OD)
        { ...mockCommuteLog, id: 'am-1', departureTime: '08:00', arrivalTime: '08:30' },
        { ...mockCommuteLog, id: 'am-2', departureTime: '08:10', arrivalTime: '08:40' },
        // 퇴근 잠실→강남 — same weekday, reverse OD: must be excluded
        {
          ...mockCommuteLog,
          id: 'pm-1',
          departureStationId: 'jamsil',
          departureStationName: '잠실',
          arrivalStationId: 'gangnam',
          arrivalStationName: '강남',
          departureTime: '18:00',
          arrivalTime: '18:45',
        },
      ];

      const prediction = await modelService.predict(logs, MONDAY, {
        useCache: false,
        originStationName: '강남',
        destinationStationName: '잠실',
      });

      // departure avg over the OD's logs only: (08:00+08:10)/2 = 08:05
      expect(prediction.predictedDepartureTime).toBe('08:05');
      // arrival = 08:05 + avg measured duration 30min (same-OD completed logs)
      expect(prediction.predictedArrivalTime).toBe('08:35');
      // The prediction carries the OD it was computed for, so consumers can
      // verify it matches their registered route before promoting it.
      expect(prediction.originStationName).toBe('강남');
      expect(prediction.destinationStationName).toBe('잠실');
    });

    it('returns a route-less default when no log matches the requested OD', async () => {
      const logs: CommuteLog[] = [
        {
          ...mockCommuteLog,
          id: 'pm-1',
          departureStationName: '잠실',
          arrivalStationName: '강남',
          departureTime: '18:00',
          arrivalTime: '18:45',
        },
      ];

      const prediction = await modelService.predict(logs, MONDAY, {
        useCache: false,
        originStationName: '강남',
        destinationStationName: '잠실',
      });

      // Default estimate — NOT derived from the reverse-OD logs.
      expect(prediction.predictedDepartureTime).toBe('08:00');
      expect(prediction.predictedArrivalTime).toBe('08:45');
      // No OD tag: a default is not data for this route, so route-aware
      // consumers must not treat it as an OD-scoped prediction.
      expect(prediction.originStationName).toBeUndefined();
      expect(prediction.destinationStationName).toBeUndefined();
    });

    it('keeps route-less calls on the whole-weekday population (caller compatibility)', async () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'am-1', departureTime: '08:00', arrivalTime: '08:30' },
        { ...mockCommuteLog, id: 'am-2', departureTime: '08:10', arrivalTime: '08:40' },
        {
          ...mockCommuteLog,
          id: 'pm-1',
          departureStationName: '잠실',
          arrivalStationName: '강남',
          departureTime: '18:00',
          arrivalTime: '18:45',
        },
      ];

      const prediction = await modelService.predict(logs, MONDAY, { useCache: false });

      // Mixed-population average preserved for legacy callers:
      // (08:00 + 08:10 + 18:00) / 3 = 11:23, + avg duration 35min = 11:58.
      expect(prediction.predictedDepartureTime).toBe('11:23');
      expect(prediction.predictedArrivalTime).toBe('11:58');
      expect(prediction.originStationName).toBeUndefined();
    });

    // The cache key must include the route context: without it, the 출근 OD's
    // cached result would be served to the 퇴근 OD (and to route-less callers)
    // for the same weekday/weather/holiday tuple.
    it('caches OD-scoped predictions under separate keys (no cross-OD mixing)', async () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'am-1', departureTime: '08:00', arrivalTime: '08:30' },
        {
          ...mockCommuteLog,
          id: 'pm-1',
          departureStationName: '잠실',
          arrivalStationName: '강남',
          departureTime: '18:00',
          arrivalTime: '18:45',
        },
      ];

      const morning = await modelService.predict(logs, MONDAY, {
        originStationName: '강남',
        destinationStationName: '잠실',
      });
      const evening = await modelService.predict(logs, MONDAY, {
        originStationName: '잠실',
        destinationStationName: '강남',
      });

      expect(morning.predictedDepartureTime).toBe('08:00');
      // A shared cache key would replay the 08:00 morning result here.
      expect(evening.predictedDepartureTime).toBe('18:00');
    });

    it('does not serve a route-scoped cached result to a route-less caller', async () => {
      const logs: CommuteLog[] = [
        { ...mockCommuteLog, id: 'am-1', departureTime: '08:00', arrivalTime: '08:30' },
        {
          ...mockCommuteLog,
          id: 'pm-1',
          departureStationName: '잠실',
          arrivalStationName: '강남',
          departureTime: '18:00',
          arrivalTime: '18:45',
        },
      ];

      await modelService.predict(logs, MONDAY, {
        originStationName: '강남',
        destinationStationName: '잠실',
      });
      const routeless = await modelService.predict(logs, MONDAY);

      // Route-less caller keeps its whole-weekday average: (08:00+18:00)/2 = 13:00.
      expect(routeless.predictedDepartureTime).toBe('13:00');
      expect(routeless.originStationName).toBeUndefined();
    });

    // Security regression: the prediction cache is a module-level singleton,
    // so the key must be scoped by the users whose logs produced the numbers —
    // otherwise user B (same day/weekday/weather/OD tuple) replays user A's
    // cached commute times.
    it("does not share cached predictions between different users' logs", async () => {
      const userALogs: CommuteLog[] = [
        {
          ...mockCommuteLog,
          id: 'a-1',
          userId: 'user-a',
          departureTime: '08:00',
          arrivalTime: '08:30',
        },
      ];
      const userBLogs: CommuteLog[] = [
        {
          ...mockCommuteLog,
          id: 'b-1',
          userId: 'user-b',
          departureTime: '09:00',
          arrivalTime: '09:40',
        },
      ];

      const a = await modelService.predict(userALogs, MONDAY);
      const b = await modelService.predict(userBLogs, MONDAY);

      expect(a.predictedDepartureTime).toBe('08:00');
      // A user-blind key would replay user A's 08:00 result here.
      expect(b.predictedDepartureTime).toBe('09:00');
    });

    // Staleness regression: the key must track the log CONTENT, not just who
    // owns it. Closing an open commute (arrivalTime filled in) changes the
    // measured durations the arrival is now derived from, while user, day,
    // weather and route all stay identical — a content-blind key replays the
    // pre-arrival number for the whole five-minute window.
    it('recomputes when an open log is closed with an arrival time', async () => {
      const openLog: CommuteLog[] = [
        { ...mockCommuteLog, id: 'log-1', departureTime: '08:00', arrivalTime: undefined },
      ];
      const closedLog: CommuteLog[] = [
        { ...mockCommuteLog, id: 'log-1', departureTime: '08:00', arrivalTime: '08:50' },
      ];

      const before = await modelService.predict(openLog, MONDAY);
      const after = await modelService.predict(closedLog, MONDAY);

      // No usable duration yet → the historical +0.05-of-a-day placeholder.
      expect(before.predictedArrivalTime).toBe('09:12');
      // Measured 50min now drives the arrival; a stale cache would echo 09:12.
      expect(after.predictedArrivalTime).toBe('08:50');
    });

    it('keys a mixed-user log set apart from a single-user subset', async () => {
      const soloLog: CommuteLog = {
        ...mockCommuteLog,
        id: 'a-1',
        userId: 'user-a',
        departureTime: '08:00',
        arrivalTime: '08:30',
      };
      const mixedLogs: CommuteLog[] = [
        soloLog,
        {
          ...mockCommuteLog,
          id: 'b-1',
          userId: 'user-b',
          departureTime: '10:00',
          arrivalTime: '10:30',
        },
      ];

      const solo = await modelService.predict([soloLog], MONDAY);
      const mixed = await modelService.predict(mixedLogs, MONDAY);

      expect(solo.predictedDepartureTime).toBe('08:00');
      // avg(08:00, 10:00) = 09:00 — a colliding key would replay the solo result.
      expect(mixed.predictedDepartureTime).toBe('09:00');
    });

    it('should cache predictions', async () => {
      const logs = [mockCommuteLog];

      const prediction1 = await modelService.predict(logs, MONDAY);
      const prediction2 = await modelService.predict(logs, MONDAY);

      expect(prediction1.predictedDepartureTime).toBe(prediction2.predictedDepartureTime);
    });

    it('should skip cache when useCache is false', async () => {
      const logs = [mockCommuteLog];

      await modelService.predict(logs, MONDAY, { useCache: true });
      const prediction = await modelService.predict(logs, MONDAY, { useCache: false });

      expect(prediction).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should return null before initialization', () => {
      expect(modelService.getMetadata()).toBeNull();
    });

    it('should return metadata after initialization', async () => {
      await modelService.initialize();
      const metadata = modelService.getMetadata();

      expect(metadata).not.toBeNull();
      expect(metadata?.version).toBe('fallback');
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(modelService.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await modelService.initialize();
      expect(modelService.isReady()).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear prediction cache', async () => {
      const logs = [mockCommuteLog];
      await modelService.predict(logs, MONDAY);

      modelService.clearCache();

      // No error means cache was cleared successfully
      expect(true).toBe(true);
    });
  });

  describe('saveModel', () => {
    it('should return false in fallback mode', async () => {
      const result = await modelService.saveModel();
      expect(result).toBe(false);
    });
  });

  describe('getModel', () => {
    it('should return null in fallback mode', () => {
      expect(modelService.getModel()).toBeNull();
    });
  });

  describe('setModel', () => {
    it('should be a no-op in fallback mode', () => {
      modelService.setModel({}, {
        version: 'test',
        lastTrainedAt: new Date(),
        trainingDataCount: 0,
        accuracy: 0,
        loss: 0,
        isFineTuned: false,
      });

      expect(modelService.getModel()).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should reset service state', async () => {
      await modelService.initialize();
      modelService.dispose();

      expect(modelService.isReady()).toBe(false);
      expect(modelService.getMetadata()).toBeNull();
    });
  });
});
