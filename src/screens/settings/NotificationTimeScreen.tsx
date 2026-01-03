/**
 * Notification Time Settings Screen
 * Configure commute schedule and quiet hours
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useAuth } from '@/services/auth/AuthContext';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import SettingTimePicker from '@/components/settings/SettingTimePicker';

export const NotificationTimeScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const notificationSettings = user?.preferences.notificationSettings;
  const commuteSchedule = user?.preferences.commuteSchedule;

  // Default times if not set
  const morningTime = commuteSchedule?.weekdays?.morningCommute?.departureTime || '08:00';
  const eveningTime = commuteSchedule?.weekdays?.eveningCommute?.departureTime || '18:00';
  const quietHoursStart = notificationSettings?.quietHours?.startTime || '22:00';
  const quietHoursEnd = notificationSettings?.quietHours?.endTime || '07:00';

  const handleMorningTimeChange = async (time: string): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          commuteSchedule: {
            ...user.preferences.commuteSchedule,
            weekdays: {
              ...user.preferences.commuteSchedule.weekdays,
              morningCommute: {
                departureTime: time,
                stationId: user.preferences.commuteSchedule.weekdays?.morningCommute?.stationId || '',
                destinationStationId: user.preferences.commuteSchedule.weekdays?.morningCommute?.destinationStationId || '',
                bufferMinutes: user.preferences.commuteSchedule.weekdays?.morningCommute?.bufferMinutes || 10,
              },
              eveningCommute: user.preferences.commuteSchedule.weekdays?.eveningCommute || null,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error updating morning commute time:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEveningTimeChange = async (time: string): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          commuteSchedule: {
            ...user.preferences.commuteSchedule,
            weekdays: {
              morningCommute: user.preferences.commuteSchedule.weekdays?.morningCommute || null,
              eveningCommute: {
                departureTime: time,
                stationId: user.preferences.commuteSchedule.weekdays?.eveningCommute?.stationId || '',
                destinationStationId: user.preferences.commuteSchedule.weekdays?.eveningCommute?.destinationStationId || '',
                bufferMinutes: user.preferences.commuteSchedule.weekdays?.eveningCommute?.bufferMinutes || 10,
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error updating evening commute time:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleQuietHours = async (value: boolean): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            quietHours: {
              ...user.preferences.notificationSettings.quietHours,
              enabled: value,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error updating quiet hours:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuietHoursStartChange = async (time: string): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            quietHours: {
              ...user.preferences.notificationSettings.quietHours,
              startTime: time,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error updating quiet hours start time:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuietHoursEndChange = async (time: string): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            quietHours: {
              ...user.preferences.notificationSettings.quietHours,
              endTime: time,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error updating quiet hours end time:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWeekdaysOnly = async (value: boolean): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          notificationSettings: {
            ...user.preferences.notificationSettings,
            weekdaysOnly: value,
          },
        },
      });
    } catch (error) {
      console.error('Error updating weekdays only:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Commute Schedule */}
        <SettingSection title="출퇴근 시간">
          <SettingTimePicker
            icon="sunny"
            label="아침 출근"
            value={morningTime}
            onValueChange={handleMorningTimeChange}
          />
          <View style={styles.stationInfo}>
            <Text style={styles.stationLabel}>
              {commuteSchedule?.weekdays?.morningCommute?.stationId
                ? `출발역에서 출발`
                : '즐겨찾기에서 출발역을 설정하세요'}
            </Text>
          </View>

          <SettingTimePicker
            icon="moon"
            label="저녁 퇴근"
            value={eveningTime}
            onValueChange={handleEveningTimeChange}
          />
          <View style={styles.stationInfo}>
            <Text style={styles.stationLabel}>
              {commuteSchedule?.weekdays?.eveningCommute?.stationId
                ? `출발역에서 출발`
                : '즐겨찾기에서 출발역을 설정하세요'}
            </Text>
          </View>
        </SettingSection>

        {/* Quiet Hours */}
        <SettingSection title="방해 금지 모드">
          <SettingToggle
            icon="moon-outline"
            label="조용한 시간대 사용"
            subtitle="이 시간에는 알림을 받지 않습니다"
            value={notificationSettings?.quietHours?.enabled || false}
            onValueChange={handleToggleQuietHours}
            disabled={saving}
          />

          {notificationSettings?.quietHours?.enabled && (
            <>
              <SettingTimePicker
                icon="time-outline"
                label="시작 시간"
                value={quietHoursStart}
                onValueChange={handleQuietHoursStartChange}
              />
              <SettingTimePicker
                icon="time-outline"
                label="종료 시간"
                value={quietHoursEnd}
                onValueChange={handleQuietHoursEndChange}
              />
            </>
          )}
        </SettingSection>

        {/* Additional Settings */}
        <SettingSection title="추가 설정">
          <SettingToggle
            icon="calendar"
            label="평일만 알림 받기"
            subtitle="주말과 공휴일에는 알림을 받지 않습니다"
            value={notificationSettings?.weekdaysOnly || false}
            onValueChange={handleToggleWeekdaysOnly}
            disabled={saving}
          />
        </SettingSection>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ 출퇴근 시간을 설정하면 해당 시간대에 맞춤 알림을 받을 수
            있습니다. 즐겨찾기에서 출발역과 도착역을 설정하세요.
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
  stationInfo: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  stationLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
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

export default NotificationTimeScreen;
