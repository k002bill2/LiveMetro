/**
 * ArrivalCard — single arrival entry (Wanted Design System).
 *
 * Mirrors the design handoff:
 *   ┌─[LineBadge] 잠실행 ━━━━━━━━━━━━━ 2분 30초 ┐
 *   │             정시 운행                [곧 도착] │
 *   │ - - - - - - - - - - - - - - - - - - - - - - │  ← isFirst only
 *   │ 칸별 혼잡도            ← 전 / 후 →            │
 *   │ ▮▮▮▮▮▮▮▮▮▮  (10 bar columns)                │
 *   └─────────────────────────────────────────────┘
 *
 * The first arrival in a list is rendered with a primary border + glow shadow
 * via the `isFirst` prop. Per-car congestion is optional.
 */
import React, { memo, useMemo } from 'react';
import { Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { WANTED_TOKENS, typeStyle, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { LineBadge, Pill, congFromPct, CONG_TONE, type LineId } from '@/components/design';

export interface ArrivalCardProps {
  line: LineId;
  destination: string;
  /** Minutes portion of the remaining time. */
  minutes: number;
  /** Seconds portion (0–59). Padded to 2 digits in the UI. */
  seconds: number;
  /** Highlights this card as the next-to-arrive (primary border + shadow). */
  isFirst?: boolean;
  /** Optional minute-level delay shown as subtitle. */
  delayMinutes?: number;
  /** Per-car congestion percentages (0–100). Length = car count. */
  carCongestion?: readonly number[];
  /**
   * Phase 55: when true, render a friendly empty-state row instead of
   * wholesale-hiding the congestion section when `carCongestion` is
   * absent. Defaults to false to preserve existing call-sites that
   * intentionally suppress the strip (e.g., non-first arrivals).
   */
  showEmptyCongestion?: boolean;
  testID?: string;
}

const ArrivalCardImpl: React.FC<ArrivalCardProps> = ({
  line,
  destination,
  minutes,
  seconds,
  isFirst = false,
  delayMinutes = 0,
  carCongestion,
  showEmptyCongestion = false,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const totalSeconds = Math.max(0, Math.floor(minutes) * 60 + Math.max(0, Math.floor(seconds)));
  const showImminentOnly = totalSeconds === 0;

  const cardStyle = useMemo<ViewStyle>(() => {
    const base: ViewStyle = {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
    };
    if (isFirst) {
      return {
        ...base,
        borderWidth: 2,
        borderColor: semantic.primaryNormal,
        shadowColor: WANTED_TOKENS.blue[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
      };
    }
    return {
      ...base,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    };
  }, [isFirst, semantic]);

  const destinationStyle: TextStyle = {
    ...typeStyle('body2', '800'),
    color: semantic.labelStrong,
  };

  const subtitleStyle: TextStyle = {
    marginTop: 2,
    ...typeStyle('caption1'),
    color: delayMinutes > 0 ? WANTED_TOKENS.status.red500 : semantic.labelAlt,
  };

  const minutesNumStyle: TextStyle = {
    fontSize: 28,
    fontFamily: weightToFontFamily('800'),
    color: isFirst ? semantic.primaryNormal : semantic.labelStrong,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.84,
  };

  const minutesUnitStyle: TextStyle = {
    ...typeStyle('label2', '700'),
    color: isFirst ? semantic.primaryNormal : semantic.labelNeutral,
    marginLeft: 1,
  };

  const secondsStyle: TextStyle = {
    ...typeStyle('label2', '700'),
    color: semantic.labelAlt,
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View testID={testID} style={cardStyle}>
      <View style={styles.headerRow}>
        <LineBadge line={line} size={26} />
        <View style={styles.destBlock}>
          <Text style={destinationStyle} numberOfLines={1}>
            {`${destination}행`}
          </Text>
          <Text style={subtitleStyle} numberOfLines={1}>
            {delayMinutes > 0 ? `지연 ${delayMinutes}분` : '정시 운행'}
          </Text>
        </View>
        <View style={styles.timeBlock}>
          {showImminentOnly ? (
            <Pill tone="primary" size="sm" testID={testID ? `${testID}-imminent` : undefined}>
              곧 도착
            </Pill>
          ) : (
            <>
              <View style={styles.timeRow}>
                <Text style={minutesNumStyle}>{minutes}</Text>
                <Text style={minutesUnitStyle}>분</Text>
                <Text style={secondsStyle}>{`${String(seconds).padStart(2, '0')}초`}</Text>
              </View>
              {isFirst ? (
                <View style={styles.pillSpacer}>
                  <Pill tone="primary" size="sm">
                    곧 도착
                  </Pill>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* Phase 55: empty state when caller explicitly opts in
          (`showEmptyCongestion`) and no per-car data is available.
          Renders a small placeholder row so users see clear messaging
          instead of a mysteriously empty card. */}
      {!(carCongestion && carCongestion.length > 0) && showEmptyCongestion ? (
        <View
          testID={testID ? `${testID}-congestion-empty` : undefined}
          style={[styles.congestionWrap, { borderTopColor: semantic.lineSubtle }]}
        >
          <View style={styles.emptyRow}>
            <Text style={[styles.emptyText, { color: semantic.labelAlt }]}>
              혼잡도 정보 준비 중
            </Text>
            <Text style={[styles.emptyHint, { color: semantic.labelAlt }]}>
              사용자 제보가 쌓이면 표시돼요
            </Text>
          </View>
        </View>
      ) : null}

      {carCongestion && carCongestion.length > 0 ? (
        <View
          testID={testID ? `${testID}-congestion` : undefined}
          style={[styles.congestionWrap, { borderTopColor: semantic.lineSubtle }]}
        >
          <View style={styles.congestionHeader}>
            <Text style={[styles.congestionLabel, { color: semantic.labelAlt }]}>
              칸별 혼잡도
            </Text>
            <Text style={[styles.congestionAxis, { color: semantic.labelAlt }]}>
              ← 전 / 후 →
            </Text>
          </View>
          <View style={styles.barRow}>
            {carCongestion.map((pct, idx) => {
              const tone = congFromPct(pct);
              const color = CONG_TONE[tone].color;
              const clamped = Math.max(0, Math.min(100, pct));
              return (
                <View
                  key={`${idx}-${pct}`}
                  testID={testID ? `${testID}-car-bar-${idx + 1}` : undefined}
                  style={styles.barColumn}
                >
                  <View style={[styles.barTrack, { backgroundColor: semantic.bgSubtle }]}>
                    <View
                      style={[
                        styles.barFill,
                        { backgroundColor: color, height: `${clamped}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barNum, { color: semantic.labelAlt }]}>
                    {idx + 1}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s3,
  },
  destBlock: {
    flex: 1,
  },
  timeBlock: {
    alignItems: 'flex-end',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  pillSpacer: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  congestionWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  congestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  congestionLabel: {
    fontSize: 11,
    fontFamily: weightToFontFamily('700'),
  },
  congestionAxis: {
    fontSize: 10,
    fontFamily: weightToFontFamily('600'),
  },
  barRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  barTrack: {
    width: '100%',
    height: 28,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
  },
  barNum: {
    fontSize: 9,
    fontFamily: weightToFontFamily('700'),
  },
  /* Phase 55: empty state row */
  emptyRow: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  emptyHint: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    marginTop: 2,
  },
});

export const ArrivalCard = memo(ArrivalCardImpl);
ArrivalCard.displayName = 'ArrivalCard';
