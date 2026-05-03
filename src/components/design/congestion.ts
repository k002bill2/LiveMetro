/**
 * Congestion utility — 4-step semantic mapping for crowdedness percentages.
 *
 * Mirrors the design handoff's `CONG_TONE` map and `congFromPct` function so
 * design components and screens stay 1:1 with the prototype.
 */
import { WANTED_TOKENS, type CongestionLevel } from '@/styles/modernTheme';

export const CONG_TONE = WANTED_TOKENS.congestion;

/**
 * Map a congestion percentage (0–100) to a 4-step semantic level.
 * Cutoffs match the design's congFromPct(): <45=low, <70=mid, <88=high, else vhigh.
 */
export const congFromPct = (pct: number): CongestionLevel => {
  if (pct < 45) return 'low';
  if (pct < 70) return 'mid';
  if (pct < 88) return 'high';
  return 'vhigh';
};

export type { CongestionLevel };
