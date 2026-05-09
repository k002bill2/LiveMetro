import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Footprints } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { JourneyStrip, type JourneyStripLeg } from '@/components/design/JourneyStrip';
import { Pill } from '@/components/design/Pill';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';
import type { Route } from '@/models/route';

interface Props {
  route: RouteWithMLMeta;
  expanded: boolean;
  onToggleExpand: () => void;
  recommended?: boolean;
}

/**
 * Map a domain Route into the JourneyStrip leg sequence.
 * Mirrors the canonical helper in AlternativeRouteCard; inlined here to keep
 * the cross-component coupling at the type level only.
 */
function routeToLegs(route: Route): JourneyStripLeg[] {
  const legs: JourneyStripLeg[] = [];
  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i]!;
    const prev = i > 0 ? route.segments[i - 1] : null;
    if (prev && prev.lineId !== seg.lineId) {
      legs.push({ type: 'transfer' });
    }
    legs.push({
      type: 'train',
      lineId: seg.lineId,
      minutes: seg.estimatedMinutes,
    });
  }
  return legs;
}

export const RouteCard: React.FC<Props> = ({ route, expanded, onToggleExpand, recommended }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  const hasDelayRisk = route.delayRiskLineIds.length > 0;
  const legs = routeToLegs(route);

  return (
    <Pressable
      onPress={onToggleExpand}
      style={[
        styles.card,
        (expanded || recommended) && {
          borderColor: semantic.primaryNormal,
          borderWidth: 2,
        },
      ]}
      testID="route-card"
      accessibilityRole="button"
      accessibilityLabel={`${route.totalMinutes}분 경로`}
      accessibilityState={{ expanded }}
    >
      <View style={styles.metaRow}>
        <Text style={styles.eta} testID="route-card-eta">
          {`${route.etaMinutes}분 ±${route.etaConfidenceMinutes}분`}
        </Text>
        {recommended && (
          <View style={[styles.recommendBadge, { backgroundColor: semantic.bgSubtle }]}>
            <Text style={[styles.recommendText, { color: semantic.primaryNormal }]}>추천</Text>
          </View>
        )}
      </View>

      <JourneyStrip legs={legs} />

      <View style={styles.pillsRow}>
        {hasDelayRisk ? (
          <Pill tone="warn">{`${route.delayRiskLineIds.join(', ')}호선 지연 위험`}</Pill>
        ) : (
          <Pill tone="pos">정시 운행</Pill>
        )}
        <Pill tone="neutral">
          {route.transferCount === 0 ? '환승 없음' : `환승 ${route.transferCount}회`}
        </Pill>
      </View>

      {expanded && (
        <View style={styles.details} testID="route-card-details">
          {route.segments.map((seg, idx) => (
            <View key={`${seg.fromStationId}-${idx}`} style={styles.detailRow}>
              <Footprints size={14} color={semantic.labelAlt} strokeWidth={1.7} />
              <Text style={styles.detailText}>
                {`${seg.fromStationName} → ${seg.toStationName}${seg.isTransfer ? ' (환승)' : ''}`}
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
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    eta: {
      fontSize: WANTED_TOKENS.type.title3.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    recommendBadge: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.pill,
    },
    recommendText: {
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontFamily: weightToFontFamily('600'),
    },
    pillsRow: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s3,
      flexWrap: 'wrap',
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
