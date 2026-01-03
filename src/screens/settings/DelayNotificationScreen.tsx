/**
 * Delay Notification Settings Screen
 * Configure delay alerts and thresholds
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
import SettingSlider from '@/components/settings/SettingSlider';

export const DelayNotificationScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { sendTestNotification } = useNotifications();
  const [saving, setSaving] = useState(false);

  const notificationSettings = user?.preferences.notificationSettings;

  const handleToggleEnabled = async (value: boolean): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            enabled: value,
          },
        },
      });
    } catch (error) {
      console.error('Error updating notifications enabled:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleThresholdChange = async (value: number): Promise<void> => {
    if (!user) return;

    try {
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            delayThresholdMinutes: value,
          },
        },
      });
    } catch (error) {
      console.error('Error updating delay threshold:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    }
  };

  const handleToggleAlertType = async (
    alertType: 'delays' | 'suspensions' | 'congestion' | 'alternativeRoutes' | 'serviceUpdates',
    value: boolean
  ): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            alertTypes: {
              ...user.preferences.notificationSettings.alertTypes,
              [alertType]: value,
            },
          },
        },
      });
    } catch (error) {
      console.error(`Error updating ${alertType} alert type:`, error);
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
        {/* Basic Settings */}
        <SettingSection title="기본 설정">
          <SettingToggle
            icon="notifications"
            label="지연 알림 받기"
            subtitle="열차 지연 시 알림을 보냅니다"
            value={notificationSettings?.enabled || false}
            onValueChange={handleToggleEnabled}
            disabled={saving}
          />
        </SettingSection>

        {/* Delay Threshold */}
        <SettingSection title="지연 기준">
          <SettingSlider
            icon="time"
            label="알림 기준 시간"
            subtitle={`${notificationSettings?.delayThresholdMinutes || 5}분 이상 지연 시 알림`}
            value={notificationSettings?.delayThresholdMinutes || 5}
            minValue={5}
            maxValue={30}
            step={5}
            unit="분"
            onValueChange={handleThresholdChange}
          />
        </SettingSection>

        {/* Alert Types */}
        <SettingSection title="알림 종류">
          <SettingToggle
            icon="train"
            label="열차 지연"
            subtitle="정상 운행 시간보다 지연될 때"
            value={notificationSettings?.alertTypes.delays || false}
            onValueChange={(value) => handleToggleAlertType('delays', value)}
            disabled={saving}
          />
          <SettingToggle
            icon="close-circle"
            label="운행 중단"
            subtitle="열차 운행이 일시 중단될 때"
            value={notificationSettings?.alertTypes.suspensions || false}
            onValueChange={(value) => handleToggleAlertType('suspensions', value)}
            disabled={saving}
          />
          <SettingToggle
            icon="people"
            label="혼잡도 경고"
            subtitle="열차 혼잡도가 높을 때"
            value={notificationSettings?.alertTypes.congestion || false}
            onValueChange={(value) => handleToggleAlertType('congestion', value)}
            disabled={saving}
          />
          <SettingToggle
            icon="swap-horizontal"
            label="대체 경로"
            subtitle="지연 시 대체 경로 추천"
            value={notificationSettings?.alertTypes.alternativeRoutes || false}
            onValueChange={(value) =>
              handleToggleAlertType('alternativeRoutes', value)
            }
            disabled={saving}
          />
          <SettingToggle
            icon="megaphone"
            label="서비스 업데이트"
            subtitle="노선 변경 및 공지사항"
            value={notificationSettings?.alertTypes.serviceUpdates || false}
            onValueChange={(value) =>
              handleToggleAlertType('serviceUpdates', value)
            }
            disabled={saving}
          />
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
            ℹ️ 알림은 즐겨찾기에 등록된 역과 자주 이용하는 노선을 기준으로
            전송됩니다.
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

export default DelayNotificationScreen;
