/**
 * CommuteRouteCard — HomeScreen "오늘의 출근 경로" card.
 *
 * Design source: design handoff bundle main.jsx HomeScreen lines 71–162
 * (May 2026 refresh — chat3 addition). Sits between the MLHeroCard and
 * QuickActionsGrid as a visual summary of the user's morning commute.
 *
 * Composition:
 *   ┌ Header: route icon + 라벨 + "경로 변경 ›" link ─────────────┐
 *   │                                                              │
 *   │  ◯ 출발 ┄ 👣 ┄ ◯ 환승선 ━━ 🚊 ━━ ◯ 도착                    │
 *   │  홍대   도보4분  2호선  8개역잠실 강남                       │
 *   │  08:32         직행18분         09:00                        │
 *   │                                                              │
 *   ├──────────── divider ──────────────────────────────────────── │
 *   │  0회 환승  │  8개역 이동  │  1,450원 요금                    │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Purely presentational. Optional fields hide gracefully:
 *   - `walkMinutes` undefined → walk leg renders without minutes label
 *   - `lineId` undefined → falls back to a neutral train icon (no LineBadge)
 *   - `transferCount`/`stationCount`/`fareKrw` undefined → fact grid hidden
 *     when all three are missing
 *
 * Caller wires data from user.commuteSchedule + ML prediction. See
 * HomeScreen for the canonical mapping.
 */
import React, { memo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  Building2,
  ChevronRight,
  Footprints,
  Home as HomeIcon,
  Route as RouteIcon,
  TrainFront,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { LineBadge, type LineId } from './LineBadge';

interface CommuteRouteCardProps {
  /** Origin station name (e.g. "홍대입구"). Card hides if missing. */
  origin?: string;
  /** Destination station name (e.g. "강남"). Card hides if missing. */
  destination?: string;
  /** Departure time in "HH:mm" format. */
  departureTime?: string;
  /** Arrival time in "HH:mm" format. */
  arrivalTime?: string;
  /** Subway line for the ride leg (drives LineBadge + ride leg color). */
  lineId?: LineId;
  /** Walking minutes from origin to platform. */
  walkMinutes?: number;
  /** Ride duration in minutes. */
  rideMinutes?: number;
  /** Direction terminus label (e.g. "잠실 방면"). */
  directionLabel?: string;
  /** Number of stations to ride through. Drives "N개역" sub-label. */
  stationCount?: number;
  /** Number of transfers. Drives bottom fact "N회 환승". */
  transferCount?: number;
  /** Fare in won. Drives bottom fact "N원 요금". */
  fareKrw?: number;
  /** Tap handler for the "경로 변경" link — typically navigates to settings. */
  onPressEdit?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const formatKrw = (n: number): string => n.toLocaleString('ko-KR');

// Walk-leg dotted line. RN's `borderStyle: 'dotted'` renders inconsistently
// (iOS often promotes it to solid; Android draws dashes), so we lay out
// individual dot Views in a flex row with `space-between` and let onLayout
// pick the dot count for the available width. Density stays visually
// consistent across screen sizes.
const DOT_SIZE = 2;
const DOT_TARGET_GAP = 1;

const DottedLine: React.FC<{ color: string }> = memo(({ color }) => {
  const [width, setWidth] = useState(0);
  const handleLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width;
    if (next !== width) setWidth(next);
  };
  const dotCount =
    width > 0 ? Math.max(2, Math.floor(width / (DOT_SIZE + DOT_TARGET_GAP))) : 0;

  return (
    <View style={styles.dottedLine} onLayout={handleLayout}>
      {Array.from({ length: dotCount }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
});
DottedLine.displayName = 'DottedLine';

const CommuteRouteCardImpl: React.FC<CommuteRouteCardProps> = ({
  origin,
  destination,
  departureTime,
  arrivalTime,
  lineId,
  walkMinutes,
  rideMinutes,
  directionLabel,
  stationCount,
  transferCount,
  fareKrw,
  onPressEdit,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  // Card hides entirely if we don't have both endpoints — partial origin/dest
  // is worse than absent, since an empty timeline reads as broken.
  if (!origin || !destination) return null;

  const lineColor = lineId ? getSubwayLineColor(lineId) : semantic.labelAlt;
  // Ride leg sub-label is orthogonal to the mid-node minutes meta:
  //   - mid node nodeMeta shows the duration ("직행 N분")
  //   - ride leg shows station count + direction ("8개역 · 잠실 방면")
  // This mirrors the bundle and avoids the same minutes string rendering
  // twice when only `rideMinutes` is known.
  const rideSubLabel =
    directionLabel && stationCount !== undefined
      ? `${stationCount}개역 · ${directionLabel}`
      : (directionLabel ??
        (stationCount !== undefined ? `${stationCount}개역` : undefined));

  const showFacts =
    transferCount !== undefined ||
    stationCount !== undefined ||
    fareKrw !== undefined;

  const accessibilityLabel = [
    '오늘의 출근 경로',
    `${origin}에서 ${destination}`,
    departureTime && arrivalTime ? `${departureTime}부터 ${arrivalTime}` : null,
    lineId ? `${lineId}호선 이용` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      testID={testID ?? 'commute-route-card'}
      style={[
        styles.card,
        { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle },
        style,
      ]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <RouteIcon size={12} color={semantic.labelAlt} strokeWidth={2.2} />
          <Text style={[styles.headerLabel, { color: semantic.labelAlt }]}>
            오늘의 출근 경로
          </Text>
        </View>
        {onPressEdit && (
          <Pressable
            onPress={onPressEdit}
            accessibilityRole="button"
            accessibilityLabel="출퇴근 경로 변경"
            hitSlop={8}
            style={styles.editLink}
            testID="commute-route-card-edit"
          >
            <Text style={[styles.editText, { color: WANTED_TOKENS.blue[500] }]}>
              경로 변경
            </Text>
            <ChevronRight
              size={12}
              color={WANTED_TOKENS.blue[500]}
              strokeWidth={2.4}
            />
          </Pressable>
        )}
      </View>

      {/* Timeline row */}
      <View style={styles.timeline}>
        {/* Origin node */}
        <View style={styles.node}>
          <View
            style={[
              styles.nodeCircle,
              {
                backgroundColor: 'rgba(0,102,255,0.10)',
                borderColor: WANTED_TOKENS.blue[500],
                borderWidth: 2,
              },
            ]}
          >
            <HomeIcon
              size={16}
              color={WANTED_TOKENS.blue[500]}
              strokeWidth={2.2}
            />
          </View>
          <Text style={[styles.nodeLabel, { color: semantic.labelStrong }]}>
            {origin}
          </Text>
          {departureTime && (
            <Text style={[styles.nodeMeta, { color: semantic.labelAlt }]}>
              {departureTime}
            </Text>
          )}
        </View>

        {/* Walk leg */}
        <View style={styles.leg}>
          <View style={styles.legLineRow}>
            <DottedLine color={semantic.labelAlt} />
            <Footprints size={13} color={semantic.labelAlt} strokeWidth={2} />
            <DottedLine color={semantic.labelAlt} />
          </View>
          {walkMinutes !== undefined && (
            <Text style={[styles.legSubLabel, { color: semantic.labelAlt }]}>
              도보 {walkMinutes}분
            </Text>
          )}
        </View>

        {/* Mid node — line badge */}
        <View style={styles.node}>
          {lineId ? (
            <LineBadge line={lineId} size={36} />
          ) : (
            <View
              style={[
                styles.nodeCircle,
                {
                  backgroundColor: semantic.bgSubtle,
                  borderColor: semantic.lineSubtle,
                  borderWidth: 1,
                },
              ]}
            >
              <TrainFront
                size={16}
                color={semantic.labelNeutral}
                strokeWidth={2.2}
              />
            </View>
          )}
          {lineId && (
            <Text style={[styles.nodeLabel, { color: semantic.labelStrong }]}>
              {/^\d+$/.test(lineId) ? `${lineId}호선` : lineId}
            </Text>
          )}
          {rideMinutes !== undefined && (
            <Text style={[styles.nodeMeta, { color: semantic.labelAlt }]}>
              직행 {rideMinutes}분
            </Text>
          )}
        </View>

        {/* Ride leg */}
        <View style={styles.leg}>
          <View style={styles.legLineRow}>
            <View
              style={[
                styles.solidLine,
                { backgroundColor: lineColor },
              ]}
            />
            <TrainFront size={13} color={lineColor} strokeWidth={2} />
            <View
              style={[
                styles.solidLine,
                { backgroundColor: lineColor },
              ]}
            />
          </View>
          {rideSubLabel && (
            <Text
              style={[
                styles.legSubLabel,
                { color: lineId ? lineColor : semantic.labelAlt },
              ]}
              numberOfLines={1}
            >
              {rideSubLabel}
            </Text>
          )}
        </View>

        {/* Destination node */}
        <View style={styles.node}>
          <View
            style={[
              styles.nodeCircle,
              { backgroundColor: WANTED_TOKENS.blue[500] },
            ]}
          >
            <Building2 size={16} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={[styles.nodeLabel, { color: semantic.labelStrong }]}>
            {destination}
          </Text>
          {arrivalTime && (
            <Text
              style={[
                styles.nodeMeta,
                { color: WANTED_TOKENS.blue[500] },
              ]}
            >
              {arrivalTime}
            </Text>
          )}
        </View>
      </View>

      {/* Fact grid */}
      {showFacts && (
        <View
          style={[
            styles.factGrid,
            { borderTopColor: semantic.lineSubtle },
          ]}
        >
          <View style={styles.factCell}>
            <Text style={[styles.factValue, { color: semantic.labelStrong }]}>
              {transferCount ?? 0}회
            </Text>
            <Text style={[styles.factLabel, { color: semantic.labelAlt }]}>
              환승
            </Text>
          </View>
          <View
            style={[
              styles.factCell,
              styles.factCellMid,
              { borderColor: semantic.lineSubtle },
            ]}
          >
            <Text style={[styles.factValue, { color: semantic.labelStrong }]}>
              {stationCount !== undefined ? `${stationCount}개역` : '—'}
            </Text>
            <Text style={[styles.factLabel, { color: semantic.labelAlt }]}>
              이동
            </Text>
          </View>
          <View style={styles.factCell}>
            <Text style={[styles.factValue, { color: semantic.labelStrong }]}>
              {fareKrw !== undefined ? (
                <>
                  {formatKrw(fareKrw)}
                  <Text style={styles.factCurrency}>원</Text>
                </>
              ) : (
                '—'
              )}
            </Text>
            <Text style={[styles.factLabel, { color: semantic.labelAlt }]}>
              요금
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export const CommuteRouteCard = memo(CommuteRouteCardImpl);
CommuteRouteCard.displayName = 'CommuteRouteCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.5,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  editText: {
    fontSize: 11,
    fontFamily: weightToFontFamily('700'),
  },
  timeline: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  node: {
    flexShrink: 0,
    alignItems: 'center',
    minWidth: 56,
  },
  nodeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: {
    marginTop: 6,
    fontSize: 11.5,
    fontFamily: weightToFontFamily('800'),
  },
  nodeMeta: {
    marginTop: 1,
    fontSize: 10,
    fontFamily: weightToFontFamily('600'),
  },
  leg: {
    flex: 1,
    paddingHorizontal: 6,
    alignItems: 'center',
    paddingTop: 12,
  },
  legLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 4,
  },
  dottedLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.5,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  solidLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  legSubLabel: {
    marginTop: 4,
    fontSize: 9.5,
    fontFamily: weightToFontFamily('700'),
  },
  factGrid: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  factCell: {
    flex: 1,
    alignItems: 'center',
  },
  factCellMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  factValue: {
    fontSize: 14,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.1,
  },
  factCurrency: {
    fontSize: 10,
    marginLeft: 1,
  },
  factLabel: {
    marginTop: 1,
    fontSize: 10.5,
    fontFamily: weightToFontFamily('700'),
  },
});
