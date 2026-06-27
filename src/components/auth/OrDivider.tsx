/**
 * OrDivider — labeled separator between auth sections (Wanted Design System).
 *
 * Used as `간편 로그인` between the email-login button and social buttons.
 */
import React, { memo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { weightToFontFamily } from '@/styles/modernTheme';

interface OrDividerProps {
  label?: string;
  testID?: string;
}

const OrDividerImpl: React.FC<OrDividerProps> = ({ label = '또는', testID }) => {
  const semantic = useSemanticTokens();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  };

  const lineStyle: ViewStyle = {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: semantic.lineSubtle,
  };

  const labelStyle: TextStyle = {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    letterSpacing: 0.44,
    color: semantic.labelAlt,
  };

  return (
    <View testID={testID} style={containerStyle}>
      <View testID={testID ? `${testID}-line-left` : undefined} style={lineStyle} />
      <Text style={labelStyle}>{label}</Text>
      <View testID={testID ? `${testID}-line-right` : undefined} style={lineStyle} />
    </View>
  );
};

export const OrDivider = memo(OrDividerImpl);
OrDivider.displayName = 'OrDivider';
