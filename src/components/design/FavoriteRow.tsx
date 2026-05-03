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
import { WANTED_TOKENS } from '@/styles/modernTheme';
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
  showDragHandle = false,
  onPress,
  onLongPress,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const tone = congestion ? CONG_TONE[congestion] : null;

  return (
    <Pressable
      testID={testID ?? `favorite-row-${stationName}`}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${stationName}역 즐겨찾기, ${nextMinutes}분 후 도착`}
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

      {/* Line badges — stack vertically when 2 lines, single inline when 1 */}
      <View style={styles.badgeStack}>
        {lines.slice(0, 2).map((l) => (
          <LineBadge key={String(l)} line={l} size={22} />
        ))}
      </View>

      {/* Center: name + direction/congestion line */}
      <View style={styles.center}>
        <View style={styles.nameRow}>
          {nickname && (
            <Pill tone="primary" size="sm">
              {nickname}
            </Pill>
          )}
          <Text style={[styles.stationName, { color: semantic.labelStrong }]} numberOfLines={1}>
            {stationName}
          </Text>
        </View>
        <View style={styles.subRow}>
          {destinationLabel && (
            <Text style={[styles.subText, { color: semantic.labelAlt }]} numberOfLines={1}>
              {destinationLabel}
            </Text>
          )}
          {tone && (
            <>
              <Text style={[styles.subText, { color: semantic.labelAlt }]}> · </Text>
              <View style={[styles.congDot, { backgroundColor: tone.color }]} />
              <Text style={[styles.subText, { color: tone.color, fontWeight: '700' }]}>
                {tone.label}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Right: minutes — primary signal */}
      <View style={styles.right}>
        <Text style={[styles.minutes, { color: semantic.primaryNormal }]}>
          {nextMinutes}
          <Text style={styles.minutesUnit}>분</Text>
        </Text>
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
  badgeStack: {
    flexDirection: 'column',
    gap: 4,
    minWidth: 22,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  subText: {
    fontSize: 12,
    fontWeight: '600',
  },
  congDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 3,
  },
  right: {
    alignItems: 'flex-end',
  },
  minutes: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  minutesUnit: {
    fontSize: 12,
    fontWeight: '700',
  },
});
