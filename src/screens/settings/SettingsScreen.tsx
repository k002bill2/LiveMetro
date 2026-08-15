/**
 * Settings Screen Component - Modern Design
 * User preferences and app configuration
 * Minimal grayscale design with black accent
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSemanticTokens } from '@/services/theme';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import {
  ChevronRight,
  TrainFront,
  Bell,
  Clock,
  Volume2,
  Globe,
  Moon,
  MapPin,
  LogIn,
  ScanFace,
  Fingerprint,
  HelpCircle,
  Shield,
  ShieldCheck,
  Info,
  LogOut,
  FileCheck,
  MessageSquare,
  Wrench,
  Trash2,
  Activity,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useAuth } from '../../services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { AppStackParamList } from '@/navigation/types';
import { useI18n } from '../../services/i18n';
import { useTheme } from '../../services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '../../styles/modernTheme';
import { SettingsStackParamList } from '@/navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  isBiometricAvailable,
  isBiometricLoginEnabled,
  getBiometricTypeName,
  reEnableBiometricLogin,
  disableBiometricLogin,
  hasStoredCredentials,
} from '../../services/auth/biometricService';
import { commuteLogService } from '@/services/pattern/commuteLogService';
import { deleteCommuteSettings } from '@/services/commute/commuteService';
import {
  loadDetectionEpisodes,
  summarizeDetectionMetrics,
  formatDetectionSummary,
  clearDetectionMetrics,
} from '@/services/guidance/guidanceDetectionMetrics';
import { deleteAccountAndPurgeLocalData } from '@/services/account/accountDeletionService';

/**
 * Phase 42 (SE1): pick the first grapheme of the user's display name as
 * the avatar initial. Falls back to '?' for anonymous / blank names.
 * Korean characters are single graphemes so a single Array.from is enough.
 */
const getAvatarInitial = (name?: string | null): string => {
  if (!name || name.trim().length === 0) return '?';
  const chars = Array.from(name.trim());
  return chars[0]!.toUpperCase();
};

// Storage keys
const AUTO_LOGIN_ENABLED_KEY = '@livemetro_auto_login_enabled';
const AUTO_LOGIN_EMAIL_KEY = 'livemetro_auto_login_email';
const AUTO_LOGIN_PASSWORD_KEY = 'livemetro_auto_login_password';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, firebaseUser, signOut, deleteCurrentUser } = useAuth();
  const { resetSignupFlow } = useOnboarding();
  const { language, t } = useI18n();
  const { themeMode } = useTheme();
  const semantic = useSemanticTokens();
  // Root navigation for screens outside SettingsNavigator
  const rootNavigation = useNavigation<NavigationProp<AppStackParamList>>();

  // Get display values for language and theme
  const languageDisplayName = language === 'ko' ? '한국어' : 'English';
  const themeDisplayName =
    themeMode === 'system'
      ? t.settings.themeSystem
      : themeMode === 'dark'
      ? t.settings.themeDark
      : t.settings.themeLight;

  // Auto login state
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(false);

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypeName, setBiometricTypeName] = useState('생체인증');

  // Phase 42 (SE1): commute log count for the profile card meta line
  // ("누적 N회"). null = not yet loaded; failure leaves it null so the
  // meta line silently omits the trailing fragment.
  const [commuteCount, setCommuteCount] = useState<number | null>(null);

  // Check auto login and biometric status on mount
  useEffect(() => {
    const checkSettings = async (): Promise<void> => {
      try {
        // Check auto login status
        const savedAutoLogin = await AsyncStorage.getItem(AUTO_LOGIN_ENABLED_KEY);
        setAutoLoginEnabled(savedAutoLogin === 'true');

        // Check biometric status
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);

        if (available) {
          const enabled = await isBiometricLoginEnabled();
          setBiometricEnabled(enabled);

          const typeName = await getBiometricTypeName();
          setBiometricTypeName(typeName);
        }
      } catch {
        // Error checking settings status
      }
    };

    checkSettings();
  }, []);

  // Phase 42 (SE1): load commute log count once when the user becomes
  // available. Cancelled flag prevents setState after unmount.
  useEffect(() => {
    if (!user?.id) {
      setCommuteCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const logs = await commuteLogService.getCommuteLogs(user.id);
        if (!cancelled) setCommuteCount(logs.length);
      } catch {
        // Failure leaves commuteCount null — meta line gracefully omits "누적 N회".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Handle auto login toggle
  const handleAutoLoginToggle = useCallback(async (value: boolean): Promise<void> => {
    if (!value) {
      // Disable: show confirmation dialog
      Alert.alert(
        '자동로그인 해제',
        '저장된 로그인 정보가 삭제됩니다. 계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '해제',
            style: 'destructive',
            onPress: async () => {
              try {
                await AsyncStorage.setItem(AUTO_LOGIN_ENABLED_KEY, 'false');
                await SecureStore.deleteItemAsync(AUTO_LOGIN_EMAIL_KEY);
                await SecureStore.deleteItemAsync(AUTO_LOGIN_PASSWORD_KEY);
                setAutoLoginEnabled(false);
              } catch {
                Alert.alert('오류', '설정 변경에 실패했습니다.');
              }
            },
          },
        ]
      );
    } else {
      // Enable: show info that it can only be set during login
      Alert.alert(
        '자동로그인',
        '자동로그인은 로그인 시 설정할 수 있습니다.',
        [{ text: '확인' }]
      );
    }
  }, []);

  // Handle biometric toggle
  const handleBiometricToggle = useCallback(async (value: boolean): Promise<void> => {
    if (value) {
      // Check if credentials are stored (set during login)
      const hasCredentials = await hasStoredCredentials();
      if (!hasCredentials) {
        Alert.alert(
          '설정 필요',
          `${biometricTypeName} 로그인을 사용하려면 먼저 로그아웃 후 이메일/비밀번호로 다시 로그인해주세요.\n\n로그인 시 ${biometricTypeName} 설정 안내가 표시됩니다.`,
          [{ text: '확인' }]
        );
        return;
      }
      // Enable biometric login via service SoT (credentials already stored)
      const success = await reEnableBiometricLogin();
      if (success) {
        setBiometricEnabled(true);
        Alert.alert('완료', `${biometricTypeName} 로그인이 활성화되었습니다.`);
      } else {
        Alert.alert('오류', '설정 변경에 실패했습니다.');
      }
    } else {
      // Confirm disable
      Alert.alert(
        `${biometricTypeName} 비활성화`,
        `${biometricTypeName} 로그인을 비활성화하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '비활성화',
            style: 'destructive',
            onPress: async () => {
              const success = await disableBiometricLogin();
              if (success) {
                setBiometricEnabled(false);
              } else {
                Alert.alert('오류', '설정 변경에 실패했습니다.');
              }
            },
          },
        ]
      );
    }
  }, [biometricTypeName]);

  /**
   * 계정 삭제 실행 — 서버 전수 파기(deleteAccount) → 로컬 파기 → 온보딩
   * 상태 리셋 → 로그아웃.
   *
   * `resetSignupFlow()`는 반드시 `signOut()` **전에** 호출한다:
   * OnboardingContext의 userId가 사라지면 early-return 하므로(그 함수는
   * in-memory 플래그도 함께 되돌린다) 순서가 뒤집히면 다음 로그인에서
   * 온보딩이 완료된 것처럼 보인다.
   *
   * 서버가 Auth 레코드까지 지우므로 여기서 deleteCurrentUser()는 호출하지
   * 않는다. 실패는 친화 메시지만 노출하고 로그아웃하지 않는다 — 계정이
   * 아직 살아 있으므로 그대로 재시도할 수 있다.
   */
  const deletionInFlight = useRef(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const runAccountDeletion = useCallback(async (): Promise<void> => {
    // 중복 탭 가드 — state는 렌더용, 실제 게이트는 ref(동기 반영).
    if (deletionInFlight.current) return;
    deletionInFlight.current = true;
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccountAndPurgeLocalData();
      if (!result.success) {
        Alert.alert(
          '계정 삭제 실패',
          result.error ?? '계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        );
        return;
      }

      try {
        await resetSignupFlow();
      } catch {
        // 비치명: 다음 실행에서 온보딩이 한 번 더 뜰 뿐이다.
      }
      try {
        await signOut();
      } catch {
        // 계정은 이미 서버에서 삭제됐다 — 로컬 세션 해제 실패는 비치명.
      }
      Alert.alert(
        '삭제 완료',
        '계정과 모든 개인 데이터가 삭제되었습니다.\n이용해 주셔서 감사합니다.',
      );
    } finally {
      deletionInFlight.current = false;
      setIsDeletingAccount(false);
    }
  }, [resetSignupFlow, signOut]);

  /** 2단계 확인 — 1차 경고(무엇이 지워지는지) → 2차 최종 확인. */
  const handleDeleteAccount = useCallback((): void => {
    Alert.alert(
      '계정 삭제',
      [
        '계정을 삭제하면 다음 정보가 영구 삭제됩니다:',
        '',
        '• 계정 및 프로필 정보',
        '• 즐겨찾는 역, 출퇴근 경로 설정',
        '• 이동 기록과 패턴 분석 데이터',
        '• 알림 설정 및 푸시 토큰',
        '',
        '작성하신 지연·혼잡도 제보는 다른 이용자에게 도움이 되므로 삭제되지 않고 익명 처리됩니다.',
        '',
        '이 작업은 되돌릴 수 없습니다.',
      ].join('\n'),
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계속',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '정말 삭제하시겠습니까?',
              '마지막 확인입니다. 삭제된 데이터는 복구할 수 없습니다.',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '영구 삭제',
                  style: 'destructive',
                  onPress: () => {
                    void runAccountDeletion();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [runAccountDeletion]);

  const handleNukeAccount = useCallback((): void => {
    Alert.alert(
      '⚠️ 회원 정보 모두 삭제',
      [
        '다음 데이터를 영구 삭제합니다 (개발용):',
        '',
        '• Firebase 계정 (휴대폰 인증 기록 포함)',
        '• 출퇴근 경로 설정 (종점행 선호 포함)',
        '• 생체 인증 자격증명 (SecureStore)',
        '• 자동 로그인 정보',
        '• 온보딩 / 가입 축하 표시 플래그',
        '',
        '이 작업은 되돌릴 수 없습니다.',
      ].join('\n'),
      [
        { text: '취소', style: 'cancel' },
        {
          text: '모두 삭제',
          style: 'destructive',
          onPress: async () => {
            // 원격 개인 데이터(commuteSettings/<uid> = 출퇴근 경로 + 종점행
            // 선호)는 Auth 계정 삭제 **전에** 파기한다. firestore.rules가
            // `request.auth.uid == userId`를 요구하므로 deleteUser 이후에는
            // 토큰이 없어 permission-denied로 조용히 실패하고, 계정이 사라진
            // 뒤의 문서는 어떤 클라이언트로도 도달할 수 없는 고아가 된다.
            // 실패해도 계정 삭제는 계속한다 — 일시적 Firestore 오류가 계정
            // 삭제 자체를 막는 쪽이 더 나쁜 실패 모드다(로그만 남긴다).
            //
            // uid는 `user?.id`를 우선하되 `firebaseUser?.uid`로 폴백한다:
            // `user`는 users/<uid> 문서 리스너가 채우므로 그 읽기가 아직/영영
            // 실패한 상태에서도 deleteCurrentUser(auth.currentUser 기준)는
            // 성공한다. 그 창에서 `user?.id`만 보면 파기를 건너뛴 채 계정이
            // 사라져 고아 문서가 남는다. 두 값은 같은 도메인이다
            // (AuthContext.tsx:175 — `id: firebaseUser.uid`).
            const purgeUid = user?.id ?? firebaseUser?.uid;
            if (purgeUid) {
              const purge = await deleteCommuteSettings(purgeUid);
              if (!purge.success) {
                console.error('Commute settings purge failed (non-fatal):', purge.error);
              }
            }
            // Order matters: Firebase user deletion FIRST, then local
            // cleanup only on success. If Firebase delete fails (e.g.
            // `auth/requires-recent-login`) we abort with local data
            // intact — otherwise the user would be stuck signed in but
            // forced through the entire signup/onboarding flow again.
            try {
              await deleteCurrentUser();
            } catch (err) {
              const message = err instanceof Error ? err.message : '계정 삭제에 실패했습니다.';
              Alert.alert('계정 삭제 오류', message);
              return;
            }
            // Firebase delete succeeded → wipe local in parallel. Each
            // step is non-fatal (logged, never thrown) so a single
            // SecureStore hiccup can't strand the user with a deleted
            // Firebase account but lingering local credentials.
            try {
              await disableBiometricLogin();
            } catch (e) {
              console.error('Biometric cleanup failed (non-fatal):', e);
            }
            try {
              await AsyncStorage.removeItem(AUTO_LOGIN_ENABLED_KEY);
              await SecureStore.deleteItemAsync(AUTO_LOGIN_EMAIL_KEY);
            } catch (e) {
              console.error('Auto-login cleanup failed (non-fatal):', e);
            }
            try {
              await resetSignupFlow();
            } catch (e) {
              console.error('Onboarding reset failed (non-fatal):', e);
            }
            // 길안내 감지 진단 이력(역명·노선ID·타임스탬프 = 위치 이력)도 파기 —
            // 전역 device-local 키라 계정 삭제 시 남으면 개인정보처리방침의 즉시 파기
            // 약속과 상충하고 다음 계정 요약에 혼입될 수 있다. fire-and-forget(no-throw).
            void clearDetectionMetrics();
            Alert.alert(
              '삭제 완료',
              '모든 데이터가 삭제되었습니다.\n앱을 재시작하면 처음부터 가입 흐름이 시작됩니다.',
            );
          },
        },
      ],
    );
  }, [deleteCurrentUser, resetSignupFlow, user?.id, firebaseUser?.uid]);

  const handleResetSignupFlow = useCallback((): void => {
    Alert.alert(
      '온보딩 상태 리셋',
      '저장된 온보딩 완료 / 가입 축하 표시 플래그를 모두 지웁니다.\n\n다음 앱 실행 시 가입 축하 → 온보딩 흐름이 처음부터 다시 표시돼요. (개발용)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '리셋',
          style: 'destructive',
          onPress: async () => {
            await resetSignupFlow();
            Alert.alert(
              '리셋 완료',
              '앱을 재시작하면 가입 축하 화면이 다시 표시됩니다.',
            );
          },
        },
      ],
    );
  }, [resetSignupFlow]);

  // 길안내 감지(soft-confirm) 적중률 진단 — 저장된 에피소드를 집계해 Alert로 보여준다.
  // 라벨/버튼/요약은 i18n(t.settings.detectionDiagnostics)에서 주입 → 서비스는 순수 유지.
  // 로드 실패는 친화 메시지로 폴백, 초기화는 fire-and-forget.
  const handleDetectionDiagnostics = useCallback(async (): Promise<void> => {
    const labels = t.settings.detectionDiagnostics;
    try {
      const episodes = await loadDetectionEpisodes();
      // null = 저장소 읽기 실패(빈 이력과 구분) → "기록 없음" 요약이 아니라 로드 에러 표시.
      if (episodes === null) {
        Alert.alert(t.common.error, labels.loadError);
        return;
      }
      const summary = summarizeDetectionMetrics(episodes);
      Alert.alert(labels.title, formatDetectionSummary(summary, labels), [
        { text: labels.resetButton, style: 'destructive', onPress: () => void clearDetectionMetrics() },
        { text: labels.closeButton, style: 'cancel' },
      ]);
    } catch {
      Alert.alert(t.common.error, labels.loadError);
    }
  }, [t]);

  const handleSignOut = async (): Promise<void> => {
    Alert.alert(
      t.settings.signOut,
      t.settings.signOutConfirm,
      [
        {
          text: t.common.cancel,
          style: 'cancel',
        },
        {
          text: t.settings.signOut,
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // 로그아웃 시에도 길안내 감지 진단 이력을 파기 — 기기-로컬 측정이라
              // 세션 종료 시 정리가 정직하고, 같은 기기에서 다음 계정으로 로그인해도
              // 이전 사용자의 위치성 이력이 혼입되지 않는다. fire-and-forget(no-throw).
              void clearDetectionMetrics();
            } catch {
              Alert.alert(t.common.error, language === 'ko' ? '로그아웃에 실패했습니다.' : 'Failed to sign out.');
            }
          },
        },
      ],
    );
  };

  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const SettingItem: React.FC<{
    Icon: React.ElementType;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showChevron?: boolean;
    accessibilityLabel?: string;
    testID?: string;
  }> = ({ Icon, title, subtitle, onPress, showChevron = true, accessibilityLabel, testID }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Icon size={16} color={semantic.labelStrong} strokeWidth={2} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showChevron && (
        <ChevronRight size={20} color={semantic.labelAlt} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} testID="settings-screen">
        {/* User Profile Section — Phase 42 (SE1): gradient avatar + 이니셜
            + 누적 횟수. 카드 전체 onPress가 EditProfile로 이동하므로
            별도 Pencil 버튼 대신 chevron-right만 표시 (번들 매칭). */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="프로필 편집"
          >
            <LinearGradient
              colors={['#0066FF', '#6FA8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileAvatar}
            >
              <Text style={styles.profileAvatarInitial}>
                {getAvatarInitial(user?.displayName)}
              </Text>
            </LinearGradient>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.displayName || t.settings.anonymousUser}
              </Text>
              <Text style={styles.profileEmail}>
                {user?.email || 'anonymous@livemetro.app'}
                {commuteCount !== null && ` · 누적 ${commuteCount}회`}
              </Text>
            </View>
            <ChevronRight size={18} color={semantic.labelAlt} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.notificationSettings}</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              Icon={TrainFront}
              title={t.settings.commuteSettings}
              subtitle={t.settings.commuteSettingsDesc}
              onPress={() => navigation.navigate('CommuteSettings')}
            />
            <SettingItem
              Icon={Bell}
              title={t.settings.delayAlert}
              subtitle={t.settings.delayAlertDesc}
              onPress={() => navigation.navigate('DelayNotification')}
            />
            <SettingItem
              Icon={Clock}
              title={t.settings.notificationTime}
              subtitle={t.settings.notificationTimeDesc}
              onPress={() => navigation.navigate('NotificationTime')}
            />
            <SettingItem
              Icon={Volume2}
              title={t.settings.soundSettings}
              subtitle={t.settings.soundSettingsDesc}
              onPress={() => navigation.navigate('SoundSettings')}
            />
          </View>
        </View>

        {/* Delay Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === 'ko' ? '지연 정보' : 'DELAY INFO'}
          </Text>
          <View style={styles.settingGroup}>
            <SettingItem
              Icon={MessageSquare}
              title={language === 'ko' ? '실시간 제보' : 'Live Reports'}
              subtitle={language === 'ko' ? '승객들의 실시간 지연 제보' : 'Real-time delay reports from passengers'}
              onPress={() => rootNavigation.navigate('DelayFeed')}
            />
            <SettingItem
              Icon={FileCheck}
              title={language === 'ko' ? '지연증명서' : 'Delay Certificate'}
              subtitle={language === 'ko' ? '지연 이력 및 증명서 발급' : 'Delay history and certificate issuance'}
              onPress={() => rootNavigation.navigate('DelayCertificate')}
            />
          </View>
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.appSettings}</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              Icon={Globe}
              title={t.settings.language}
              subtitle={languageDisplayName}
              onPress={() => navigation.navigate('LanguageSettings')}
            />
            <SettingItem
              Icon={Moon}
              title={t.settings.theme}
              subtitle={themeDisplayName}
              onPress={() => navigation.navigate('ThemeSettings')}
            />
            <SettingItem
              Icon={MapPin}
              title={t.settings.locationPermission}
              subtitle={t.settings.locationPermissionDesc}
              onPress={() => navigation.navigate('LocationPermission')}
            />
            <SettingItem
              Icon={Shield}
              title={t.settings.privacyPolicy}
              subtitle={language === 'ko' ? '데이터 사용 및 권한 관리' : 'Data usage and permissions'}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            />
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.security}</Text>
          <View style={styles.settingGroup}>
            {/* Auto Login Toggle */}
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <View style={styles.iconContainer}>
                  <LogIn size={16} color={semantic.labelStrong} strokeWidth={2} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>
                    {language === 'ko' ? '자동로그인' : 'Auto Login'}
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {language === 'ko' ? '앱 시작 시 자동으로 로그인합니다' : 'Automatically sign in when app starts'}
                  </Text>
                </View>
              </View>
              <Switch
                value={autoLoginEnabled}
                onValueChange={handleAutoLoginToggle}
                trackColor={{ false: semantic.lineNormal, true: semantic.primaryNormal }}
                thumbColor={'#FFFFFF'}
              />
            </View>
            {/* Biometric Login Toggle */}
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <View style={styles.iconContainer}>
                  {biometricTypeName === 'Face ID' ? (
                    <ScanFace
                      size={16}
                      strokeWidth={2}
                      color={biometricAvailable ? semantic.labelStrong : semantic.labelDisabled}
                    />
                  ) : (
                    <Fingerprint
                      size={16}
                      strokeWidth={2}
                      color={biometricAvailable ? semantic.labelStrong : semantic.labelDisabled}
                    />
                  )}
                </View>
                <View style={styles.textContainer}>
                  <Text style={[
                    styles.settingTitle,
                    !biometricAvailable && { color: semantic.labelDisabled }
                  ]}>
                    {biometricTypeName} {language === 'ko' ? '로그인' : 'Login'}
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {biometricAvailable
                      ? (language === 'ko' ? `${biometricTypeName}로 빠르게 로그인` : `Quick login with ${biometricTypeName}`)
                      : t.settings.biometricUnavailable}
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: semantic.lineNormal, true: semantic.primaryNormal }}
                thumbColor={'#FFFFFF'}
                disabled={!biometricAvailable}
              />
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.info}</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              Icon={HelpCircle}
              title={t.settings.help}
              subtitle={t.settings.helpDesc}
              onPress={() => navigation.navigate('Help')}
            />
            <SettingItem
              Icon={MessageSquare}
              title={t.settings.feedback}
              subtitle={t.settings.feedbackDesc}
              onPress={() => navigation.navigate('Feedback')}
            />
            <SettingItem
              Icon={ShieldCheck}
              title={t.settings.termsOfService}
              onPress={() => navigation.navigate('TermsOfService')}
            />
            <SettingItem
              Icon={Activity}
              title={language === 'ko' ? '길안내 감지 진단' : 'Guidance Detection Diagnostics'}
              subtitle={
                language === 'ko'
                  ? '탑승 감지 적중률 및 대기 기록 보기'
                  : 'Boarding-detection hit rate and wait log'
              }
              onPress={handleDetectionDiagnostics}
              accessibilityLabel={language === 'ko' ? '길안내 감지 진단 보기' : 'View guidance detection diagnostics'}
              testID="settings-detection-diagnostics"
            />
            <SettingItem
              Icon={Info}
              title={t.settings.appInfo}
              subtitle={`${t.settings.version} 1.0.0`}
              onPress={() => {}}
              showChevron={false}
            />
          </View>
        </View>

        {/* Dev Tools — visible only in __DEV__ builds. Reset onboarding +
            celebration flags so the next launch re-runs the post-auth
            wizard for testing. Excluded from production binaries entirely
            because Metro inlines `__DEV__` as a literal `false` then. */}
        {__DEV__ ? (
          <View style={styles.section} testID="dev-tools-section">
            <Text style={styles.devSectionLabel}>개발자 도구</Text>
            <TouchableOpacity
              style={styles.devButton}
              onPress={handleResetSignupFlow}
              testID="dev-reset-signup-flow"
              accessibilityRole="button"
              accessibilityLabel="온보딩 상태 리셋"
            >
              <Wrench size={20} color={semantic.labelAlt} />
              <Text style={styles.devButtonText}>온보딩 상태 리셋</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.devButton, styles.devButtonDanger]}
              onPress={handleNukeAccount}
              testID="dev-nuke-account"
              accessibilityRole="button"
              accessibilityLabel="회원 정보 모두 삭제"
            >
              <Trash2 size={20} color="#E04A3F" />
              <Text style={[styles.devButtonText, styles.devButtonTextDanger]}>
                회원 정보 모두 삭제
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={semantic.labelAlt} />
            <Text style={styles.signOutText}>{t.settings.signOut}</Text>
          </TouchableOpacity>
        </View>

        {/* 계정 삭제 — 되돌릴 수 없는 위험 액션이라 로그아웃 아래에 분리 배치.
            2단계 확인 후 서버 전수 파기 → 로컬 파기 → 로그아웃한다. */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDeletingAccount }}
            accessibilityLabel={
              language === 'ko'
                ? '계정 삭제, 모든 개인 데이터가 영구 삭제됩니다'
                : 'Delete account, all personal data will be permanently erased'
            }
            testID="settings-delete-account"
          >
            <Trash2 size={20} color={semantic.statusNegative} />
            <Text style={styles.deleteAccountText}>
              {isDeletingAccount
                ? language === 'ko'
                  ? '삭제 중...'
                  : 'Deleting...'
                : language === 'ko'
                ? '계정 삭제'
                : 'Delete Account'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.deleteAccountHint}>
            {language === 'ko'
              ? '계정과 개인 데이터가 영구 삭제됩니다. 작성한 제보는 익명 처리 후 유지됩니다.'
              : 'Your account and personal data are erased permanently. Reports you posted are kept anonymized.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      // Phase 5 alignment: bgSubtlePage gives Settings its own quiet shade
      // distinct from card surfaces. Theme-reactive via isDark.
      backgroundColor: semantic.bgSubtlePage,
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    sectionTitle: {
      // Wanted handoff (rest.jsx:649): 12/800 labelAlt 0.04em uppercase eyebrow.
      // Stronger weight + smaller size builds the hierarchy gap with item title (14/600).
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s2,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    profileCard: {
      backgroundColor: semantic.bgBase,
      flexDirection: 'row',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    profileIcon: {
      width: 56,
      height: 56,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    // Phase 42 (SE1): gradient pill avatar replacing the User-icon block.
    // 52x52 matches the design handoff's profile slot.
    profileAvatar: {
      width: 52,
      height: 52,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s4,
      // iOS shadow fast-path: shadow가 LinearGradient에 직접 걸리면 투명 알파에서
      // 매 프레임 경로를 역산해 "cannot calculate shadow efficiently" advice를 띄운다.
      // 불투명 배경색으로 pill 모양에서 그림자를 캐싱한다. 위 gradient(#0066FF→#6FA8FF,
      // 완전 불투명)가 이 색을 가려 시각적 변화는 없다 — gradient의 시작 stop과 일치.
      backgroundColor: '#0066FF',
      shadowColor: '#0066FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    profileAvatarInitial: {
      color: '#FFFFFF',
      fontSize: 22,
      fontFamily: weightToFontFamily('800'),
      lineHeight: 26,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      // Wanted handoff (rest.jsx:693): 16/800 labelStrong. Smaller and stronger than
      // the previous heading2 (20/700) to fit the dense profile-card hierarchy.
      fontSize: WANTED_TOKENS.type.body1.size,
      lineHeight: WANTED_TOKENS.type.body1.lh,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      marginBottom: 2,
    },
    profileEmail: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    editButton: {
      width: 36,
      height: 36,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    settingGroup: {
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      overflow: 'hidden',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    settingItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      // Wanted handoff (rest.jsx:658): 32×32 rounded-square (r8 CSS = r4 token = 8px)
      // with 16px icon. Replaces the prior 36×36 r-pill / icon-20 form factor.
      width: 32,
      height: 32,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r4,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    textContainer: {
      flex: 1,
    },
    settingTitle: {
      // Wanted handoff (rest.jsx:662): 14/600 labelStrong (label1 token).
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    settingSubtitle: {
      // Wanted handoff (rest.jsx:663): 11/600 labelAlt with 1px tighter top inset.
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 1,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    signOutText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    deleteAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      // 최소 44x44pt 터치 영역 확보 (아이콘 20 + 상하 패딩).
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.statusNegative,
    },
    deleteAccountText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.statusNegative,
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    deleteAccountHint: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '400',
      fontFamily: weightToFontFamily('400'),
      color: semantic.labelAlt,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s2,
      textAlign: 'center',
    },
    devSectionLabel: {
      fontSize: 12,
      letterSpacing: 0.44,
      textTransform: 'uppercase',
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    devButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      // iOS can't draw dashed borders with a borderRadius (renders solid +
      // warns "Unsupported dashed / dotted border style"); keep dashed on Android.
      borderStyle: Platform.OS === 'ios' ? 'solid' : 'dashed',
      borderColor: semantic.lineNormal,
    },
    devButtonDanger: {
      marginTop: WANTED_TOKENS.spacing.s2,
      borderColor: 'rgba(224,74,63,0.55)',
    },
    devButtonText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    devButtonTextDanger: {
      color: '#E04A3F',
    },
  });

export default SettingsScreen;
