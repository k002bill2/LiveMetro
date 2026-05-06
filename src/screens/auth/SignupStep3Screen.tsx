/**
 * SignupStep3Screen — 회원가입 3/3 (가입 완료 celebration).
 *
 * Lives in the post-auth/!hasCompletedOnboarding stack as `initialRoute`
 * when `hasSeenSignupCelebration === false`. Both the primary CTA and the
 * secondary "나중에 할게요" button mark the celebration seen and route to
 * OnboardingNavigator — copy differs but the destination is identical to
 * stay compatible with the RootNavigator gate.
 *
 * Synced with the Wanted v6 hand-off (auth-signup-steps.jsx:236): SignupHeader
 * (no back chevron), nested-ring hero with single outer pulse, avatar-first
 * summary card, grouped icon checklist, dashed gradient bonus banner.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  Gift,
  Star,
  TrainFront,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { SignupHeader } from '@/components/auth/SignupHeader';
import {
  enableBiometricLogin,
  getBiometricTypeName,
  isBiometricAvailable,
  isBiometricLoginEnabled,
} from '@/services/auth/biometricService';
import { consumePendingBiometricCredentials } from '@/services/auth/pendingBiometricSetup';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ChecklistTone = 'next' | 'todo';

interface ChecklistItem {
  id: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  tone: ChecklistTone;
}

const CHECKLIST: readonly ChecklistItem[] = [
  { id: 'commute', label: '출퇴근 경로 등록', sub: '집·회사 역만 골라주세요', icon: TrainFront, tone: 'next' },
  { id: 'alerts', label: '알림 시간 설정', sub: '평소 출발 시간 기준', icon: Bell, tone: 'todo' },
  { id: 'favorites', label: '자주 가는 역 추가', sub: '즐겨찾기로 빠르게 확인', icon: Star, tone: 'todo' },
];

const PULSE_DURATION_MS = 1200;
const HERO_SIZE = 160;
const RING_INSET_MID = 18;
const RING_INSET_CORE = 36;
const AVATAR_SIZE = 44;

export const SignupStep3Screen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { user, firebaseUser } = useAuth();
  const { markCelebrationSeen } = useOnboarding();

  const [submitting, setSubmitting] = useState(false);

  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseValue]);

  // Drop any stashed biometric credentials if the user leaves this screen
  // without tapping a CTA. handleCta consumes them on the happy path.
  useEffect(() => {
    return () => {
      consumePendingBiometricCredentials();
    };
  }, []);

  const promptBiometricSetup = useCallback(async (): Promise<void> => {
    const creds = consumePendingBiometricCredentials();
    if (!creds) return;
    try {
      const available = await isBiometricAvailable();
      if (!available) return;
      const enabled = await isBiometricLoginEnabled();
      if (enabled) return;
      const typeName = await getBiometricTypeName();
      await new Promise<void>((resolve) => {
        Alert.alert(
          `${typeName} 설정`,
          `다음에 ${typeName}로 빠르게 로그인하시겠습니까?`,
          [
            { text: '나중에', style: 'cancel', onPress: () => resolve() },
            {
              text: '설정하기',
              onPress: async () => {
                const success = await enableBiometricLogin(creds.email, creds.password);
                if (success) {
                  await new Promise<void>((doneResolve) => {
                    Alert.alert(
                      '완료',
                      `${typeName} 로그인이 활성화되었습니다.`,
                      [{ text: '확인', onPress: () => doneResolve() }],
                      { onDismiss: () => doneResolve() },
                    );
                  });
                }
                resolve();
              },
            },
          ],
          { onDismiss: () => resolve() },
        );
      });
    } catch (err) {
      console.error('Biometric setup prompt error:', err);
    }
  }, []);

  const handleCta = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await promptBiometricSetup();
      await markCelebrationSeen();
      navigation.navigate('Onboarding');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, promptBiometricSetup, markCelebrationSeen, navigation]);

  // Defensive fallback: '익명 사용자' is the AuthContext default for a
  // phone-only Firebase user with no displayName set yet (createOrGetUser-
  // Document line 137/150). On the celebration screen that label feels
  // unwelcoming, so we treat it as "no name set" and substitute '신규
  // 사용자'. When the user has actually set a nickname via SignupStep2's
  // linkEmailToCurrentUser, displayName holds their real name and this
  // branch is skipped.
  const rawName = user?.displayName ?? '';
  const displayName =
    rawName && rawName !== '익명 사용자' ? rawName : '신규 사용자';
  const email = user?.email ?? '';
  const phoneNumber = firebaseUser?.phoneNumber ?? '';
  // Phone-only users land here without an email. Fall back to a masked
  // phone (010-****-XXXX) so the summary card has a meaningful identifier
  // rather than an empty row. Korean E.164 (+82) is normalized to 010-…
  // before masking.
  const maskedPhone = phoneNumber
    ? phoneNumber.replace(/^\+82/, '0').replace(/^(\d{3})\d{4}(\d{4}).*$/, '$1-****-$2')
    : '';
  const contactLabel = email || maskedPhone;
  const avatarInitial = displayName.charAt(0) || '?';

  const pulseScale = pulseValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]} testID="signup-step3">
      <SignupHeader currentStep={3} testID="signup-step3-header" />

      <ScrollView contentContainerStyle={styles.body}>
        {/* Hero — nested rings + animated outer pulse + check core */}
        <View style={styles.heroWrap} testID="signup-step3-hero">
          <View style={styles.hero}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ringOuter,
                {
                  backgroundColor: isDark ? 'rgba(51,133,255,0.10)' : 'rgba(0,102,255,0.06)',
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.ringMid,
                {
                  backgroundColor: isDark ? 'rgba(51,133,255,0.18)' : 'rgba(0,102,255,0.12)',
                },
              ]}
            />
            <View style={[styles.ringCore, { backgroundColor: semantic.primaryNormal }]}>
              <Check size={48} color={semantic.labelOnColor} strokeWidth={3} />
            </View>
          </View>
        </View>

        {/* Greeting */}
        <Text
          style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
          testID="signup-step3-title"
        >
          환영해요, {displayName}님
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
          testID="signup-step3-subtitle"
        >
          가입이 완료되었어요.{'\n'}출퇴근을 더 똑똑하게 만들 준비가 끝났어요.
        </Text>

        {/* Account summary card — avatar + name/email + verify pill */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
          ]}
          testID="signup-step3-summary"
        >
          <LinearGradient
            colors={['#0066FF', '#6FA8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text
              style={[styles.avatarLabel, { fontFamily: weightToFontFamily('800') }]}
              testID="signup-step3-avatar-initial"
            >
              {avatarInitial}
            </Text>
          </LinearGradient>
          <View style={styles.summaryText}>
            <Text
              style={[styles.summaryName, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {contactLabel ? (
              <Text
                style={[styles.summaryEmail, { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') }]}
                numberOfLines={1}
                testID="signup-step3-contact"
              >
                {contactLabel}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.verifyPill,
              { backgroundColor: isDark ? 'rgba(0,191,64,0.18)' : 'rgba(0,191,64,0.10)' },
            ]}
            testID="signup-step3-verify-badge"
          >
            <BadgeCheck size={11} color={semantic.statusPositive} strokeWidth={2.4} />
            <Text
              style={[styles.verifyText, { color: semantic.statusPositive, fontFamily: weightToFontFamily('700') }]}
            >
              인증 완료
            </Text>
          </View>
        </View>

        {/* Next-up checklist */}
        <Text
          style={[styles.sectionLabel, { color: semantic.labelAlt, fontFamily: weightToFontFamily('800') }]}
          testID="signup-step3-checklist-label"
        >
          다음 단계 · 1분이면 끝나요
        </Text>
        <View
          style={[
            styles.checklistCard,
            { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle },
          ]}
          testID="signup-step3-checklist"
        >
          {CHECKLIST.map((item, i) => {
            const Icon = item.icon;
            const isLast = i === CHECKLIST.length - 1;
            const isNext = item.tone === 'next';
            return (
              <View
                key={item.id}
                style={[
                  styles.checklistRow,
                  !isLast && { borderBottomColor: semantic.lineSubtle, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
                testID={`checklist-${item.id}`}
              >
                <View
                  style={[
                    styles.checklistIcon,
                    { backgroundColor: isNext ? semantic.primaryNormal : semantic.bgSubtle },
                  ]}
                >
                  <Icon
                    size={18}
                    color={isNext ? semantic.labelOnColor : semantic.labelNeutral}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.checklistText}>
                  <Text
                    style={[
                      styles.checklistLabel,
                      { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.checklistSub,
                      { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
                    ]}
                  >
                    {item.sub}
                  </Text>
                </View>
                {isNext ? (
                  <View style={[styles.nowPill, { backgroundColor: semantic.primaryNormal }]}>
                    <Text
                      style={[
                        styles.nowPillLabel,
                        { color: semantic.labelOnColor, fontFamily: weightToFontFamily('700') },
                      ]}
                    >
                      지금
                    </Text>
                  </View>
                ) : (
                  <ChevronRight size={16} color={semantic.labelAlt} strokeWidth={2} />
                )}
              </View>
            );
          })}
        </View>

        {/* Welcome bonus — dashed gradient banner */}
        <View
          style={[
            styles.bonusFrame,
            { borderColor: isDark ? 'rgba(51,133,255,0.45)' : 'rgba(0,102,255,0.30)' },
          ]}
          testID="signup-step3-bonus"
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(51,133,255,0.18)', 'rgba(124,58,237,0.14)']
                : ['rgba(0,102,255,0.10)', 'rgba(124,58,237,0.08)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bonusInner}
          >
            <Gift size={18} color={semantic.primaryNormal} strokeWidth={2.2} />
            <Text
              style={[styles.bonusText, { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') }]}
            >
              첫 가입 보너스{' '}
              <Text style={{ color: semantic.primaryNormal, fontFamily: weightToFontFamily('800') }}>
                30일 ML 예측 무제한
              </Text>{' '}
              활성화됨
            </Text>
          </LinearGradient>
        </View>

        {/* CTAs — primary + ghost. Both proceed to Onboarding (gate-safe). */}
        <TouchableOpacity
          testID="signup-step3-cta"
          style={[
            styles.primary,
            { backgroundColor: submitting ? semantic.primaryHover : semantic.primaryNormal },
          ]}
          onPress={handleCta}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="출퇴근 설정하러 가기"
        >
          <Text
            style={[styles.primaryLabel, { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') }]}
          >
            {submitting ? '진행 중…' : '출퇴근 설정하러 가기'}
          </Text>
          {!submitting && (
            <ArrowRight size={18} color={semantic.labelOnColor} strokeWidth={2.4} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID="signup-step3-cta-secondary"
          style={styles.secondary}
          onPress={handleCta}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="나중에 할게요, 홈으로 이동"
        >
          <Text
            style={[styles.secondaryLabel, { color: semantic.labelAlt, fontFamily: weightToFontFamily('700') }]}
          >
            나중에 할게요 · 홈으로
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
  heroWrap: {
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s4,
  },
  hero: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
  },
  ringMid: {
    position: 'absolute',
    top: RING_INSET_MID,
    left: RING_INSET_MID,
    right: RING_INSET_MID,
    bottom: RING_INSET_MID,
    borderRadius: (HERO_SIZE - RING_INSET_MID * 2) / 2,
  },
  ringCore: {
    position: 'absolute',
    top: RING_INSET_CORE,
    left: RING_INSET_CORE,
    right: RING_INSET_CORE,
    bottom: RING_INSET_CORE,
    borderRadius: (HERO_SIZE - RING_INSET_CORE * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  title: {
    marginTop: WANTED_TOKENS.spacing.s4,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: WANTED_TOKENS.spacing.s5,
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r8,
    borderWidth: 1,
    gap: WANTED_TOKENS.spacing.s3,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryName: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  summaryEmail: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 4,
    borderRadius: WANTED_TOKENS.radius.pill,
  },
  verifyText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  sectionLabel: {
    marginTop: WANTED_TOKENS.spacing.s6,
    marginBottom: WANTED_TOKENS.spacing.s3,
    fontSize: 12,
    letterSpacing: 0.48,
    textTransform: 'uppercase',
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  checklistCard: {
    borderRadius: WANTED_TOKENS.radius.r8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    gap: WANTED_TOKENS.spacing.s3,
  },
  checklistIcon: {
    width: 36,
    height: 36,
    borderRadius: WANTED_TOKENS.radius.r5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistText: {
    flex: 1,
  },
  checklistLabel: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  checklistSub: {
    marginTop: 1,
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  nowPill: {
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 4,
    borderRadius: WANTED_TOKENS.radius.pill,
  },
  nowPillLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  bonusFrame: {
    marginTop: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  bonusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
  },
  bonusText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  primary: {
    flexDirection: 'row',
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: WANTED_TOKENS.spacing.s2,
    marginTop: WANTED_TOKENS.spacing.s6,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryLabel: {
    fontSize: 16,
    letterSpacing: -0.16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  secondary: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s2,
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
});

export default SignupStep3Screen;
