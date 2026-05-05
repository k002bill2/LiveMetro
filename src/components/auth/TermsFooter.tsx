/**
 * TermsFooter — login screen micro-copy linking to ToS / Privacy Policy.
 *
 * Mirrors the Wanted handoff: 11px caption, centered, two underlined links.
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, TextStyle } from 'react-native';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

interface TermsFooterProps {
  onTermsPress: () => void;
  onPrivacyPress: () => void;
  testID?: string;
}

const TermsFooterImpl: React.FC<TermsFooterProps> = ({ onTermsPress, onPrivacyPress, testID }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const baseText: TextStyle = {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    lineHeight: 17,
    color: semantic.labelAlt,
    textAlign: 'center',
  };

  const linkText: TextStyle = {
    ...baseText,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    textDecorationLine: 'underline',
  };

  return (
    <View testID={testID} style={styles.wrap}>
      <Text style={baseText}>계속 진행하면 LiveMetro의</Text>
      <View style={styles.linkRow}>
        <TouchableOpacity
          testID={testID ? `${testID}-tos` : undefined}
          onPress={onTermsPress}
          accessible
          accessibilityRole="link"
          accessibilityLabel="서비스 이용약관"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={linkText}>서비스 이용약관</Text>
        </TouchableOpacity>
        <Text style={baseText}> 및 </Text>
        <TouchableOpacity
          testID={testID ? `${testID}-privacy` : undefined}
          onPress={onPrivacyPress}
          accessible
          accessibilityRole="link"
          accessibilityLabel="개인정보 처리방침"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={linkText}>개인정보 처리방침</Text>
        </TouchableOpacity>
      </View>
      <Text style={baseText}>에 동의하게 됩니다.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingBottom: WANTED_TOKENS.spacing.s6,
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const TermsFooter = memo(TermsFooterImpl);
TermsFooter.displayName = 'TermsFooter';
