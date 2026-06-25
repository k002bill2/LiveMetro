/**
 * GuidanceActiveBanner — "안내 중" home banner.
 *
 * Reads the active guidance session reactively (useGuidanceSession). When a
 * journey is in progress, surfaces a tap target that returns the rider to the
 * live guidance screen — the re-entry point the store docs flagged as future
 * work. Renders nothing when no session is active or when explicitly `hidden`
 * (e.g. while the guidance screen itself is on top).
 *
 * Self-colored (blue accent + white text) so it reads as a persistent status
 * affordance regardless of theme.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Navigation } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';

interface GuidanceActiveBannerProps {
  /** Tap handler — typically navigates back to the RouteGuidance screen. */
  onPress: () => void;
  /** Suppress rendering even when a session is active (e.g. on the guidance screen). */
  hidden?: boolean;
  testID?: string;
}

const GuidanceActiveBannerImpl: React.FC<GuidanceActiveBannerProps> = ({
  onPress,
  hidden,
  testID,
}) => {
  const session = useGuidanceSession();
  if (!session || hidden) return null;

  const routeLabel = `${session.fromStationName} → ${session.toStationName}`;

  return (
    <Pressable
      testID={testID ?? 'guidance-active-banner'}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`안내 중, ${session.fromStationName}에서 ${session.toStationName}로 가는 길안내로 돌아가기`}
      hitSlop={6}
      style={[styles.banner, { backgroundColor: WANTED_TOKENS.blue[500] }]}
    >
      <View style={styles.iconWrap}>
        <Navigation size={16} color="#FFFFFF" strokeWidth={2.4} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>안내 중</Text>
        <Text style={styles.route} numberOfLines={1}>
          {routeLabel}
        </Text>
      </View>
      <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.4} />
    </Pressable>
  );
};

export const GuidanceActiveBanner = memo(GuidanceActiveBannerImpl);
GuidanceActiveBanner.displayName = 'GuidanceActiveBanner';

export default GuidanceActiveBanner;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: weightToFontFamily('600'),
  },
  route: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: weightToFontFamily('700'),
  },
});
