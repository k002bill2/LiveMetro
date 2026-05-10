/**
 * CommuteTimeScreen — onboarding step 3/5 (출근 시간 설정).
 *
 * Sits between CommuteRoute (route picker) and NotificationPermission so
 * the user can set their typical departure time before alert toggles ask
 * about timing-dependent notifications. Reuses the design-system
 * TimePickerCard so the visual contract is identical to the same control
 * in CommuteSettings (image 17).
 *
 * Data flow:
 *   - Receives `route: OnboardingRouteData` from CommuteRoute. The default
 *     departureTime ('08:00') comes pre-loaded; the user can override it
 *     via the chip selector.
 *   - On "다음 단계" → forwards the same shape to NotificationPermission
 *     with the updated departureTime. No persistence here — the final
 *     commit happens in FavoritesOnboarding via saveCommuteRoutes().
 */
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { TimePickerCard } from '@/components/settings/TimePickerCard';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';
import { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CommuteTime'>;

// Same chip set as CommuteSettings — 30-minute increments around the
// typical morning + evening commute windows.
const MORNING_TIME_OPTIONS: readonly string[] = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00',
];
const EVENING_TIME_OPTIONS: readonly string[] = [
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
];
const FALLBACK_EVENING_TIME = '18:30';

export const CommuteTimeScreen: React.FC<Props> = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { onSkip } = useOnboardingCallbacks();

  const [departureTime, setDepartureTime] = useState<string>(
    route.params.route.departureTime,
  );
  const [eveningDepartureTime, setEveningDepartureTime] = useState<string>(
    route.params.route.eveningDepartureTime ?? FALLBACK_EVENING_TIME,
  );

  const handleNext = useCallback(() => {
    navigation.navigate('NotificationPermission', {
      route: {
        ...route.params.route,
        departureTime,
        eveningDepartureTime,
      },
    });
  }, [navigation, route.params.route, departureTime, eveningDepartureTime]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: semantic.bgBase }]}
      testID="commute-time"
    >
      <OnbHeader
        currentStep={3}
        totalSteps={5}
        onBack={() => navigation.canGoBack() && navigation.goBack()}
        onSkip={onSkip}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text
          style={[styles.eyebrow, { color: semantic.primaryNormal }]}
          testID="commute-time-eyebrow"
        >
          STEP 3 / 5 · 시간 설정
        </Text>
        <Text
          style={[
            styles.title,
            { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
          ]}
          testID="commute-time-title"
        >
          {'출근 시간을\n알려주세요'}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
          ]}
        >
          {'평소 출퇴근 시간을 선택해주세요.\n언제든 설정에서 바꿀 수 있어요.'}
        </Text>

        <View style={styles.pickerWrap}>
          <TimePickerCard
            testID="commute-time-picker"
            title="출근 시간"
            subtitle="평일 기준"
            value={departureTime}
            options={MORNING_TIME_OPTIONS}
            onChange={setDepartureTime}
          />
          <TimePickerCard
            testID="commute-time-picker-evening"
            title="퇴근 시간"
            subtitle="평일 기준"
            value={eveningDepartureTime}
            options={EVENING_TIME_OPTIONS}
            onChange={setEveningDepartureTime}
          />
        </View>

        <TouchableOpacity
          testID="commute-time-cta"
          style={[
            styles.primary,
            {
              backgroundColor: semantic.primaryNormal,
              shadowColor: semantic.primaryNormal,
            },
          ]}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel="다음 단계"
        >
          <Text
            style={[
              styles.primaryLabel,
              { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') },
            ]}
          >
            다음 단계
          </Text>
          <ArrowRight size={18} color={semantic.labelOnColor} strokeWidth={2.4} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s2,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.55,
  },
  title: {
    marginTop: 6,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  // TimePickerCard already provides its own outer card padding/style; we
  // just give it a vertical breathing room inside the screen body.
  pickerWrap: {
    marginTop: WANTED_TOKENS.spacing.s2,
    marginHorizontal: -WANTED_TOKENS.spacing.s4,
  },
  primary: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: WANTED_TOKENS.spacing.s6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  primaryLabel: {
    fontSize: 16,
    letterSpacing: -0.16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
});

export default CommuteTimeScreen;
