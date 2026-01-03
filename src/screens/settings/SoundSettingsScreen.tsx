/**
 * Sound Settings Screen
 * Configure notification sound and vibration preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useAuth } from '@/services/auth/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';

export const SoundSettingsScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { sendTestNotification } = useNotifications();
  const [saving, setSaving] = useState(false);

  const notificationSettings = user?.preferences.notificationSettings;

  const handleTogglePushNotifications = async (value: boolean): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            pushNotifications: value,
          },
        },
      });
    } catch (error) {
      console.error('Error updating push notifications:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmailNotifications = async (value: boolean): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            emailNotifications: value,
          },
        },
      });
    } catch (error) {
      console.error('Error updating email notifications:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (): Promise<void> => {
    try {
      const success = await sendTestNotification();
      if (success) {
        Alert.alert('성공', '테스트 알림이 전송되었습니다.');
      } else {
        Alert.alert('실패', '알림 권한이 허용되지 않았습니다.');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('오류', '테스트 알림 전송에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Notification Methods */}
        <SettingSection title="알림 방식">
          <SettingToggle
            icon="notifications"
            label="푸시 알림"
            subtitle="앱이 꺼져있어도 알림 받기"
            value={notificationSettings?.pushNotifications || false}
            onValueChange={handleTogglePushNotifications}
            disabled={saving}
          />
          <SettingToggle
            icon="mail"
            label="이메일 알림"
            subtitle="중요 업데이트 이메일로 수신 (준비 중)"
            value={notificationSettings?.emailNotifications || false}
            onValueChange={handleToggleEmailNotifications}
            disabled={true}
          />
        </SettingSection>

        {/* Future Features */}
        <SettingSection title="알림 효과">
          <View style={styles.disabledItem}>
            <Text style={styles.disabledLabel}>🔔 알림음</Text>
            <Text style={styles.disabledSubtitle}>
              알림 수신 시 소리 재생 (곧 추가될 예정)
            </Text>
          </View>
          <View style={styles.disabledItem}>
            <Text style={styles.disabledLabel}>📳 진동</Text>
            <Text style={styles.disabledSubtitle}>
              알림 수신 시 진동 (곧 추가될 예정)
            </Text>
          </View>
        </SettingSection>

        {/* Test Notification */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestNotification}
          >
            <Text style={styles.testButtonText}>테스트 알림 보내기</Text>
          </TouchableOpacity>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ 푸시 알림이 켜져 있어야 열차 지연 및 운행 중단 알림을 받을 수
            있습니다.
          </Text>
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
    paddingHorizontal: SPACING.lg,
  },
  disabledItem: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    opacity: 0.5,
  },
  disabledLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  disabledSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  testButton: {
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  infoBox: {
    backgroundColor: COLORS.primary.light,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
});

export default SoundSettingsScreen;
