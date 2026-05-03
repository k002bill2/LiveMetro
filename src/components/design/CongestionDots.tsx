/**
 * CongestionDots — 4-dot congestion meter.
 *
 * Mirrors the design handoff's `CongestionDots` atom: lights up dots from
 * left to right based on level (low=1, mid=2, high=3, vhigh=4) using the
 * level's tone color for filled dots and a neutral gray for empty ones.
 */
import React, { memo } from 'react';
import { View, ViewStyle } from 'react-native';
import { CONG_TONE, type CongestionLevel } from './congestion';

interface CongestionDotsProps {
  level: CongestionLevel;
  dotSize?: number;
  gap?: number;
  style?: ViewStyle;
  testID?: string;
}

const ORDER: CongestionLevel[] = ['low', 'mid', 'high', 'vhigh'];

const CongestionDotsImpl: React.FC<CongestionDotsProps> = ({
  level,
  dotSize = 6,
  gap = 3,
  style,
  testID,
}) => {
  const tone = CONG_TONE[level];
  const idx = ORDER.indexOf(level);

  return (
    <View
      testID={testID ?? `congestion-dots-${level}`}
      accessibilityLabel={`혼잡도 ${tone.label}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap,
        },
        style,
      ]}
    >
      {ORDER.map((l, i) => (
        <View
          key={l}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: 999,
            backgroundColor: i <= idx ? tone.color : 'rgba(112,115,124,0.18)',
          }}
        />
      ))}
    </View>
  );
};

export const CongestionDots = memo(CongestionDotsImpl);
CongestionDots.displayName = 'CongestionDots';
