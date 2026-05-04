/**
 * OnbHeader — shared progress indicator across the onboarding wizard
 * (Welcome → CommuteRoute → NotificationPermission → Favorites).
 *
 * Mirrors `src/components/auth/SignupHeader.tsx` structure (chevron + dot
 * gauge + counter) but adds a right-side "건너뛰기" text link, which the
 * onboarding flow exposes from step 2/4 onwards. Step 1/4 hides both back
 * and skip — it is the entry screen.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

export type OnbStep = 1 | 2 | 3 | 4;

interface OnbHeaderProps {
  currentStep: OnbStep;
  totalSteps?: 4;
  onBack?: () => void;
  onSkip?: () => void;
  testID?: string;
}

const TOTAL_DEFAULT: 4 = 4;

export const OnbHeader: React.FC<OnbHeaderProps> = ({
  currentStep,
  totalSteps = TOTAL_DEFAULT,
  onBack,
  onSkip,
  testID = 'onb-header',
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

      <View
        style={styles.gauge}
        accessibilityRole="progressbar"
        accessibilityLabel={`온보딩 ${currentStep}단계, 전체 ${totalSteps}단계`}
      >
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
        {onSkip ? (
          <TouchableOpacity
            testID={`${testID}-skip`}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="건너뛰기"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Text
              style={[
                styles.skipLabel,
                { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
              ]}
            >
              건너뛰기
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={[
              styles.counter,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
            ]}
            testID={`${testID}-counter`}
          >
            {currentStep}/{totalSteps}
          </Text>
        )}
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
    minWidth: 56,
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
  skipLabel: {
    fontSize: WANTED_TOKENS.type.label2.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    letterSpacing: 0.2,
  },
});

export default OnbHeader;
