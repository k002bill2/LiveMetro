/**
 * CongestionBar — compact horizontal congestion meter.
 *
 * Mirrors the design handoff's `CongestionBar` atom: 4-step semantic level
 * mapped to color + percentage fill on a rounded track.
 */
import React, { memo } from 'react';
import { View, ViewStyle } from 'react-native';
import { CONG_TONE, type CongestionLevel } from './congestion';

interface CongestionBarProps {
  level: CongestionLevel;
  width?: number;
  height?: number;
  style?: ViewStyle;
  testID?: string;
}

const CongestionBarImpl: React.FC<CongestionBarProps> = ({
  level,
  width = 56,
  height = 6,
  style,
  testID,
}) => {
  const tone = CONG_TONE[level];

  return (
    <View
      testID={testID ?? `congestion-bar-${level}`}
      accessibilityLabel={`혼잡도 ${tone.label}`}
      style={[
        {
          width,
          height,
          borderRadius: 999,
          backgroundColor: 'rgba(112,115,124,0.14)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${tone.pct * 100}%`,
          height: '100%',
          backgroundColor: tone.color,
          borderRadius: 999,
        }}
      />
    </View>
  );
};

export const CongestionBar = memo(CongestionBarImpl);
CongestionBar.displayName = 'CongestionBar';
