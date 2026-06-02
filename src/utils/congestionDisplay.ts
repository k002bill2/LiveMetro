/**
 * congestionDisplay — shared mapping from the crowdsourced congestion model to
 * the 0–100 percentages the bar UI renders.
 *
 * Both StationDetailScreen and TrainSelectionScreen show the same per-car bar
 * strip, so the level→percent mapping lives here (single source of truth)
 * instead of being duplicated per screen.
 */
import { CongestionLevel, type CarCongestion } from '@/models/congestion';

/** Center-of-band percentage for each congestion level (drives the bar fill). */
export const CONGESTION_LEVEL_TO_PERCENT: Record<CongestionLevel, number> = {
  [CongestionLevel.LOW]: 20,
  [CongestionLevel.MODERATE]: 50,
  [CongestionLevel.HIGH]: 80,
  [CongestionLevel.CROWDED]: 95,
};

/** Convert per-car congestion summaries to bar-fill percentages (order preserved). */
export const carsToPercentages = (cars: readonly CarCongestion[]): number[] =>
  cars.map((c) => CONGESTION_LEVEL_TO_PERCENT[c.congestionLevel] ?? 0);
