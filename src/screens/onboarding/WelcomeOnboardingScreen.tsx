/**
 * WelcomeOnboardingScreen — onboarding step 1/4 (환영).
 *
 * Entry screen of the redefined onboarding flow
 * (Welcome → CommuteRoute → NotificationPermission → Favorites).
 *
 * Layout (top → bottom):
 *  - OnbHeader (step 1, no back / no skip — entry screen)
 *  - Brand pulse hero (3 staggered concentric rings + center pin)
 *  - Title + subtitle
 *  - 3 value-proposition cards (nearby stations / ML prediction / delay alerts)
 *  - Privacy microcopy
 *  - Primary CTA "시작하기" → navigate('CommuteRoute')
 *
 * Pulse pattern reused from `src/screens/auth/SignupStep3Screen.tsx:72-95`
 * (3 rings × stagger 600ms × loop, useNativeDriver).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BellRing, MapPin, ShieldCheck, Sparkles, LucideIcon } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
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

const VALUE_PROPS: readonly ValueProp[] = [
  {
    id: 'nearby',
    icon: MapPin,
    iconBg: 'rgba(0,102,255,0.12)',
    iconFg: '#0066FF',
    title: '주변 역 자동 인식',
    body: 'GPS로 가까운 역의 실시간 도착 정보를 한눈에 확인합니다',
  },
  {
    id: 'ml',
    icon: Sparkles,
    iconBg: 'rgba(124,58,237,0.12)',
    iconFg: '#7C3AED',
    title: 'ML 출퇴근 예측',
    body: '오늘 몇 분 걸릴지 신뢰구간과 함께 알려드립니다',
  },
  {
    id: 'alerts',
    icon: BellRing,
    iconBg: 'rgba(255,180,0,0.16)',
    iconFg: '#A06A00',
    title: '지연·운행 정보 알림',
    body: '내가 자주 타는 노선의 변동 사항을 즉시 받아봅니다',
  },
];

const RING_COUNT = 3;
const RING_DURATION_MS = 1800;
const RING_STAGGER_MS = 600;
const RING_SIZE = 96;

export const WelcomeOnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const ringValues = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const animations = ringValues.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RING_STAGGER_MS),
          Animated.timing(v, {
            toValue: 1,
            duration: RING_DURATION_MS,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [ringValues]);

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
        {/* Pulse hero — abstract line graphic + center pin */}
        <View style={styles.hero} testID="welcome-hero">
          {ringValues.map((v, i) => {
            const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
            const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] });
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[
                  styles.ring,
                  {
                    backgroundColor: semantic.primaryNormal,
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              />
            );
          })}
          <View style={[styles.ringCore, { backgroundColor: semantic.primaryNormal }]}>
            <MapPin size={36} color={semantic.labelOnColor} strokeWidth={2.4} />
          </View>
        </View>

        <Text
          style={[styles.stepEyebrow, { color: semantic.primaryNormal }]}
          testID="welcome-eyebrow"
          accessibilityRole="text"
        >
          STEP 1 / 4
        </Text>
        <Text
          style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
          testID="welcome-title"
        >
          서울 지하철, 더 똑똑하게
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
        >
          LiveMetro가 매일의 출퇴근을 도와드릴게요
        </Text>

        <View style={styles.cards} testID="welcome-cards">
          {VALUE_PROPS.map((p) => {
            const Icon = p.icon;
            return (
              <View
                key={p.id}
                style={[
                  styles.card,
                  { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
                ]}
                testID={`welcome-card-${p.id}`}
              >
                <View
                  style={[styles.cardIcon, { backgroundColor: p.iconBg }]}
                >
                  <Icon size={20} color={p.iconFg} strokeWidth={2.2} />
                </View>
                <View style={styles.cardBody}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
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
          style={[styles.privacyBox, { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle }]}
          testID="welcome-privacy"
        >
          <ShieldCheck size={14} color={semantic.labelAlt} strokeWidth={2.2} />
          <Text
            style={[styles.privacyText, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
          >
            위치, 알림 등 권한은 다음 단계에서 안내합니다.
          </Text>
        </View>

        <TouchableOpacity
          testID="welcome-cta"
          style={[styles.primary, { backgroundColor: semantic.primaryNormal }]}
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
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  hero: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  ringCore: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepEyebrow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.55,
  },
  title: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: WANTED_TOKENS.type.title3.size,
    lineHeight: WANTED_TOKENS.type.title3.lh,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    textAlign: 'center',
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  cards: {
    marginTop: WANTED_TOKENS.spacing.s6,
    gap: WANTED_TOKENS.spacing.s3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
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
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  cardCopy: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  privacyBox: {
    marginTop: WANTED_TOKENS.spacing.s6,
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
    lineHeight: 11.5 * 1.5,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  primary: {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s5,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
});

export default WelcomeOnboardingScreen;
