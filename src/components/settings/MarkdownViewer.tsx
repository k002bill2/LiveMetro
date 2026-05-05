/**
 * Markdown Viewer Component
 * Display markdown content with custom styling.
 *
 * Phase 45 — Wanted Design System migration. Markdown style object
 * is theme-aware via useMemo (the underlying library expects a flat
 * object, so we don't go through StyleSheet.create + createStyles).
 */

import React, { useMemo } from 'react';
import { Alert, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

interface MarkdownViewerProps {
  content: string;
  onLinkPress?: (url: string) => void;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  onLinkPress,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const markdownStyles = useMemo(() => buildStyles(semantic), [semantic]);

  const handleLinkPress = (url: string): boolean => {
    if (onLinkPress) {
      onLinkPress(url);
      return false;
    }

    // Confirm before opening external links
    Alert.alert(
      '외부 링크',
      `다음 링크를 여시겠습니까?\n\n${url}`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '열기',
          onPress: () => {
            Linking.openURL(url).catch((err) => {
              console.error('Error opening URL:', err);
              Alert.alert('오류', '링크를 열 수 없습니다.');
            });
          },
        },
      ]
    );

    return false;
  };

  return (
    <Markdown
      style={markdownStyles as any}
      onLinkPress={handleLinkPress}
    >
      {content}
    </Markdown>
  );
};

// Body line height: 14 * 1.6 = 22.4 (relaxed reading rhythm).
const BODY_FONT_SIZE = 14;
const BODY_LINE_HEIGHT = BODY_FONT_SIZE * 1.6;

const buildStyles = (semantic: WantedSemanticTheme) => ({
  body: {
    color: semantic.labelStrong,
    fontSize: BODY_FONT_SIZE,
    fontFamily: weightToFontFamily('500'),
    lineHeight: BODY_LINE_HEIGHT,
  },
  heading1: {
    fontSize: 32,
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelStrong,
    marginTop: WANTED_TOKENS.spacing.s5,
    marginBottom: WANTED_TOKENS.spacing.s4,
  },
  heading2: {
    fontSize: 24,
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelStrong,
    marginTop: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  heading3: {
    fontSize: 20,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
    marginTop: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  heading4: {
    fontSize: 16,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
    marginTop: WANTED_TOKENS.spacing.s3,
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  heading5: {
    fontSize: 14,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
    marginTop: WANTED_TOKENS.spacing.s3,
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  heading6: {
    fontSize: 13,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelNeutral,
    marginTop: WANTED_TOKENS.spacing.s3,
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: WANTED_TOKENS.spacing.s3,
    lineHeight: BODY_LINE_HEIGHT,
  },
  link: {
    color: WANTED_TOKENS.blue[500],
    textDecorationLine: 'underline' as const,
  },
  bullet_list: {
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  ordered_list: {
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  list_item: {
    marginTop: WANTED_TOKENS.spacing.s2,
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  bullet_list_icon: {
    color: semantic.labelStrong,
    fontSize: 16,
    marginLeft: 0,
    marginRight: WANTED_TOKENS.spacing.s2,
  },
  code_inline: {
    backgroundColor: semantic.bgSubtle,
    color: semantic.labelStrong,
    fontFamily: WANTED_TOKENS.fontFamily.mono,
    fontSize: 13,
    paddingHorizontal: WANTED_TOKENS.spacing.s1,
    paddingVertical: 2,
    borderRadius: WANTED_TOKENS.radius.r2,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  code_block: {
    backgroundColor: semantic.bgSubtle,
    color: semantic.labelStrong,
    fontFamily: WANTED_TOKENS.fontFamily.mono,
    fontSize: 13,
    padding: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r4,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  fence: {
    backgroundColor: semantic.bgSubtle,
    color: semantic.labelStrong,
    fontFamily: WANTED_TOKENS.fontFamily.mono,
    fontSize: 13,
    padding: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r4,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  blockquote: {
    // Translucent blue tint works in both light and dark themes — the
    // hardcoded blue[50] (#EAF2FE) regressed in dark mode (Gemini cross-
    // review Phase 45). Same pattern as CommuteRouteCard's origin node.
    backgroundColor: 'rgba(0,102,255,0.10)',
    borderLeftColor: WANTED_TOKENS.blue[500],
    borderLeftWidth: 3,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  hr: {
    backgroundColor: semantic.lineNormal,
    height: 1,
    marginVertical: WANTED_TOKENS.spacing.s4,
  },
  table: {
    borderWidth: 1,
    borderColor: semantic.lineNormal,
    borderRadius: WANTED_TOKENS.radius.r4,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  thead: {
    backgroundColor: semantic.bgSubtle,
  },
  th: {
    padding: WANTED_TOKENS.spacing.s2,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    fontFamily: weightToFontFamily('700'),
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
  },
  td: {
    padding: WANTED_TOKENS.spacing.s2,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  strong: {
    fontFamily: weightToFontFamily('700'),
  },
  em: {
    fontStyle: 'italic' as const,
  },
});

export default MarkdownViewer;
