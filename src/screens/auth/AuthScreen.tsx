/**
 * AuthScreen — entry-point auth screen (Wanted Design System).
 *
 * Phase 8 rewrite: lightweight orchestrator that mirrors the Wanted handoff's
 * LoginScreen 1:1. Heavy email/password and signup flows live in
 *   - EmailLoginScreen
 *   - SignUpScreen
 *
 * The legacy 679-line implementation is replaced by this orchestrator + the
 * five atomic components in `src/components/auth/`.
 *
 * Removed (per the design contract):
 *   - Inline email/password form (moved to EmailLoginScreen)
 *   - Auto-login checkbox (moved to EmailLoginScreen)
 *   - Forgot-password link (moved to EmailLoginScreen)
 *   - Sign-up toggle (now SignUpScreen)
 *
 * Added:
 *   - LoginHero        (illustration + wordmark)
 *   - FaceIDButton     (always visible; falls back to email if not configured)
 *   - SocialButton x3  (placeholder UI — backend follow-up)
 *   - OrDivider        ("간편 로그인")
 *   - TermsFooter      (ToS / privacy micro-copy)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';
import { ChevronRight, Eye, Mail } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

import { useAuth } from '@/services/auth/AuthContext';
import { isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName, performBiometricLogin } from '@/services/auth/biometricService';
import { LoginHero } from '@/components/auth/LoginHero';
import { FaceIDButton } from '@/components/auth/FaceIDButton';
import { SocialButton, type SocialProvider } from '@/components/auth/SocialButton';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { OrDivider } from '@/components/auth/OrDivider';
import { TermsFooter } from '@/components/auth/TermsFooter';
import { AppStackParamList } from '@/navigation/types';
import { useAppleAuthAvailability } from '@/hooks/useAppleAuthAvailability';
import { isSocialAuthError, type SocialSignInResult } from '@/services/auth/social/types';

const AUTO_LOGIN_ENABLED_KEY = '@livemetro_auto_login_enabled';
const AUTO_LOGIN_EMAIL_KEY = 'livemetro_auto_login_email';
const AUTO_LOGIN_PASSWORD_KEY = 'livemetro_auto_login_password';

const TOS_URL = 'https://livemetro.app/terms';
const PRIVACY_URL = 'https://livemetro.app/privacy';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export const AuthScreen: React.FC = () => {
  const semantic = useSemanticTokens();
  const navigation = useNavigation<Nav>();
  const {
    signInWithEmail,
    signInAnonymously,
    signInWithGoogle,
    signInWithApple,
    signInWithKakao,
  } = useAuth();
  const appleAvailable = useAppleAuthAvailability();

  const [biometricLabel, setBiometricLabel] = useState<string>('생체인증으로 계속하기');
  const [biometricVariant, setBiometricVariant] = useState<'face' | 'touch'>('face');
  const [autoLoggingIn, setAutoLoggingIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  // Any in-flight auth action (biometric/anonymous `loading` or a social login)
  // blocks every other auth entry point to prevent concurrent sign-ins.
  const busy = loading || socialLoading !== null;

  // Bootstrap: try silent auto-login + detect biometric type
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async (): Promise<void> => {
      try {
        const available = await isBiometricAvailable();
        if (available) {
          const typeName = await getBiometricTypeName();
          if (!cancelled) {
            setBiometricLabel(`${typeName}로 계속하기`);
            setBiometricVariant(typeName === 'Touch ID' ? 'touch' : 'face');
          }
        }
        const autoLoginPref = await AsyncStorage.getItem(AUTO_LOGIN_ENABLED_KEY);
        if (autoLoginPref === 'true') {
          const savedEmail = await SecureStore.getItemAsync(AUTO_LOGIN_EMAIL_KEY);
          const savedPassword = await SecureStore.getItemAsync(AUTO_LOGIN_PASSWORD_KEY);
          if (savedEmail && savedPassword && !cancelled) {
            try {
              await signInWithEmail(savedEmail, savedPassword);
              return;
            } catch {
              // Auto-login failed silently — fall through to UI
            }
          }
        }
      } catch (err) {
        console.error('Auth bootstrap error:', err);
      } finally {
        if (!cancelled) setAutoLoggingIn(false);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [signInWithEmail]);

  const handleBiometricLogin = useCallback(async () => {
    setLoading(true);
    try {
      const available = await isBiometricAvailable();
      if (!available) {
        Alert.alert(
          '생체인증 사용 불가',
          '디바이스에서 생체인증을 지원하지 않거나 활성화되어 있지 않습니다.\n이메일로 로그인 후 설정에서 활성화하세요.'
        );
        return;
      }
      const enabled = await isBiometricLoginEnabled();
      if (!enabled) {
        Alert.alert(
          '생체인증 미설정',
          '아직 생체인증이 등록되지 않았습니다. 이메일로 한 번 로그인하면 자동으로 설정 안내가 나타납니다.'
        );
        return;
      }
      const result = await performBiometricLogin();
      if (result.success && result.credentials) {
        await signInWithEmail(result.credentials.email, result.credentials.password);
      } else if (result.error && result.error !== 'fallback') {
        Alert.alert('인증 실패', result.error);
      }
    } catch (err) {
      console.error('Biometric login error:', err);
      Alert.alert('오류', '생체인증 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [signInWithEmail]);

  const runSocialLogin = useCallback(
    async (
      provider: SocialProvider,
      action: () => Promise<SocialSignInResult>,
    ): Promise<void> => {
      if (busy) {
        return;
      }
      setSocialLoading(provider);
      try {
        const result = await action();
        if (result.status === 'cancelled') {
          return;
        }
      } catch (err) {
        console.error('Social login error:', err);
        Alert.alert(
          '로그인 실패',
          isSocialAuthError(err)
            ? err.userMessage
            : '로그인 중 문제가 발생했습니다. 다시 시도해주세요.',
        );
      } finally {
        setSocialLoading(null);
      }
    },
    [busy],
  );

  const handleAppleLogin = useCallback(
    () => runSocialLogin('apple', signInWithApple),
    [runSocialLogin, signInWithApple],
  );

  const handleGoogleLogin = useCallback(
    () => runSocialLogin('google', signInWithGoogle),
    [runSocialLogin, signInWithGoogle],
  );

  const handleKakaoLogin = useCallback(
    () => runSocialLogin('kakao', signInWithKakao),
    [runSocialLogin, signInWithKakao],
  );

  const handleAnonymous = useCallback(async () => {
    try {
      setLoading(true);
      await signInAnonymously();
    } catch (err) {
      console.error('Anonymous sign in error:', err);
      Alert.alert('오류', '둘러보기 모드 진입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [signInAnonymously]);

  const openExternal = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      // silently ignore — link unavailable
    });
  }, []);

  if (autoLoggingIn) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]}>
        <View style={styles.autoLoginPanel} testID="auth-autologin">
          <Text style={[styles.autoLoginText, { color: semantic.labelNeutral }]}>
            자동 로그인 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const titleStyle: TextStyle = {
    fontSize: WANTED_TOKENS.type.heading1.size,
    lineHeight: WANTED_TOKENS.type.heading1.lh * 1.1,
    letterSpacing:
      WANTED_TOKENS.type.heading1.size * WANTED_TOKENS.type.heading1.tracking,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    color: semantic.labelStrong,
  };

  const subtitleStyle: TextStyle = {
    marginTop: 6,
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.size * 1.5,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    color: semantic.labelAlt,
  };

  const emailButtonStyle: ViewStyle = {
    marginTop: 10,
    height: 52,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: WANTED_TOKENS.spacing.s2,
    backgroundColor: 'transparent',
  };

  const emailButtonLabel: TextStyle = {
    color: semantic.labelStrong,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  };

  const browseButtonStyle: ViewStyle = {
    marginTop: WANTED_TOKENS.spacing.s5,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
  };

  const browseLabel: TextStyle = {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelNeutral,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <LoginHero testID="auth-hero" />

        <View style={styles.body}>
          <Text style={titleStyle}>출퇴근, 1초도 낭비 없이.</Text>
          <Text style={subtitleStyle}>
            내 출퇴근 패턴을 학습해 도착 시간을 예측하고,{'\n'}실시간 혼잡도와 지연 정보를 알려드려요.
          </Text>

          <View style={styles.faceCtaWrap}>
            <FaceIDButton
              label={biometricLabel}
              onPress={handleBiometricLogin}
              loading={busy}
              variant={biometricVariant}
              testID="face-cta"
            />
          </View>

          <TouchableOpacity
            testID="email-cta"
            style={emailButtonStyle}
            onPress={() => navigation.navigate('EmailLogin')}
            disabled={busy}
            accessible
            accessibilityRole="button"
            accessibilityLabel="이메일로 로그인"
            accessibilityState={{ disabled: busy }}
            activeOpacity={0.8}
          >
            <Mail size={18} color={semantic.labelStrong} strokeWidth={2} />
            <Text style={emailButtonLabel}>이메일로 로그인</Text>
          </TouchableOpacity>

          <View style={styles.dividerWrap}>
            <OrDivider label="간편 로그인" testID="auth-divider" />
          </View>

          <View style={styles.socialStack}>
            {appleAvailable && (
              <AppleSignInButton
                onPress={handleAppleLogin}
                disabled={busy && socialLoading !== 'apple'}
                testID="social-apple"
              />
            )}
            <SocialButton
              provider="google"
              label="Google로 계속하기"
              onPress={handleGoogleLogin}
              loading={socialLoading === 'google'}
              disabled={busy && socialLoading !== 'google'}
              testID="social-google"
            />
            <SocialButton
              provider="kakao"
              label="카카오로 계속하기"
              onPress={handleKakaoLogin}
              loading={socialLoading === 'kakao'}
              disabled={busy && socialLoading !== 'kakao'}
              testID="social-kakao"
            />
          </View>

          <TouchableOpacity
            testID="browse-cta"
            style={browseButtonStyle}
            onPress={handleAnonymous}
            disabled={busy}
            accessible
            accessibilityRole="button"
            accessibilityLabel="로그인 없이 둘러보기"
            accessibilityState={{ disabled: busy }}
          >
            <Eye size={15} color={semantic.labelNeutral} strokeWidth={2} />
            <Text style={browseLabel}>로그인 없이 둘러보기</Text>
            <ChevronRight size={14} color={semantic.labelNeutral} strokeWidth={2} />
          </TouchableOpacity>

          <TermsFooter
            onTermsPress={() => openExternal(TOS_URL)}
            onPrivacyPress={() => openExternal(PRIVACY_URL)}
            testID="auth-terms"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 0 },
  body: {
    flex: 1,
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: 28,
    paddingBottom: WANTED_TOKENS.spacing.s4,
  },
  faceCtaWrap: {
    marginTop: WANTED_TOKENS.spacing.s6,
  },
  dividerWrap: {
    marginTop: WANTED_TOKENS.spacing.s5,
  },
  socialStack: {
    marginTop: WANTED_TOKENS.spacing.s4,
    gap: WANTED_TOKENS.spacing.s2,
  },
  autoLoginPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoLoginText: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});

export default AuthScreen;
