/**
 * LineBadge — Seoul Metro circular line badge.
 *
 * Mirrors the design handoff's `LineBadge` atom: short labels (1–2 chars) get
 * a perfect circle, longer labels (분당, 신분당, 경의, 공항) auto-grow to a
 * pill shape so the text fits without clipping.
 */
import React, { memo, useMemo } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { SUBWAY_LINE_COLORS } from '@/utils/colorUtils';
import { weightToFontFamily } from '@/styles/modernTheme';

export type LineId = keyof typeof SUBWAY_LINE_COLORS | string;

interface LineLabel {
  label: string;
  color: string;
}

const LINE_LABELS: Record<string, LineLabel> = {
  '1':  { label: '1',     color: SUBWAY_LINE_COLORS['1'] },
  '2':  { label: '2',     color: SUBWAY_LINE_COLORS['2'] },
  '3':  { label: '3',     color: SUBWAY_LINE_COLORS['3'] },
  '4':  { label: '4',     color: SUBWAY_LINE_COLORS['4'] },
  '5':  { label: '5',     color: SUBWAY_LINE_COLORS['5'] },
  '6':  { label: '6',     color: SUBWAY_LINE_COLORS['6'] },
  '7':  { label: '7',     color: SUBWAY_LINE_COLORS['7'] },
  '8':  { label: '8',     color: SUBWAY_LINE_COLORS['8'] },
  '9':  { label: '9',     color: SUBWAY_LINE_COLORS['9'] },
  'sb': { label: '신분당', color: SUBWAY_LINE_COLORS['sb'] },
  'bd': { label: '분당',   color: SUBWAY_LINE_COLORS['bd'] },
  'gj': { label: '경의',   color: SUBWAY_LINE_COLORS['gj'] },
  'gx': { label: '공항',   color: SUBWAY_LINE_COLORS['gx'] },
};

interface LineBadgeProps {
  line: LineId;
  size?: number;
  style?: ViewStyle;
  testID?: string;
}

const fontSizeFor = (size: number): number => {
  if (size <= 18) return 11;
  if (size <= 24) return 13;
  if (size <= 32) return 15;
  return 18;
};

const LineBadgeImpl: React.FC<LineBadgeProps> = ({ line, size = 24, style, testID }) => {
  const meta = LINE_LABELS[String(line)];

  const computed = useMemo(() => {
    if (!meta) return null;
    const isLong = meta.label.length > 1;
    const fontSize = fontSizeFor(size);
    return {
      isLong,
      fontSize,
      paddingHorizontal: isLong ? Math.round(size * 0.32) : 0,
      width: isLong ? undefined : size,
      minWidth: size,
    };
  }, [meta, size]);

  if (!meta || !computed) return null;

  return (
    <View
      testID={testID ?? `line-badge-${line}`}
      accessibilityLabel={`${meta.label}호선`}
      style={[
        {
          height: size,
          minWidth: computed.minWidth,
          width: computed.width,
          paddingHorizontal: computed.paddingHorizontal,
          borderRadius: 9999,
          backgroundColor: meta.color,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: weightToFontFamily('800'),
          fontSize: computed.fontSize,
          letterSpacing: -0.1,
          lineHeight: computed.fontSize,
          textAlign: 'center',
        }}
      >
        {meta.label}
      </Text>
    </View>
  );
};

export const LineBadge = memo(LineBadgeImpl);
LineBadge.displayName = 'LineBadge';
