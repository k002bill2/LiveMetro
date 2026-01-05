/**
 * Commute Notification Screen
 * Screen for setting notification preferences during onboarding
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
} from 'react-native';
import {
  Bell,
  ArrowLeftRight,
  Flag,
  Clock,
  AlertTriangle,
  Info,
  ArrowLeft,
  ArrowRight
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/styles/modernTheme';
import { OnboardingStackParamList } from '@/navigation/types';
import {
  CommuteNotifications,
  DEFAULT_COMMUTE_NOTIFICATIONS,
  ALERT_MINUTES_OPTIONS,
} from '@/models/commute';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CommuteNotification'>;

export const CommuteNotificationScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    commuteType,
    departureTime,
    departureStation,
    arrivalStation,
    transferStations,
  } = route.params;

  const [notifications, setNotifications] = useState<CommuteNotifications>(
    DEFAULT_COMMUTE_NOTIFICATIONS
  );

  const isMorning = commuteType === 'morning';
  const hasTransfers = transferStations.length > 0;

  // Toggle notification setting
  const toggleSetting = (key: keyof CommuteNotifications) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Set alert minutes
  const setAlertMinutes = (minutes: number) => {
    setNotifications((prev) => ({
      ...prev,
      alertMinutesBefore: minutes,
    }));
  };

  // Handle next
  const handleNext = () => {
    if (isMorning) {
      // Go to evening time setup
      navigation.navigate('CommuteTime', {
        commuteType: 'evening',
        morningRoute: {
          departureTime,
          departureStation,
          arrivalStation,
          transferStations,
          notifications,
        },
        onTimeSet: () => {}, // Will be handled by the screen
        onSkip: undefined, // No skip for evening
      });
    } else {
      // Go to complete screen
      navigation.navigate('CommuteComplete', {
        morningRoute: route.params.morningRoute!,
        eveningRoute: {
          departureTime,
          departureStation,
          arrivalStation,
          transferStations,
          notifications,
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Bell
              size={48}
              color={COLORS.secondary.blue}
            />
          </View>
          <Text style={styles.title}>
            {isMorning ? '출근 알림 설정' : '퇴근 알림 설정'}
          </Text>
          <Text style={styles.subtitle}>
            {isMorning
              ? '출근 중 받고 싶은 알림을 선택하세요'
              : '퇴근 중 받고 싶은 알림을 선택하세요'}
          </Text>
        </View>

        {/* Notification Settings */}
        <View style={styles.settingsSection}>
          {/* Transfer Alert - only show if there are transfers */}
          {hasTransfers && (
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ArrowLeftRight
                  size={22}
                  color={COLORS.secondary.blue}
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>환승역 미리알림</Text>
                <Text style={styles.settingDescription}>
                  환승역 도착 전 알림을 받습니다
                </Text>
              </View>
              <Switch
                value={notifications.transferAlert}
                onValueChange={() => toggleSetting('transferAlert')}
                trackColor={{
                  false: COLORS.gray[300],
                  true: COLORS.secondary.blue,
                }}
                thumbColor={COLORS.white}
              />
            </View>
          )}

          {/* Arrival Alert */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Flag
                size={22}
                color={COLORS.semantic.error}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>도착역 미리알림</Text>
              <Text style={styles.settingDescription}>
                도착역 도착 전 알림을 받습니다
              </Text>
            </View>
            <Switch
              value={notifications.arrivalAlert}
              onValueChange={() => toggleSetting('arrivalAlert')}
              trackColor={{
                false: COLORS.gray[300],
                true: COLORS.secondary.blue,
              }}
              thumbColor={COLORS.white}
            />
          </View>

          {/* Delay Alert */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Clock
                size={22}
                color={COLORS.secondary.yellow}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>연착 알림</Text>
              <Text style={styles.settingDescription}>
                열차 연착 시 알림을 받습니다
              </Text>
            </View>
            <Switch
              value={notifications.delayAlert}
              onValueChange={() => toggleSetting('delayAlert')}
              trackColor={{
                false: COLORS.gray[300],
                true: COLORS.secondary.blue,
              }}
              thumbColor={COLORS.white}
            />
          </View>

          {/* Incident Alert */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <AlertTriangle
                size={22}
                color={COLORS.semantic.error}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>사고 알림</Text>
              <Text style={styles.settingDescription}>
                운행 중단, 사고 발생 시 알림을 받습니다
              </Text>
            </View>
            <Switch
              value={notifications.incidentAlert}
              onValueChange={() => toggleSetting('incidentAlert')}
              trackColor={{
                false: COLORS.gray[300],
                true: COLORS.secondary.blue,
              }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Alert Timing */}
        <View style={styles.timingSection}>
          <Text style={styles.timingTitle}>알림 시간</Text>
          <Text style={styles.timingDescription}>
            환승역/도착역 도착 몇 분 전에 알림을 받을까요?
          </Text>
          <View style={styles.timingOptions}>
            {ALERT_MINUTES_OPTIONS.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.timingButton,
                  notifications.alertMinutesBefore === minutes &&
                    styles.timingButtonActive,
                ]}
                onPress={() => setAlertMinutes(minutes)}
              >
                <Text
                  style={[
                    styles.timingButtonText,
                    notifications.alertMinutesBefore === minutes &&
                      styles.timingButtonTextActive,
                  ]}
                >
                  {minutes}분 전
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Info
            size={20}
            color={COLORS.text.tertiary}
          />
          <Text style={styles.infoText}>
            알림 설정은 나중에 설정 메뉴에서 변경할 수 있습니다.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={COLORS.text.secondary} />
          <Text style={styles.backButtonText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {isMorning ? '퇴근 설정하기' : '완료'}
          </Text>
          <ArrowRight size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING['2xl'],
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  settingsSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  settingDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  timingSection: {
    backgroundColor: COLORS.surface.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  timingTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  timingDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginBottom: SPACING.lg,
  },
  timingOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  timingButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.base,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    alignItems: 'center',
  },
  timingButtonActive: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  timingButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  timingButtonTextActive: {
    color: COLORS.white,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface.background,
    borderRadius: RADIUS.base,
    padding: SPACING.lg,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    lineHeight: 20,
  },
  bottomContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    gap: SPACING.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    gap: SPACING.xs,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.base,
    gap: SPACING.sm,
  },
  nextButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});

export default CommuteNotificationScreen;
