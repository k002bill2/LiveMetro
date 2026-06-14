/**
 * Sound Settings Screen
 * Configure notification alert mode, vibration, volume, sound, per-event
 * delivery gates, and the email-notification channel — per the Wanted
 * "소리 설정" handoff.
 *
 * Honesty notes (do not regress):
 * - `soundId` is a stored preference only. Delivered notifications always use
 *   the system default sound, so no copy claims the chosen sound plays.
 * - There is no push toggle here: `pushNotifications` gated nothing (phantom).
 * - `emailNotifications` does gate the Cloud Functions email digest, so the
 *   email channel toggle stays.
 *
 * Phase 46 — migrated to Wanted Design System tokens.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { AlertTriangle, BellOff, BellRing, Mail, Megaphone, Smartphone, Train, Vibrate, Volume2, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/services/auth/AuthContext';

import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import VolumeSlider from '@/components/settings/VolumeSlider';
import SoundRadioList from '@/components/settings/SoundRadioList';
import VibrationPicker from '@/components/settings/VibrationPicker';
import { soundService, NOTIFICATION_SOUNDS, VIBRATION_PATTERNS } from '@/services/sound/soundService';
import {
  NotificationSoundId,
  VibrationPatternId,
  SoundPreferences,
  type PerEventSoundOverrides,
} from '@/models/user';

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
  soundId: 'chime',
  volume: 80,
  vibrationEnabled: true,
  vibrationPattern: 'default',
};

export const SoundSettingsScreen: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [saving, setSaving] = useState(false);

  // Email notifications can be enabled only for a signed-in user with an email.
  const canEnableEmail = !!user && !user.isAnonymous && !!user.email;

  const notificationSettings = user?.preferences.notificationSettings;
  const soundSettings = notificationSettings?.soundSettings || DEFAULT_SOUND_SETTINGS;
  const perEventSound = notificationSettings?.perEventSound ?? DEFAULT_PER_EVENT_SOUND;

  // The two booleans the alert-mode grid drives. Volume + sound list gate on
  // soundEnabled; the vibration row gates on vibrationEnabled.
  const soundEnabled = soundSettings.soundEnabled;
  const vibrationEnabled = soundSettings.vibrationEnabled;

  // Derive current alert mode from sound/vibration combo (4 modes from 2 booleans).
  const currentAlertMode: AlertModeId = soundEnabled && vibrationEnabled
    ? 'soundAndVibration'
    : soundEnabled
    ? 'soundOnly'
    : vibrationEnabled
    ? 'vibrationOnly'
    : 'silent';

  // Legacy soundId values (pre-4-id union) fall back to 'chime' gracefully.
  const currentSoundId: NotificationSoundId = NOTIFICATION_SOUNDS.some(
    (s) => s.id === soundSettings.soundId,
  )
    ? soundSettings.soundId
    : 'chime';

  // Initialize sound service
  useEffect(() => {
    soundService.initialize();

    return () => {
      void soundService.cleanup();
    };
  }, []);

  // Helper to update sound settings
  const updateSoundSettings = useCallback(
    async (updates: Partial<SoundPreferences>): Promise<void> => {
      if (!user) return;

      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            soundSettings: {
              ...soundSettings,
              ...updates,
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
    [user, soundSettings, updateUserPreferences],
  );

  const handleToggleEmailNotifications = useCallback(
    async (value: boolean): Promise<void> => {
      if (!user) return;

      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            emailNotifications: value,
          },
        });
      } catch (error) {
        console.error('Error updating email notifications:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, updateUserPreferences],
  );

  // Alert mode 4-grid handler — derives sound/vibration toggles atomically.
  const handleAlertModeChange = useCallback(
    (modeId: AlertModeId): void => {
      const mode = ALERT_MODES.find((m) => m.id === modeId);
      if (!mode) return;
      void updateSoundSettings({ soundEnabled: mode.sound, vibrationEnabled: mode.vibration });
    },
    [updateSoundSettings],
  );

  // Per-event sound override handler — toggles a single event's delivery gate.
  const handleTogglePerEvent = useCallback(
    async (key: keyof PerEventSoundOverrides, value: boolean): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            perEventSound: { ...perEventSound, [key]: value },
          },
        });
      } catch (error) {
        console.error(`Error updating per-event sound ${key}:`, error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, perEventSound, updateUserPreferences],
  );

  const handleSoundChange = useCallback(
    (soundId: NotificationSoundId): void => {
      void updateSoundSettings({ soundId });
    },
    [updateSoundSettings],
  );

  const handleVolumeChange = useCallback(
    (volume: number): void => {
      void updateSoundSettings({ volume });
    },
    [updateSoundSettings],
  );

  const handleVibrationPatternChange = useCallback(
    (patternId: VibrationPatternId): void => {
      void updateSoundSettings({ vibrationPattern: patternId });
    },
    [updateSoundSettings],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* 1) Alert Mode 2×2 grid — sound + vibration combo */}
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
                  style={[styles.alertModeCard, selected ? styles.alertModeCardSelected : styles.alertModeCardUnselected]}
                >
                  <mode.Icon
                    size={22}
                    color={selected ? '#FFFFFF' : semantic.labelAlt}
                    strokeWidth={2.2}
                  />
                  <Text style={[styles.alertModeLabel, selected ? styles.alertModeTextSelected : styles.alertModeLabelUnselected]}>
                    {mode.label}
                  </Text>
                  <Text style={[styles.alertModeSubtitle, selected ? styles.alertModeTextSelected : styles.alertModeSubtitleUnselected]}>
                    {mode.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingSection>

        {/* 2) Vibration pattern (single row → bottom sheet) */}
        <SettingSection title="진동">
          <VibrationPicker
            icon={Vibrate}
            label="진동 패턴"
            subtitle="알림이 울릴 때의 진동 세기"
            options={VIBRATION_PATTERNS}
            value={soundSettings.vibrationPattern}
            onValueChange={handleVibrationPatternChange}
            disabled={!vibrationEnabled || saving}
          />
        </SettingSection>

        {/* 3) Volume — percentage in the section header trailing slot */}
        <SettingSection
          title="알림 볼륨"
          trailing={<Text style={styles.volumeValue}>{soundSettings.volume}%</Text>}
        >
          <VolumeSlider
            value={soundSettings.volume}
            onValueChange={handleVolumeChange}
            disabled={!soundEnabled || saving}
          />
        </SettingSection>

        {/* 4) Sound — inline radio list (not a modal) */}
        <SettingSection title="알림음">
          <SoundRadioList
            options={NOTIFICATION_SOUNDS}
            value={currentSoundId}
            volume={soundSettings.volume}
            onValueChange={handleSoundChange}
            disabled={!soundEnabled || saving}
          />
        </SettingSection>

        {/* 5) Per-event delivery gates — Wanted handoff "이벤트별" */}
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
            icon={Megaphone}
            label="실시간 제보"
            subtitle="검증된 제보 도착 시"
            value={perEventSound.communityReport}
            onValueChange={(v) => handleTogglePerEvent('communityReport', v)}
            disabled={saving}
          />
        </SettingSection>

        {/* 6) Email channel — the only real delivery channel toggle here */}
        <SettingSection title="알림 채널">
          <SettingToggle
            icon={Mail}
            label="이메일 알림"
            subtitle={canEnableEmail ? '중요 업데이트 이메일로 수신' : '이메일 로그인 필요'}
            value={notificationSettings?.emailNotifications || false}
            onValueChange={handleToggleEmailNotifications}
            disabled={saving || !canEnableEmail}
          />
        </SettingSection>

        {/* 7) Footer */}
        <Text style={styles.footer}>개별 이벤트마다 소리를 끄거나 켤 수 있어요.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    content: {
      flex: 1,
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
    alertModeCardSelected: {
      backgroundColor: WANTED_TOKENS.blue[500],
      borderColor: WANTED_TOKENS.blue[500],
    },
    alertModeCardUnselected: {
      backgroundColor: semantic.bgBase,
      borderColor: semantic.lineSubtle,
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
    alertModeTextSelected: {
      color: '#FFFFFF',
    },
    alertModeLabelUnselected: {
      color: semantic.labelStrong,
    },
    alertModeSubtitleUnselected: {
      color: semantic.labelAlt,
    },
    volumeValue: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    footer: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s6,
    },
  });

export default SoundSettingsScreen;
