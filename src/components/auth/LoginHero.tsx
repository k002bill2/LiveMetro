/**
 * LoginHero — abstract subway-line illustration + wordmark (Wanted Design System).
 *
 * Mirrors the Wanted handoff: radial gradient backdrop, 5 line paths, 2 station
 * nodes per line, a pulse pin marker, and a wordmark with brand badge.
 */
import React, { memo } from 'react';
import { Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { TrainFront } from 'lucide-react-native';
import { WANTED_TOKENS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

interface LoginHeroProps {
  testID?: string;
}

const LINE_DATA: ReadonlyArray<{ color: string; y: number; dy: number }> = [
  { color: '#00A84D', y: 64, dy: -12 }, // 2호선
  { color: '#0052A4', y: 96, dy: 0 }, // 1호선
  { color: '#EF7C1C', y: 128, dy: 14 }, // 3호선
  { color: '#996CAC', y: 160, dy: -6 }, // 5호선
  { color: '#D6406A', y: 192, dy: 8 }, // 신분당
];

const HERO_HEIGHT = 300;

const LoginHeroImpl: React.FC<LoginHeroProps> = ({ testID }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const heroStyle: ViewStyle = {
    position: 'relative',
    height: HERO_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: isDark ? '#0B0E18' : '#EAF2FF',
  };

  const wordmarkContainer: ViewStyle = {
    position: 'absolute',
    left: WANTED_TOKENS.spacing.s6,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  };

  const brandBadge: ViewStyle = {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: WANTED_TOKENS.blue[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: WANTED_TOKENS.blue[500],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  };

  const wordmarkText: TextStyle = {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: isDark ? '#FFFFFF' : semantic.labelStrong,
    lineHeight: 24,
  };

  const taglineText: TextStyle = {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.44,
    color: isDark ? 'rgba(255,255,255,0.6)' : semantic.labelAlt,
    marginTop: 4,
  };

  const pulsePinOuter: ViewStyle = {
    position: 'absolute',
    left: 168,
    top: 130,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: WANTED_TOKENS.blue[500],
    shadowColor: WANTED_TOKENS.blue[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  };

  return (
    <View testID={testID} style={heroStyle}>
      <Svg viewBox="0 0 390 300" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        {LINE_DATA.map((l, i) => (
          <G key={`${l.color}-${i}`}>
            <Path
              d={`M -20 ${l.y} Q 130 ${l.y + l.dy} 260 ${l.y + l.dy * 0.4} T 420 ${l.y - l.dy * 0.2}`}
              stroke={l.color}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              opacity={isDark ? 0.85 : 0.92}
            />
            <Circle
              cx={70 + i * 12}
              cy={l.y + l.dy * 0.6}
              r={5}
              fill={isDark ? '#0B0E18' : '#FFFFFF'}
              stroke={l.color}
              strokeWidth={3}
            />
            <Circle
              cx={210 + i * 8}
              cy={l.y + l.dy * 0.2}
              r={5}
              fill={isDark ? '#0B0E18' : '#FFFFFF'}
              stroke={l.color}
              strokeWidth={3}
            />
          </G>
        ))}
      </Svg>
      <View style={pulsePinOuter} />
      <View style={wordmarkContainer}>
        <View style={brandBadge}>
          <TrainFront size={20} color="#FFFFFF" strokeWidth={2.2} />
        </View>
        <View>
          <Text style={wordmarkText}>LiveMetro</Text>
          <Text style={taglineText}>실시간 · ML 예측 · 커뮤니티</Text>
        </View>
      </View>
    </View>
  );
};

export const LoginHero = memo(LoginHeroImpl);
LoginHero.displayName = 'LoginHero';
