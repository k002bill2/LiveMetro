/**
 * ScreenTitle — In-screen title for bottom-tab screens.
 *
 * Tab screens hide the native header (RootNavigator `headerShown: false`) and
 * draw their own title, so the type scale lives here instead of being copied
 * per screen. Layout (inset, margins) stays with the caller via `style`.
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { useSemanticTokens } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

type ScreenTitleProps = Omit<TextProps, 'accessibilityRole'>;

export const ScreenTitle: React.FC<ScreenTitleProps> = memo(({ style, ...textProps }) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return <Text {...textProps} accessibilityRole="header" style={[styles.title, style]} />;
});

ScreenTitle.displayName = 'ScreenTitle';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    title: {
      fontSize: WANTED_TOKENS.type.heading1.size,
      lineHeight: WANTED_TOKENS.type.heading1.lh,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: WANTED_TOKENS.type.heading1.size * WANTED_TOKENS.type.heading1.tracking,
    },
  });
