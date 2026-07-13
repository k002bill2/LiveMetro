/**
 * GuidanceActiveBanner — "안내 중" home banner.
 *
 * Reads the active guidance session reactively (useGuidanceSession). When a
 * journey is in progress, surfaces a tap target that returns the rider to the
 * live guidance screen — the re-entry point the store docs flagged as future
 * work. Renders nothing when no session is active.
 *
 * Self-colored (blue accent + white text) so it reads as a persistent status
 * affordance regardless of theme.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Navigation } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useGuidanceSession } from '@/hooks/useGuidanceSession';
import { isActiveGuidanceSession } from '@/services/guidance/guidanceSessionStore';

interface GuidanceActiveBannerProps {
  /** Tap handler — typically navigates back to the RouteGuidance screen. */
  onPress: () => void;
  testID?: string;
}

const GuidanceActiveBannerImpl: React.FC<GuidanceActiveBannerProps> = ({
  onPress,
  testID,
}) => {
  const session = useGuidanceSession();
  // 활성 정의 SSOT(18R/W1) — 로컬 완주(localCompletedAt)·원격 완료
  // (commuteLogCompletedAt) 세션은 non-null이어도 "안내 중"으로 표시하지 않는다.
  // 선행 `!session`은 아래 JSX를 위한 타입 내로잉 역할도 겸한다.
  if (!session || !isActiveGuidanceSession(session)) return null;

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
