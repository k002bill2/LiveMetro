/**
 * Sound Settings Screen
 * Configure notification sound and vibration preferences
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import SettingSlider from '@/components/settings/SettingSlider';
import SoundPicker from '@/components/settings/SoundPicker';
import VibrationPicker from '@/components/settings/VibrationPicker';
import {
  soundService,
  NOTIFICATION_SOUNDS,
  VIBRATION_PATTERNS,
} from '@/services/sound/soundService';
import {
  NotificationSoundId,
  VibrationPatternId,
  SoundPreferences,
} from '@/models/user';
import { emailNotificationService } from '@/services/email/emailService';

// Default sound settings for fallback
const DEFAULT_SOUND_SETTINGS: SoundPreferences = {
  soundEnabled: true,
  soundId: 'default',
  volume: 80,
  vibrationEnabled: true,
  vibrationPattern: 'default',
};

export const SoundSettingsScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { sendTestNotification } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Check if email notifications can be enabled for this user
  const canEnableEmail = user && !user.isAnonymous && !!user.email;

  const notificationSettings = user?.preferences.notificationSettings;
  const soundSettings = notificationSettings?.soundSettings || DEFAULT_SOUND_SETTINGS;

  // Initialize sound service
  useEffect(() => {
    soundService.initialize();

    return () => {
      soundService.cleanup();
    };
  }, []);

  // Helper to update sound settings
  const updateSoundSettings = useCallback(
    async (updates: Partial<SoundPreferences>): Promise<void> => {
      if (!user) return;

      try {
        setSaving(true);
        await updateUserProfile({
          preferences: {
            ...user.preferences,
            notificationSettings: {
              ...user.preferences.notificationSettings,
              soundSettings: {
                ...soundSettings,
                ...updates,
              },
            },
          },
        });
      } catch (error) {
        console.error('Error updating sound settings:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, soundSettings, updateUserProfile]
  );

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

  // Sound settings handlers
  const handleSoundEnabledChange = (value: boolean): void => {
    updateSoundSettings({ soundEnabled: value });
  };

  const handleSoundChange = (soundId: NotificationSoundId): void => {
    updateSoundSettings({ soundId });
  };

  const handleVolumeChange = useCallback(
    (volume: number): void => {
      // Debounce volume changes to avoid too many API calls
      updateSoundSettings({ volume });
    },
    [updateSoundSettings]
  );

  const handleVibrationEnabledChange = (value: boolean): void => {
    updateSoundSettings({ vibrationEnabled: value });
  };

  const handleVibrationPatternChange = (patternId: VibrationPatternId): void => {
    updateSoundSettings({ vibrationPattern: patternId });
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

  const handleTestEmail = async (): Promise<void> => {
    if (!canEnableEmail) {
      Alert.alert('안내', '이메일 알림을 사용하려면 이메일로 로그인해야 합니다.');
      return;
    }

    try {
      setSendingTestEmail(true);
      const success = await emailNotificationService.sendTestEmail();
      if (success) {
        Alert.alert('성공', `테스트 이메일이 ${user?.email}로 전송되었습니다.`);
      } else {
        Alert.alert('실패', '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      Alert.alert('오류', '이메일 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingTestEmail(false);
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
            subtitle={canEnableEmail ? "중요 업데이트 이메일로 수신" : "이메일 로그인 필요"}
            value={notificationSettings?.emailNotifications || false}
            onValueChange={handleToggleEmailNotifications}
            disabled={saving || !canEnableEmail}
          />
          {notificationSettings?.emailNotifications && canEnableEmail && (
            <TouchableOpacity
              style={[styles.testEmailButton, sendingTestEmail && styles.testEmailButtonDisabled]}
              onPress={handleTestEmail}
              disabled={sendingTestEmail}
            >
              <Text style={styles.testEmailButtonText}>
                {sendingTestEmail ? '전송 중...' : '테스트 이메일 보내기'}
              </Text>
            </TouchableOpacity>
          )}
        </SettingSection>

        {/* Sound Settings */}
        <SettingSection title="알림 효과">
          <SettingToggle
            icon="volume-high"
            label="알림음"
            subtitle="알림 수신 시 소리 재생"
            value={soundSettings.soundEnabled}
            onValueChange={handleSoundEnabledChange}
            disabled={saving}
          />

          {soundSettings.soundEnabled && (
            <>
              <SoundPicker
                icon="musical-notes"
                label="알림음 선택"
                options={NOTIFICATION_SOUNDS}
                value={soundSettings.soundId}
                volume={soundSettings.volume}
                onValueChange={handleSoundChange}
                disabled={saving}
              />

              <SettingSlider
                icon="volume-medium"
                label="볼륨"
                subtitle="알림음 볼륨 조절"
                value={soundSettings.volume}
                minValue={0}
                maxValue={100}
                step={10}
                unit="%"
                onValueChange={handleVolumeChange}
              />
            </>
          )}

          <SettingToggle
            icon="phone-portrait"
            label="진동"
            subtitle="알림 수신 시 진동"
            value={soundSettings.vibrationEnabled}
            onValueChange={handleVibrationEnabledChange}
            disabled={saving}
          />

          {soundSettings.vibrationEnabled && (
            <VibrationPicker
              icon="pulse"
              label="진동 패턴"
              options={VIBRATION_PATTERNS}
              value={soundSettings.vibrationPattern}
              onValueChange={handleVibrationPatternChange}
              disabled={saving}
            />
          )}
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
  testEmailButton: {
    backgroundColor: COLORS.primary.main,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  testEmailButtonDisabled: {
    opacity: 0.6,
  },
  testEmailButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
