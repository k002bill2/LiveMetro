/**
 * WelcomeOnboardingScreen — onboarding step 1/4 (시작 전 안내).
 *
 * Layout (top → bottom):
 *  - OnbHeader (step 1, no back / no skip — entry screen)
 *  - WelcomeHero (3 weaving curves + center pin, see WelcomeHero.tsx)
 *  - STEP eyebrow + 2-line title + subtitle (Wanted handoff copy)
 *  - 3 value-prop cards (nearby search / ML prediction / delay alerts)
 *  - Privacy notice card
 *  - Primary CTA "시작하기 →" → navigate('CommuteRoute')
 *
 * The pulse animation was replaced by a static SVG weave per the Wanted
 * design — the static treatment matches the rest of the onboarding's calm
 * pace and keeps the focal point on the title/CTA rather than motion.
 */
import React, { useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowRight,
  BellRing,
  MapPin,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { WelcomeHero } from '@/components/onboarding/WelcomeHero';
import { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WelcomeOnboarding'>;

interface ValueProp {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
}

// Wanted handoff: three card icons match the value-prop tints used on the
// design system (blue=primary feature, violet=ML/AI, amber=alert/warn).
const VALUE_PROPS: readonly ValueProp[] = [
  {
    id: 'nearby',
    icon: MapPin,
    iconBg: 'rgba(0,102,255,0.12)',
    iconFg: '#0066FF',
    title: '주변 역 자동 검색',
    body: '근처 지하철역을 찾아 표시해요',
  },
  {
    id: 'ml',
    icon: Sparkles,
    iconBg: 'rgba(151,71,255,0.14)',
    iconFg: '#7C3AED',
    title: 'ML 출퇴근 예측',
    body: '내 패턴을 학습해 ±3분 정확도',
  },
  {
    id: 'alerts',
    icon: BellRing,
    iconBg: 'rgba(255,180,0,0.18)',
    iconFg: '#A06A00',
    title: '실시간 지연 알림',
    body: '내 노선 지연을 즉시 알려드려요',
  },
];

export const WelcomeOnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const handleStart = useCallback(() => {
    navigation.navigate('CommuteRoute');
  }, [navigation]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: semantic.bgBase }]}
      testID="welcome-onboarding"
    >
      <OnbHeader currentStep={1} />
      <ScrollView contentContainerStyle={styles.body}>
        <WelcomeHero
          primaryColor={semantic.primaryNormal}
          pinIconColor={semantic.labelOnColor}
          isDark={isDark}
        />

        <Text
          style={[styles.stepEyebrow, { color: semantic.primaryNormal }]}
          testID="welcome-eyebrow"
          accessibilityRole="text"
        >
          STEP 1 / 5
        </Text>
        <Text
          style={[
            styles.title,
            { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
          ]}
          testID="welcome-title"
        >
          {'시작 전에\n몇 가지만 확인할게요'}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
          ]}
        >
          {'더 정확한 출퇴근 예측을 위해\n아래 정보가 필요해요. 1분이면 끝나요.'}
        </Text>

        <View style={styles.cards} testID="welcome-cards">
          {VALUE_PROPS.map((p) => {
            const Icon = p.icon;
            return (
              <View
                key={p.id}
                style={[
                  styles.card,
                  { backgroundColor: semantic.bgSubtlePage, borderColor: semantic.lineSubtle },
                ]}
                testID={`welcome-card-${p.id}`}
              >
                <View style={[styles.cardIcon, { backgroundColor: p.iconBg }]}>
                  <Icon size={20} color={p.iconFg} strokeWidth={2.2} />
                </View>
                <View style={styles.cardBody}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
                    ]}
                  >
                    {p.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardCopy,
                      { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
                    ]}
                  >
                    {p.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.privacyBox,
            { backgroundColor: semantic.bgSubtlePage, borderColor: semantic.lineSubtle },
          ]}
          testID="welcome-privacy"
        >
          <ShieldCheck size={14} color={semantic.labelAlt} strokeWidth={2.2} />
          <Text
            style={[
              styles.privacyText,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
            ]}
          >
            {'모든 정보는 기기에만 저장되며,\n언제든지 설정에서 변경할 수 있어요.'}
          </Text>
        </View>

        <TouchableOpacity
          testID="welcome-cta"
          style={[
            styles.primary,
            { backgroundColor: semantic.primaryNormal, shadowColor: semantic.primaryNormal },
          ]}
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel="시작하기"
        >
          <Text
            style={[
              styles.primaryLabel,
              { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') },
            ]}
          >
            시작하기
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
  stepEyebrow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.55,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  cards: {
    marginTop: WANTED_TOKENS.spacing.s5,
    gap: WANTED_TOKENS.spacing.s2 + 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: WANTED_TOKENS.spacing.s3,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  cardCopy: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  privacyBox: {
    marginTop: WANTED_TOKENS.spacing.s5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
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
    elevation: 8,
  },
  primaryLabel: {
    fontSize: 16,
    letterSpacing: -0.16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
});

export default WelcomeOnboardingScreen;
