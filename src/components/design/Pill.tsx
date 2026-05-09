/**
 * Pill — small status / label chip.
 *
 * Mirrors the design handoff's `Pill` atom with 6 tones × 3 sizes. Used for
 * "검증됨", "곧 도착", nicknames, route tags, etc.
 */
import React, { memo, ReactNode } from 'react';
import { Text, View, ViewStyle, TextStyle } from 'react-native';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

export type PillTone = 'neutral' | 'primary' | 'pos' | 'neg' | 'warn' | 'cool';
export type PillSize = 'sm' | 'md' | 'lg';

interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  size?: PillSize;
  style?: ViewStyle;
  testID?: string;
}

// Hex-alpha suffixes used to derive tint backgrounds from the canonical
// status colors: 1A ≈ 10%, 29 ≈ 16%. Pill stays theme-agnostic so we read
// from the root `WANTED_TOKENS` palettes (not the light/dark semantic
// scopes) — the tones are intentionally consistent across backgrounds.
const TINT_10 = '1A';
const TINT_16 = '29';
const { status, blue } = WANTED_TOKENS;

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  // Neutral tint has no canonical token equivalent: design uses labelAlt
  // grayscale at 10%, but `WANTED_TOKENS.light.bgSubtle` is 8% and
  // theme-scoped. Keep raw rgba documenting the source.
  neutral: { bg: 'rgba(112,115,124,0.10)',          fg: WANTED_TOKENS.light.labelNeutral },
  primary: { bg: blue[50],                          fg: blue[700] },
  pos:     { bg: `${status.green500}${TINT_10}`,    fg: status.green700 },
  neg:     { bg: `${status.red500}${TINT_10}`,      fg: status.red700 },
  warn:    { bg: `${status.yellow500}${TINT_16}`,   fg: status.amber700 },
  cool:    { bg: `${status.cyan500}${TINT_10}`,     fg: status.cyan500 },
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
