/**
 * SocialButton — provider-styled OAuth login button (Wanted Design System).
 *
 * Variants:
 *   apple  — black bg, white fg, Apple icon
 *   google — white bg, neutral border, multicolor logo (uses globe glyph)
 *   kakao  — yellow bg, dark fg, chat-bubble icon
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { Apple, Globe, MessageCircle, type LucideIcon } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

export type SocialProvider = 'apple' | 'google' | 'kakao';

interface SocialButtonProps {
  provider: SocialProvider;
  label: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
}

interface ProviderStyle {
  bg: string;
  fg: string;
  borderColor?: string;
  Icon: LucideIcon;
}

const SocialButtonImpl: React.FC<SocialButtonProps> = ({
  provider,
  label,
  onPress,
  loading = false,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const variants: Record<SocialProvider, ProviderStyle> = {
    apple: { bg: '#000000', fg: '#FFFFFF', Icon: Apple },
    google: {
      bg: semantic.bgBase,
      fg: semantic.labelStrong,
      borderColor: semantic.lineSubtle,
      Icon: Globe,
    },
    kakao: { bg: '#FEE500', fg: '#191919', Icon: MessageCircle },
  };

  const v = variants[provider];

  const buttonStyle: ViewStyle = {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: v.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    opacity: loading ? 0.7 : 1,
    ...(v.borderColor ? { borderWidth: 1, borderColor: v.borderColor } : {}),
  };

  const labelStyle: TextStyle = {
    color: v.fg,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    letterSpacing: -0.15,
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={loading}
      style={buttonStyle}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading }}
      activeOpacity={0.85}
    >
      <v.Icon size={20} color={v.fg} strokeWidth={2} />
      <Text style={labelStyle} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const SocialButton = memo(SocialButtonImpl);
SocialButton.displayName = 'SocialButton';
