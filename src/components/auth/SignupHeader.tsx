/**
 * SignupHeader — shared progress indicator across signup wizard steps 1/3 → 3/3.
 *
 * Renders a left ChevronLeft (when onBack provided), a centered 3-dot gauge
 * highlighting the current step, and a right "{current}/{total}" caption.
 * Aligned with the Wanted Design System hand-off (chat3 — "SignupHeader as
 * shared component").
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

export type SignupStep = 1 | 2 | 3;

interface SignupHeaderProps {
  currentStep: SignupStep;
  totalSteps?: 3;
  onBack?: () => void;
  testID?: string;
}

const TOTAL_DEFAULT: 3 = 3;

export const SignupHeader: React.FC<SignupHeaderProps> = ({
  currentStep,
  totalSteps = TOTAL_DEFAULT,
  onBack,
  testID = 'signup-header',
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const dots = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity
            testID={`${testID}-back`}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <ChevronLeft size={26} color={semantic.labelNeutral} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.gauge} accessibilityRole="progressbar" accessibilityLabel={`회원가입 ${currentStep}단계, 전체 ${totalSteps}단계`}>
        {dots.map((step) => {
          const isActive = step <= currentStep;
          const dotStyle: ViewStyle = {
            width: step === currentStep ? 22 : 8,
            height: 8,
            borderRadius: WANTED_TOKENS.radius.pill,
            backgroundColor: isActive ? semantic.primaryNormal : semantic.lineSubtle,
            marginHorizontal: 3,
          };
          return <View key={step} style={dotStyle} />;
        })}
      </View>

      <View style={[styles.side, styles.sideRight]}>
        <Text
          style={[
            styles.counter,
            { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
          ]}
          testID={`${testID}-counter`}
        >
          {currentStep}/{totalSteps}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: WANTED_TOKENS.spacing.s2,
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s2,
    height: 48,
  },
  side: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  gauge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    letterSpacing: 0.2,
  },
});

export default SignupHeader;
