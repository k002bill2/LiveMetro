/**
 * Delay Notification Settings Screen
 * Configure delay alerts and thresholds.
 *
 * Phase 46 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens (WANTED_TOKENS + weightToFontFamily +
 * isDark-driven semantic theme). Atom layer migrated in Phase 45.
 */

import React, { useMemo, useState } from 'react';
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
import { ArrowRightLeft, Bell, Clock, Megaphone, Train, Users, XCircle } from 'lucide-react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import { useNotifications } from '@/hooks/useNotifications';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import SettingSlider from '@/components/settings/SettingSlider';

export const DelayNotificationScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const { sendTestNotification } = useNotifications();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
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
            icon={Bell}
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
            icon={Clock}
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
            icon={Train}
            label="열차 지연"
            subtitle="정상 운행 시간보다 지연될 때"
            value={notificationSettings?.alertTypes.delays || false}
            onValueChange={(value) => handleToggleAlertType('delays', value)}
            disabled={saving}
          />
          <SettingToggle
            icon={XCircle}
            label="운행 중단"
            subtitle="열차 운행이 일시 중단될 때"
            value={notificationSettings?.alertTypes.suspensions || false}
            onValueChange={(value) => handleToggleAlertType('suspensions', value)}
            disabled={saving}
          />
          <SettingToggle
            icon={Users}
            label="혼잡도 경고"
            subtitle="열차 혼잡도가 높을 때"
            value={notificationSettings?.alertTypes.congestion || false}
            onValueChange={(value) => handleToggleAlertType('congestion', value)}
            disabled={saving}
          />
          <SettingToggle
            icon={ArrowRightLeft}
            label="대체 경로"
            subtitle="지연 시 대체 경로 추천"
            value={notificationSettings?.alertTypes.alternativeRoutes || false}
            onValueChange={(value) =>
              handleToggleAlertType('alternativeRoutes', value)
            }
            disabled={saving}
          />
          <SettingToggle
            icon={Megaphone}
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

// Body line height: 13 * 1.6 = 20.8 (relaxed reading rhythm).
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
    infoBox: {
      // Translucent blue tint adapts to both light and dark themes
      // (Phase 45.1 — same pattern as MarkdownViewer.blockquote).
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
  });

export default DelayNotificationScreen;
