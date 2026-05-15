/**
 * Notification Time Settings Screen
 * Configure commute schedule and quiet hours.
 *
 * Phase 46 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { Calendar, Clock, Moon, Sun } from 'lucide-react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import SettingTimePicker from '@/components/settings/SettingTimePicker';
import { isUsableCommuteTime } from '@/models/user';

/** "HH:MM" → decimal hours (e.g., "08:30" → 8.5). Returns 0 on parse failure. */
const parseTime = (t: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return 0;
  return parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60;
};

export const NotificationTimeScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [saving, setSaving] = useState(false);

  const notificationSettings = user?.preferences.notificationSettings;
  const commuteSchedule = user?.preferences.commuteSchedule;

  // Default times if not set
  const morningTime = commuteSchedule?.weekdays?.morningCommute?.departureTime || '08:00';
  const eveningTime = commuteSchedule?.weekdays?.eveningCommute?.departureTime || '18:00';
  const quietHoursStart = notificationSettings?.quietHours?.startTime || '22:00';
  const quietHoursEnd = notificationSettings?.quietHours?.endTime || '07:00';

  // Phase 50: 24h timeline derived from existing single-departure data.
  // The Wanted handoff design uses commute *windows* (start/end), but the
  // current data model stores only a single departureTime. We derive a
  // visualization-only window centered on the departure (morning −1h…+2h,
  // evening −1h…+3h) — purely cosmetic, no data shape change.
  const morningH = parseTime(morningTime);
  const eveningH = parseTime(eveningTime);
  const quietStartH = parseTime(quietHoursStart);
  const quietEndH = parseTime(quietHoursEnd);
  const quietEnabled = notificationSettings?.quietHours?.enabled || false;
  const morningStart = Math.max(0, morningH - 1);
  const morningEnd = Math.min(24, morningH + 2);
  const eveningStart = Math.max(0, eveningH - 1);
  const eveningEnd = Math.min(24, eveningH + 3);
  // Quiet hours commonly cross midnight (e.g., 22:00 → 07:00). Render two
  // bands when wrapped; otherwise a single band.
  const quietBands: { left: number; width: number }[] = quietEnabled
    ? quietStartH > quietEndH
      ? [
          { left: quietStartH, width: 24 - quietStartH },
          { left: 0, width: quietEndH },
        ]
      : [{ left: quietStartH, width: Math.max(0, quietEndH - quietStartH) }]
    : [];
  const pct = (n: number): `${number}%` => `${(n / 24) * 100}%`;

  const handleMorningTimeChange = async (time: string): Promise<void> => {
    if (!user) return;

    // Only update the departure time of an *existing usable* commute.
    // Synthesizing a commute object here with `stationId: '' ` corrupts
    // the profile — the empty object then shadows the real commute (saved
    // to Firestore by onboarding) and breaks station lookups downstream.
    const existingMorning =
      user.preferences.commuteSchedule.weekdays?.morningCommute;
    if (!isUsableCommuteTime(existingMorning)) {
      Alert.alert(
        '출근 경로 먼저 설정',
        '출근 알림 시간을 바꾸려면 먼저 출근 경로를 등록해주세요.'
      );
      return;
    }

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          commuteSchedule: {
            ...user.preferences.commuteSchedule,
            weekdays: {
              ...user.preferences.commuteSchedule.weekdays,
              morningCommute: { ...existingMorning, departureTime: time },
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

    // Same rule as the morning leg: only retime an existing usable commute,
    // never synthesize one with empty-string station ids.
    const existingEvening =
      user.preferences.commuteSchedule.weekdays?.eveningCommute;
    if (!isUsableCommuteTime(existingEvening)) {
      Alert.alert(
        '퇴근 경로 먼저 설정',
        '퇴근 알림 시간을 바꾸려면 먼저 퇴근 경로를 등록해주세요.'
      );
      return;
    }

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          commuteSchedule: {
            ...user.preferences.commuteSchedule,
            weekdays: {
              morningCommute: user.preferences.commuteSchedule.weekdays?.morningCommute || null,
              eveningCommute: { ...existingEvening, departureTime: time },
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

  const handleToggleWeekendsAlwaysSilent = async (value: boolean): Promise<void> => {
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
              weekendsAlwaysSilent: value,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error updating weekends always silent:', error);
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
        {/* Phase 50: 24h alert timeline (Wanted handoff signature). Visualizes
            commute alert windows + quiet hours on a single 24h horizontal bar. */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineEyebrow}>24시간 알림</Text>
          <Text style={styles.timelineTitle}>평일 알림 활성 시간</Text>

          {/* Labels above the bar — anchored to commute window start */}
          <View style={styles.timelineLabelRow}>
            <Text style={[styles.timelineLabel, { left: pct(morningStart) }]}>출근</Text>
            <Text style={[styles.timelineLabel, { left: pct(eveningStart) }]}>퇴근</Text>
          </View>

          {/* Track + bands */}
          <View style={styles.timelineTrack}>
            {/* Daytime light band: morning end → evening start */}
            {eveningStart > morningEnd && (
              <View
                style={[
                  styles.timelineBand,
                  styles.timelineBandLight,
                  { left: pct(morningEnd), width: pct(eveningStart - morningEnd) },
                ]}
              />
            )}
            {/* Morning commute solid */}
            <View
              style={[
                styles.timelineBand,
                styles.timelineBandSolid,
                { left: pct(morningStart), width: pct(morningEnd - morningStart) },
              ]}
            />
            {/* Evening commute solid */}
            <View
              style={[
                styles.timelineBand,
                styles.timelineBandSolid,
                { left: pct(eveningStart), width: pct(eveningEnd - eveningStart) },
              ]}
            />
            {/* Quiet hours muted bands (rendered last so they overlay) */}
            {quietBands.map((b, i) => (
              <View
                key={`quiet-${i}`}
                style={[
                  styles.timelineBand,
                  styles.timelineBandQuiet,
                  { left: pct(b.left), width: pct(b.width) },
                ]}
              />
            ))}
          </View>

          {/* Hour ticks: evenly spaced 0/6/12/18/24 */}
          <View style={styles.timelineTickRow}>
            {[0, 6, 12, 18, 24].map((h) => (
              <Text key={h} style={styles.timelineTick}>
                {String(h).padStart(2, '0')}
              </Text>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.timelineLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.timelineBandSolid]} />
              <Text style={styles.legendText}>출퇴근 (강조)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.timelineBandLight]} />
              <Text style={styles.legendText}>일반</Text>
            </View>
            {quietEnabled && (
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.timelineBandQuiet]} />
                <Text style={styles.legendText}>방해 금지</Text>
              </View>
            )}
          </View>
        </View>

        {/* Commute Schedule */}
        <SettingSection title="출퇴근 시간">
          <SettingTimePicker
            icon={Sun}
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
            icon={Moon}
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
            icon={Moon}
            label="조용한 시간대 사용"
            subtitle="이 시간에는 알림을 받지 않습니다"
            value={notificationSettings?.quietHours?.enabled || false}
            onValueChange={handleToggleQuietHours}
            disabled={saving}
          />

          {notificationSettings?.quietHours?.enabled && (
            <>
              <SettingTimePicker
                icon={Clock}
                label="시작 시간"
                value={quietHoursStart}
                onValueChange={handleQuietHoursStartChange}
              />
              <SettingTimePicker
                icon={Clock}
                label="종료 시간"
                value={quietHoursEnd}
                onValueChange={handleQuietHoursEndChange}
              />
              <SettingToggle
                icon={Calendar}
                label="주말은 종일 무음"
                subtitle="토 · 일"
                value={notificationSettings?.quietHours?.weekendsAlwaysSilent ?? false}
                onValueChange={handleToggleWeekendsAlwaysSilent}
                disabled={saving}
              />
            </>
          )}
        </SettingSection>

        {/* Additional Settings */}
        <SettingSection title="추가 설정">
          <SettingToggle
            icon={Calendar}
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
    stationInfo: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingBottom: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    stationLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
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
    /* Phase 50: 24h timeline card */
    timelineCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r10,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      padding: WANTED_TOKENS.spacing.s5,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    timelineEyebrow: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      lineHeight: WANTED_TOKENS.type.caption1.lh,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    timelineTitle: {
      fontSize: WANTED_TOKENS.type.headline1.size,
      lineHeight: WANTED_TOKENS.type.headline1.lh,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    timelineLabelRow: {
      position: 'relative',
      height: 16,
      marginTop: WANTED_TOKENS.spacing.s4,
    },
    timelineLabel: {
      position: 'absolute',
      fontSize: 10,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryHover,
      paddingLeft: 4,
    },
    timelineTrack: {
      position: 'relative',
      height: 48,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: semantic.bgSubtle,
      overflow: 'hidden',
    },
    timelineBand: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    timelineBandSolid: {
      backgroundColor: semantic.primaryNormal,
    },
    timelineBandLight: {
      backgroundColor: semantic.primaryBg,
    },
    timelineBandQuiet: {
      backgroundColor: 'rgba(112,115,124,0.32)',
    },
    timelineTickRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    timelineTick: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    timelineLegendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
      marginRight: 6,
    },
    legendText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
  });

export default NotificationTimeScreen;
