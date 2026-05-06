/**
 * NearbyStationCard — horizontal-scroll card for the HomeScreen "주변 역" slot.
 *
 * Mirrors the design handoff bundle (`main.jsx:196-245` of
 * `~/Downloads/livemetro/project/src/screens/main.jsx`) — a 2-section card:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [LineBadges]                  📍 180m         │  ← top
 *   │ 역명                                          │
 *   │ 🦶 도보 3분 · 9번 출구                          │
 *   │ ─────────────── divider ─────────────────── │
 *   │ [LineBadge]  잠실 방면              2분        │  ← next arrival
 *   │ ● 보통  +1대 더                              │  ← congestion + extra
 *   └──────────────────────────────────────────────┘
 *
 * The "next arrival" half renders only when `nextArrival` is provided.
 * Caller decides whether to fetch real-time arrivals (heavy) or leave the
 * lower half blank for a tap-through experience.
 */
import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Footprints, MapPin } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { LineBadge, type LineId } from './LineBadge';
import { CONG_TONE, type CongestionLevel } from './congestion';

const MAX_LINE_BADGES = 3;
const WALK_METERS_PER_MINUTE = 80;

const CONG_LABEL: Record<CongestionLevel, string> = {
  low: '여유',
  mid: '보통',
  high: '혼잡',
  vhigh: '매우 혼잡',
};

export interface NearbyStationNextArrival {
  lineId: LineId;
  destination: string; // e.g. "잠실 방면" — caller appends "방면" suffix
  minutes: number;
}

export interface NearbyStationCardProps {
  /** Lines passing through this station (max 3 displayed). */
  lineIds: readonly LineId[];
  stationName: string;
  /** Distance from current location in meters. */
  distanceM: number;
  /** Optional pre-computed walk minutes. Falls back to ceil(distanceM/80). */
  walkMin?: number;
  exitNumber?: string | null;
  /** When provided, the lower half (after divider) renders. */
  nextArrival?: NearbyStationNextArrival;
  congestion?: CongestionLevel;
  /** Optional secondary arrival hint, e.g. "+1대 더". */
  trailingArrivalLabel?: string;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const formatDistance = (meters: number): string => {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    return `${km.toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
};

const buildAccessibilityLabel = (
  stationName: string,
  walkMin: number,
  exitNumber: string | null | undefined,
  arrivalMinutes: number | undefined,
): string => {
  const parts: string[] = [`${stationName}역`, `도보 ${walkMin}분`];
  if (exitNumber) parts.push(`${exitNumber}번 출구`);
  if (typeof arrivalMinutes === 'number') parts.push(`${arrivalMinutes}분 후 도착`);
  return parts.join(', ');
};

const NearbyStationCardImpl: React.FC<NearbyStationCardProps> = ({
  lineIds,
  stationName,
  distanceM,
  walkMin,
  exitNumber,
  nextArrival,
  congestion,
  trailingArrivalLabel,
  onPress,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { width } = useWindowDimensions();

  const computedWalkMin = walkMin ?? Math.max(1, Math.ceil(distanceM / WALK_METERS_PER_MINUTE));
  const congTone = congestion ? CONG_TONE[congestion] : null;
  const congLabel = congestion ? CONG_LABEL[congestion] : null;

  // Card width = 220 (matches design handoff `flex: '0 0 220px'`) clamped to
  // [200, 240] so very small/large devices still feel right. Earlier 72%
  // width caused awkward look on tablets.
  const cardWidth = useMemo(
    () => Math.min(240, Math.max(200, Math.round(width * 0.6))),
    [width],
  );
  const accessibilityLabel = buildAccessibilityLabel(
    stationName,
    computedWalkMin,
    exitNumber,
    nextArrival?.minutes,
  );

  const tid = testID ?? `nearby-station-card-${stationName}`;

  return (
    <Pressable
      testID={tid}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.card,
        {
          width: cardWidth,
          backgroundColor: semantic.bgBase,
          borderColor: semantic.lineSubtle,
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {/* Top row — line badges + distance */}
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          {lineIds.slice(0, MAX_LINE_BADGES).map((l) => (
            <LineBadge key={String(l)} line={l} size={20} />
          ))}
        </View>
        <View style={styles.distanceWrap}>
          <MapPin size={11} color={semantic.labelAlt} strokeWidth={2.2} />
          <Text style={[styles.distanceText, { color: semantic.labelAlt }]}>
            {formatDistance(distanceM)}
          </Text>
        </View>
      </View>

      {/* Station name */}
      <Text
        style={[styles.stationName, { color: semantic.labelStrong }]}
        numberOfLines={1}
      >
        {stationName}
      </Text>

      {/* Walk meta */}
      <View style={styles.walkMetaWrap}>
        <Footprints size={11} color={semantic.labelAlt} strokeWidth={2} />
        <Text
          testID={`${tid}-walk-meta`}
          style={[styles.walkMeta, { color: semantic.labelAlt }]}
          numberOfLines={1}
        >
          {`도보 ${computedWalkMin}분`}
          {exitNumber ? ` · ${exitNumber}번 출구` : ''}
        </Text>
      </View>

      {/* Divider + next arrival half — only when arrival data provided */}
      {nextArrival && (
        <>
          <View
            style={[styles.divider, { backgroundColor: semantic.lineSubtle }]}
          />
          <View style={styles.arrivalRow}>
            <LineBadge line={nextArrival.lineId} size={18} />
            <Text
              style={[styles.arrivalDest, { color: semantic.labelNeutral }]}
              numberOfLines={1}
            >
              {nextArrival.destination}
            </Text>
            <Text
              testID={`${tid}-arrival`}
              style={[styles.arrivalMinutes, { color: semantic.primaryNormal }]}
            >
              {nextArrival.minutes}
              <Text style={styles.arrivalUnit}>분</Text>
            </Text>
          </View>
          {(congLabel || trailingArrivalLabel) && (
            <View style={styles.congRow}>
              {congTone && (
                <View
                  style={[styles.congDot, { backgroundColor: congTone.color }]}
                />
              )}
              {congLabel && (
                <Text
                  testID={`${tid}-cong-label`}
                  style={[styles.congLabel, { color: congTone?.color ?? semantic.labelAlt }]}
                  numberOfLines={1}
                >
                  {congLabel}
                </Text>
              )}
              {trailingArrivalLabel && (
                <Text
                  style={[styles.trailingLabel, { color: semantic.labelAlt }]}
                  numberOfLines={1}
                >
                  {trailingArrivalLabel}
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
};

export const NearbyStationCard = memo(NearbyStationCardImpl);
NearbyStationCard.displayName = 'NearbyStationCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    rowGap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    columnGap: 4,
  },
  distanceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 3,
  },
  distanceText: {
    fontSize: 10.5,
    fontFamily: weightToFontFamily('700'),
    fontVariant: ['tabular-nums'],
  },
  stationName: {
    fontSize: 16,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.16,
    marginTop: 4,
  },
  walkMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  walkMeta: {
    fontSize: 11,
    fontFamily: weightToFontFamily('600'),
    flexShrink: 1,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  arrivalDest: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontFamily: weightToFontFamily('600'),
  },
  arrivalMinutes: {
    fontSize: 18,
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.36,
    fontVariant: ['tabular-nums'],
  },
  arrivalUnit: {
    fontSize: 10,
    fontFamily: weightToFontFamily('700'),
  },
  congRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    marginTop: 4,
  },
  congDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  congLabel: {
    fontSize: 10,
    fontFamily: weightToFontFamily('700'),
  },
  trailingLabel: {
    fontSize: 10,
    fontFamily: weightToFontFamily('600'),
    marginLeft: 6,
  },
});
