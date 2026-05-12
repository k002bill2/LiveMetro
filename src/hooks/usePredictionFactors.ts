/**
 * usePredictionFactors hook
 *
 * Phase 3 of ML prediction Sections 6-9 (spec: 2026-05-12).
 * Combines weather + congestion + delay + pattern into a unified factors[] array
 * for the Section 8 "예측에 반영된 요소" panel.
 *
 * Adaptations from plan (documented in test file):
 * - DayOfWeek is numeric (0=Sun..6=Sat) per src/models/pattern.ts.
 * - Uses weatherService.getCurrentWeather (returns WeatherData | null).
 * - Uses congestionService.getLineCongestion + level→percent mapping vs MODERATE
 *   baseline (no daily-vs-today aggregate exists yet).
 * - Uses officialDelayService.getActiveDelays() (no per-line filter; we filter
 *   client-side by lineId).
 * - CommutePattern lacks averageMin; pattern factor shows confidence-based label.
 */

import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Users,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react-native';
import { weatherService, type WeatherData } from '@/services/weather/weatherService';
import { congestionService } from '@/services/congestion/congestionService';
import {
  officialDelayService,
  type OfficialDelay,
} from '@/services/delay/officialDelayService';
import { useCommutePattern } from '@/hooks/useCommutePattern';
import type { CommutePattern } from '@/models/pattern';
import { CongestionLevel } from '@/models/train';
import type { TrainCongestionSummary } from '@/models/congestion';
import type { DayOfWeek } from '@/models/pattern';
import { DAY_NAMES_KO } from '@/models/pattern';

export type FactorImpact = 'negative' | 'positive' | 'neutral';

export type FactorId = 'weather' | 'congestion' | 'delay' | 'pattern';

export interface PredictionFactor {
  readonly id: FactorId;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
  readonly impact: FactorImpact;
}

export interface UsePredictionFactorsParams {
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly dayOfWeek: DayOfWeek;
}

export interface UsePredictionFactorsReturn {
  readonly factors: readonly PredictionFactor[];
  readonly loading: boolean;
}

/**
 * Convert CongestionLevel enum to an approximate crowdedness percent
 * (midpoint of the documented buckets: LOW <30, MODERATE 30-70, HIGH 70-90, CROWDED >90).
 */
const LEVEL_TO_PERCENT: Record<CongestionLevel, number> = {
  [CongestionLevel.LOW]: 20,
  [CongestionLevel.MODERATE]: 50,
  [CongestionLevel.HIGH]: 80,
  [CongestionLevel.CROWDED]: 95,
};

const CONGESTION_BASELINE_PERCENT = 50; // MODERATE midpoint = "normal day"
/** Min deviation (percentage points) from baseline to flag as positive/negative. */
const CONGESTION_DEVIATION_THRESHOLD_PP = 5;

/** Weather impact tuning: rain adds 1 min per N mm; snow uses a floor. */
const WEATHER_RAIN_MM_PER_MIN = 2;
const WEATHER_SNOW_MIN_DELAY_MIN = 2;

interface ConditionalSummary {
  readonly overallLevel: CongestionLevel;
  readonly direction: 'up' | 'down';
}

function averageCongestionPercent(
  summaries: readonly ConditionalSummary[],
  direction: 'up' | 'down'
): number | null {
  const filtered = summaries.filter(s => s.direction === direction);
  const pool = filtered.length > 0 ? filtered : summaries;
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, s) => sum + LEVEL_TO_PERCENT[s.overallLevel], 0);
  return total / pool.length;
}

function buildWeatherFactor(
  result: PromiseSettledResult<WeatherData | null>
): PredictionFactor {
  if (result.status !== 'fulfilled' || result.value == null) {
    return {
      id: 'weather',
      icon: Cloud,
      label: '날씨 정보 없음',
      value: '-',
      impact: 'neutral',
    };
  }
  const w = result.value;
  if (w.condition === 'clear') {
    return { id: 'weather', icon: Sun, label: '맑음', value: '맑음', impact: 'neutral' };
  }
  if (w.condition === 'rain') {
    // +1분 per WEATHER_RAIN_MM_PER_MIN of precipitation, floor 1.
    const delayMin = Math.max(1, Math.round(w.precipitation / WEATHER_RAIN_MM_PER_MIN));
    return {
      id: 'weather',
      icon: CloudRain,
      label: '비 예보',
      value: `+${delayMin}분`,
      impact: 'negative',
    };
  }
  if (w.condition === 'snow') {
    const delayMin = Math.max(WEATHER_SNOW_MIN_DELAY_MIN, Math.round(w.precipitation));
    return {
      id: 'weather',
      icon: CloudSnow,
      label: '눈 예보',
      value: `+${delayMin}분`,
      impact: 'negative',
    };
  }
  return { id: 'weather', icon: Cloud, label: '흐림', value: '흐림', impact: 'neutral' };
}

function buildCongestionFactor(
  result: PromiseSettledResult<readonly TrainCongestionSummary[]>,
  direction: 'up' | 'down'
): PredictionFactor {
  if (result.status !== 'fulfilled') {
    return {
      id: 'congestion',
      icon: Users,
      label: '평균 혼잡도',
      value: '-',
      impact: 'neutral',
    };
  }
  const avg = averageCongestionPercent(result.value, direction);
  if (avg == null) {
    return {
      id: 'congestion',
      icon: Users,
      label: '평균 혼잡도',
      value: '데이터 부족',
      impact: 'neutral',
    };
  }
  const diff = Math.round(avg - CONGESTION_BASELINE_PERCENT);
  const impact: FactorImpact =
    diff > CONGESTION_DEVIATION_THRESHOLD_PP
      ? 'negative'
      : diff < -CONGESTION_DEVIATION_THRESHOLD_PP
        ? 'positive'
        : 'neutral';
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '';
  const value = diff === 0 ? '평소와 같음' : `평소보다 ${Math.abs(diff)}%p ${arrow}`.trim();
  return { id: 'congestion', icon: Users, label: '평균 혼잡도', value, impact };
}

function buildDelayFactor(
  result: PromiseSettledResult<readonly OfficialDelay[]>,
  lineId: string
): PredictionFactor {
  if (result.status !== 'fulfilled') {
    return {
      id: 'delay',
      icon: Check,
      label: '지연 정보 없음',
      value: '-',
      impact: 'neutral',
    };
  }
  const lineDelays = result.value.filter(d => d.lineId === lineId);
  // No per-line delays AND no global delays: treat as on-time.
  if (result.value.length === 0 || lineDelays.length === 0) {
    return {
      id: 'delay',
      icon: Check,
      label: '지연 없음',
      value: '정시 운행',
      impact: 'positive',
    };
  }
  return {
    id: 'delay',
    icon: AlertTriangle,
    label: `${lineDelays.length}건 지연`,
    value: '확인 필요',
    impact: 'negative',
  };
}

function buildPatternFactor(
  patterns: readonly CommutePattern[] | undefined,
  dayOfWeek: DayOfWeek
): PredictionFactor {
  const dayLabel = DAY_NAMES_KO[dayOfWeek] ?? '오늘';
  const pattern = patterns?.find(p => p.dayOfWeek === dayOfWeek);
  if (!pattern) {
    return {
      id: 'pattern',
      icon: Calendar,
      label: `${dayLabel} 패턴`,
      value: '데이터 부족',
      impact: 'neutral',
    };
  }
  // Smaller stdDev = more predictable.
  const value =
    pattern.sampleCount > 0
      ? `±${Math.max(1, Math.round(pattern.stdDevMinutes))}분 편차`
      : '데이터 부족';
  return {
    id: 'pattern',
    icon: Calendar,
    label: `${dayLabel} 패턴`,
    value,
    impact: 'neutral',
  };
}

export function usePredictionFactors(
  params: UsePredictionFactorsParams
): UsePredictionFactorsReturn {
  const [factors, setFactors] = useState<readonly PredictionFactor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { patterns } = useCommutePattern();

  useEffect(() => {
    let cancelled = false;

    async function loadFactors(): Promise<void> {
      setLoading(true);

      const [weatherResult, congestionResult, delayResult] = await Promise.allSettled([
        weatherService.getCurrentWeather(),
        congestionService.getLineCongestion(params.lineId),
        officialDelayService.getActiveDelays(),
      ]);

      // Builders accept the real service types directly — no casts needed.
      const next: readonly PredictionFactor[] = [
        buildWeatherFactor(weatherResult),
        buildCongestionFactor(congestionResult, params.direction),
        buildDelayFactor(delayResult, params.lineId),
        buildPatternFactor(patterns, params.dayOfWeek),
      ];

      if (!cancelled) {
        setFactors(next);
        setLoading(false);
      }
    }

    void loadFactors();

    return () => {
      cancelled = true;
    };
  }, [params.lineId, params.direction, params.dayOfWeek, patterns]);

  return { factors, loading };
}
