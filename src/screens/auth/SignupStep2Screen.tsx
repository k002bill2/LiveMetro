/**
 * SignupStep2Screen — 회원가입 2/3 (계정 정보 + 약관 동의 하이브리드).
 *
 * Wanted v6 hand-off (auth-signup-steps.jsx Step 2 + auth.jsx 폼):
 *   상단 입력 폼 (이메일 + 닉네임 + 비밀번호 + 비밀번호 확인 + 4-bar 강도 미터)
 *   + 하단 약관 박스 (전체동의 + 필수3 + 선택1).
 *
 * Pre-fill 정책:
 *   - email / nickname: firebaseUser.email / displayName이 있으면 채움
 *     (한 번 link한 적 있는 phone-only 사용자가 다시 들어왔을 때).
 *   - password / passwordConfirm: 항상 빈칸 (보안 — 절대 영속 저장 안 함).
 *
 * 제출 모드:
 *   A) 이메일 + 비밀번호 입력 → linkEmailToCurrentUser (phone user에 email
 *      credential 부착) + markTermsAgreed + navigate('SignupStep3').
 *   B) 입력 모두 비움 → markTermsAgreed만 (phone-only로 진행)
 *      + navigate('SignupStep3'). 이메일은 향후 Settings에서 추가 가능.
 *
 * 필수 약관 3종은 두 모드 모두에서 정통망법/개인정보보호법 §22-2 충족 위해
 * 강제. 미동의 시 CTA 비활성.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { SignupHeader } from '@/components/auth/SignupHeader';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 10;
const PASSWORD_MIN = 8;

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: '' | '약함' | '보통' | '양호' | '안전';
}

const evalPasswordStrength = (pw: string): PasswordStrength => {
  if (!pw) return { score: 0, label: '' };
  const longEnough = pw.length >= PASSWORD_MIN;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const met = [longEnough, hasLetter, hasNumber, hasSymbol].filter(Boolean).length as
    | 0 | 1 | 2 | 3 | 4;
  const labels: Record<0 | 1 | 2 | 3 | 4, PasswordStrength['label']> = {
    0: '', 1: '약함', 2: '보통', 3: '양호', 4: '안전',
  };
  return { score: met, label: labels[met] };
};

const strengthColor = (score: number, primary: string): string => {
  switch (score) {
    case 1: return '#E04A3F';
    case 2: return '#F2A53A';
    case 3: return '#1FB05A';
    case 4: return primary;
    default: return primary;
  }
};

interface Agreements {
  terms: boolean;
  privacy: boolean;
  age: boolean;
  marketing: boolean;
}

const AGREEMENT_INITIAL: Agreements = {
  terms: false, privacy: false, age: false, marketing: false,
};

interface AgreementRow {
  id: keyof Agreements;
  label: string;
  required: boolean;
}

const AGREEMENT_ROWS: readonly AgreementRow[] = [
  { id: 'terms', label: '이용약관', required: true },
  { id: 'privacy', label: '개인정보 처리방침', required: true },
  { id: 'age', label: '만 14세 이상입니다', required: true },
  { id: 'marketing', label: '마케팅 정보 수신', required: false },
];

export const SignupStep2Screen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { firebaseUser, linkEmailToCurrentUser } = useAuth();
  const { markTermsAgreed } = useOnboarding();

  // Pre-fill from Firebase user only — never from a stash, never from
  // password storage. Phone-only users with a previously linked email
  // see their address pre-filled here; fresh users get empty fields.
  const [email, setEmail] = useState(firebaseUser?.email ?? '');
  const [nickname, setNickname] = useState(firebaseUser?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreements, setAgreements] = useState<Agreements>(AGREEMENT_INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => evalPasswordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && password === passwordConfirm;
  const requiredAgreed = agreements.terms && agreements.privacy && agreements.age;
  const allAgreed =
    agreements.terms && agreements.privacy && agreements.age && agreements.marketing;

  // Mode detection: if user typed ANY email/password char they're opting
  // into the email-link mode and must complete the form fully. Otherwise
  // (all empty) they proceed phone-only.
  const wantsEmailLink = email.trim().length > 0 || password.length > 0;
  const emailFormValid =
    isValidEmail(email.trim()) &&
    nickname.trim().length >= NICKNAME_MIN &&
    nickname.trim().length <= NICKNAME_MAX &&
    strength.score === 4 &&
    passwordsMatch;

  const canSubmit =
    requiredAgreed && !submitting && (!wantsEmailLink || emailFormValid);

  const toggleAll = useCallback(() => {
    setAgreements((prev) => {
      const next = !(prev.terms && prev.privacy && prev.age && prev.marketing);
      return { terms: next, privacy: next, age: next, marketing: next };
    });
  }, []);

  const toggleOne = useCallback((id: keyof Agreements) => {
    setAgreements((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!requiredAgreed) {
      Alert.alert('오류', '필수 약관에 모두 동의해주세요.');
      return;
    }
    if (wantsEmailLink && !emailFormValid) {
      Alert.alert(
        '오류',
        '입력하신 이메일/비밀번호가 형식에 맞지 않습니다. 비워두면 휴대폰 인증만으로 진행할 수 있어요.',
      );
      return;
    }

    setSubmitting(true);
    try {
      if (wantsEmailLink) {
        await linkEmailToCurrentUser(email.trim(), password, nickname.trim());
      }
      await markTermsAgreed();
      navigation.navigate('SignupStep3');
    } catch (err) {
      console.error('SignupStep2 submit error:', err);
      const message = err instanceof Error ? err.message : '진행 중 오류가 발생했습니다.';
      Alert.alert('오류', message);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    requiredAgreed,
    wantsEmailLink,
    emailFormValid,
    email,
    nickname,
    password,
    linkEmailToCurrentUser,
    markTermsAgreed,
    navigation,
  ]);

  const inputRowStyle: ViewStyle = {
    height: 52,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
    backgroundColor: semantic.bgBase,
  };

  const inputInside: TextStyle = {
    flex: 1,
    fontSize: WANTED_TOKENS.type.body1.size,
    color: semantic.labelStrong,
    paddingVertical: 0,
  };

  const labelStyle: TextStyle = {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelNormal,
  };

  const hintStyle: TextStyle = {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    color: semantic.labelAlt,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]} testID="signup-step2">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <SignupHeader currentStep={2} testID="signup-step2-header" />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text
            style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
            testID="signup-step2-title"
          >
            계정 만들기
          </Text>
          <Text
            style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
            testID="signup-step2-subtitle"
          >
            이메일로 가입하면 출퇴근 패턴 학습과{'\n'}기기 간 동기화를 사용할 수 있어요.
          </Text>

          {/* Email — optional */}
          <View style={styles.field}>
            <Text style={[labelStyle, styles.fieldLabelSpacing]}>이메일</Text>
            <View style={inputRowStyle}>
              <Mail size={18} color={semantic.labelAlt} strokeWidth={2} />
              <TextInput
                style={inputInside}
                value={email}
                onChangeText={setEmail}
                placeholder="example@mail.com"
                placeholderTextColor={semantic.labelAlt}
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                testID="email-input"
                accessibilityLabel="이메일 입력"
              />
            </View>
          </View>

          {/* Nickname */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={labelStyle}>닉네임</Text>
              <Text style={hintStyle}>{NICKNAME_MIN}~{NICKNAME_MAX}자</Text>
            </View>
            <View style={inputRowStyle}>
              <UserIcon size={18} color={semantic.labelAlt} strokeWidth={2} />
              <TextInput
                style={inputInside}
                value={nickname}
                onChangeText={(v) => setNickname(v.slice(0, NICKNAME_MAX))}
                placeholder="지수"
                placeholderTextColor={semantic.labelAlt}
                autoCapitalize="words"
                textContentType="name"
                testID="nickname-input"
                accessibilityLabel="닉네임 입력"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={labelStyle}>비밀번호</Text>
              <Text style={hintStyle}>8자 이상 · 영문/숫자/기호</Text>
            </View>
            <View style={inputRowStyle}>
              <Lock size={18} color={semantic.labelAlt} strokeWidth={2} />
              <TextInput
                style={inputInside}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                placeholderTextColor={semantic.labelAlt}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="password-new"
                testID="password-input"
                accessibilityLabel="비밀번호 입력"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                testID="password-toggle"
              >
                {showPassword ? (
                  <EyeOff size={18} color={semantic.labelAlt} strokeWidth={2} />
                ) : (
                  <Eye size={18} color={semantic.labelAlt} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
            {password.length > 0 ? (
              <View style={styles.strengthRow} testID="password-strength">
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => {
                    const filled = i <= strength.score;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          {
                            backgroundColor: filled
                              ? strengthColor(strength.score, semantic.primaryNormal)
                              : semantic.lineSubtle,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                {strength.label ? (
                  <Text
                    style={[
                      styles.strengthLabel,
                      {
                        color: strengthColor(strength.score, semantic.primaryNormal),
                        fontFamily: weightToFontFamily('700'),
                      },
                    ]}
                  >
                    {strength.label}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Password confirm */}
          <View style={styles.field}>
            <Text style={[labelStyle, styles.fieldLabelSpacing]}>비밀번호 확인</Text>
            <View style={inputRowStyle}>
              <Lock size={18} color={semantic.labelAlt} strokeWidth={2} />
              <TextInput
                style={inputInside}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="비밀번호 다시 입력"
                placeholderTextColor={semantic.labelAlt}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                testID="password-confirm-input"
                accessibilityLabel="비밀번호 확인 입력"
              />
              {passwordsMatch ? (
                <View
                  style={[styles.matchBadge, { backgroundColor: semantic.statusPositive }]}
                  testID="password-confirm-match"
                >
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : null}
            </View>
          </View>

          {/* Agreements */}
          <View
            style={[
              styles.agreementBox,
              { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
            ]}
            testID="agreements-box"
          >
            <Pressable
              onPress={toggleAll}
              accessibilityRole="checkbox"
              accessibilityLabel="전체 동의"
              accessibilityState={{ checked: allAgreed }}
              style={styles.agreementHeaderRow}
              testID="agreement-all"
            >
              <CheckBox checked={allAgreed} primary={semantic.primaryNormal} subtle={semantic.lineNormal} />
              <Text
                style={[
                  styles.agreementHeaderLabel,
                  { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
                ]}
              >
                전체 동의
              </Text>
            </Pressable>
            <View style={[styles.agreementDivider, { backgroundColor: semantic.lineSubtle }]} />
            {AGREEMENT_ROWS.map((row) => {
              const checked = agreements[row.id];
              return (
                <View key={row.id} style={styles.agreementRow}>
                  <Pressable
                    onPress={() => toggleOne(row.id)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${row.required ? '필수' : '선택'} ${row.label}`}
                    accessibilityState={{ checked }}
                    style={styles.agreementCheckArea}
                    testID={`agreement-${row.id}`}
                  >
                    <CheckBox
                      checked={checked}
                      primary={semantic.primaryNormal}
                      subtle={semantic.lineNormal}
                    />
                    <Text
                      style={[
                        styles.agreementLabel,
                        {
                          color: row.required ? semantic.labelStrong : semantic.labelNormal,
                          fontFamily: weightToFontFamily('600'),
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: semantic.labelAlt,
                          fontFamily: weightToFontFamily('600'),
                        }}
                      >
                        ({row.required ? '필수' : '선택'}){' '}
                      </Text>
                      {row.label}
                    </Text>
                  </Pressable>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${row.label} 자세히 보기`}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    // TODO: route to terms detail screen — placeholder noop
                    onPress={() => undefined}
                    testID={`agreement-${row.id}-detail`}
                  >
                    <ChevronRight size={16} color={semantic.labelAlt} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Submit */}
          <TouchableOpacity
            testID="signup-step2-cta"
            style={[
              styles.primary,
              { backgroundColor: canSubmit ? semantic.primaryNormal : semantic.lineSubtle },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="동의하고 계속하기"
          >
            <Text
              style={[
                styles.primaryLabel,
                {
                  color: canSubmit ? semantic.labelOnColor : semantic.labelAlt,
                  fontFamily: weightToFontFamily('800'),
                },
              ]}
            >
              {submitting ? '처리중…' : '동의하고 계속하기'}
            </Text>
            {!submitting && canSubmit && (
              <ArrowRight size={18} color={semantic.labelOnColor} strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface CheckBoxProps {
  checked: boolean;
  primary: string;
  subtle: string;
}

const CheckBox: React.FC<CheckBoxProps> = ({ checked, primary, subtle }) => (
  <View
    style={[
      checkBoxStyles.box,
      {
        backgroundColor: checked ? primary : 'transparent',
        borderColor: checked ? primary : subtle,
      },
    ]}
  >
    {checked ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
  </View>
);

const checkBoxStyles = StyleSheet.create({
  box: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  title: {
    fontSize: 26, lineHeight: 32, letterSpacing: -0.6,
    fontWeight: '800', fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: 14, lineHeight: 21,
    fontWeight: '500', fontFamily: weightToFontFamily('500'),
  },
  field: { marginTop: WANTED_TOKENS.spacing.s5 },
  fieldHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  fieldLabelSpacing: { marginBottom: WANTED_TOKENS.spacing.s2 },
  strengthRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2, marginTop: WANTED_TOKENS.spacing.s2,
  },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: {
    fontSize: 11, fontWeight: '700', fontFamily: weightToFontFamily('700'),
    minWidth: 30, textAlign: 'right',
  },
  matchBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  agreementBox: {
    marginTop: WANTED_TOKENS.spacing.s5,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6, borderWidth: 1,
  },
  agreementHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s3, paddingVertical: WANTED_TOKENS.spacing.s2,
  },
  agreementHeaderLabel: {
    fontSize: 14, fontWeight: '800', fontFamily: weightToFontFamily('800'),
  },
  agreementDivider: { height: 1, marginVertical: WANTED_TOKENS.spacing.s2 },
  agreementRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s2,
  },
  agreementCheckArea: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s3,
  },
  agreementLabel: {
    fontSize: 13.5, fontWeight: '600', fontFamily: weightToFontFamily('600'),
  },
  primary: {
    flexDirection: 'row', height: 56, borderRadius: WANTED_TOKENS.radius.r8,
    alignItems: 'center', justifyContent: 'center',
    gap: WANTED_TOKENS.spacing.s2, marginTop: WANTED_TOKENS.spacing.s6,
  },
  primaryLabel: {
    fontSize: 16, fontWeight: '800', fontFamily: weightToFontFamily('800'),
  },
});

export default SignupStep2Screen;
