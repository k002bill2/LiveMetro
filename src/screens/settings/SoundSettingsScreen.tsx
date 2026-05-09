/**
 * Sound Settings Screen
 * Configure notification sound and vibration preferences.
 *
 * Phase 46 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Mail,
  MessageCircle,
  Music,
  Smartphone,
  Train,
  Volume1,
  Volume2,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
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
  type PerEventSoundOverrides,
} from '@/models/user';
import { emailNotificationService } from '@/services/email/emailService';

type AlertModeId = 'soundAndVibration' | 'soundOnly' | 'vibrationOnly' | 'silent';

interface AlertMode {
  readonly id: AlertModeId;
  readonly label: string;
  readonly subtitle: string;
  readonly Icon: LucideIcon;
  readonly sound: boolean;
  readonly vibration: boolean;
}

const ALERT_MODES: readonly AlertMode[] = [
  { id: 'soundAndVibration', label: '소리 + 진동', subtitle: '모든 채널', Icon: BellRing,    sound: true,  vibration: true  },
  { id: 'soundOnly',         label: '소리만',     subtitle: '진동 없음', Icon: Volume2,      sound: true,  vibration: false },
  { id: 'vibrationOnly',     label: '진동만',     subtitle: '무음',     Icon: Smartphone,    sound: false, vibration: true  },
  { id: 'silent',            label: '무음',       subtitle: '배지만',   Icon: BellOff,       sound: false, vibration: false },
];

const DEFAULT_PER_EVENT_SOUND: PerEventSoundOverrides = {
  trainArrival: true,
  delayDetected: true,
  communityReport: false,
};

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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Check if email notifications can be enabled for this user
  const canEnableEmail = user && !user.isAnonymous && !!user.email;

  const notificationSettings = user?.preferences.notificationSettings;
  const soundSettings = notificationSettings?.soundSettings || DEFAULT_SOUND_SETTINGS;
  const perEventSound = notificationSettings?.perEventSound ?? DEFAULT_PER_EVENT_SOUND;

  // Derive current alert mode from sound/vibration combo (4 modes from 2 booleans).
  const currentAlertMode: AlertModeId = soundSettings.soundEnabled && soundSettings.vibrationEnabled
    ? 'soundAndVibration'
    : soundSettings.soundEnabled
    ? 'soundOnly'
    : soundSettings.vibrationEnabled
    ? 'vibrationOnly'
    : 'silent';

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

  // Alert mode 4-grid handler — derives sound/vibration toggles atomically.
  const handleAlertModeChange = useCallback(
    (modeId: AlertModeId): void => {
      const mode = ALERT_MODES.find((m) => m.id === modeId);
      if (!mode) return;
      updateSoundSettings({ soundEnabled: mode.sound, vibrationEnabled: mode.vibration });
    },
    [updateSoundSettings],
  );

  // Per-event sound override handler — toggles a single event's sound flag.
  const handleTogglePerEvent = useCallback(
    async (key: keyof PerEventSoundOverrides, value: boolean): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserProfile({
          preferences: {
            ...user.preferences,
            notificationSettings: {
              ...user.preferences.notificationSettings,
              perEventSound: { ...perEventSound, [key]: value },
            },
          },
        });
      } catch (error) {
        console.error(`Error updating per-event sound ${key}:`, error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, perEventSound, updateUserProfile],
  );

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
        {/* Alert Mode 4-grid — sound + vibration combo per Wanted handoff */}
        <SettingSection title="알림 방식">
          <View style={styles.alertModeGrid}>
            {ALERT_MODES.map((mode) => {
              const selected = currentAlertMode === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  onPress={() => handleAlertModeChange(mode.id)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={mode.label}
                  accessibilityState={{ selected }}
                  style={[
                    styles.alertModeCard,
                    selected
                      ? { borderColor: WANTED_TOKENS.blue[500], backgroundColor: `${WANTED_TOKENS.blue[500]}0F` }
                      : { borderColor: semantic.lineSubtle, backgroundColor: semantic.bgBase },
                  ]}
                >
                  <mode.Icon
                    size={22}
                    color={selected ? WANTED_TOKENS.blue[500] : semantic.labelAlt}
                    strokeWidth={2.2}
                  />
                  <Text style={[styles.alertModeLabel, { color: selected ? WANTED_TOKENS.blue[500] : semantic.labelStrong }]}>
                    {mode.label}
                  </Text>
                  <Text style={[styles.alertModeSubtitle, { color: semantic.labelAlt }]}>
                    {mode.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingSection>

        {/* Notification Channels (renamed from "알림 방식" to avoid collision) */}
        <SettingSection title="알림 채널">
          <SettingToggle
            icon={Bell}
            label="푸시 알림"
            subtitle="앱이 꺼져있어도 알림 받기"
            value={notificationSettings?.pushNotifications || false}
            onValueChange={handleTogglePushNotifications}
            disabled={saving}
          />
          <SettingToggle
            icon={Mail}
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
            icon={Volume2}
            label="알림음"
            subtitle="알림 수신 시 소리 재생"
            value={soundSettings.soundEnabled}
            onValueChange={handleSoundEnabledChange}
            disabled={saving}
          />

          {soundSettings.soundEnabled && (
            <>
              <SoundPicker
                icon={Music}
                label="알림음 선택"
                options={NOTIFICATION_SOUNDS}
                value={soundSettings.soundId}
                volume={soundSettings.volume}
                onValueChange={handleSoundChange}
                disabled={saving}
              />

              <SettingSlider
                icon={Volume1}
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
            icon={Smartphone}
            label="진동"
            subtitle="알림 수신 시 진동"
            value={soundSettings.vibrationEnabled}
            onValueChange={handleVibrationEnabledChange}
            disabled={saving}
          />

          {soundSettings.vibrationEnabled && (
            <VibrationPicker
              icon={Activity}
              label="진동 패턴"
              options={VIBRATION_PATTERNS}
              value={soundSettings.vibrationPattern}
              onValueChange={handleVibrationPatternChange}
              disabled={saving}
            />
          )}
        </SettingSection>

        {/* Per-Event Sound Overrides — Wanted handoff "이벤트별" */}
        <SettingSection title="이벤트별">
          <SettingToggle
            icon={Train}
            label="열차 도착"
            subtitle="3분 전 알림"
            value={perEventSound.trainArrival}
            onValueChange={(v) => handleTogglePerEvent('trainArrival', v)}
            disabled={saving}
          />
          <SettingToggle
            icon={AlertTriangle}
            label="지연 발생"
            subtitle="실시간 지연"
            value={perEventSound.delayDetected}
            onValueChange={(v) => handleTogglePerEvent('delayDetected', v)}
            disabled={saving}
          />
          <SettingToggle
            icon={MessageCircle}
            label="실시간 제보"
            subtitle="검증된 제보 도착 시"
            value={perEventSound.communityReport}
            onValueChange={(v) => handleTogglePerEvent('communityReport', v)}
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
            ℹ️ 푸시 알림이 켜져 있어야 열차 지연 및 운행 중단 알림을 받을 수
            있습니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const INFO_FONT_SIZE = 13;
const INFO_LINE_HEIGHT = INFO_FONT_SIZE * 1.6;

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    content: {
      flex: 1,
    },
    section: {
      marginBottom: WANTED_TOKENS.spacing.s5,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
    },
    testButton: {
      backgroundColor: WANTED_TOKENS.blue[500],
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r8,
      alignItems: 'center',
    },
    testButtonText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    testEmailButton: {
      backgroundColor: WANTED_TOKENS.blue[500],
      paddingVertical: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      marginTop: WANTED_TOKENS.spacing.s2,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      alignItems: 'center',
    },
    testEmailButtonDisabled: {
      opacity: 0.6,
    },
    testEmailButtonText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: '#FFFFFF',
    },
    infoBox: {
      backgroundColor: 'rgba(0,102,255,0.10)',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s5,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    infoText: {
      fontSize: INFO_FONT_SIZE,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      lineHeight: INFO_LINE_HEIGHT,
    },
    alertModeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: 8,
    },
    alertModeCard: {
      width: '47%',
      paddingVertical: WANTED_TOKENS.spacing.s4,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1.5,
      alignItems: 'flex-start',
      gap: 6,
    },
    alertModeLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('800'),
      letterSpacing: -0.14,
    },
    alertModeSubtitle: {
      fontSize: 11,
      fontFamily: weightToFontFamily('600'),
    },
  });

export default SoundSettingsScreen;
