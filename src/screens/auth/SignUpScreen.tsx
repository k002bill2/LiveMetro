/**
 * SignUpScreen — account creation flow split out of the legacy AuthScreen.
 *
 * Hosts the name + email + password form. Mirrors EmailLoginScreen's visual
 * language (Wanted tokens, large primary CTA).
 *
 * Two modes:
 * - 'create' (default): plain email/password signup via createUserWithEmailAndPassword.
 * - 'link': called after Step1 phone verification when auth.currentUser is a
 *   phone-only Firebase user. Uses linkWithCredential to attach email +
 *   password to the same user. Reaches this mode when registered as the
 *   `EmailLink` route in the post-auth/!hasCompletedOnboarding stack.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { analyzeAuthError, printFirebaseDebugInfo } from '@/utils/firebaseDebug';
import { AppStackParamList } from '@/navigation/types';
import { SignupHeader } from '@/components/auth/SignupHeader';
import { setPendingBiometricCredentials } from '@/services/auth/pendingBiometricSetup';

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type Nav = NativeStackNavigationProp<AppStackParamList>;

export type SignUpMode = 'create' | 'link';

interface SignUpScreenProps {
  mode?: SignUpMode;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ mode = 'create' }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { signUpWithEmail, linkEmailToCurrentUser } = useAuth();
  const isLinkMode = mode === 'link';

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('오류', '이메일을 입력해주세요.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      if (isLinkMode) {
        await linkEmailToCurrentUser(email.trim(), password, displayName.trim());
      } else {
        await signUpWithEmail(email.trim(), password, displayName.trim());
      }
      // Stash credentials so SignupStep3 can offer a biometric setup prompt
      // when the user taps the celebration CTA. The pending module clears
      // them after a single consume.
      setPendingBiometricCredentials({ email: email.trim(), password });
      // Auth state transition + SignupStep3 celebration handle the
      // post-success UX; no Alert here.
    } catch (err) {
      console.error('Signup error:', err);
      const debugInfo = analyzeAuthError(err);
      printFirebaseDebugInfo(debugInfo);
      const message =
        debugInfo.errorType === 'EMAIL_IN_USE'
          ? '이미 사용 중인 이메일입니다.'
          : err instanceof Error
            ? err.message
            : '계정 생성에 실패했습니다.';
      Alert.alert('계정 생성 실패', message);
    } finally {
      setLoading(false);
    }
  }, [displayName, email, password, signUpWithEmail, linkEmailToCurrentUser, isLinkMode]);

  const inputStyle: TextStyle = {
    height: 52,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    fontSize: WANTED_TOKENS.type.body1.size,
    color: semantic.labelStrong,
    backgroundColor: semantic.bgBase,
  };

  const labelStyle: TextStyle = {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelNormal,
    marginBottom: WANTED_TOKENS.spacing.s2,
  };

  const primaryStyle: ViewStyle = {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    backgroundColor: loading ? semantic.primaryHover : semantic.primaryNormal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s5,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <SignupHeader
          currentStep={2}
          onBack={
            isLinkMode
              ? undefined
              : () => navigation.canGoBack() && navigation.goBack()
          }
        />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text
            style={[
              styles.title,
              {
                color: semantic.labelStrong,
                letterSpacing:
                  WANTED_TOKENS.type.title3.size * WANTED_TOKENS.type.title3.tracking,
              },
            ]}
          >
            {isLinkMode ? '이메일과 비밀번호 설정' : '계정 만들기'}
          </Text>
          <Text style={[styles.subtitle, { color: semantic.labelAlt }]}>
            {isLinkMode
              ? '본인 인증이 완료되었습니다. 가입을 마무리해 주세요.'
              : 'LiveMetro에 오신 것을 환영합니다!'}
          </Text>

          <View style={styles.field}>
            <Text style={labelStyle}>이름</Text>
            <TextInput
              style={inputStyle}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="홍길동"
              placeholderTextColor={semantic.labelAlt}
              autoCapitalize="words"
              textContentType="name"
              testID="displayname-input"
              accessibilityLabel="이름 입력"
            />
          </View>

          <View style={styles.field}>
            <Text style={labelStyle}>이메일</Text>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="example@gmail.com"
              placeholderTextColor={semantic.labelAlt}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              autoComplete="email"
              testID="email-input"
              accessibilityLabel="이메일 입력"
            />
          </View>

          <View style={styles.field}>
            <Text style={labelStyle}>비밀번호</Text>
            <TextInput
              style={inputStyle}
              value={password}
              onChangeText={setPassword}
              placeholder="6자 이상 입력하세요"
              placeholderTextColor={semantic.labelAlt}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
              testID="password-input"
              accessibilityLabel="비밀번호 입력"
            />
          </View>

          <TouchableOpacity
            testID="submit-button"
            style={primaryStyle}
            onPress={handleSubmit}
            disabled={loading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="계정 만들기"
          >
            <Text style={styles.primaryLabel}>{loading ? '처리중...' : '계정 만들기'}</Text>
          </TouchableOpacity>

          {!isLinkMode ? (
            <TouchableOpacity
              testID="goto-login"
              style={styles.linkRow}
              onPress={() => navigation.canGoBack() && navigation.goBack()}
            >
              <Text style={[styles.linkText, { color: semantic.labelAlt }]}>
                이미 계정이 있으신가요? 로그인
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  title: {
    fontSize: WANTED_TOKENS.type.title3.size,
    lineHeight: WANTED_TOKENS.type.title3.lh,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  field: {
    marginTop: WANTED_TOKENS.spacing.s5,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  linkRow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  linkText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});

export default SignUpScreen;
