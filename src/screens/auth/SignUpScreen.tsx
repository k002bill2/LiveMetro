/**
 * SignUpScreen — account creation flow split out of the legacy AuthScreen.
 *
 * Hosts the name + email + password form. Mirrors EmailLoginScreen's visual
 * language (Wanted tokens, large primary CTA).
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
import { ChevronLeft } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { analyzeAuthError, printFirebaseDebugInfo } from '@/utils/firebaseDebug';
import { AppStackParamList } from '@/navigation/types';

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type Nav = NativeStackNavigationProp<AppStackParamList>;

export const SignUpScreen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { signUpWithEmail } = useAuth();

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
      await signUpWithEmail(email.trim(), password, displayName.trim());
      Alert.alert('성공', '계정이 생성되었습니다!');
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
  }, [displayName, email, password, signUpWithEmail]);

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
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="signup-back"
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <ChevronLeft size={26} color={semantic.labelNeutral} strokeWidth={2} />
          </TouchableOpacity>
        </View>
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
            계정 만들기
          </Text>
          <Text style={[styles.subtitle, { color: semantic.labelAlt }]}>
            LiveMetro에 오신 것을 환영합니다!
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

          <TouchableOpacity
            testID="goto-login"
            style={styles.linkRow}
            onPress={() => navigation.canGoBack() && navigation.goBack()}
          >
            <Text style={[styles.linkText, { color: semantic.labelAlt }]}>
              이미 계정이 있으신가요? 로그인
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    paddingTop: WANTED_TOKENS.spacing.s2,
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s2,
  },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  title: {
    fontSize: WANTED_TOKENS.type.title3.size,
    lineHeight: WANTED_TOKENS.type.title3.lh,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
  },
  field: {
    marginTop: WANTED_TOKENS.spacing.s5,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  linkRow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  linkText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
  },
});

export default SignUpScreen;
