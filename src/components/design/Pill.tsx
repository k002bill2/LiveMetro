/**
 * Pill — small status / label chip.
 *
 * Mirrors the design handoff's `Pill` atom with 6 tones × 3 sizes. Used for
 * "검증됨", "곧 도착", nicknames, route tags, etc.
 */
import React, { memo, ReactNode } from 'react';
import { Text, View, ViewStyle, TextStyle } from 'react-native';
import { weightToFontFamily } from '@/styles/modernTheme';

export type PillTone = 'neutral' | 'primary' | 'pos' | 'neg' | 'warn' | 'cool';
export type PillSize = 'sm' | 'md' | 'lg';

interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  size?: PillSize;
  style?: ViewStyle;
  testID?: string;
}

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: 'rgba(112,115,124,0.10)', fg: '#37383C' },
  primary: { bg: '#EAF2FE',                 fg: '#0044BB' },
  pos:     { bg: 'rgba(0,191,64,0.10)',     fg: '#008F30' },
  neg:     { bg: 'rgba(255,66,66,0.10)',    fg: '#C42727' },
  warn:    { bg: 'rgba(255,180,0,0.16)',    fg: '#A06A00' },
  cool:    { bg: 'rgba(0,152,178,0.10)',    fg: '#0098B2' },
};

const SIZES: Record<PillSize, { paddingV: number; paddingH: number; fontSize: number; height: number }> = {
  sm: { paddingV: 2, paddingH: 8,  fontSize: 11, height: 20 },
  md: { paddingV: 4, paddingH: 10, fontSize: 12, height: 24 },
  lg: { paddingV: 6, paddingH: 12, fontSize: 13, height: 28 },
};

const PillImpl: React.FC<PillProps> = ({
  children,
  tone = 'neutral',
  size = 'md',
  style,
  testID,
}) => {
  const t = TONES[tone];
  const s = SIZES[size];

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    height: s.height,
    paddingVertical: s.paddingV,
    paddingHorizontal: s.paddingH,
    borderRadius: 9999,
    backgroundColor: t.bg,
    alignSelf: 'flex-start',
    gap: 4,
  };

  const textStyle: TextStyle = {
    color: t.fg,
    fontSize: s.fontSize,
    fontFamily: weightToFontFamily('700'),
    lineHeight: s.fontSize + 2,
  };

  return (
    <View testID={testID} style={[containerStyle, style]}>
      {typeof children === 'string' ? <Text style={textStyle}>{children}</Text> : children}
    </View>
  );
};

export const Pill = memo(PillImpl);
Pill.displayName = 'Pill';
