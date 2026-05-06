/**
 * SignupStep1Screen — 회원가입 1/3 (NICE 본인 인증, UI mock).
 *
 * Two internal phases driven by `phase` state:
 *   - 'input': carrier (3×2 grid) + name + phone + birth → "인증 요청" CTA
 *   - 'otp':   6-digit OTP entry with countdown + resend → "인증" → SignUp
 *
 * Pure UI mock — no NICE SDK integration. The backend stub remains a
 * follow-up phase (decision in plan: src/services/auth/niceAuth.ts deferred).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { ArrowRight, Calendar, ShieldCheck, Smartphone, User } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { SignupHeader } from '@/components/auth/SignupHeader';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuth } from '@/services/auth/AuthContext';
import { firebaseConfig } from '@/services/firebase/config';
import { toE164KR } from '@/utils/phoneFormat';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Phase = 'input' | 'otp';

interface Carrier {
  id: string;
  label: string;
  isMvno: boolean;
}

const CARRIERS: readonly Carrier[] = [
  { id: 'skt', label: 'SKT', isMvno: false },
  { id: 'kt', label: 'KT', isMvno: false },
  { id: 'lgu', label: 'LG U+', isMvno: false },
  { id: 'mvno-skt', label: 'SKT 알뜰폰', isMvno: true },
  { id: 'mvno-kt', label: 'KT 알뜰폰', isMvno: true },
  { id: 'mvno-lgu', label: 'LG 알뜰폰', isMvno: true },
];

const OTP_LENGTH = 6;
const OTP_TIMEOUT_SECONDS = 168; // 02:48

const formatPhone = (digits: string): string => {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};

const maskPhone = (digits: string): string => {
  if (digits.length < 11) return formatPhone(digits);
  return `${digits.slice(0, 3)}-****-${digits.slice(7, 11)}`;
};

const formatTimer = (seconds: number): string => {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

export const SignupStep1Screen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const navigation = useNavigation<Nav>();
  const { requestPhoneVerification, confirmPhoneCode } = useAuth();

  const [phase, setPhase] = useState<Phase>('input');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [carrierId, setCarrierId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [secondsLeft, setSecondsLeft] = useState(OTP_TIMEOUT_SECONDS);
  const otpRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);

  const cursorOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase !== 'otp') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, cursorOpacity]);

  useEffect(() => {
    if (phase !== 'otp') return undefined;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const isInputComplete = useMemo(
    () => Boolean(carrierId) && name.trim().length > 0 && phone.length === 11 && birth.length === 6,
    [carrierId, name, phone, birth],
  );

  const isOtpComplete = useMemo(() => otpDigits.every((d) => d.length === 1), [otpDigits]);

  const handleRequestOtp = useCallback(async () => {
    if (!isInputComplete || requesting) return;
    if (!recaptchaRef.current) {
      Alert.alert('오류', '인증 모듈을 초기화하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setRequesting(true);
    try {
      const e164 = toE164KR(phone);
      const id = await requestPhoneVerification(e164, recaptchaRef.current);
      setVerificationId(id);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(OTP_TIMEOUT_SECONDS);
      setPhase('otp');
    } catch (err) {
      Alert.alert('인증 요청 실패', err instanceof Error ? err.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setRequesting(false);
    }
  }, [isInputComplete, requesting, phone, requestPhoneVerification]);

  const handleResend = useCallback(async () => {
    if (!recaptchaRef.current) return;
    setRequesting(true);
    try {
      const e164 = toE164KR(phone);
      const id = await requestPhoneVerification(e164, recaptchaRef.current);
      setVerificationId(id);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setSecondsLeft(OTP_TIMEOUT_SECONDS);
      otpRefs.current[0]?.focus();
    } catch (err) {
      Alert.alert('재전송 실패', err instanceof Error ? err.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setRequesting(false);
    }
  }, [phone, requestPhoneVerification]);

  const handleOtpChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(0, 1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyPress = useCallback(
    (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    },
    [otpDigits],
  );

  const handleVerify = useCallback(async () => {
    if (!isOtpComplete || verifying || !verificationId) return;
    setVerifying(true);
    try {
      await confirmPhoneCode(verificationId, otpDigits.join(''));
      // signInWithCredential succeeded inside the handler. The
      // onAuthStateChanged listener will flip user → truthy and the
      // RootNavigator will route to SignupStep2 (계정 정보 + 약관 동의)
      // because phone-only users still need to accept terms (정통망법 +
      // 개인정보보호법 §22-2). Email/nickname/password are optional in
      // SignupStep2 — users can add them now or link later from Settings.
    } catch (err) {
      Alert.alert('인증 실패', err instanceof Error ? err.message : '인증번호를 다시 확인해주세요.');
    } finally {
      setVerifying(false);
    }
  }, [isOtpComplete, verifying, verificationId, otpDigits, confirmPhoneCode]);

  const handleBack = useCallback(() => {
    if (phase === 'otp') {
      setPhase('input');
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  }, [phase, navigation]);

  const primaryStyle = useCallback(
    (enabled: boolean): ViewStyle => ({
      height: 56,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: enabled ? semantic.primaryNormal : semantic.lineSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: WANTED_TOKENS.spacing.s6,
    }),
    [semantic.primaryNormal, semantic.lineSubtle],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: semantic.bgBase }]} testID="signup-step1">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SignupHeader currentStep={1} onBack={handleBack} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {phase === 'input' ? (
            <>
              <Text
                style={[styles.stepCaption, { color: semantic.primaryNormal, fontFamily: weightToFontFamily('800') }]}
                testID="signup-step1-step-caption"
              >
                STEP 1 / 3
              </Text>
              <Text
                style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
                testID="signup-step1-title"
              >
                본인 인증
              </Text>
              <Text style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}>
                휴대폰 번호로 인증을 진행해요.{'\n'}입력하신 번호는 본인 확인 외 사용되지 않아요.
              </Text>

              <Text
                style={[styles.sectionLabel, { color: semantic.labelNormal, fontFamily: weightToFontFamily('700') }]}
              >
                통신사
              </Text>
              <View style={styles.carrierGrid} testID="carrier-grid">
                {CARRIERS.map((c) => {
                  const selected = carrierId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      testID={`carrier-${c.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.label} 선택`}
                      onPress={() => setCarrierId(c.id)}
                      style={styles.carrierColumn}
                    >
                      <View
                        style={[
                          styles.carrierBox,
                          {
                            borderColor: selected ? semantic.primaryNormal : semantic.lineSubtle,
                            borderWidth: selected ? 2 : 1,
                            backgroundColor: selected
                              ? (isDark ? 'rgba(51,133,255,0.14)' : 'rgba(0,102,255,0.06)')
                              : semantic.bgSubtle,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.carrierLabel,
                            {
                              color: selected ? semantic.primaryNormal : semantic.labelStrong,
                              fontFamily: weightToFontFamily(selected ? '700' : '600'),
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {c.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.field}>
                <Text style={[styles.inputLabel, { color: semantic.labelNormal, fontFamily: weightToFontFamily('700') }]}>
                  이름
                </Text>
                <View
                  style={[
                    styles.inputRow,
                    { borderColor: semantic.lineSubtle, backgroundColor: semantic.bgBase },
                  ]}
                >
                  <User size={18} color={semantic.labelAlt} strokeWidth={2} />
                  <TextInput
                    testID="name-input"
                    value={name}
                    onChangeText={setName}
                    placeholder="이지수"
                    placeholderTextColor={semantic.labelAlt}
                    style={[styles.inputInside, { color: semantic.labelStrong }]}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <Text style={[styles.inputLabel, { color: semantic.labelNormal, fontFamily: weightToFontFamily('700') }]}>
                    휴대폰 번호
                  </Text>
                  <Text style={[styles.fieldHint, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}>
                    {"' - ' 없이 입력"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.inputRow,
                    { borderColor: semantic.lineSubtle, backgroundColor: semantic.bgBase },
                  ]}
                >
                  <Smartphone size={18} color={semantic.labelAlt} strokeWidth={2} />
                  <TextInput
                    testID="phone-input"
                    value={phone}
                    onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="01012345678"
                    placeholderTextColor={semantic.labelAlt}
                    keyboardType="number-pad"
                    style={[styles.inputInside, { color: semantic.labelStrong }]}
                  />
                  <TouchableOpacity
                    testID="phone-inline-request"
                    onPress={handleRequestOtp}
                    disabled={!isInputComplete || requesting}
                    accessibilityRole="button"
                    accessibilityLabel="인증 요청 (인라인)"
                    style={[
                      styles.inlineButton,
                      {
                        backgroundColor: isInputComplete && !requesting
                          ? semantic.primaryNormal
                          : semantic.lineSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.inlineButtonLabel,
                        {
                          color: isInputComplete && !requesting ? semantic.labelOnColor : semantic.labelAlt,
                          fontFamily: weightToFontFamily('700'),
                        },
                      ]}
                    >
                      인증 요청
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.inputLabel, { color: semantic.labelNormal, fontFamily: weightToFontFamily('700') }]}>
                  생년월일
                </Text>
                <View
                  style={[
                    styles.inputRow,
                    { borderColor: semantic.lineSubtle, backgroundColor: semantic.bgBase },
                  ]}
                >
                  <Calendar size={18} color={semantic.labelAlt} strokeWidth={2} />
                  <TextInput
                    testID="birth-input"
                    value={birth}
                    onChangeText={(v) => setBirth(v.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="950813"
                    placeholderTextColor={semantic.labelAlt}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.inputInside, { color: semantic.labelStrong }]}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.infoCard,
                  { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
                ]}
                testID="signup-step1-info-card"
              >
                <ShieldCheck size={16} color={semantic.labelAlt} strokeWidth={2} />
                <Text
                  style={[styles.infoText, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
                >
                  본인 인증은 NICE 평가정보를 통해 처리되며,{'\n'}입력하신 정보는 LiveMetro에 저장되지 않아요.
                </Text>
              </View>

              <TouchableOpacity
                testID="request-otp-button"
                style={[styles.primaryRow, primaryStyle(isInputComplete && !requesting)]}
                disabled={!isInputComplete || requesting}
                onPress={handleRequestOtp}
                accessibilityRole="button"
                accessibilityLabel="인증 요청"
              >
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color: isInputComplete ? semantic.labelOnColor : semantic.labelAlt,
                      fontFamily: weightToFontFamily('800'),
                    },
                  ]}
                >
                  {requesting ? '요청 중…' : '인증 요청'}
                </Text>
                {!requesting && isInputComplete && (
                  <ArrowRight size={18} color={semantic.labelOnColor} strokeWidth={2.4} />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
                testID="otp-title"
              >
                인증번호 입력
              </Text>
              <Text style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}>
                {maskPhone(phone)}로 6자리 인증번호를 보냈어요
              </Text>

              <View style={styles.otpRow} testID="otp-row">
                {otpDigits.map((digit, idx) => {
                  const isCursor = !digit && idx === otpDigits.findIndex((d) => !d);
                  return (
                    <View key={idx} style={styles.otpCellWrapper}>
                      <TextInput
                        testID={`otp-cell-${idx}`}
                        ref={(r) => {
                          otpRefs.current[idx] = r;
                        }}
                        value={digit}
                        onChangeText={(v) => handleOtpChange(idx, v)}
                        onKeyPress={(e) => handleOtpKeyPress(idx, e)}
                        keyboardType="number-pad"
                        maxLength={1}
                        textContentType="oneTimeCode"
                        style={[
                          styles.otpCell,
                          {
                            color: semantic.labelStrong,
                            borderColor: digit ? semantic.primaryNormal : semantic.lineSubtle,
                            backgroundColor: semantic.bgBase,
                            fontFamily: weightToFontFamily('700'),
                          },
                        ]}
                      />
                      {isCursor ? (
                        <Animated.View
                          style={[
                            styles.otpCursor,
                            { backgroundColor: semantic.primaryNormal, opacity: cursorOpacity },
                          ]}
                          pointerEvents="none"
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.timerRow}>
                <Text style={[styles.timer, { color: semantic.primaryNormal, fontFamily: weightToFontFamily('700') }]}>
                  {formatTimer(secondsLeft)}
                </Text>
                <TouchableOpacity
                  testID="resend-button"
                  onPress={handleResend}
                  disabled={secondsLeft > 0}
                  accessibilityRole="button"
                  accessibilityLabel="인증번호 재전송"
                >
                  <Text
                    style={[
                      styles.resendLabel,
                      {
                        color: secondsLeft > 0 ? semantic.labelAlt : semantic.primaryNormal,
                        fontFamily: weightToFontFamily('600'),
                      },
                    ]}
                  >
                    재전송
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                testID="verify-button"
                style={primaryStyle(isOtpComplete && !verifying)}
                disabled={!isOtpComplete || verifying}
                onPress={handleVerify}
                accessibilityRole="button"
                accessibilityLabel="인증 확인"
              >
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color: isOtpComplete ? semantic.labelOnColor : semantic.labelAlt,
                      fontFamily: weightToFontFamily('800'),
                    },
                  ]}
                >
                  {verifying ? '인증 중…' : '인증'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification
        title="reCAPTCHA 본인 확인"
        cancelLabel="취소"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  stepCaption: {
    marginTop: WANTED_TOKENS.spacing.s4,
    fontSize: 11,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    marginTop: WANTED_TOKENS.spacing.s2,
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  fieldHint: {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  inputRow: {
    height: 52,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
  inputInside: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.body1.size,
    paddingVertical: 0,
  },
  inlineButton: {
    height: 32,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: WANTED_TOKENS.spacing.s2,
    marginTop: WANTED_TOKENS.spacing.s5,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  primaryRow: {
    flexDirection: 'row',
    gap: WANTED_TOKENS.spacing.s2,
  },
  sectionLabel: {
    marginTop: WANTED_TOKENS.spacing.s6,
    marginBottom: WANTED_TOKENS.spacing.s3,
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  carrierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -WANTED_TOKENS.spacing.s1,
    marginVertical: -WANTED_TOKENS.spacing.s1,
  },
  carrierColumn: {
    width: '33.33%',
    padding: WANTED_TOKENS.spacing.s1,
  },
  carrierBox: {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  field: {
    marginTop: WANTED_TOKENS.spacing.s5,
  },
  inputLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: WANTED_TOKENS.spacing.s8,
  },
  otpCellWrapper: {
    width: 48,
    height: 60,
    position: 'relative',
  },
  otpCell: {
    width: 48,
    height: 60,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  otpCursor: {
    position: 'absolute',
    width: 2,
    height: 28,
    top: 16,
    left: 23,
    borderRadius: 1,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: WANTED_TOKENS.spacing.s5,
  },
  timer: {
    fontSize: WANTED_TOKENS.type.body2.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  resendLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});

export default SignupStep1Screen;
