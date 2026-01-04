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
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
import { SettingsStackParamList } from '@/navigation/types';
import {
  isBiometricAvailable,
  isBiometricLoginEnabled,
  getBiometricTypeName,
  disableBiometricLogin,
  hasStoredCredentials,
} from '../../services/auth/biometricService';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, signOut } = useAuth();

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
      // Check if credentials are stored
      const hasCredentials = await hasStoredCredentials();
      if (!hasCredentials) {
        Alert.alert(
          '설정 필요',
          `${biometricTypeName} 로그인을 사용하려면 먼저 이메일/비밀번호로 로그인해주세요.`,
          [{ text: '확인' }]
        );
        return;
      }
      setBiometricEnabled(true);
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
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('오류', '로그아웃에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

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
          <Ionicons name={icon as any} size={20} color={COLORS.black} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* User Profile Section */}
        <View style={styles.section}>
          <View style={styles.profileCard}>
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={32} color={COLORS.black} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.displayName || '익명 사용자'}
              </Text>
              <Text style={styles.profileEmail}>
                {user?.email || 'anonymous@livemetro.app'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="train-outline"
              title="출퇴근 설정"
              subtitle="출퇴근 경로 및 알림 설정"
              onPress={() => navigation.navigate('CommuteSettings')}
            />
            <SettingItem
              icon="notifications"
              title="지연 알림"
              subtitle="열차 지연 시 알림 받기"
              onPress={() => navigation.navigate('DelayNotification')}
            />
            <SettingItem
              icon="time"
              title="알림 시간대"
              subtitle="출퇴근 시간 설정"
              onPress={() => navigation.navigate('NotificationTime')}
            />
            <SettingItem
              icon="volume-high"
              title="소리 설정"
              subtitle="알림음 및 진동 설정"
              onPress={() => navigation.navigate('SoundSettings')}
            />
          </View>
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 설정</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="language"
              title="언어"
              subtitle="한국어"
              onPress={() => navigation.navigate('LanguageSettings')}
            />
            <SettingItem
              icon="moon"
              title="테마"
              subtitle="시스템 설정 따름"
              onPress={() => navigation.navigate('ThemeSettings')}
            />
            <SettingItem
              icon="location"
              title="위치 권한"
              subtitle="주변 역 검색을 위해 필요"
              onPress={() => navigation.navigate('LocationPermission')}
            />
          </View>
        </View>

        {/* Security Settings */}
        {biometricAvailable && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>보안</Text>
            <View style={styles.settingGroup}>
              <View style={styles.settingItem}>
                <View style={styles.settingItemLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={biometricTypeName === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                      size={20}
                      color={COLORS.black}
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.settingTitle}>{biometricTypeName} 로그인</Text>
                    <Text style={styles.settingSubtitle}>{biometricTypeName}로 빠르게 로그인</Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: COLORS.gray[300], true: COLORS.black }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>
          </View>
        )}

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>정보</Text>
          <View style={styles.settingGroup}>
            <SettingItem
              icon="help-circle"
              title="도움말"
              subtitle="앱 사용법 및 FAQ"
              onPress={() => navigation.navigate('Help')}
            />
            <SettingItem
              icon="document-text"
              title="개인정보처리방침"
              onPress={() => navigation.navigate('PrivacyPolicy')}
            />
            <SettingItem
              icon="shield-checkmark"
              title="서비스 이용약관"
              onPress={() => {}}
              showChevron={false}
            />
            <SettingItem
              icon="information-circle"
              title="앱 정보"
              subtitle="버전 1.0.0"
              onPress={() => {}}
              showChevron={false}
            />
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.text.secondary} />
            <Text style={styles.signOutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.lg,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  profileCard: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  profileIcon: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: 4,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  profileEmail: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  settingGroup: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.surface.card,
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
    color: COLORS.text.primary,
  },
  settingSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  signOutText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
  },
});
export default SettingsScreen;
