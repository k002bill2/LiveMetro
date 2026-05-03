/**
 * EmailLoginScreen — secondary auth screen split out of the legacy AuthScreen.
 *
 * Hosts the email + password form, the auto-login toggle, and the password
 * reset link. The Wanted handoff keeps these flows out of the main entry
 * (AuthScreen) so it can stay light + biometric-first.
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ChevronLeft } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import {
  isBiometricAvailable,
  isBiometricLoginEnabled,
  getBiometricTypeName,
  enableBiometricLogin,
} from '@/services/auth/biometricService';
import { analyzeAuthError, printFirebaseDebugInfo } from '@/utils/firebaseDebug';
import { AppStackParamList } from '@/navigation/types';

const AUTO_LOGIN_ENABLED_KEY = '@livemetro_auto_login_enabled';
const AUTO_LOGIN_EMAIL_KEY = 'livemetro_auto_login_email';
const AUTO_LOGIN_PASSWORD_KEY = 'livemetro_auto_login_password';

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type Nav = NativeStackNavigationProp<AppStackParamList>;

export const EmailLoginScreen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { signInWithEmail, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const persistAutoLogin = useCallback(
    async (storedEmail: string, storedPassword: string): Promise<void> => {
      try {
        if (autoLogin) {
          await AsyncStorage.setItem(AUTO_LOGIN_ENABLED_KEY, 'true');
          await SecureStore.setItemAsync(AUTO_LOGIN_EMAIL_KEY, storedEmail);
          await SecureStore.setItemAsync(AUTO_LOGIN_PASSWORD_KEY, storedPassword);
        } else {
          await AsyncStorage.setItem(AUTO_LOGIN_ENABLED_KEY, 'false');
          await SecureStore.deleteItemAsync(AUTO_LOGIN_EMAIL_KEY);
          await SecureStore.deleteItemAsync(AUTO_LOGIN_PASSWORD_KEY);
        }
      } catch (err) {
        console.error('Error saving auto login credentials:', err);
      }
    },
    [autoLogin]
  );

  const promptBiometricSetup = useCallback(
    async (loginEmail: string, loginPassword: string): Promise<void> => {
      const available = await isBiometricAvailable();
      if (!available) return;
      const enabled = await isBiometricLoginEnabled();
      if (enabled) return;
      const typeName = await getBiometricTypeName();
      Alert.alert(
        `${typeName} 설정`,
        `다음에 ${typeName}로 빠르게 로그인하시겠습니까?`,
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '설정하기',
            onPress: async () => {
              const success = await enableBiometricLogin(loginEmail, loginPassword);
              if (success) {
                Alert.alert('완료', `${typeName} 로그인이 활성화되었습니다.`);
              }
            },
          },
        ]
      );
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('오류', '이메일을 입력해주세요.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('오류', '비밀번호를 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim();
    try {
      await signInWithEmail(trimmedEmail, password);
      await persistAutoLogin(trimmedEmail, password);
      await promptBiometricSetup(trimmedEmail, password);
    } catch (err) {
      console.error('Auth error:', err);
      const debugInfo = analyzeAuthError(err);
      printFirebaseDebugInfo(debugInfo);
      const message =
        debugInfo.errorType === 'AUTH_DISABLED'
          ? 'Firebase 콘솔에서 이메일/비밀번호 인증을 활성화해야 합니다.'
          : err instanceof Error
            ? err.message
            : '로그인에 실패했습니다.';
      Alert.alert('로그인 실패', message);
    } finally {
      setLoading(false);
    }
  }, [email, password, signInWithEmail, persistAutoLogin, promptBiometricSetup]);

  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('알림', '이메일을 먼저 입력해주세요.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert('오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email.trim());
      Alert.alert('이메일 전송 완료', `${email}로 비밀번호 재설정 이메일을 보냈습니다.`);
    } catch (err) {
      console.error('Password reset error:', err);
      Alert.alert('오류', '비밀번호 재설정 이메일 전송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [email, resetPassword]);

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
    marginTop: WANTED_TOKENS.spacing.s4,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            testID="email-login-back"
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
            이메일로 로그인
          </Text>
          <Text style={[styles.subtitle, { color: semantic.labelAlt }]}>
            계정 정보를 입력해주세요.
          </Text>

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
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor={semantic.labelAlt}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              testID="password-input"
              accessibilityLabel="비밀번호 입력"
            />
          </View>

          <TouchableOpacity
            testID="auto-login-toggle"
            style={styles.checkRow}
            onPress={() => setAutoLogin((v) => !v)}
            accessible
            accessibilityRole="checkbox"
            accessibilityLabel="자동로그인"
            accessibilityState={{ checked: autoLogin }}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: autoLogin ? semantic.primaryNormal : semantic.lineNormal,
                  backgroundColor: autoLogin ? semantic.primaryNormal : 'transparent',
                },
              ]}
            >
              {autoLogin ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={[styles.checkLabel, { color: semantic.labelNormal }]}>자동로그인</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="submit-button"
            style={primaryStyle}
            onPress={handleSubmit}
            disabled={loading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="로그인"
          >
            <Text style={styles.primaryLabel}>{loading ? '처리중...' : '로그인'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="forgot-password"
            style={styles.linkRow}
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={[styles.linkText, { color: semantic.labelAlt }]}>
              비밀번호를 잊으셨나요?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="goto-signup"
            style={styles.linkRow}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={[styles.linkText, { color: semantic.primaryNormal, fontWeight: '700' }]}>
              계정이 없으신가요? 가입하기
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
  checkRow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 14,
  },
  checkLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  linkRow: {
    alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s3,
  },
  linkText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
  },
});

export default EmailLoginScreen;
