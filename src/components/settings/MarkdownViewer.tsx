/**
 * Markdown Viewer Component
 * Display markdown content with custom styling
 */

import React from 'react';
import { Alert, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/styles/modernTheme';

interface MarkdownViewerProps {
  content: string;
  onLinkPress?: (url: string) => void;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  onLinkPress,
}) => {
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

const markdownStyles = {
  body: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  heading1: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  heading2: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heading3: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heading4: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heading5: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heading6: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  link: {
    color: COLORS.text.link,
    textDecorationLine: 'underline' as const,
  },
  bullet_list: {
    marginBottom: SPACING.md,
  },
  ordered_list: {
    marginBottom: SPACING.md,
  },
  list_item: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bullet_list_icon: {
    color: COLORS.black,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginLeft: 0,
    marginRight: SPACING.sm,
  },
  code_inline: {
    backgroundColor: COLORS.surface.card,
    color: COLORS.text.primary,
    fontFamily: 'monospace',
    fontSize: TYPOGRAPHY.fontSize.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  code_block: {
    backgroundColor: COLORS.surface.card,
    color: COLORS.text.primary,
    fontFamily: 'monospace',
    fontSize: TYPOGRAPHY.fontSize.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    marginBottom: SPACING.md,
  },
  fence: {
    backgroundColor: COLORS.surface.card,
    color: COLORS.text.primary,
    fontFamily: 'monospace',
    fontSize: TYPOGRAPHY.fontSize.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    marginBottom: SPACING.md,
  },
  blockquote: {
    backgroundColor: COLORS.primary.light,
    borderLeftColor: COLORS.black,
    borderLeftWidth: 3,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  hr: {
    backgroundColor: COLORS.border.medium,
    height: 1,
    marginVertical: SPACING.lg,
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: RADIUS.base,
    marginBottom: SPACING.md,
  },
  thead: {
    backgroundColor: COLORS.surface.card,
  },
  th: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  td: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  strong: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  em: {
    fontStyle: 'italic',
  },
};

export default MarkdownViewer;
