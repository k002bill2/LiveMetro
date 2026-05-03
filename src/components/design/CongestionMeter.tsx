/**
 * CongestionMeter — switchable congestion visualization.
 *
 * Wraps CongestionBar / CongestionDots so screens can flip presentation
 * via a single `style` prop. The 'heat' style is rendered as a saturated
 * solid pill — used for compact in-row signals (e.g., car-by-car list).
 */
import React, { memo } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { CongestionBar } from './CongestionBar';
import { CongestionDots } from './CongestionDots';
import { CONG_TONE, type CongestionLevel } from './congestion';

export type CongestionStyle = 'bar' | 'dots' | 'heat';

interface CongestionMeterProps {
  level: CongestionLevel;
  style?: CongestionStyle;
  showLabel?: boolean;
  width?: number;
  containerStyle?: ViewStyle;
  testID?: string;
}

const CongestionMeterImpl: React.FC<CongestionMeterProps> = ({
  level,
  style = 'bar',
  showLabel = false,
  width = 56,
  containerStyle,
  testID,
}) => {
  const tone = CONG_TONE[level];

  const content = (() => {
    if (style === 'dots') return <CongestionDots level={level} />;
    if (style === 'heat') {
      return (
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 9999,
            backgroundColor: tone.color,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: '800',
              lineHeight: 14,
            }}
          >
            {tone.label}
          </Text>
        </View>
      );
    }
    return <CongestionBar level={level} width={width} />;
  })();

  return (
    <View
      testID={testID ?? `congestion-meter-${style}-${level}`}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, containerStyle]}
    >
      {content}
      {showLabel && style !== 'heat' && (
        <Text
          style={{
            color: tone.color,
            fontSize: 11,
            fontWeight: '700',
            lineHeight: 14,
          }}
        >
          {tone.label}
        </Text>
      )}
    </View>
  );
};

export const CongestionMeter = memo(CongestionMeterImpl);
CongestionMeter.displayName = 'CongestionMeter';
