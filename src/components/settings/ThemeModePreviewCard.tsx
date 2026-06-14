/**
 * Theme Mode Preview Card
 * Wanted handoff (settings-detail-2) — 테마 화면의 라이트/다크/시스템
 * 미니 앱 미리보기 카드. 시스템 모드는 라이트/다크 반반 분할로 표현.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { type ThemeMode, useSemanticTokens } from '@/services/theme';

interface ThemeModePreviewCardProps {
  mode: ThemeMode;
  title: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * 미리보기 전용 고정 팔레트 — 테마 토큰이 아니라 "라이트/다크 테마 자체"를
 * 묘사하는 콘텐츠 색상. 다크 모드에서도 라이트 카드는 밝게 보여야 한다.
 */
const PREVIEW_PALETTES = {
  light: { bg: '#FAFAFA', card: '#FFFFFF', fg: '#1F2024', sub: '#70737C', bar: '#E5E7EB' },
  dark: { bg: '#16181D', card: '#22262E', fg: '#F4F5F7', sub: '#A4A8B0', bar: '#3A3F49' },
} as const;

type PreviewPalette = (typeof PREVIEW_PALETTES)[keyof typeof PREVIEW_PALETTES];

const PREVIEW_ACCENT = WANTED_TOKENS.blue[500];
const PREVIEW_LINE_GREEN = '#00A84F';

/** 단일 팔레트의 미니 앱 화면 (상태바 + 카드 2장) */
const MiniAppPreview: React.FC<{ palette: PreviewPalette }> = ({ palette }) => (
  <View style={[miniStyles.canvas, { backgroundColor: palette.bg }]}>
    <View style={miniStyles.statusRow}>
      <Text style={[miniStyles.statusTime, { color: palette.sub }]}>9:41</Text>
      <View style={miniStyles.statusDots}>
        <View style={[miniStyles.dot, { backgroundColor: palette.sub }]} />
        <View style={[miniStyles.dot, { backgroundColor: palette.sub }]} />
        <View style={[miniStyles.battery, { backgroundColor: palette.sub }]} />
      </View>
    </View>
    <View style={[miniStyles.card, { backgroundColor: palette.card }]}>
      <View style={[miniStyles.accentBar, { backgroundColor: PREVIEW_ACCENT }]} />
      <View style={[miniStyles.subBar, { backgroundColor: palette.bar, width: '80%' }]} />
    </View>
    <View style={[miniStyles.card, { backgroundColor: palette.card }]}>
      <View style={miniStyles.lineRow}>
        <View style={miniStyles.lineBadge} />
        <View style={[miniStyles.titleBar, { backgroundColor: palette.fg }]} />
      </View>
      <View style={[miniStyles.subBar, { backgroundColor: palette.sub, width: '50%' }]} />
    </View>
  </View>
);

MiniAppPreview.displayName = 'MiniAppPreview';

export const ThemeModePreviewCard: React.FC<ThemeModePreviewCardProps> = ({
  mode,
  title,
  selected,
  onPress,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <TouchableOpacity
      style={[styles.card, selected ? styles.cardSelected : styles.cardUnselected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      testID={`theme-mode-${mode}`}
    >
      {mode === 'system' ? (
        // 라이트/다크 반반 분할 — 각 절반을 클리핑해 동일 미니 UI를 겹쳐 그림
        <View style={styles.splitRow}>
          <View style={styles.splitHalf}>
            <View style={styles.splitInnerLeft}>
              <MiniAppPreview palette={PREVIEW_PALETTES.light} />
            </View>
          </View>
          <View style={styles.splitHalf}>
            <View style={styles.splitInnerRight}>
              <MiniAppPreview palette={PREVIEW_PALETTES.dark} />
            </View>
          </View>
        </View>
      ) : (
        <MiniAppPreview palette={PREVIEW_PALETTES[mode]} />
      )}

      <View style={styles.labelRow}>
        <Text style={styles.labelText}>{title}</Text>
        {selected ? (
          <View style={styles.checkCircle}>
            <Check size={11} color="#FFFFFF" strokeWidth={3.5} />
          </View>
        ) : (
          <View style={styles.emptyCircle} />
        )}
      </View>
    </TouchableOpacity>
  );
};

ThemeModePreviewCard.displayName = 'ThemeModePreviewCard';

const PREVIEW_HEIGHT = 132;

const miniStyles = StyleSheet.create({
  canvas: {
    height: PREVIEW_HEIGHT,
    padding: 10,
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTime: {
    fontSize: 8,
    fontFamily: weightToFontFamily('800'),
  },
  statusDots: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  battery: {
    width: 6,
    height: 4,
    borderRadius: 1,
  },
  card: {
    borderRadius: 7,
    padding: 8,
    marginBottom: 6,
  },
  accentBar: {
    width: '60%',
    height: 5,
    borderRadius: 2,
    marginBottom: 5,
  },
  subBar: {
    height: 3,
    borderRadius: 2,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  lineBadge: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: PREVIEW_LINE_GREEN,
  },
  titleBar: {
    width: 30,
    height: 4,
    borderRadius: 2,
  },
});

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: semantic.bgBase,
    },
    cardSelected: {
      borderWidth: 2,
      borderColor: WANTED_TOKENS.blue[500],
    },
    cardUnselected: {
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    splitRow: {
      flexDirection: 'row',
      height: PREVIEW_HEIGHT,
    },
    splitHalf: {
      width: '50%',
      overflow: 'hidden',
    },
    splitInnerLeft: {
      width: '200%',
    },
    splitInnerRight: {
      width: '200%',
      marginLeft: '-100%',
    },
    labelRow: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    labelText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    checkCircle: {
      width: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: WANTED_TOKENS.blue[500],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCircle: {
      width: 16,
      height: 16,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: 'rgba(112,115,124,0.30)',
    },
  });

export default ThemeModePreviewCard;
