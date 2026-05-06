/**
 * Settings Screen Component - Modern Design
 * User preferences and app configuration
 * Minimal grayscale design with black accent
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
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
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useAuth } from '../../services/auth/AuthContext';
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
  const { user, signOut } = useAuth();
  const { language, t } = useI18n();
  const { themeMode, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
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
  }> = ({ Icon, title, subtitle, onPress, showChevron = true }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={semantic.labelStrong} />
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
      <ScrollView style={styles.content}>
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
                  <LogIn size={20} color={semantic.labelStrong} />
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
                      size={20}
                      color={biometricAvailable ? semantic.labelStrong : semantic.labelDisabled}
                    />
                  ) : (
                    <Fingerprint
                      size={20}
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
              Icon={ShieldCheck}
              title={t.settings.termsOfService}
              onPress={() => {}}
              showChevron={false}
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

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={semantic.labelAlt} />
            <Text style={styles.signOutText}>{t.settings.signOut}</Text>
          </TouchableOpacity>
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
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s3,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      letterSpacing: 0.6,
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
      fontSize: WANTED_TOKENS.type.heading2.size,
      lineHeight: WANTED_TOKENS.type.heading2.lh,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: 4,
      letterSpacing:
        WANTED_TOKENS.type.heading2.size * WANTED_TOKENS.type.heading2.tracking,
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
      width: 36,
      height: 36,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    textContainer: {
      flex: 1,
    },
    settingTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    settingSubtitle: {
      fontSize: WANTED_TOKENS.type.body2.size,
      color: semantic.labelAlt,
      marginTop: 2,
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
  });

export default SettingsScreen;
