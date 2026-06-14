/**
 * NotificationTimeline — 24-hour "평일 알림 활성 시간" bar (Wanted handoff).
 *
 * Visualizes, on a single horizontal 24h track:
 *   - 일반 (light)    — the active (non–quiet-hours) span
 *   - 출퇴근 (solid)  — commute alert windows, derived from departure times
 *   - 방해 금지 (hatch) — quiet hours, drawn as a diagonal-stripe overlay
 *
 * All bands derive from the same source values the editable controls use
 * (`morningTime`/`eveningTime` departure times + quiet start/end), so the
 * bar can never drift from the inputs below it. This component is purely
 * presentational — it persists nothing.
 */
import React, { useId, useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useSemanticTokens } from '@/services/theme';

interface NotificationTimelineProps {
  /** Morning departure "HH:MM" — anchors the 출근 window. */
  morningTime: string;
  /** Evening departure "HH:MM" — anchors the 퇴근 window. */
  eveningTime: string;
  /** Quiet-hours start "HH:MM". */
  quietStart: string;
  /** Quiet-hours end "HH:MM". */
  quietEnd: string;
  /** Whether quiet hours are active (controls the hatch overlay + legend). */
  quietEnabled: boolean;
  /**
   * Whether a usable morning commute exists. When false the 출근 block/label is
   * not drawn — the bar never visualizes a window for a commute that isn't set.
   * Defaults to true.
   */
  morningActive?: boolean;
  /** Whether a usable evening commute exists (gates the 퇴근 block/label). */
  eveningActive?: boolean;
}

/** Commute window lengths (hours) past the departure time. Display-only. */
const MORNING_WINDOW_H = 2;
const EVENING_WINDOW_H = 3;

const TRACK_HEIGHT = 48;
const HATCH_TILE = 6;

/** "HH:MM" → decimal hours (e.g. "08:30" → 8.5). 0 on parse failure. */
export const parseTime = (t: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return 0;
  return parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60;
};

interface Band {
  readonly left: number;
  readonly width: number;
}

/**
 * Quiet hours frequently cross midnight (e.g. 23:00 → 07:00). Returns one
 * band normally, or two when the range wraps. Empty when disabled or zero-width.
 */
export const computeQuietBands = (
  startH: number,
  endH: number,
  enabled: boolean
): readonly Band[] => {
  if (!enabled) return [];
  if (startH > endH) {
    return [
      { left: startH, width: 24 - startH },
      { left: 0, width: endH },
    ];
  }
  const width = Math.max(0, endH - startH);
  return width > 0 ? [{ left: startH, width }] : [];
};

export const NotificationTimeline: React.FC<NotificationTimelineProps> = ({
  morningTime,
  eveningTime,
  quietStart,
  quietEnd,
  quietEnabled,
  morningActive = true,
  eveningActive = true,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // Unique, stable per-instance suffix for SVG pattern ids — avoids url(#id)
  // collisions if multiple timelines mount in one document (web/list/modal).
  const rawId = useId();
  const hatchId = `ntHatch-${rawId.replace(/:/g, '')}`;

  // Measured track width (px). The hatch overlay uses pixel coordinates rather
  // than SVG percentages: react-native-svg won't reliably resolve percentage
  // Rect coords without a viewBox, so we draw against the real measured width
  // (RN View percentages, used by the solid/light bands below, are fine).
  const [trackWidth, setTrackWidth] = useState(0);
  const handleTrackLayout = (e: LayoutChangeEvent): void => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const morningH = parseTime(morningTime);
  const eveningH = parseTime(eveningTime);
  const quietStartH = parseTime(quietStart);
  const quietEndH = parseTime(quietEnd);

  const morningStart = Math.min(24, morningH);
  const morningEnd = Math.min(24, morningH + MORNING_WINDOW_H);
  const eveningStart = Math.min(24, eveningH);
  const eveningEnd = Math.min(24, eveningH + EVENING_WINDOW_H);

  const quietBands = computeQuietBands(quietStartH, quietEndH, quietEnabled);

  // The "일반" (general active) band spans the non-quiet portion of the day.
  // When quiet hours wrap midnight (start > end) the active span is the
  // middle [quietEnd, quietStart]; otherwise the full day reads as active.
  const generalBand: Band =
    quietEnabled && quietStartH > quietEndH
      ? { left: quietEndH, width: Math.max(0, quietStartH - quietEndH) }
      : { left: 0, width: 24 };

  const pct = (n: number): `${number}%` => `${(n / 24) * 100}%`;
  /** hours [0..24] → pixel x against the measured track width. */
  const px = (hours: number): number => (hours / 24) * trackWidth;

  return (
    <View style={styles.card} testID="notification-timeline">
      <Text style={styles.eyebrow}>24시간 알림</Text>
      <Text style={styles.title}>평일 알림 활성 시간</Text>

      {/* Commute labels anchored above their window start — only for commutes
          that are actually set, so the bar never labels a phantom window. */}
      <View style={styles.labelRow}>
        {morningActive && (
          <Text style={[styles.label, { left: pct(morningStart) }]}>출근</Text>
        )}
        {eveningActive && (
          <Text style={[styles.label, { left: pct(eveningStart) }]}>퇴근</Text>
        )}
      </View>

      <View style={styles.track} testID="timeline-track" onLayout={handleTrackLayout}>
        {/* General active (light) band */}
        {generalBand.width > 0 && (
          <View
            style={[
              styles.band,
              styles.bandLight,
              { left: pct(generalBand.left), width: pct(generalBand.width) },
            ]}
          />
        )}
        {/* Commute solid blocks — only when the commute is usable */}
        {morningActive && (
          <View
            style={[
              styles.band,
              styles.bandSolid,
              { left: pct(morningStart), width: pct(morningEnd - morningStart) },
            ]}
          />
        )}
        {eveningActive && (
          <View
            style={[
              styles.band,
              styles.bandSolid,
              { left: pct(eveningStart), width: pct(eveningEnd - eveningStart) },
            ]}
          />
        )}
        {/* Quiet hours diagonal-hatch overlay (drawn last so it sits on top).
            Pixel coordinates from the measured track width — see trackWidth. */}
        {quietBands.length > 0 && trackWidth > 0 && (
          <Svg
            width={trackWidth}
            height={TRACK_HEIGHT}
            style={styles.hatchOverlay}
            testID="timeline-hatch"
          >
            <Defs>
              <Pattern
                id={hatchId}
                patternUnits="userSpaceOnUse"
                width={HATCH_TILE}
                height={HATCH_TILE}
              >
                <Line
                  x1={0}
                  y1={HATCH_TILE}
                  x2={HATCH_TILE}
                  y2={0}
                  stroke={semantic.labelAlt}
                  strokeWidth={1}
                />
              </Pattern>
            </Defs>
            {quietBands.map((b, i) => (
              <React.Fragment key={`quiet-${i}`}>
                <Rect
                  x={px(b.left)}
                  y={0}
                  width={px(b.width)}
                  height={TRACK_HEIGHT}
                  fill="rgba(112,115,124,0.12)"
                />
                <Rect
                  x={px(b.left)}
                  y={0}
                  width={px(b.width)}
                  height={TRACK_HEIGHT}
                  fill={`url(#${hatchId})`}
                />
              </React.Fragment>
            ))}
          </Svg>
        )}
      </View>

      {/* Hour ticks */}
      <View style={styles.tickRow}>
        {[0, 6, 12, 18, 24].map((h) => (
          <Text key={h} style={styles.tick}>
            {String(h).padStart(2, '0')}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.bandSolid]} />
          <Text style={styles.legendText}>출퇴근 (강조)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.bandLight]} />
          <Text style={styles.legendText}>일반</Text>
        </View>
        {quietEnabled && (
          <View style={styles.legendItem}>
            <Svg
              width={10}
              height={10}
              style={styles.legendSwatch}
              testID="legend-hatch"
            >
              <Defs>
                <Pattern
                  id={`${hatchId}-legend`}
                  patternUnits="userSpaceOnUse"
                  width={HATCH_TILE}
                  height={HATCH_TILE}
                >
                  <Line
                    x1={0}
                    y1={HATCH_TILE}
                    x2={HATCH_TILE}
                    y2={0}
                    stroke={semantic.labelAlt}
                    strokeWidth={1}
                  />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={10} height={10} fill="rgba(112,115,124,0.12)" />
              <Rect x={0} y={0} width={10} height={10} fill={`url(#${hatchId}-legend)`} />
            </Svg>
            <Text style={styles.legendText}>방해 금지</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r10,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      padding: WANTED_TOKENS.spacing.s5,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    eyebrow: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      lineHeight: WANTED_TOKENS.type.caption1.lh,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: WANTED_TOKENS.type.headline1.size,
      lineHeight: WANTED_TOKENS.type.headline1.lh,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    labelRow: {
      position: 'relative',
      height: 16,
      marginTop: WANTED_TOKENS.spacing.s4,
    },
    label: {
      position: 'absolute',
      fontSize: 10,
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryHover,
      paddingLeft: 4,
    },
    track: {
      position: 'relative',
      height: TRACK_HEIGHT,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: semantic.bgSubtle,
      overflow: 'hidden',
    },
    band: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    hatchOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
    },
    bandSolid: {
      backgroundColor: semantic.primaryNormal,
    },
    bandLight: {
      backgroundColor: semantic.primaryBg,
    },
    tickRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    tick: {
      fontSize: 10,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
      marginRight: 6,
    },
    legendText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
  });

export default NotificationTimeline;
