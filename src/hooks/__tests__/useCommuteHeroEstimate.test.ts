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
import { useFirestoreMorningCommute } from '@/hooks/useFirestoreMorningCommute';
import { useCommuteRouteSummary } from '@/hooks/useCommuteRouteSummary';
import { useAuth } from '@/services/auth/AuthContext';
import { trainService } from '@/services/train/trainService';

jest.mock('@/hooks/useMLPrediction', () => ({
  useMLPrediction: jest.fn(() => ({ prediction: null, baselineMinutes: null })),
}));

jest.mock('@/hooks/useFirestoreMorningCommute', () => ({
  useFirestoreMorningCommute: jest.fn(() => null),
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
    mockUseMLPrediction.mockReturnValue({ prediction: null, baselineMinutes: null });
    mockUseFirestoreMorningCommute.mockReturnValue(null);
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

  it('derives door-to-door hero minutes from an ML prediction (departure→arrival)', () => {
    mockUseMLPrediction.mockReturnValue({
      prediction: {
        predictedDepartureTime: '08:00',
        predictedArrivalTime: '08:28',
        confidence: 0.82,
      },
      baselineMinutes: 31,
    });
    mockUseFirestoreMorningCommute.mockReturnValue({
      departureTime: '08:00',
      stationId: '0150',
      destinationStationId: '0220',
    });

    const { result } = renderHook(() => useCommuteHeroEstimate());

    expect(result.current.hasRealPrediction).toBe(true);
    expect(result.current.effectiveHero?.predictedMinutes).toBe(28);
    // delta = 28 - baseline(31) = -3 (faster than usual)
    expect(result.current.effectiveHero?.deltaMinutes).toBe(-3);
    expect(result.current.effectiveHero?.arrivalTime).toBe('08:28');
    expect(result.current.effectiveHero?.confidence).toBe(0.82);
    expect(result.current.effectiveDepartureTime).toBe('08:00');
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
