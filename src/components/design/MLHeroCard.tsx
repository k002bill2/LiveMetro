/**
 * MLHeroCard — gradient hero card teasing the ML commute prediction.
 *
 * Mirrors the design handoff's HomeScreen ML hero (main.jsx lines 36–69):
 * a deep-blue gradient surface with a sparkles label, origin→destination
 * route, large minutes number, trend pill, and confidence subtext.
 *
 * Purely presentational — caller wires `useMLPrediction()` data to props.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react-native';

interface MLHeroCardProps {
  /** "홍대입구" → 출발역 표시명 */
  origin?: string;
  /** "강남" → 도착역 표시명 */
  destination?: string;
  /** Predicted commute minutes (display number) */
  predictedMinutes: number;
  /** Difference vs personal baseline (negative = faster than usual) */
  deltaMinutes?: number;
  /** Predicted arrival HH:mm — shown in subtext */
  arrivalTime?: string;
  /** Confidence 0–1 */
  confidence?: number;
  /** Tap handler — typically navigates to WeeklyPrediction */
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const formatDelta = (delta: number | undefined): { label: string; isFaster: boolean } | null => {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return null;
  if (delta === 0) return { label: '평소와 비슷', isFaster: false };
  const isFaster = delta < 0;
  const abs = Math.abs(Math.round(delta));
  return {
    label: isFaster ? `평소보다 -${abs}분` : `평소보다 +${abs}분`,
    isFaster,
  };
};

const MLHeroCardImpl: React.FC<MLHeroCardProps> = ({
  origin,
  destination,
  predictedMinutes,
  deltaMinutes,
  arrivalTime,
  confidence,
  onPress,
  style,
  testID,
}) => {
  const delta = formatDelta(deltaMinutes);
  const confidencePct = typeof confidence === 'number' ? Math.round(confidence * 100) : null;
  const routeLabel = origin && destination ? `${origin} → ${destination}` : null;

  const subtext = (() => {
    const parts: string[] = [];
    if (arrivalTime) parts.push(`지금 출발하면 ${arrivalTime} 도착`);
    if (confidencePct !== null) parts.push(`신뢰도 ${confidencePct}%`);
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  return (
    <Pressable
      testID={testID ?? 'ml-hero-card'}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`ML 출퇴근 예측 ${predictedMinutes}분`}
      style={[styles.wrap, style]}
    >
      <LinearGradient
        colors={['#0066FF', '#0044BB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative blobs */}
        <View style={styles.blobTop} />
        <View style={styles.blobBottom} />

        <View style={styles.content}>
          <View style={styles.tagRow}>
            <Sparkles size={12} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.tagText}>ML 출퇴근 예측</Text>
          </View>

          {routeLabel && <Text style={styles.routeText}>{routeLabel}</Text>}

          <View style={styles.numberRow}>
            <Text style={styles.numberText} accessibilityRole="text">
              {predictedMinutes}
            </Text>
            <Text style={styles.numberUnit}>분</Text>
            {delta && (
              <View style={styles.deltaPill}>
                {delta.isFaster ? (
                  <TrendingDown size={11} color="#FFFFFF" strokeWidth={2.4} />
                ) : (
                  <TrendingUp size={11} color="#FFFFFF" strokeWidth={2.4} />
                )}
                <Text style={styles.deltaText}>{delta.label}</Text>
              </View>
            )}
          </View>

          {subtext && <Text style={styles.subtext}>{subtext}</Text>}
        </View>
      </LinearGradient>
    </Pressable>
  );
};

export const MLHeroCard = memo(MLHeroCardImpl);
MLHeroCard.displayName = 'MLHeroCard';

const styles = StyleSheet.create({
  wrap: {
    /* Wrapper to anchor shadow on the rounded gradient */
    shadowColor: '#0044BB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 6,
    borderRadius: 24,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  blobTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -60,
    right: 20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    position: 'relative',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagText: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeText: {
    marginTop: 8,
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 14,
    fontWeight: '600',
  },
  numberRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  numberUnit: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  deltaPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 9999,
    alignSelf: 'center',
  },
  deltaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  subtext: {
    marginTop: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 12,
    fontWeight: '600',
  },
});
