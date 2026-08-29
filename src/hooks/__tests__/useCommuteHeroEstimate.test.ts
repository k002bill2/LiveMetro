/**
 * useCommuteHeroEstimate — single source of truth for the commute hero
 * estimate shared by HomeScreen (MLHeroCard) and WeeklyPredictionScreen.
 *
 * The hook is the SOLE caller of useMLPrediction / useFirestoreMorningCommute /
 * useCommuteRouteSummary and the station-name resolution, so both screens read
 * an identical estimate instead of each deriving their own (which previously
 * diverged — home showed graph ride minutes, prediction showed a 4+3+10+3
 * fallback constant). These tests pin that composition.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { useCommuteHeroEstimate } from '@/hooks/useCommuteHeroEstimate';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import {
  useFirestoreMorningCommute,
  useFirestoreCommuteLeg,
} from '@/hooks/useFirestoreMorningCommute';
import { useCommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';
import { resolveActiveCommuteType } from '@/utils/commuteSchedule';
import { useAuth } from '@/services/auth/AuthContext';
import { trainService } from '@/services/train/trainService';

jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: jest.fn(() => ({ prediction: null, baselineMinutesFor: () => null })),
}));

jest.mock('@/hooks/useFirestoreMorningCommute', () => ({
  useFirestoreMorningCommute: jest.fn(() => null),
  useFirestoreCommuteLeg: jest.fn(() => null),
}));

jest.mock('@/utils/commuteSchedule', () => ({
  resolveActiveCommuteType: jest.fn(() => 'morning'),
}));

jest.mock('@/hooks/useCommuteRouteSummary', () => ({
  useCommuteRouteSummary: jest.fn(() => ({ ready: false })),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'u1', preferences: {} } })),
}));

jest.mock('@/services/train/trainService', () => ({
  trainService: {
    getStation: jest.fn(async () => null),
  },
}));

const mockUseMLPrediction = useMLPrediction as jest.Mock;
const mockUseFirestoreMorningCommute = useFirestoreMorningCommute as jest.Mock;
const mockUseFirestoreCommuteLeg = useFirestoreCommuteLeg as jest.Mock;
const mockResolveActiveCommuteType = resolveActiveCommuteType as jest.Mock;
const mockUseCommuteRouteSummary = useCommuteRouteSummary as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockGetStation = trainService.getStation as jest.Mock;

const userWithProfileCommute = (
  morningCommute: unknown,
): { user: { id: string; preferences: { commuteSchedule: { weekdays: { morningCommute: unknown } } } } } => ({
  user: {
    id: 'u1',
    preferences: { commuteSchedule: { weekdays: { morningCommute } } },
  },
});

describe('useCommuteHeroEstimate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMLPrediction.mockReturnValue({ prediction: null, baselineMinutesFor: () => null });
    mockUseFirestoreMorningCommute.mockReturnValue(null);
    mockUseFirestoreCommuteLeg.mockReturnValue(null);
    mockResolveActiveCommuteType.mockReturnValue('morning');
    mockUseCommuteRouteSummary.mockReturnValue({ ready: false });
    mockUseAuth.mockReturnValue({ user: { id: 'u1', preferences: {} } });
    mockGetStation.mockResolvedValue(null);
  });

  it('returns null hero and undefined departure when no commute and no prediction', () => {
    const { result } = renderHook(() => useCommuteHeroEstimate());

    expect(result.current.effectiveHero).toBeNull();
    expect(result.current.effectiveDepartureTime).toBeUndefined();
    expect(result.current.hasRealPrediction).toBe(false);
    expect(result.current.morningCommute).toBeNull();
  });

  it('derives door-to-door hero minutes from an OD-matched ML prediction (departure→arrival)', async () => {
    // The prediction carries the OD it was computed from; it is promoted only
    // because that OD matches the registered route's resolved station names.
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.82,
        originStationName: '서울역',
        destinationStationName: '강남역',
      },
      baselineMinutesFor: () => 31,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(28);
    });
    expect(result.current.hasRealPrediction).toBe(true);
    // delta = 28 - baseline(31) = -3 (faster than usual)
    expect(result.current.effectiveHero?.deltaMinutes).toBe(-3);
    expect(result.current.effectiveHero?.arrivalTime).toBe('08:28');
    expect(result.current.effectiveHero?.confidence).toBe(0.82);
    expect(result.current.effectiveDepartureTime).toBe('08:00');
  });

  // OD wiring: the hero hook must register its 출근 OD with useMLPrediction so
  // the fallback model averages only that leg's logs — and must refuse to
  // promote any prediction that was NOT computed for that OD (route-less
  // initial state, or a stale/mismatched route).
  it('passes the resolved morning OD to useMLPrediction as route context', async () => {
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(mockUseMLPrediction).toHaveBeenCalledWith({
        originStationName: '서울역',
        destinationStationName: '강남역',
      });
    });
  });

  it('does not promote a route-less (mixed-population) prediction — graph fallback wins', async () => {
    // Prediction carries no OD tag: it was averaged over ALL weekday logs
    // (potentially 출근+퇴근 mixed), so it must not become the hero number.
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '13:15',
        predictedArrivalTime: '13:45',
        confidence: 0.4,
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({ ready: true, rideMinutes: 26 });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(26);
    });
    // Graph fallback, not the 30-minute ML span (13:15→13:45).
    expect(result.current.effectiveHero?.confidence).toBeUndefined();
    // The hero on screen is the graph estimate — the "real prediction" flag
    // must not report the discarded route-less ML result as promoted.
    expect(result.current.hasRealPrediction).toBe(false);
  });

  it('does not promote a prediction computed for a different OD than the registered route', async () => {
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.8,
        originStationName: '산곡',
        destinationStationName: '선릉',
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:10',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({ ready: true, rideMinutes: 26 });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(26);
    });
    expect(result.current.effectiveHero?.confidence).toBeUndefined();
    // OD-mismatched prediction was discarded → not a real prediction on screen.
    expect(result.current.hasRealPrediction).toBe(false);
  });

  // Regression (screenshot bug): the fallback model could emit an inverted
  // pair (departure 13:15 / arrival 13:05) from mixed-leg logs. minutesBetween
  // reads that as a midnight wrap → "1430분" on the hero. An inverted morning
  // prediction is corrupt input, not a real overnight commute — it must not be
  // promoted to the hero at all.
  it('rejects an inverted ML prediction (arrival before departure) instead of showing 1430', async () => {
    // OD matches the registered route on purpose: this pins the wrap gate
    // specifically, independent of the OD-match gate.
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '13:15',
        predictedArrivalTime: '13:05',
        confidence: 0.3,
        originStationName: '서울역',
        destinationStationName: '강남역',
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    // Wait until the station names resolve (the OD gate would pass) — the
    // hero must STILL be null because the pair is inverted.
    await waitFor(() => {
      expect(result.current.commuteStationNames.origin).toBe('서울역');
    });
    expect(result.current.effectiveHero).toBeNull();
  });

  it('falls back to graph ride minutes when the ML prediction is inverted', async () => {
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '13:15',
        predictedArrivalTime: '13:05',
        confidence: 0.3,
        originStationName: '서울역',
        destinationStationName: '강남역',
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({ ready: true, rideMinutes: 26 });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(26);
    });
    // The 1430-minute wrap number must never surface.
    expect(result.current.effectiveHero?.confidence).toBeUndefined();
    // Inverted prediction was discarded → not a real prediction on screen.
    expect(result.current.hasRealPrediction).toBe(false);
  });

  // hasRealPrediction gates the "데이터 수집중" copy and the ML badge. It must
  // track the hero actually promoted to the screen (heroProps), not the mere
  // existence of an mlPrediction object — a discarded prediction (route-less,
  // OD-mismatched or inverted) falls through to the graph estimate, and the
  // flag must say so.
  it('reports hasRealPrediction=false when the ML prediction is discarded and the graph hero shows', async () => {
    // Route-less prediction (no OD tag): heroProps refuses to promote it.
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '13:15',
        predictedArrivalTime: '13:45',
        confidence: 0.4,
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({ ready: true, rideMinutes: 26 });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    // Wait until the graph fallback hero is on screen (names resolved).
    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(26);
    });
    expect(result.current.hasRealPrediction).toBe(false);
  });

  // When the ML prediction is discarded (inverted / OD-mismatched) and the
  // graph fallback provides the hero, the departure timestamp must come from
  // the registered commute too — otherwise the card would pair the graph's
  // ride minutes with the corrupt 13:15 ML departure.
  it('uses the registered departure time (not the ML one) when the ML prediction is discarded', async () => {
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '13:15',
        predictedArrivalTime: '13:05',
        confidence: 0.3,
        originStationName: '서울역',
        destinationStationName: '강남역',
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({ ready: true, rideMinutes: 26 });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(26);
    });
    expect(result.current.effectiveDepartureTime).toBe('08:00');
  });

  // Wiring regression: the baseline must be looked up for the leg the number is
  // labelled as. commuteStationNames tracks the ACTIVE leg, so on the evening
  // leg it names the reverse OD — asking with those would price a morning
  // number off the (measurably slower) return trip.
  it('asks for the baseline of the morning OD, using resolved station names', async () => {
    const baselineMinutesFor = jest.fn(() => 31);
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.82,
        originStationName: '산곡',
        destinationStationName: '선릉',
      },
      baselineMinutesFor,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockGetStation.mockImplementation((id: string) =>
      Promise.resolve(
        id === '0150'
          ? { name: '산곡', lineId: '7' }
          : { name: '선릉', lineId: '2' },
      ),
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(baselineMinutesFor).toHaveBeenCalledWith('산곡', '선릉');
    });
    expect(result.current.effectiveHero?.deltaMinutes).toBe(-3);
  });

  it('does not surface an ML hero on the evening leg (baseline would be the wrong OD)', async () => {
    mockResolveActiveCommuteType.mockReturnValue('evening');
    const baselineMinutesFor = jest.fn(() => 31);
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.82,
      },
      baselineMinutesFor,
    });
    mockUseFirestoreCommuteLeg.mockReturnValue({
      departureTime: '18:40',
      stationId: '0220',
      destinationStationId: '0150',
    });

    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));

    expect(result.current.hasRealPrediction).toBe(false);
    expect(result.current.effectiveHero?.confidence).toBeUndefined();
  });

  it('falls back to graph ride minutes (no ML) and derives arrival from departure + ride', async () => {
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({
      ready: true,
      rideMinutes: 26,
      transferCount: 1,
      stationCount: 8,
      fareKrw: 1400,
    });
    // The graph fallback gates on resolved endpoint names (faithful to
    // HomeScreen) — resolve them so the hero surfaces.
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.effectiveHero?.predictedMinutes).toBe(26);
    });
    expect(result.current.hasRealPrediction).toBe(false);
    expect(result.current.effectiveHero?.deltaMinutes).toBeUndefined();
    expect(result.current.effectiveHero?.confidence).toBeUndefined();
    // arrival = 08:00 + 26min = 08:26
    expect(result.current.effectiveHero?.arrivalTime).toBe('08:26');
    // departure source = registered commute (no ML)
    expect(result.current.effectiveDepartureTime).toBe('08:00');
  });

  it('forwards the chosen transferStationId to useCommuteRouteSummary (via-constrained route)', () => {
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
      transferStationId: 'stn-via',
    });

    renderHook(() => useCommuteHeroEstimate());

    expect(mockUseCommuteRouteSummary).toHaveBeenCalledWith('0150', '0220', 'stn-via');
  });

  it('drops a non-null profile commute with empty station ids and uses store #2 (isUsableCommuteTime gate)', () => {
    // Profile (store #1) has a non-null morningCommute but empty station ids
    // (NotificationTimeScreen synthesis). A plain `??` would let it shadow the
    // valid onboarding data, so the gate must drop it to null.
    mockUseAuth.mockReturnValue(
      userWithProfileCommute({ departureTime: '07:30', stationId: '', destinationStationId: '' }),
    );
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockUseCommuteRouteSummary.mockReturnValue({ ready: true, rideMinutes: 26 });

    const { result } = renderHook(() => useCommuteHeroEstimate());

    // departure resolves from store #2 (08:00), NOT the empty store #1 object.
    expect(result.current.morningCommute?.stationId).toBe('0150');
    expect(result.current.effectiveDepartureTime).toBe('08:00');
  });

  it('resolves origin/destination station names via trainService', async () => {
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.commuteStationNames.origin).toBe('서울역');
    });
    expect(result.current.commuteStationNames.destination).toBe('강남역');
    expect(result.current.commuteStationNames.originLineId).toBe('1');
  });

  it('forwards refreshNonce to the live morning-commute subscription (HomeScreen focus re-read)', () => {
    renderHook(() => useCommuteHeroEstimate(7));
    expect(mockUseFirestoreMorningCommute).toHaveBeenCalledWith('u1', 7);
  });

  it('defaults refreshNonce to 0 for consumers that omit it', () => {
    renderHook(() => useCommuteHeroEstimate());
    expect(mockUseFirestoreMorningCommute).toHaveBeenCalledWith('u1', 0);
  });
});

describe('useCommuteHeroEstimate direction=auto (evening switch)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMLPrediction.mockReturnValue({ prediction: null, baselineMinutesFor: () => null });
    mockUseFirestoreMorningCommute.mockReturnValue(null);
    mockUseFirestoreCommuteLeg.mockReturnValue(null);
    mockResolveActiveCommuteType.mockReturnValue('morning');
    mockUseCommuteRouteSummary.mockReturnValue({ ready: false });
    mockUseAuth.mockReturnValue({ user: { id: 'u1', preferences: {} } });
    mockGetStation.mockResolvedValue(null);
  });

  it("PM + 퇴근설정 → activeCommuteType='evening', 그래프 추정치(ML 무시)", async () => {
    mockResolveActiveCommuteType.mockReturnValue('evening');
    // Evening leg resolves (work→home) via useFirestoreCommuteLeg('evening').
    mockUseFirestoreCommuteLeg.mockReturnValue({
      departureTime: '19:00',
      stationId: '0220',
      destinationStationId: '0150',
    });
    mockUseCommuteRouteSummary.mockReturnValue({
      ready: true,
      rideMinutes: 24,
      transferCount: 1,
      stationCount: 7,
      fareKrw: 1400,
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0220'
        ? { id: '0220', name: '강남역', lineId: '2' }
        : { id: '0150', name: '서울역', lineId: '1' },
    );
    // ML prediction is present (morning-only model) — must be IGNORED for evening.
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:30',
        confidence: 0.9,
      },
      baselineMinutesFor: () => 30,
    });

    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));

    expect(result.current.activeCommuteType).toBe('evening');
    expect(result.current.activeCommute?.stationId).toBe('0220');
    await waitFor(() =>
      expect(result.current.effectiveHero?.predictedMinutes).toBe(24),
    );
    // Evening must NOT reuse the morning ML number.
    expect(result.current.hasRealPrediction).toBe(false);
    expect(result.current.effectiveHero?.confidence).toBeUndefined();
    // arrival = 19:00 + 24min = 19:24, departure from evening commute.
    expect(result.current.effectiveHero?.arrivalTime).toBe('19:24');
    expect(result.current.effectiveDepartureTime).toBe('19:00');
  });

  it("AM + 출근설정 → activeCommuteType='morning', ML 적용(오늘과 동일)", async () => {
    mockResolveActiveCommuteType.mockReturnValue('morning');
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    // OD-tagged so the prediction survives promotion once the names resolve —
    // hasRealPrediction tracks the PROMOTED hero, not the raw prediction.
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.8,
        originStationName: '서울역',
        destinationStationName: '강남역',
      },
      baselineMinutesFor: () => 31,
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));

    expect(result.current.activeCommuteType).toBe('morning');
    expect(result.current.activeCommute?.stationId).toBe('0150');
    await waitFor(() => {
      expect(result.current.hasRealPrediction).toBe(true);
    });
  });

  it('PM + 퇴근 미설정 → activeCommute null', () => {
    mockResolveActiveCommuteType.mockReturnValue('evening');
    mockUseFirestoreCommuteLeg.mockReturnValue(null); // evening not set / toggled off

    const { result } = renderHook(() => useCommuteHeroEstimate(0, 'auto'));

    expect(result.current.activeCommuteType).toBe('evening');
    expect(result.current.activeCommute).toBeNull();
  });

  it("default direction='morning' → activeCommuteType='morning' (회귀, Weekly 보호)", () => {
    // Would mislead if the resolver were consulted — it must not be.
    mockResolveActiveCommuteType.mockReturnValue('evening');

    const { result } = renderHook(() => useCommuteHeroEstimate());

    expect(result.current.activeCommuteType).toBe('morning');
    expect(mockResolveActiveCommuteType).not.toHaveBeenCalled();
  });

  it("evening leg subscription disabled in direction='morning' (enabled=false)", () => {
    renderHook(() => useCommuteHeroEstimate());
    expect(mockUseFirestoreCommuteLeg).toHaveBeenCalledWith('u1', 'evening', 0, false);
  });

  it("evening leg subscription enabled in direction='auto'", () => {
    renderHook(() => useCommuteHeroEstimate(0, 'auto'));
    expect(mockUseFirestoreCommuteLeg).toHaveBeenCalledWith('u1', 'evening', 0, true);
  });

  // Station names resolve ASYNCHRONOUSLY, so for one window after the commute
  // (or the active leg) changes the state still holds the PREVIOUS OD's names.
  // Those stale names feed both the prediction's route context and the OD gate
  // that checks it, so they agree with each other and a prediction computed for
  // the old route sails through onto the new commute. The names must be
  // invalidated the moment the commute they were resolved for changes.
  it('discards station names resolved for a previous commute until the new lookup lands', async () => {
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.82,
        originStationName: '서울역',
        destinationStationName: '강남역',
      },
      baselineMinutesFor: () => null,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });
    mockGetStation.mockImplementation(async (id: string) =>
      id === '0150'
        ? { id: '0150', name: '서울역', lineId: '1' }
        : { id: '0220', name: '강남역', lineId: '2' },
    );

    const { result, rerender } = renderHook(() => useCommuteHeroEstimate());

    await waitFor(() => {
      expect(result.current.commuteStationNames.origin).toBe('서울역');
    });
    expect(result.current.hasRealPrediction).toBe(true);

    // The commute flips to the reverse OD and the new lookup never settles
    // inside this window — exactly the leg-transition gap.
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '18:40',
      stationId: '0220',
      destinationStationId: '0150',
    });
    mockGetStation.mockImplementation(() => new Promise(() => {}));
    rerender({});

    expect(result.current.commuteStationNames.origin).toBeUndefined();
    expect(result.current.commuteStationNames.destination).toBeUndefined();
    // The old-OD prediction must NOT be promoted onto the new commute.
    expect(result.current.hasRealPrediction).toBe(false);
  });
});
