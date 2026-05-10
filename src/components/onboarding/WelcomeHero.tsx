/**
 * WelcomeHero — abstract line graphic + center pin used on the onboarding
 * step 1/4 entry screen.
 *
 * Wanted handoff: three layered curves (green/orange/violet) sweep across
 * the canvas with a subtle opacity falloff, anchored by a primary-colored
 * circular pin holding a TrainFront icon. Each curve is a quadratic Bezier
 * (`Q controlX controlY endX endY`) tuned to weave above and below the
 * vertical center so the layers feel organic instead of parallel.
 */
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TrainFront } from 'lucide-react-native';

import { WANTED_TOKENS } from '@/styles/modernTheme';

interface WelcomeHeroProps {
  testID?: string;
  primaryColor: string;
  pinIconColor: string;
  isDark?: boolean;
}

const HERO_HEIGHT = 220;
const PIN_SIZE = 88;

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  testID = 'welcome-hero',
  primaryColor,
  pinIconColor,
  isDark = false,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const w = Math.max(320, screenWidth - 48);
  const h = HERO_HEIGHT;

  // Curve set — three quadratic Beziers weaving at different vertical
  // anchors so the layers feel like wind/wave streaks rather than parallel
  // arcs. Tuned to match the Wanted handoff sweep.
  const paths = useMemo(
    () => [
      {
        d: `M 0 ${h * 0.46} Q ${w * 0.32} ${h * 0.18} ${w * 0.62} ${h * 0.42} T ${w} ${h * 0.32}`,
        stroke: WANTED_TOKENS.status.green500,
        opacity: isDark ? 0.55 : 0.65,
      },
      {
        d: `M 0 ${h * 0.54} Q ${w * 0.28} ${h * 0.78} ${w * 0.58} ${h * 0.5} T ${w} ${h * 0.62}`,
        stroke: '#FF8A1F',
        opacity: isDark ? 0.5 : 0.6,
      },
      {
        d: `M 0 ${h * 0.62} Q ${w * 0.36} ${h * 0.36} ${w * 0.66} ${h * 0.6} T ${w} ${h * 0.5}`,
        stroke: WANTED_TOKENS.status.violet500,
        opacity: isDark ? 0.5 : 0.55,
      },
    ],
    [w, h, isDark],
  );

  return (
    <View style={[styles.wrap, { height: HERO_HEIGHT }]} testID={testID}>
      <Svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        pointerEvents="none"
        style={styles.svg}
      >
        {paths.map((p, i) => (
          <Path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={p.opacity}
            fill="none"
          />
        ))}
      </Svg>
      <View
        style={[
          styles.pin,
          {
            backgroundColor: primaryColor,
            shadowColor: primaryColor,
          },
        ]}
        testID={`${testID}-pin`}
      >
        <TrainFront size={36} color={pinIconColor} strokeWidth={2.4} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
});

export default WelcomeHero;
