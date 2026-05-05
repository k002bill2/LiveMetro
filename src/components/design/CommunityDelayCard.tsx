/**
 * CommunityDelayCard — single-card preview of an active community/system delay,
 * matching the design handoff's HomeScreen "실시간 제보" slot
 * (main.jsx HomeScreen lines 142–161).
 *
 * Composition:
 *   [LineBadge] [title row: 역명 + 사유 + (검증됨 Pill)] [부가 설명] [timestamp · 확인 수]
 *
 * Purely presentational. Caller wires delay data — works with both
 * useDelayDetection's DelayInfo (Seoul API derived) and DelayReport
 * (community sourced). Optional fields gracefully hide when absent.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { LineBadge, type LineId } from './LineBadge';
import { Pill } from './Pill';

interface CommunityDelayCardProps {
  /** Subway line where delay occurred — drives LineBadge color. */
  line: LineId;
  /** Primary headline (e.g. "강남역 신호장애"). */
  title: string;
  /** Optional descriptor (e.g. "교대~강남 구간 약 5분 정차 중"). */
  description?: string;
  /** Whether this delay has been verified (shows warn-tone Pill). */
  verified?: boolean;
  /** Relative time label (e.g. "12분 전"). */
  timestampLabel?: string;
  /** Number of users who confirmed this delay (e.g. "47명 확인"). */
  confirmCount?: number;
  /** Tap handler — typically navigates to DelayFeed. */
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const CommunityDelayCardImpl: React.FC<CommunityDelayCardProps> = ({
  line,
  title,
  description,
  verified,
  timestampLabel,
  confirmCount,
  onPress,
  style,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const meta = [
    timestampLabel,
    typeof confirmCount === 'number' ? `${confirmCount}명 확인` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      testID={testID ?? 'community-delay-card'}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`실시간 제보: ${title}${description ? `. ${description}` : ''}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: semantic.bgBase,
          borderColor: semantic.lineSubtle,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        <LineBadge line={line} size={26} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { color: semantic.labelStrong }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {verified && (
              <Pill tone="warn" size="sm">
                검증됨
              </Pill>
            )}
          </View>
          {description && (
            <Text
              style={[styles.description, { color: semantic.labelNeutral }]}
              numberOfLines={2}
            >
              {description}
            </Text>
          )}
          {meta && (
            <Text style={[styles.meta, { color: semantic.labelAlt }]}>
              {meta}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export const CommunityDelayCard = memo(CommunityDelayCardImpl);
CommunityDelayCard.displayName = 'CommunityDelayCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: weightToFontFamily('800'),
    flexShrink: 1,
  },
  description: {
    fontSize: 13,
    fontFamily: weightToFontFamily('500'),
    lineHeight: 18,
    marginTop: 4,
  },
  meta: {
    fontSize: 11,
    fontFamily: weightToFontFamily('600'),
    marginTop: 6,
  },
});
