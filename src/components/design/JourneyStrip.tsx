/**
 * JourneyStrip — compact horizontal visualisation of a multi-leg subway
 * journey, matching the design handoff's RoutesScreen visual journey strip
 * (main.jsx RoutesScreen lines 82–109).
 *
 * Composition (left → right):
 *   [train leg] → [transfer arrow] → [train leg] [walk pill] [train leg]
 *
 * - Train legs render as line-coloured blocks with the line label and
 *   per-leg minutes. Width scales with the leg's relative weight so a
 *   user can read journey balance at a glance without inspecting numbers.
 * - Walk legs render as a neutral grey pill with a footprints glyph.
 * - Transfer markers render as a small chevron-style arrow between legs.
 *
 * Purely presentational. Caller maps domain Route data into the
 * `JourneyStripLeg[]` shape via a thin adapter — see
 * `AlternativeRouteCard` for the canonical mapping from `RouteSegment[]`.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ArrowRight, Footprints } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import type { LineId } from './LineBadge';

/** Discriminated union for the strip's leg shapes. */
export type JourneyStripLeg =
  | {
      readonly type: 'train';
      readonly lineId: LineId | string;
      /** Minutes the train spends on this leg. Drives the visible label. */
      readonly minutes: number;
      /**
       * Optional weight that biases this leg's rendered width. Defaults to
       * `minutes`. Caller can pass station count for closer parity with
       * the design handoff's visual.
       */
      readonly weight?: number;
      /**
       * Optional short label shown inside the leg (e.g. "2", "신분당").
       * Falls back to `lineId` for digit lines, or first char otherwise.
       */
      readonly label?: string;
    }
  | { readonly type: 'walk'; readonly minutes: number }
  | { readonly type: 'transfer' };

interface JourneyStripProps {
  /** Ordered legs from origin to destination. */
  legs: readonly JourneyStripLeg[];
  style?: ViewStyle;
  testID?: string;
}

/**
 * Map a numeric weight to a flex factor that keeps very short legs
 * readable (min 36px) and lets longer legs grow proportionally.
 */
const weightToFlex = (weight: number): number => Math.max(1, weight);

const labelFor = (leg: Extract<JourneyStripLeg, { type: 'train' }>): string => {
  if (leg.label) return leg.label;
  // Digit lines render as the digit; named lines (신분당 등) take first char.
  return /^\d+$/.test(leg.lineId) ? leg.lineId : leg.lineId.charAt(0);
};

const JourneyStripImpl: React.FC<JourneyStripProps> = ({
  legs,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  return (
    <View
      testID={testID ?? 'journey-strip'}
      accessibilityRole="text"
      accessibilityLabel={`경로 strip — ${legs.length}구간`}
      style={[styles.row, style]}
    >
      {legs.map((leg, i) => {
        if (leg.type === 'transfer') {
          return (
            <ArrowRight
              key={`transfer-${i}`}
              size={12}
              color={semantic.labelAlt}
              strokeWidth={2}
            />
          );
        }
        if (leg.type === 'walk') {
          return (
            <View
              key={`walk-${i}`}
              style={[
                styles.walkPill,
                { backgroundColor: 'rgba(112,115,124,0.10)' },
              ]}
            >
              <Footprints size={11} color={semantic.labelNeutral} />
              <Text
                style={[styles.walkText, { color: semantic.labelNeutral }]}
              >
                {leg.minutes}
              </Text>
            </View>
          );
        }
        const lineColor = getSubwayLineColor(leg.lineId);
        const flex = weightToFlex(leg.weight ?? leg.minutes);
        return (
          <View
            key={`train-${i}-${leg.lineId}`}
            style={[
              styles.trainLeg,
              { backgroundColor: lineColor, flex, minWidth: 36 },
            ]}
          >
            <Text style={styles.trainLabel}>{labelFor(leg)}</Text>
            <Text style={styles.trainMinutes}>{leg.minutes}분</Text>
          </View>
        );
      })}
    </View>
  );
};

export const JourneyStrip = memo(JourneyStripImpl);
JourneyStrip.displayName = 'JourneyStrip';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
  },
  trainLeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 6,
  },
  trainLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: weightToFontFamily('800'),
  },
  trainMinutes: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: weightToFontFamily('700'),
  },
  walkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    height: 24,
    borderRadius: 6,
  },
  walkText: {
    fontSize: 10,
    fontFamily: weightToFontFamily('700'),
  },
});
