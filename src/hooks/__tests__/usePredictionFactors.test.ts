/**
 * usePredictionFactors Hook Tests
 *
 * Phase 3 of ML prediction Sections 6-9 (spec: 2026-05-12).
 *
 * Adaptations from plan (documented):
 * - DayOfWeek is numeric (0=Sun..6=Sat) per src/models/pattern.ts, NOT string codes.
 *   Wednesday = 3.
 * - weatherService exposes `getCurrentWeather` (returns WeatherData | null), not
 *   `getCurrentForecast`. WeatherData has { condition, precipitation }.
 * - congestionService has no `getDailyAverage`/`getTodayAverage`. We use
 *   `getLineCongestion(lineId)` which returns TrainCongestionSummary[]. The hook
 *   averages `overallLevel` across summaries vs a baseline (MODERATE = 50%).
 * - trainDelayService does not exist. We use `officialDelayService.getActiveDelays()`
 *   from src/services/delay/officialDelayService.ts (no-arg).
 * - CommutePattern has no `averageMin`. We use `stdDevMinutes` only as a "data
 *   present" signal; the pattern factor is informational/neutral.
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { CongestionLevel } from '@/models/train';
import { usePredictionFactors } from '@/hooks/usePredictionFactors';

jest.mock('@/services/weather/weatherService', () => ({
  weatherService: {
    getCurrentWeather: jest.fn(),
  },
}));

jest.mock('@/services/congestion/congestionService', () => ({
  congestionService: {
    getLineCongestion: jest.fn(),
  },
}));

jest.mock('@/services/delay/officialDelayService', () => ({
  officialDelayService: {
    getActiveDelays: jest.fn(),
  },
}));

jest.mock('@/hooks/useCommutePattern', () => ({
  useCommutePattern: jest.fn(),
}));

// Imports must follow jest.mock() above so the mock factories are in place.
/* eslint-disable import/first */
import { weatherService } from '@/services/weather/weatherService';
import { congestionService } from '@/services/congestion/congestionService';
import { officialDelayService } from '@/services/delay/officialDelayService';
import { useCommutePattern } from '@/hooks/useCommutePattern';
/* eslint-enable import/first */

const WEDNESDAY = 3 as const;

function makeSummary(level: CongestionLevel): unknown {
  return {
    id: `s_${level}`,
    trainId: 't1',
    lineId: '2',
    direction: 'up',
    cars: [],
    overallLevel: level,
    reportCount: 5,
    lastUpdated: new Date(),
  };
}

function setMockDefaults(): void {
  (weatherService.getCurrentWeather as jest.Mock).mockResolvedValue({
    condition: 'clear',
    precipitation: 0,
    temperature: 20,
    humidity: 50,
    description: 'clear',
    icon: 'sun',
    timestamp: new Date(),
    location: 'Seoul',
  });
  (congestionService.getLineCongestion as jest.Mock).mockResolvedValue([
    makeSummary(CongestionLevel.MODERATE),
    makeSummary(CongestionLevel.MODERATE),
  ]);
  (officialDelayService.getActiveDelays as jest.Mock).mockResolvedValue([]);
  (useCommutePattern as jest.Mock).mockReturnValue({
    patterns: [
      {
        userId: 'u1',
        dayOfWeek: WEDNESDAY,
        avgDepartureTime: '08:00',
        stdDevMinutes: 5,
        frequentRoute: {
          departureStationId: '1',
          departureStationName: 'A',
          arrivalStationId: '2',
          arrivalStationName: 'B',
          lineIds: ['2'],
        },
        confidence: 0.9,
        sampleCount: 10,
        lastUpdated: new Date(),
      },
    ],
  });
}

describe('usePredictionFactors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockDefaults();
  });

  it('maps weather=clear to neutral "맑음" factor', async () => {
    const { result } = renderHook(() =>
      usePredictionFactors({ lineId: '2', direction: 'up', dayOfWeek: WEDNESDAY })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const weather = result.current.factors.find(f => f.id === 'weather');
    expect(weather).toBeDefined();
    expect(weather).toMatchObject({ label: '맑음', impact: 'neutral' });
  });

  it('maps weather=rain to negative factor with +N분', async () => {
    (weatherService.getCurrentWeather as jest.Mock).mockResolvedValue({
      condition: 'rain',
      precipitation: 5,
      temperature: 15,
      humidity: 80,
      description: 'rain',
      icon: 'rain',
      timestamp: new Date(),
      location: 'Seoul',
    });

    const { result } = renderHook(() =>
      usePredictionFactors({ lineId: '2', direction: 'up', dayOfWeek: WEDNESDAY })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const weather = result.current.factors.find(f => f.id === 'weather');
    expect(weather?.label).toBe('비 예보');
    expect(weather?.impact).toBe('negative');
    expect(weather?.value).toMatch(/^\+\d+분$/);
  });

  it('reports congestion as negative when CROWDED summaries dominate', async () => {
    // CROWDED (90%+) vs baseline 50% (MODERATE) → diff > +5 → negative + ↑
    (congestionService.getLineCongestion as jest.Mock).mockResolvedValue([
      makeSummary(CongestionLevel.CROWDED),
      makeSummary(CongestionLevel.CROWDED),
      makeSummary(CongestionLevel.HIGH),
    ]);

    const { result } = renderHook(() =>
      usePredictionFactors({ lineId: '2', direction: 'up', dayOfWeek: WEDNESDAY })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const congestion = result.current.factors.find(f => f.id === 'congestion');
    expect(congestion?.impact).toBe('negative');
    // Implementation produces only the ↑ arrow; tighten regex to match.
    expect(congestion?.value).toMatch(/↑/);
  });

  it('reports delay as positive "정시 운행" when no active delays', async () => {
    const { result } = renderHook(() =>
      usePredictionFactors({ lineId: '2', direction: 'up', dayOfWeek: WEDNESDAY })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const delay = result.current.factors.find(f => f.id === 'delay');
    expect(delay).toMatchObject({
      label: '지연 없음',
      value: '정시 운행',
      impact: 'positive',
    });
  });

  it('falls back to neutral weather when service throws but keeps 4 factors', async () => {
    (weatherService.getCurrentWeather as jest.Mock).mockRejectedValue(
      new Error('network')
    );

    const { result } = renderHook(() =>
      usePredictionFactors({ lineId: '2', direction: 'up', dayOfWeek: WEDNESDAY })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const weather = result.current.factors.find(f => f.id === 'weather');
    expect(weather?.label).toBe('날씨 정보 없음');
    expect(weather?.impact).toBe('neutral');
    expect(result.current.factors).toHaveLength(4);
  });
});
