/**
 * Notification Time Settings Screen
 * Configure commute alert windows and quiet hours.
 *
 * Phase 51 — Wanted "알림 시간대" handoff:
 *   - 24h timeline card (commute windows + hatched quiet hours)
 *   - 출퇴근 알림 시간 (Pill badge rows; start = editable departure time,
 *     end = derived read-only window — see plan D1)
 *   - 방해 금지 (toggle + start/end + "주말은 종일 무음")
 *   - header "저장" confirmation (settings persist optimistically)
 *
 * Honesty notes:
 *   - Commute legs store only a single `departureTime`; the alert *window*
 *     is a display derivation, never a new persisted field.
 *   - "주말은 종일 무음" maps to `weekdaysOnly`, the field actually consumed
 *     by notificationService.shouldSendNotification. The legacy
 *     `weekendsAlwaysSilent` flag is unwired and intentionally not surfaced.
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, Moon } from 'lucide-react-native';

import { useSemanticTokens } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useAuth } from '@/services/auth/AuthContext';
import { useToast } from '@/components/common/Toast';
import {
  isUsableCommuteTime,
  resolveAlightAlertPreferences,
  type CommuteTime,
  type AlightAlertPreferences,
} from '@/models/user';
import { useFirestoreCommuteRoutes } from '@/hooks/useFirestoreCommuteRoutes';
import { cancelAlightAlert } from '@/services/notification/alightAlertService';
import type { SettingsStackParamList } from '@/navigation/types';

import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import TimeFieldBox from '@/components/settings/TimeFieldBox';
import CommuteAlertRow from '@/components/settings/CommuteAlertRow';
import NotificationTimeline, {
  parseTime,
} from '@/components/settings/NotificationTimeline';

type Props = NativeStackScreenProps<SettingsStackParamList, 'NotificationTime'>;

/** Commute window lengths (hours) past the departure time — display only. */
const MORNING_WINDOW_H = 2;
const EVENING_WINDOW_H = 3;

/** departure "HH:MM" + N hours → "HH:MM", clamped to 24:00. */
const deriveWindowEnd = (departure: string, addHours: number): string => {
  const endMinutes = Math.min(
    24 * 60,
    Math.round(parseTime(departure) * 60) + addHours * 60
  );
  const hh = Math.floor(endMinutes / 60);
  const mm = endMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const NotificationTimeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUserPreferences } = useAuth();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [saving, setSaving] = useState(false);

  const notificationSettings = user?.preferences.notificationSettings;
  const alightPrefs = resolveAlightAlertPreferences(notificationSettings);
  const commuteSchedule = user?.preferences.commuteSchedule;

  // The commute lives in one of two stores: the user profile (#1) or the
  // CommuteSettings/onboarding Firestore doc (#2, written by commuteService).
  // They are not kept in sync, so resolve PER LEG with the HomeScreen pattern:
  // a usable profile leg wins, else fall back to the Firestore leg. Reading
  // only #1 (the old behavior) made commutes set via CommuteSettings invisible
  // here — showing a false "set your route first" prompt.
  const firestoreRoutes = useFirestoreCommuteRoutes(user?.id);
  const resolveLeg = (
    profileLeg: CommuteTime | null | undefined,
    firestoreLeg: CommuteTime | null
  ): CommuteTime | null =>
    isUsableCommuteTime(profileLeg) ? profileLeg : firestoreLeg;

  const morningCommute = resolveLeg(
    commuteSchedule?.weekdays?.morningCommute,
    firestoreRoutes.morning
  );
  const eveningCommute = resolveLeg(
    commuteSchedule?.weekdays?.eveningCommute,
    firestoreRoutes.evening
  );
  const morningUsable = isUsableCommuteTime(morningCommute);
  const eveningUsable = isUsableCommuteTime(eveningCommute);

  const morningTime = morningCommute?.departureTime || '08:00';
  const eveningTime = eveningCommute?.departureTime || '18:00';
  const quietHoursStart = notificationSettings?.quietHours?.startTime || '22:00';
  const quietHoursEnd = notificationSettings?.quietHours?.endTime || '07:00';
  const quietEnabled = notificationSettings?.quietHours?.enabled || false;

  const morningEnd = deriveWindowEnd(morningTime, MORNING_WINDOW_H);
  const eveningEnd = deriveWindowEnd(eveningTime, EVENING_WINDOW_H);

  // The commute alert window is read-only here — its departure time is owned by
  // CommuteSettings (the single canonical commute editor, used app-wide), so we
  // never fork/desync it. When a leg isn't set, tapping its row routes the user
  // to CommuteSettings to set it up.
  const goToCommuteSetup = useCallback(
    (leg: '출근' | '퇴근'): void => {
      Alert.alert(
        `${leg} 경로 먼저 설정`,
        `${leg} 알림 시간은 출퇴근 경로에 맞춰 정해져요. 출퇴근 설정에서 경로를 등록해주세요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정으로 이동',
            onPress: () => navigation.navigate('CommuteSettings'),
          },
        ]
      );
    },
    [navigation]
  );
  const showMorningRouteGuide = useCallback(
    () => goToCommuteSetup('출근'),
    [goToCommuteSetup]
  );
  const showEveningRouteGuide = useCallback(
    () => goToCommuteSetup('퇴근'),
    [goToCommuteSetup]
  );

  // "저장" header action — settings already persist optimistically on each
  // change, so this surfaces a confirmation toast then pops back. Mirrors
  // the CommuteSettingsScreen pattern.
  const { showSuccess, ToastComponent } = useToast();
  const saveNavTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (saveNavTimer.current) clearTimeout(saveNavTimer.current);
    },
    []
  );

  const handleSavePress = useCallback((): void => {
    showSuccess('알림 시간대가 저장되었습니다');
    if (saveNavTimer.current) clearTimeout(saveNavTimer.current);
    saveNavTimer.current = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, 900);
  }, [navigation, showSuccess]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSavePress}
          accessibilityRole="button"
          accessibilityLabel="저장하고 돌아가기"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerSave}>저장</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSavePress, styles.headerSave]);

  const handleToggleQuietHours = useCallback(
    async (value: boolean): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            quietHours: {
              ...user.preferences.notificationSettings.quietHours,
              enabled: value,
            },
          },
        });
      } catch (error) {
        console.error('Error updating quiet hours:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, updateUserPreferences]
  );

  const handleQuietHoursStartChange = useCallback(
    async (time: string): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            quietHours: {
              ...user.preferences.notificationSettings.quietHours,
              startTime: time,
            },
          },
        });
      } catch (error) {
        console.error('Error updating quiet hours start time:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, updateUserPreferences]
  );

  const handleQuietHoursEndChange = useCallback(
    async (time: string): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            quietHours: {
              ...user.preferences.notificationSettings.quietHours,
              endTime: time,
            },
          },
        });
      } catch (error) {
        console.error('Error updating quiet hours end time:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, updateUserPreferences]
  );

  // "주말은 종일 무음" → weekdaysOnly (the wired weekend gate). The legacy
  // quietHours.weekendsAlwaysSilent flag is unwired; we deliberately drive
  // the real field so this toggle actually silences weekend alerts.
  const handleToggleWeekendsSilent = useCallback(
    async (value: boolean): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            weekdaysOnly: value,
          },
        });
      } catch (error) {
        console.error('Error updating weekend silence:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, updateUserPreferences]
  );

  // 하차 임박 알림 (길안내). Partial write: spread current notificationSettings
  // and replace only `alightAlert` so sibling fields (quietHours, weekdaysOnly,
  // pushNotifications) survive. Shares the sibling `saving` gate so the alight
  // controls are disabled while another notificationSettings write is in flight
  // — otherwise this would spread a pre-save snapshot and roll back the just-
  // written quietHours/weekdaysOnly (the "stale spread clobbers" race class).
  const updateAlightAlert = useCallback(
    async (next: AlightAlertPreferences): Promise<void> => {
      if (!user) return;
      try {
        setSaving(true);
        // Turning it OFF: cancel any already-scheduled/orphaned local alert now.
        // A Firestore-only write can't stop a pending OS notification when
        // RouteGuidanceScreen is unmounted (e.g. after an app restart), so the
        // fired alert would ignore the disabled setting. cancelAlightAlert is
        // never-throw and also sweeps kind-marked orphans.
        if (!next.enabled) void cancelAlightAlert();
        await updateUserPreferences({
          notificationSettings: {
            ...user.preferences.notificationSettings,
            alightAlert: next,
          },
        });
      } catch (error) {
        console.error('Error updating alight alert preferences:', error);
        Alert.alert('오류', '설정 저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [user, updateUserPreferences]
  );

  const handleAlightToggle = useCallback(
    (enabled: boolean): void => {
      void updateAlightAlert({ ...alightPrefs, enabled });
    },
    [alightPrefs, updateAlightAlert]
  );

  const handleAlightLeadChange = useCallback(
    (leadMinutes: AlightAlertPreferences['leadMinutes']): void => {
      void updateAlightAlert({ ...alightPrefs, leadMinutes });
    },
    [alightPrefs, updateAlightAlert]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <NotificationTimeline
          morningTime={morningTime}
          eveningTime={eveningTime}
          quietStart={quietHoursStart}
          quietEnd={quietHoursEnd}
          quietEnabled={quietEnabled}
          morningActive={morningUsable}
          eveningActive={eveningUsable}
        />

        {/* Commute alert windows (read-only — departure time is owned by
            CommuteSettings). An unset leg locks: tapping routes to setup. */}
        <SettingSection title="출퇴근 알림 시간">
          <CommuteAlertRow
            badgeLabel="출근"
            badgeTone="primary"
            caption="출발 시점부터 알림"
            startTime={morningTime}
            endTime={morningEnd}
            locked={!morningUsable}
            onLockedPress={showMorningRouteGuide}
            testID="commute-morning"
          />
          <CommuteAlertRow
            badgeLabel="퇴근"
            badgeTone="primary"
            caption="퇴근 시점부터 알림"
            startTime={eveningTime}
            endTime={eveningEnd}
            locked={!eveningUsable}
            onLockedPress={showEveningRouteGuide}
            testID="commute-evening"
          />
        </SettingSection>

        {/* Quiet hours */}
        <SettingSection title="방해 금지">
          <SettingToggle
            icon={Moon}
            label="방해 금지 사용"
            subtitle="설정 시간 동안 무음"
            value={quietEnabled}
            onValueChange={handleToggleQuietHours}
            disabled={saving}
          />

          {quietEnabled && (
            <View style={styles.quietRow}>
              <TimeFieldBox
                label="시작"
                value={quietHoursStart}
                onChange={handleQuietHoursStartChange}
                disabled={saving}
                testID="quiet-start"
              />
              <Text style={styles.dash} accessible={false}>
                —
              </Text>
              <TimeFieldBox
                label="종료"
                value={quietHoursEnd}
                onChange={handleQuietHoursEndChange}
                disabled={saving}
                testID="quiet-end"
              />
            </View>
          )}

          <SettingToggle
            icon={Calendar}
            label="주말은 종일 무음"
            subtitle="토 · 일"
            value={notificationSettings?.weekdaysOnly || false}
            onValueChange={handleToggleWeekendsSilent}
            disabled={saving}
          />
        </SettingSection>

        {/* 길안내 하차 임박 알림 */}
        <SettingSection title="길안내 알림">
          <SettingToggle
            label="하차 임박 알림"
            subtitle="길안내 중 환승·하차 역 도착 전에 미리 알려드려요"
            value={alightPrefs.enabled}
            onValueChange={handleAlightToggle}
            disabled={saving}
            testID="alight-alert-toggle"
          />
          {alightPrefs.enabled && (
            <View style={styles.leadRow}>
              <Text style={styles.leadLabel}>알림 시점</Text>
              <View style={styles.leadChips}>
                {([1, 2, 3] as const).map((m) => {
                  const active = alightPrefs.leadMinutes === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      testID={`alight-lead-${m}`}
                      style={[styles.leadChip, active && styles.leadChipActive]}
                      onPress={() => handleAlightLeadChange(m)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active, disabled: saving }}
                      accessibilityLabel={`도착 ${m}분 전 알림`}
                    >
                      <Text
                        style={[
                          styles.leadChipText,
                          active && styles.leadChipTextActive,
                        ]}
                      >
                        {m}분 전
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </SettingSection>

        <Text style={styles.footerText}>
          방해 금지 시간에는 긴급 지연 알림도 무음으로 와요.
        </Text>
      </ScrollView>
      <ToastComponent />
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
    contentInner: {
      paddingBottom: WANTED_TOKENS.spacing.s6,
    },
    headerSave: {
      color: WANTED_TOKENS.blue[500],
      fontSize: 17,
      fontFamily: weightToFontFamily('700'),
      paddingRight: 4,
    },
    quietRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    dash: {
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    leadRow: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leadLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    leadChips: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
    },
    leadChip: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.bgSubtle,
    },
    leadChipActive: {
      backgroundColor: semantic.primaryNormal,
    },
    leadChipText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    leadChipTextActive: {
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelOnColor,
    },
    footerText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      lineHeight: Math.round(WANTED_TOKENS.type.caption1.size * 1.5),
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
  });

export default NotificationTimeScreen;
