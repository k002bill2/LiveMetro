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
  // Full Korean names — emitted by stationsDataService for transfer lines.
  // Without these, LINE_LABELS lookup returns undefined and the badge
  // silently no-renders (regression flagged by cross-review on the
  // MapScreen Wanted handoff).
  //
  // Note: getSubwayLineColor's substring matching runs on a normalized
  // (ASCII-only) string, so it can't recognize pure Korean names. That's
  // why we hard-code each here rather than rely on the fallback path.
  '신분당선':       { label: '신분당',   color: SUBWAY_LINE_COLORS['sb'] },
  '수인분당선':     { label: '수인분당', color: SUBWAY_LINE_COLORS['bd'] },
  '경의선':         { label: '경의',     color: SUBWAY_LINE_COLORS['gj'] },
  '경의중앙선':     { label: '경의중앙', color: SUBWAY_LINE_COLORS['gj'] },
  '공항철도':       { label: '공항',     color: SUBWAY_LINE_COLORS['gx'] },
  '경춘선':         { label: '경춘',     color: SUBWAY_LINE_COLORS.gyeongchun },
  '경강선':         { label: '경강',     color: SUBWAY_LINE_COLORS.gyeonggang },
  '서해선':         { label: '서해',     color: SUBWAY_LINE_COLORS.seohae },
  '김포도시철도':   { label: '김포',     color: SUBWAY_LINE_COLORS.gimpo },
  '우이신설경전철': { label: '우이신설', color: SUBWAY_LINE_COLORS.wooyisinseol },
  // Graph-data slugs from src/data/stations.json `lines` field. routeService
  // and StationPickerModal feed these directly into LineBadge, so they need
  // explicit entries — the substring fallback in getSubwayLineColor is not
  // consulted by LineBadge.
  'airport':        { label: '공항',     color: SUBWAY_LINE_COLORS.airport },
  'bundang':        { label: '분당',     color: SUBWAY_LINE_COLORS.bundang },
  'sinbundang':     { label: '신분당',   color: SUBWAY_LINE_COLORS.sinbundang },
  'gyeongchun':     { label: '경춘',     color: SUBWAY_LINE_COLORS.gyeongchun },
  'gyeongui':       { label: '경의',     color: SUBWAY_LINE_COLORS.gyeongui },
  'seohaeline':     { label: '서해',     color: SUBWAY_LINE_COLORS.seohae },
  // Wide-area lines added with the full graph regen (24 lines total).
  'gyeonggang':     { label: '경강',     color: SUBWAY_LINE_COLORS.gyeonggang },
  'incheon1':       { label: '인천1',    color: SUBWAY_LINE_COLORS.incheon1 },
  'incheon2':       { label: '인천2',    color: SUBWAY_LINE_COLORS.incheon2 },
  'uijeongbu':      { label: '의정부',   color: SUBWAY_LINE_COLORS.uijeongbu },
  'yongin':         { label: '용인',     color: SUBWAY_LINE_COLORS.ever },
  'wooyisinseol':   { label: '우이신설', color: SUBWAY_LINE_COLORS.wooyisinseol },
  'gimpo':          { label: '김포',     color: SUBWAY_LINE_COLORS.gimpo },
  'sillim':         { label: '신림',     color: SUBWAY_LINE_COLORS.sillim },
  'gtx_a':          { label: 'GTX-A',   color: SUBWAY_LINE_COLORS.gtx_a },
};

/**
 * Look up the short Korean label for a line id (graph slug, digit, or alias).
 * Returns null when the id has no registered alias — callers decide how to
 * fall back (e.g. JourneyStrip uses the digit itself for numeric ids and the
 * first char as a last resort).
 */
export const getLineShortLabel = (line: LineId): string | null => {
  const meta = LINE_LABELS[String(line)];
  return meta ? meta.label : null;
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
