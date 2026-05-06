/**
 * FavoriteRow — single favorite-station card matching the design handoff
 * (main.jsx FavoritesScreen list rows).
 *
 * Composition:
 *   [grip] [LineBadge stack] [Pill nickname + 역명] [방향 · 혼잡도]   N분
 *
 * Purely presentational. The screen wires presses + favorite data; this
 * component owns no state.
 *
 * Phase 3B groundwork: ready to drop into FavoritesScreen / HomeScreen /
 * StationDetailScreen lists once their owning components are migrated.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { GripVertical } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { LineBadge, type LineId } from './LineBadge';
import { Pill } from './Pill';
import { CONG_TONE, type CongestionLevel } from './congestion';

interface FavoriteRowProps {
  /** Lines passing through this station (max 2 displayed in stack). */
  lines: LineId[];
  /** Station name (e.g. "강남"). */
  stationName: string;
  /** Optional user-defined alias ("회사", "집") shown as primary Pill. */
  nickname?: string | null;
  /** Direction summary ("잠실 방면"). */
  destinationLabel?: string;
  /** Congestion level shown next to direction with tone-colored dot. */
  congestion?: CongestionLevel;
  /** Minutes until next train. Required — the card's primary signal. */
  nextMinutes: number;
  /**
   * Optional total seconds remaining. When supplied, takes precedence over
   * `nextMinutes` and drives two UX branches:
   *   - `secondsLeft < 60` → renders "곧 도착" in primary tone (replaces
   *     the numeric block; "분"/"초" units are dropped)
   *   - `secondsLeft >= 60` → renders "M분 S초" with M as the dominant
   *     numeral (e.g. "1분 58초")
   *
   * Caller policy: only opt in for rows where the data freshness justifies
   * sub-minute precision and the row is willing to tick at 1Hz. For the rest
   * (e.g. non-focused favorites), pass only `nextMinutes` and the component
   * falls back to the simpler "M분" treatment.
   */
  secondsLeft?: number;
  /** When true, render the drag handle (grip icon). */
  showDragHandle?: boolean;
  /** Pressable affordance — typically navigates to StationDetail. */
  onPress?: () => void;
  /** Optional long-press for edit/reorder mode. */
  onLongPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const FavoriteRowImpl: React.FC<FavoriteRowProps> = ({
  lines,
  stationName,
  nickname,
  destinationLabel,
  congestion,
  nextMinutes,
  secondsLeft,
  showDragHandle = false,
  onPress,
  onLongPress,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const tone = congestion ? CONG_TONE[congestion] : null;

  const arrivalA11y = (() => {
    if (secondsLeft !== undefined && secondsLeft < 60) return '곧 도착';
    if (secondsLeft !== undefined && secondsLeft >= 60) {
      return `${Math.floor(secondsLeft / 60)}분 ${secondsLeft % 60}초 후 도착`;
    }
    return `${nextMinutes}분 후 도착`;
  })();

  return (
    <Pressable
      testID={testID ?? `favorite-row-${stationName}`}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${stationName}역 즐겨찾기, ${arrivalA11y}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: semantic.bgBase,
          borderColor: semantic.lineSubtle,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {showDragHandle && (
        <GripVertical
          size={16}
          color={semantic.labelAlt}
          accessibilityLabel="드래그 핸들"
        />
      )}

      {/* Left column: 상단 가로 배지 row → 하단 [역명 · 별칭 · 방향 · 혼잡]
          한 줄. 시안 image #2/#3 정합 — 이전 vertical badge stack + 2-row 이름
          블록을 가로 한 줄 inline 패턴으로 교체. */}
      <View style={styles.leftCol}>
        <View style={styles.badgesRow}>
          {lines.slice(0, 2).map((l) => (
            <LineBadge key={String(l)} line={l} size={22} />
          ))}
        </View>
        <View style={styles.metaRow}>
          <Text
            style={[styles.stationName, { color: semantic.labelStrong }]}
            numberOfLines={1}
          >
            {stationName}
          </Text>
          {nickname && (
            <Pill tone="primary" size="sm">
              {nickname}
            </Pill>
          )}
          {destinationLabel && (
            <Text
              style={[
                styles.subText,
                styles.subTextLead,
                { color: semantic.labelAlt },
              ]}
              numberOfLines={1}
            >
              {destinationLabel}
            </Text>
          )}
          {tone && (
            <>
              <Text style={[styles.subDot, { color: semantic.labelAlt }]}>
                ·
              </Text>
              <Text
                style={[
                  styles.subText,
                  {
                    color: tone.color,
                    fontFamily: weightToFontFamily('700'),
                  },
                ]}
              >
                {tone.label}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Right: minutes — primary signal. Sub-minute precision is opt-in via
          `secondsLeft`; under 60s collapses to a "곧 도착" inline label. */}
      <View style={styles.right}>
        {secondsLeft !== undefined && secondsLeft < 60 ? (
          <Text style={[styles.arriving, { color: semantic.primaryNormal }]}>
            곧 도착
          </Text>
        ) : (
          <Text style={[styles.minutes, { color: semantic.primaryNormal }]}>
            {secondsLeft !== undefined ? Math.floor(secondsLeft / 60) : nextMinutes}
            <Text style={styles.minutesUnit}>
              분
              {secondsLeft !== undefined && secondsLeft >= 60
                ? ` ${secondsLeft % 60}초`
                : ''}
            </Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export const FavoriteRow = memo(FavoriteRowImpl);
FavoriteRow.displayName = 'FavoriteRow';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  stationName: {
    fontSize: 16,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.2,
  },
  subText: {
    fontSize: 12,
    fontFamily: weightToFontFamily('600'),
  },
  subTextLead: {
    marginLeft: 4,
  },
  subDot: {
    fontSize: 12,
    fontFamily: weightToFontFamily('600'),
    marginHorizontal: -2,
  },
  right: {
    alignItems: 'flex-end',
  },
  minutes: {
    fontSize: 22,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  minutesUnit: {
    fontSize: 12,
    fontFamily: weightToFontFamily('700'),
  },
  arriving: {
    fontSize: 16,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.2,
  },
});
