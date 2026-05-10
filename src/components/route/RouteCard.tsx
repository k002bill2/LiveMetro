import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeftRight, Footprints } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { JourneyStrip, type JourneyStripLeg } from '@/components/design/JourneyStrip';
import { LineBadge } from '@/components/design/LineBadge';
import { estimateFare, estimateWalkingMinutes, getRouteDirection } from '@/services/route/routeMeta';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';
import type { Route, RouteCategory, RouteSegment } from '@/models/route';

/**
 * Tags shown in the top-left of each card. Two tags per category mirrors the
 * Wanted handoff: a "why this card" label + a softer descriptor.
 */
const CATEGORY_TAGS: Record<RouteCategory, readonly string[]> = {
  'fastest': ['추천', '최단'],
  'min-transfer': ['환승최소', '빠른길'],
};

interface Props {
  route: RouteWithMLMeta;
  expanded: boolean;
  onToggleExpand: () => void;
  recommended?: boolean;
}

/**
 * Map a domain Route into the JourneyStrip leg sequence.
 *
 * Each hop in `route.segments` is one inter-station edge; for display we
 * coalesce consecutive hops on the same line into a single train leg
 * (accumulating their minutes), and emit a transfer leg at the segment
 * marked `isTransfer`. Net result: 25 same-line hops + 1 transfer render
 * as `[train, transfer, train]` instead of 26 chips.
 */
function routeToLegs(route: Route): JourneyStripLeg[] {
  const legs: JourneyStripLeg[] = [];
  for (const seg of route.segments) {
    if (seg.isTransfer) {
      legs.push({ type: 'transfer' });
      continue;
    }
    const last = legs[legs.length - 1];
    if (last && last.type === 'train' && last.lineId === seg.lineId) {
      legs[legs.length - 1] = {
        type: 'train',
        lineId: last.lineId,
        minutes: last.minutes + seg.estimatedMinutes,
      };
    } else {
      legs.push({ type: 'train', lineId: seg.lineId, minutes: seg.estimatedMinutes });
    }
  }
  return legs;
}

/**
 * Boarding / transfer(s) / alight — the only stations the user must act on.
 * Returns an ordered list with a label and station name per row.
 */
function routeToKeyPoints(route: Route): readonly { label: string; station: string }[] {
  if (route.segments.length === 0) return [];
  const points: { label: string; station: string }[] = [];
  const first = route.segments[0]!;
  points.push({ label: '승차', station: first.fromStationName });
  for (const seg of route.segments) {
    if (seg.isTransfer) {
      points.push({ label: '환승', station: seg.fromStationName });
    }
  }
  const last = route.segments[route.segments.length - 1]!;
  points.push({ label: '하차', station: last.toStationName });
  return points;
}

/**
 * Inline single-leg summary shown when the route has no transfer:
 * "● 2  홍대입구 → 강남  (8개역)". For transfer routes the JourneyStrip
 * already conveys the per-leg structure, so this stays hidden to avoid
 * crowding the card.
 */
function singleLegSummary(route: Route): { lineId: string; from: string; to: string; hops: number } | null {
  if (route.transferCount > 0 || route.segments.length === 0) return null;
  const trainSegs = route.segments.filter((s: RouteSegment) => !s.isTransfer);
  if (trainSegs.length === 0) return null;
  const first = trainSegs[0]!;
  const last = trainSegs[trainSegs.length - 1]!;
  return {
    lineId: first.lineId,
    from: first.fromStationName,
    to: last.toStationName,
    hops: trainSegs.length,
  };
}

export const RouteCard: React.FC<Props> = ({ route, expanded, onToggleExpand, recommended }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  const legs = routeToLegs(route);
  const tags: readonly string[] = route.category
    ? CATEGORY_TAGS[route.category]
    : recommended
      ? ['추천']
      : [];
  const summary = singleLegSummary(route);

  return (
    <Pressable
      onPress={onToggleExpand}
      style={[
        styles.card,
        (expanded || recommended || route.category === 'fastest') && {
          borderColor: semantic.primaryNormal,
          borderWidth: 2,
        },
      ]}
      testID="route-card"
      accessibilityRole="button"
      accessibilityLabel={`${route.totalMinutes}분 경로`}
      accessibilityState={{ expanded }}
    >
      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.map((t) => (
            <View
              key={t}
              style={[styles.tag, { backgroundColor: semantic.bgSubtle }]}
            >
              <Text style={[styles.tagText, { color: semantic.primaryNormal }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.etaRow}>
        <Text style={styles.etaNumber} testID="route-card-eta">
          {route.etaMinutes}
        </Text>
        <Text style={styles.etaUnit}>분</Text>
        <View style={styles.etaSubMeta}>
          <ArrowLeftRight size={12} color={semantic.labelAlt} strokeWidth={1.8} />
          <Text style={styles.etaSubText}>
            {`환승 ${route.transferCount} · 도보 ${estimateWalkingMinutes(route)}분 · ${estimateFare(route).toLocaleString()}원`}
          </Text>
        </View>
      </View>

      <JourneyStrip legs={legs} />

      {summary && (
        <View style={styles.inlineLegRow}>
          <LineBadge line={summary.lineId} size={20} />
          <Text style={styles.inlineLegText}>
            {`${summary.from} → ${summary.to} (${summary.hops}개역)`}
          </Text>
          {(() => {
            const dir = getRouteDirection(route);
            return dir ? <Text style={styles.directionText}>{`${dir} 방면`}</Text> : null;
          })()}
        </View>
      )}

      {expanded && (
        <View style={styles.details} testID="route-card-details">
          {routeToKeyPoints(route).map((kp, idx) => (
            <View key={`${kp.label}-${idx}`} style={styles.detailRow}>
              <Footprints size={14} color={semantic.labelAlt} strokeWidth={1.7} />
              <Text style={styles.detailText}>
                {`${kp.label}: ${kp.station}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

RouteCard.displayName = 'RouteCard';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      padding: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    tagsRow: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s2,
      flexWrap: 'wrap',
    },
    tag: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: 4,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    tagText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('600'),
    },
    etaRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    etaNumber: {
      fontSize: 36,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      lineHeight: 40,
    },
    etaUnit: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginBottom: 4,
    },
    etaSubMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 6,
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    etaSubText: {
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    inlineLegRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingTop: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    inlineLegText: {
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
      flex: 1,
    },
    directionText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    details: {
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingTop: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      gap: WANTED_TOKENS.spacing.s2,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    detailText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      flex: 1,
    },
  });
