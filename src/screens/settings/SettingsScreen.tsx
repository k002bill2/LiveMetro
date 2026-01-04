/**
 * Settings Screen Component - Modern Design
 * User preferences and app configuration
 * Minimal grayscale design with black accent
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../services/auth/AuthContext';
import { useI18n } from '../../services/i18n';
import { useTheme } from '../../services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
import { SettingsStackParamList } from '@/navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isBiometricAvailable,
  isBiometricLoginEnabled,
  getBiometricTypeName,
  disableBiometricLogin,
  hasStoredCredentials,
} from '../../services/auth/biometricService';

// Storage key for biometric enabled state
const BIOMETRIC_ENABLED_KEY = '@livemetro_biometric_enabled';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { language, t } = useI18n();
  const { themeMode, colors } = useTheme();

  // Get display values for language and theme
  const languageDisplayName = language === 'ko' ? '한국어' : 'English';
  const themeDisplayName =
    themeMode === 'system'
      ? t.settings.themeSystem
      : themeMode === 'dark'
      ? t.settings.themeDark
      : t.settings.themeLight;

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypeName, setBiometricTypeName] = useState('생체인증');

  // Check biometric status on mount
  useEffect(() => {
    const checkBiometric = async (): Promise<void> => {
      try {
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);

        if (available) {
          const enabled = await isBiometricLoginEnabled();
          setBiometricEnabled(enabled);

          const typeName = await getBiometricTypeName();
          setBiometricTypeName(typeName);
        }
      } catch (error) {
        console.error('Error checking biometric status:', error);
      }
    };

    checkBiometric();
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
      // Enable biometric login (credentials already stored)
      try {
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        setBiometricEnabled(true);
        Alert.alert('완료', `${biometricTypeName} 로그인이 활성화되었습니다.`);
      } catch (error) {
        console.error('Error enabling biometric:', error);
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
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert(t.common.error, language === 'ko' ? '로그아웃에 실패했습니다.' : 'Failed to sign out.');
            }
          },
        },
      ],
    );
  };

  const styles = createStyles(colors);

  const SettingItem: React.FC<{
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showChevron?: boolean;
  }> = ({ icon, title, subtitle, onPress, showChevron = true }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={20} color={colors.textPrimary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* User Profile Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
          >
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={32} color={colors.textPrimary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.displayName || t.settings.anonymousUser}
              </Text>
              <Text style={styles.profileEmail}>
                {user?.email || 'anonymous@livemetro.app'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditProfile')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="create-outline" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.notificationSettings}</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="train-outline"
              title={t.settings.commuteSettings}
              subtitle={t.settings.commuteSettingsDesc}
              onPress={() => navigation.navigate('CommuteSettings')}
            />
            <SettingItem
              icon="notifications"
              title={t.settings.delayAlert}
              subtitle={t.settings.delayAlertDesc}
              onPress={() => navigation.navigate('DelayNotification')}
            />
            <SettingItem
              icon="time"
              title={t.settings.notificationTime}
              subtitle={t.settings.notificationTimeDesc}
              onPress={() => navigation.navigate('NotificationTime')}
            />
            <SettingItem
              icon="volume-high"
              title={t.settings.soundSettings}
              subtitle={t.settings.soundSettingsDesc}
              onPress={() => navigation.navigate('SoundSettings')}
            />
          </View>
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.appSettings}</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="language"
              title={t.settings.language}
              subtitle={languageDisplayName}
              onPress={() => navigation.navigate('LanguageSettings')}
            />
            <SettingItem
              icon="moon"
              title={t.settings.theme}
              subtitle={themeDisplayName}
              onPress={() => navigation.navigate('ThemeSettings')}
            />
            <SettingItem
              icon="location"
              title={t.settings.locationPermission}
              subtitle={t.settings.locationPermissionDesc}
              onPress={() => navigation.navigate('LocationPermission')}
            />
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.security}</Text>
          <View style={styles.settingGroup}>
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={biometricTypeName === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                    size={20}
                    color={biometricAvailable ? colors.textPrimary : colors.textDisabled}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[
                    styles.settingTitle,
                    !biometricAvailable && { color: colors.textDisabled }
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
                trackColor={{ false: colors.borderMedium, true: colors.primary }}
                thumbColor={colors.white}
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
              icon="help-circle"
              title={t.settings.help}
              subtitle={t.settings.helpDesc}
              onPress={() => navigation.navigate('Help')}
            />
            <SettingItem
              icon="document-text"
              title={t.settings.privacyPolicy}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            />
            <SettingItem
              icon="shield-checkmark"
              title={t.settings.termsOfService}
              onPress={() => {}}
              showChevron={false}
            />
            <SettingItem
              icon="information-circle"
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
            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.signOutText}>{t.settings.signOut}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: SPACING.xl,
    },
    sectionTitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: SPACING.md,
      marginHorizontal: SPACING.lg,
      letterSpacing: TYPOGRAPHY.letterSpacing.wide,
      textTransform: 'uppercase',
    },
    profileCard: {
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      marginHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    profileIcon: {
      width: 56,
      height: 56,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
      marginBottom: 4,
      letterSpacing: TYPOGRAPHY.letterSpacing.tight,
    },
    profileEmail: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textTertiary,
    },
    editButton: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: SPACING.sm,
    },
    settingGroup: {
      backgroundColor: colors.surface,
      marginHorizontal: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    settingItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 36,
      height: 36,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    textContainer: {
      flex: 1,
    },
    settingTitle: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textPrimary,
    },
    settingSubtitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textTertiary,
      marginTop: 2,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    signOutText: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textSecondary,
      marginLeft: SPACING.sm,
    },
  });

export default SettingsScreen;
