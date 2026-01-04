/**
 * Authentication Screen Component
 * Handles user sign-in and sign-up
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../services/auth/AuthContext';
import { analyzeAuthError, printFirebaseDebugInfo } from '../../utils/firebaseDebug';
import {
  isBiometricAvailable,
  isBiometricLoginEnabled,
  getBiometricTypeName,
  performBiometricLogin,
  enableBiometricLogin,
} from '../../services/auth/biometricService';

// Storage keys for auto login
const AUTO_LOGIN_ENABLED_KEY = '@livemetro_auto_login_enabled';
const AUTO_LOGIN_EMAIL_KEY = 'livemetro_auto_login_email';
const AUTO_LOGIN_PASSWORD_KEY = 'livemetro_auto_login_password';

export const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto login state
  const [autoLogin, setAutoLogin] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypeName, setBiometricTypeName] = useState('생체인증');

  const { signInWithEmail, signUpWithEmail, signInAnonymously, resetPassword } = useAuth();

  // Load saved data and attempt auto login on mount
  useEffect(() => {
    const loadSavedData = async (): Promise<void> => {
      try {
        // Check auto login setting
        const savedAutoLogin = await AsyncStorage.getItem(AUTO_LOGIN_ENABLED_KEY);
        const isAutoLoginEnabled = savedAutoLogin === 'true';
        setAutoLogin(isAutoLoginEnabled);

        // Check biometric availability
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);

        if (available) {
          const enabled = await isBiometricLoginEnabled();
          setBiometricEnabled(enabled);

          const typeName = await getBiometricTypeName();
          setBiometricTypeName(typeName);
        }

        // Attempt auto login if enabled
        if (isAutoLoginEnabled) {
          const savedEmail = await SecureStore.getItemAsync(AUTO_LOGIN_EMAIL_KEY);
          const savedPassword = await SecureStore.getItemAsync(AUTO_LOGIN_PASSWORD_KEY);

          if (savedEmail && savedPassword) {
            setEmail(savedEmail);
            setLoading(true);
            try {
              await signInWithEmail(savedEmail, savedPassword);
              return; // Auto login successful
            } catch (error) {
              console.log('Auto login failed, showing login form');
              // Auto login failed, show login form with saved email
            } finally {
              setLoading(false);
            }
          }
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      } finally {
        setIsAutoLoggingIn(false);
      }
    };

    loadSavedData();
  }, [signInWithEmail]);

  // Handle biometric login
  const handleBiometricLogin = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await performBiometricLogin();

      if (result.success && result.credentials) {
        // Perform actual login with stored credentials
        await signInWithEmail(result.credentials.email, result.credentials.password);
      } else if (result.error && result.error !== 'fallback') {
        Alert.alert('인증 실패', result.error);
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      Alert.alert('오류', '생체인증 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [signInWithEmail]);

  // Save auto login credentials
  const saveAutoLoginCredentials = useCallback(async (
    emailToSave: string,
    passwordToSave: string
  ): Promise<void> => {
    try {
      if (autoLogin) {
        await AsyncStorage.setItem(AUTO_LOGIN_ENABLED_KEY, 'true');
        await SecureStore.setItemAsync(AUTO_LOGIN_EMAIL_KEY, emailToSave);
        await SecureStore.setItemAsync(AUTO_LOGIN_PASSWORD_KEY, passwordToSave);
      } else {
        await AsyncStorage.setItem(AUTO_LOGIN_ENABLED_KEY, 'false');
        await SecureStore.deleteItemAsync(AUTO_LOGIN_EMAIL_KEY);
        await SecureStore.deleteItemAsync(AUTO_LOGIN_PASSWORD_KEY);
      }
    } catch (error) {
      console.error('Error saving auto login credentials:', error);
    }
  }, [autoLogin]);

  // Prompt to enable biometric after successful login
  const promptBiometricSetup = useCallback(async (
    loginEmail: string,
    loginPassword: string
  ): Promise<void> => {
    if (!biometricAvailable || biometricEnabled) return;

    Alert.alert(
      `${biometricTypeName} 설정`,
      `다음에 ${biometricTypeName}로 빠르게 로그인하시겠습니까?`,
      [
        { text: '나중에', style: 'cancel' },
        {
          text: '설정하기',
          onPress: async () => {
            const success = await enableBiometricLogin(loginEmail, loginPassword);
            if (success) {
              setBiometricEnabled(true);
              Alert.alert('완료', `${biometricTypeName} 로그인이 활성화되었습니다.`);
            }
          },
        },
      ]
    );
  }, [biometricAvailable, biometricEnabled, biometricTypeName]);

  // Email validation
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation
  const isValidPassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleSubmit = async (): Promise<void> => {
    // Validation
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

    if (!isValidPassword(password)) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }

    setLoading(true);

    const trimmedEmail = email.trim();

    try {
      if (isSignUp) {
        await signUpWithEmail(trimmedEmail, password, displayName.trim());
        Alert.alert('성공', '계정이 생성되었습니다!');
      } else {
        await signInWithEmail(trimmedEmail, password);

        // Save auto login credentials after successful login
        await saveAutoLoginCredentials(trimmedEmail, password);

        // Prompt for biometric setup (only on login, not signup)
        await promptBiometricSetup(trimmedEmail, password);
      }
    } catch (error) {
      console.error('Auth error:', error);

      // Analyze error and get recommendations
      const debugInfo = analyzeAuthError(error);
      printFirebaseDebugInfo(debugInfo);

      // Get user-friendly error message
      let errorTitle = isSignUp ? '계정 생성 실패' : '로그인 실패';
      let errorMessage = '';

      if (debugInfo.errorType === 'AUTH_DISABLED') {
        errorTitle = 'Firebase 설정 필요';
        errorMessage = 'Firebase 콘솔에서 이메일/비밀번호 인증을 활성화해야 합니다.\n\n자세한 내용은 콘솔 로그를 확인하세요.';
      } else if (debugInfo.errorType === 'EMAIL_IN_USE') {
        errorMessage = '이미 사용 중인 이메일입니다. 다른 이메일을 사용하거나 로그인하세요.';
      } else if (debugInfo.errorType === 'FIRESTORE_PERMISSION') {
        errorTitle = 'Firestore 권한 오류';
        errorMessage = 'Firestore 보안 규칙을 확인해야 합니다.\n\n자세한 내용은 콘솔 로그를 확인하세요.';
      } else if (debugInfo.missingEnvVars.length > 0) {
        errorTitle = '설정 오류';
        errorMessage = 'Firebase 환경 변수가 설정되지 않았습니다.\n\n.env 파일을 확인하고 앱을 재시작하세요.';
      } else {
        errorMessage = error instanceof Error ? error.message : '인증에 실패했습니다.';
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
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
      Alert.alert(
        '이메일 전송 완료',
        `${email}로 비밀번호 재설정 이메일을 보냈습니다. 이메일을 확인해주세요.`,
        [{ text: '확인' }]
      );
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('오류', '비밀번호 재설정 이메일 전송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = async (): Promise<void> => {
    try {
      setLoading(true);
      await signInAnonymously();
    } catch (error) {
      console.error('Anonymous sign in error:', error);
      Alert.alert('오류', '익명 로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auto login
  if (isAutoLoggingIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.autoLoginContainer}>
          <View style={styles.logoContainer}>
            <Ionicons name="train" size={48} color="#2563eb" />
          </View>
          <Text style={styles.autoLoginText}>자동 로그인 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="train" size={48} color="#2563eb" />
            </View>
            <Text style={styles.title}>
              {isSignUp ? '계정 만들기' : '로그인'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? 'LiveMetro에 오신 것을 환영합니다!'
                : '계정에 로그인하여 개인화된 서비스를 이용하세요'
              }
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {isSignUp && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>이름</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="홍길동"
                  autoCapitalize="words"
                  textContentType="name"
                  testID="displayname-input"
                  accessibilityLabel="이름 입력"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="example@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                testID="email-input"
                accessibilityLabel="이메일 입력"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
                textContentType="password"
                autoComplete={isSignUp ? 'password-new' : 'password'}
                testID="password-input"
                accessibilityLabel="비밀번호 입력"
              />
            </View>

            {/* Auto Login Checkbox (only for login) */}
            {!isSignUp && (
              <View style={styles.rememberContainer}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setAutoLogin(!autoLogin)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    autoLogin && styles.checkboxChecked
                  ]}>
                    {autoLogin && (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    )}
                  </View>
                  <Text style={styles.rememberText}>자동로그인</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
              testID="submit-button"
              accessibilityLabel={isSignUp ? '계정 만들기' : '로그인'}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? '처리중...' : (isSignUp ? '계정 만들기' : '로그인')}
              </Text>
            </TouchableOpacity>

            {/* Biometric Login Button */}
            {!isSignUp && biometricAvailable && biometricEnabled && (
              <TouchableOpacity
                style={[styles.biometricButton, loading && styles.disabledButton]}
                onPress={handleBiometricLogin}
                disabled={loading}
                testID="biometric-login-button"
                accessibilityLabel={`${biometricTypeName}로 로그인`}
              >
                <Ionicons
                  name={biometricTypeName === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                  size={24}
                  color="#2563eb"
                />
                <Text style={styles.biometricButtonText}>
                  {biometricTypeName}로 로그인
                </Text>
              </TouchableOpacity>
            )}

            {/* Forgot Password */}
            {!isSignUp && (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.forgotPasswordText}>
                  비밀번호를 잊으셨나요?
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Alternative Actions */}
          <View style={styles.alternativeSection}>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.switchButtonText}>
                {isSignUp
                  ? '이미 계정이 있으신가요? 로그인'
                  : '계정이 없으신가요? 가입하기'
                }
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleAnonymousSignIn}
              disabled={loading}
              testID="anonymous-login-button"
              accessibilityLabel="익명으로 계속하기"
            >
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <Text style={styles.secondaryButtonText}>
                익명으로 계속하기
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  autoLoginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoLoginText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#eff6ff',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  forgotPasswordButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  alternativeSection: {
    alignItems: 'center',
  },
  switchButton: {
    paddingVertical: 8,
    marginBottom: 20,
  },
  switchButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#9ca3af',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  // Remember email styles
  rememberContainer: {
    marginBottom: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  rememberText: {
    fontSize: 14,
    color: '#374151',
  },
  // Biometric button styles
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 8,
  },
});