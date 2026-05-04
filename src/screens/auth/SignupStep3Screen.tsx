/**
 * SignupStep3Screen — 회원가입 3/3 (가입 완료 celebration).
 *
 * Lives in the post-auth/!hasCompletedOnboarding stack as `initialRoute`
 * when `hasSeenSignupCelebration === false`. CTA marks the celebration
 * seen (AsyncStorage) and routes to OnboardingNavigator.
 *
 * Pulse hero animates 3 staggered concentric rings; the rest is a static
 * summary card + 3-item next-steps checklist + bonus banner.
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
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ChecklistItem {
  id: string;
  label: string;
  active: boolean;
}

const CHECKLIST: readonly ChecklistItem[] = [
  { id: 'commute', label: '출퇴근 경로 설정', active: true },
  { id: 'alerts', label: '알림 시간 설정', active: false },
  { id: 'favorites', label: '즐겨찾기 역 추가', active: false },
];

const RING_COUNT = 3;
const RING_DURATION_MS = 1800;
const RING_STAGGER_MS = 600;

export const SignupStep3Screen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { markCelebrationSeen } = useOnboarding();

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

  const handleCta = useCallback(async () => {
    await markCelebrationSeen();
    navigation.navigate('Onboarding');
  }, [markCelebrationSeen, navigation]);

  const displayName = user?.displayName ?? '신규 사용자';
  const email = user?.email ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]} testID="signup-step3">
      <ScrollView contentContainerStyle={styles.body}>
        {/* Pulse hero */}
        <View style={styles.hero} testID="signup-step3-hero">
          {ringValues.map((v, i) => {
            const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
            const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
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
            <CheckCircle2 size={56} color={semantic.labelOnColor} strokeWidth={2.4} />
          </View>
        </View>

        <Text
          style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
          testID="signup-step3-title"
        >
          가입이 완료되었어요!
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
        >
          {displayName}님, LiveMetro에 오신 것을 환영합니다
        </Text>

        {/* Account summary card */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
          ]}
          testID="signup-step3-summary"
        >
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}>
              이름
            </Text>
            <Text style={[styles.summaryValue, { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') }]}>
              {displayName}
            </Text>
          </View>
          {email ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}>
                이메일
              </Text>
              <Text
                style={[styles.summaryValue, { color: semantic.labelStrong, fontFamily: weightToFontFamily('600') }]}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.verifyBadge,
              {
                backgroundColor: isDark ? 'rgba(0,191,64,0.16)' : 'rgba(0,191,64,0.10)',
              },
            ]}
            testID="signup-step3-verify-badge"
          >
            <CheckCircle2 size={14} color={semantic.statusPositive} strokeWidth={2.4} />
            <Text
              style={[styles.verifyText, { color: semantic.statusPositive, fontFamily: weightToFontFamily('700') }]}
            >
              본인 인증 완료
            </Text>
          </View>
        </View>

        {/* Next steps checklist */}
        <Text
          style={[styles.sectionLabel, { color: semantic.labelNormal, fontFamily: weightToFontFamily('700') }]}
        >
          다음 단계
        </Text>
        <View style={styles.checklist} testID="signup-step3-checklist">
          {CHECKLIST.map((item) => (
            <View
              key={item.id}
              style={[
                styles.checklistItem,
                {
                  backgroundColor: semantic.bgBase,
                  borderColor: item.active ? semantic.primaryNormal : semantic.lineSubtle,
                  borderWidth: item.active ? 1.5 : 1,
                },
              ]}
              testID={`checklist-${item.id}`}
            >
              <View
                style={[
                  styles.checklistDot,
                  {
                    backgroundColor: item.active ? semantic.primaryNormal : 'transparent',
                    borderColor: item.active ? semantic.primaryNormal : semantic.lineNormal,
                  },
                ]}
              />
              <Text
                style={[
                  styles.checklistLabel,
                  {
                    color: item.active ? semantic.labelStrong : semantic.labelAlt,
                    fontFamily: weightToFontFamily(item.active ? '700' : '500'),
                  },
                ]}
              >
                {item.label}
              </Text>
              {item.active ? (
                <ChevronRight size={18} color={semantic.primaryNormal} strokeWidth={2.2} />
              ) : (
                <Text
                  style={[styles.checklistTodo, { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') }]}
                >
                  나중에
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Bonus banner */}
        <View style={styles.bonusWrap} testID="signup-step3-bonus">
          <LinearGradient
            colors={['#0066FF', '#0044BB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bonus}
          >
            <View style={styles.bonusTagRow}>
              <Sparkles size={14} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={[styles.bonusTag, { fontFamily: weightToFontFamily('700') }]}>
                신규 가입 혜택
              </Text>
            </View>
            <Text style={[styles.bonusTitle, { fontFamily: weightToFontFamily('800') }]}>
              30일 ML 예측 무제한
            </Text>
            <Text style={[styles.bonusSub, { fontFamily: weightToFontFamily('500') }]}>
              출퇴근 경로 설정 후 바로 사용할 수 있어요
            </Text>
          </LinearGradient>
        </View>

        <TouchableOpacity
          testID="signup-step3-cta"
          style={[styles.primary, { backgroundColor: semantic.primaryNormal }]}
          onPress={handleCta}
          accessibilityRole="button"
          accessibilityLabel="출퇴근 설정하러 가기"
        >
          <Text
            style={[styles.primaryLabel, { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') }]}
          >
            출퇴근 설정하러 가기
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const RING_SIZE = 96;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s6,
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
  title: {
    marginTop: WANTED_TOKENS.spacing.s4,
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
  summaryCard: {
    marginTop: WANTED_TOKENS.spacing.s6,
    padding: WANTED_TOKENS.spacing.s5,
    borderRadius: WANTED_TOKENS.radius.r8,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  summaryLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  summaryValue: {
    flex: 1,
    marginLeft: WANTED_TOKENS.spacing.s4,
    textAlign: 'right',
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: 6,
    borderRadius: WANTED_TOKENS.radius.pill,
    marginTop: WANTED_TOKENS.spacing.s2,
  },
  verifyText: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  sectionLabel: {
    marginTop: WANTED_TOKENS.spacing.s6,
    marginBottom: WANTED_TOKENS.spacing.s3,
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  checklist: {
    gap: WANTED_TOKENS.spacing.s2,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s4,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
  },
  checklistDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    marginRight: WANTED_TOKENS.spacing.s3,
  },
  checklistLabel: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.body2.size,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  checklistTodo: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  bonusWrap: {
    marginTop: WANTED_TOKENS.spacing.s6,
  },
  bonus: {
    padding: WANTED_TOKENS.spacing.s5,
    borderRadius: WANTED_TOKENS.radius.r8,
  },
  bonusTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bonusTag: {
    color: '#FFFFFF',
    fontSize: WANTED_TOKENS.type.caption1.size,
    letterSpacing: 0.4,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  bonusTitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  bonusSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.85)',
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  primary: {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s8,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
});

export default SignupStep3Screen;
