/**
 * Diagnosis repro — ML hero anomaly after service hours (2026-11-12 ~01:00 KST).
 *
 * Observed on device: 662분 / 평소보다 +399분 / 지금 출발하면 18:32 도착 / 신뢰도 10%.
 *
 * Chain under test (real code, only I/O hooks mocked):
 *   resolveActiveCommuteType(01:00) → 'morning' (23–11 window) → ML hero eligible
 *   modelService.predict(logs, Thursday, OD) → fallbackPrediction:
 *     1 Thursday log on the OD → confidence = min(0.5, 1/10) = 0.1
 *     departure avg = 07:30, arrival = dep + avg measured duration (662, uncapped)
 *   useCommuteHeroEstimate: minutesBetween(07:30, 18:32) = 662,
 *     delta = 662 - averageCommuteDurationFor(all OD logs) = 662 - 263 = 399
 *
 * The 07:30→18:32 log is an open commute closed hours later (an implausible
 * 11-hour subway ride). Nothing between the log and the hero bounds a measured
 * duration, so a single outlier becomes the headline number.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { useCommuteHeroEstimate } from '@/hooks/useCommuteHeroEstimate';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import { useFirestoreMorningCommute } from '@/hooks/useFirestoreMorningCommute';
import { trainService } from '@/services/train/trainService';
import { modelService } from '@/services/ml/modelService';
import { averageCommuteDurationFor } from '@/services/pattern/commuteDuration';
import { getDayOfWeek, type CommuteLog, type DayOfWeek } from '@/models/pattern';

jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: jest.fn(),
}));

jest.mock('@/hooks/useFirestoreMorningCommute', () => ({
  useFirestoreMorningCommute: jest.fn(() => null),
  useFirestoreCommuteLeg: jest.fn(() => null),
}));

jest.mock('@/hooks/useCommuteRouteSummary', () => ({
  useCommuteRouteSummary: jest.fn(() => ({ ready: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'u1', preferences: {} } })),
}));

jest.mock('@/services/train/trainService', () => ({
  trainService: { getStation: jest.fn(async () => null) },
}));

const ORIGIN = '산곡';
const DESTINATION = '선릉';

const makeLog = (
  date: string,
  dayOfWeek: DayOfWeek,
  departureTime: string,
  arrivalTime: string,
): CommuteLog => ({
  id: `log-${date}`,
  userId: 'u1',
  date,
  dayOfWeek,
  departureTime,
  arrivalTime,
  departureStationId: '0001',
  departureStationName: ORIGIN,
  arrivalStationId: '0002',
  arrivalStationName: DESTINATION,
  lineIds: ['7'],
  wasDelayed: false,
  isManual: false,
  createdAt: new Date(`${date}T07:30:00+09:00`),
});

// Thu 11/05: open log closed at 18:32 → 662 min. Mon/Tue: normal 64/63 min.
// OD baseline = (662 + 64 + 63) / 3 = 263.
const LOGS: readonly CommuteLog[] = [
  makeLog('2026-11-02', 1, '07:30', '08:34'),
  makeLog('2026-11-03', 2, '07:30', '08:33'),
  makeLog('2026-11-05', 4, '07:30', '18:32'),
];

const renderAt01KST = async (): Promise<ReturnType<typeof useCommuteHeroEstimate>> => {
  const now = new Date('2026-11-12T01:00:00+09:00'); // Thursday 01:00 KST
  jest.setSystemTime(now);

  const prediction = await modelService.predict(LOGS, getDayOfWeek(now), {
    useCache: false,
    originStationName: ORIGIN,
    destinationStationName: DESTINATION,
  });
  (useMLPrediction as jest.Mock).mockReturnValue({
    prediction,
    baselineMinutesFor: (o?: string, d?: string) => averageCommuteDurationFor(LOGS, o, d),
  });
  (useFirestoreMorningCommute as jest.Mock).mockReturnValue({
    departureTime: '07:30',
    stationId: '0001',
    destinationStationId: '0002',
  });
  (trainService.getStation as jest.Mock).mockImplementation(async (id: string) =>
    id === '0001'
      ? { id: '0001', name: ORIGIN, lineId: '7' }
      : { id: '0002', name: DESTINATION, lineId: '2' },
  );

  // 'auto' = HomeScreen's call; resolveActiveCommuteType is real here.
  const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));
  // Wait until station names resolve (the hero decision depends on them).
  await waitFor(() => expect(result.current.commuteStationNames.destination).toBe(DESTINATION));
  return result.current;
};

describe('useCommuteHeroEstimate — night anomaly (diag)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // After fix (A+B): the 662-minute outlier is excluded from measured
  // durations, the Thursday OD has no plausible log left, so modelService
  // returns the route-less no-prediction default and the hero is NOT the ML
  // 662. With the graph summary unavailable here, the hero is simply empty.
  it('after fix: at 01:00 KST the hero is not the ML 662 — no ML promotion, graph fallback (null here)', async () => {
    const estimate = await renderAt01KST();

    expect(estimate.activeCommuteType).toBe('morning');
    expect(estimate.hasRealPrediction).toBe(false);
    expect(estimate.effectiveHero).toBeNull();
  });

  it('does not promote an implausible single-outlier duration as the ML hero', async () => {
    const estimate = await renderAt01KST();

    const minutes = estimate.effectiveHero?.predictedMinutes ?? 0;
    expect(minutes).toBeLessThanOrEqual(180);
    expect(Math.abs(estimate.effectiveHero?.deltaMinutes ?? 0)).toBeLessThanOrEqual(180);
  });
});
