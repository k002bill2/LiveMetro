/**
 * SignupHeader — shared progress indicator across signup wizard steps 1/3 → 3/3.
 *
 * Renders an optional ChevronLeft (in a soft circular tap target), a
 * 3-segment horizontal progress bar highlighting filled steps, and a
 * "{current}/{total}" caption on the right. Aligned with the Wanted v6
 * hand-off (auth-signup-steps.jsx SignupHeader): segment bars, not dots.
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

  const segments = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.backSlot}>
        {onBack ? (
          <TouchableOpacity
            testID={`${testID}-back`}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(112,115,124,0.08)',
              },
            ]}
          >
            <ChevronLeft size={22} color={semantic.labelStrong} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View
        style={styles.gauge}
        accessibilityRole="progressbar"
        accessibilityLabel={`회원가입 ${currentStep}단계, 전체 ${totalSteps}단계`}
        testID={`${testID}-gauge`}
      >
        {segments.map((step) => {
          const isFilled = step <= currentStep;
          const segStyle: ViewStyle = {
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: isFilled
              ? semantic.primaryNormal
              : isDark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(112,115,124,0.18)',
            marginHorizontal: 2,
          };
          return <View key={step} style={segStyle} testID={`${testID}-segment-${step}`} />;
        })}
      </View>

      <View style={styles.counterSlot}>
        <Text
          style={[
            styles.counter,
            { color: semantic.labelAlt, fontFamily: weightToFontFamily('800') },
          ]}
          testID={`${testID}-counter`}
        >
          {currentStep} / {totalSteps}
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
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s1,
    height: 52,
    gap: WANTED_TOKENS.spacing.s3,
  },
  backSlot: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gauge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterSlot: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
  counter: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.22,
  },
});

export default SignupHeader;
