/**
 * NotificationPermissionScreen — onboarding step 3/4 (알림 권한).
 *
 * Replaces the previous CommuteNotificationScreen in the redefined onboarding
 * flow (Welcome → CommuteRoute → NotificationPermission → Favorites). Where
 * the old screen toggled commute-alert prefs that immediately wrote to a
 * profile, this one is a single-purpose OS permission ask plus three
 * forward-only toggles whose values get committed alongside the route in
 * the final step.
 *
 * Layout (top → bottom):
 *  - OnbHeader (step 3, back + skip)
 *  - Lock-screen notification preview card (visual mock)
 *  - 3 toggle cards: 출근 시간 / 지연 (추천) / 실시간 제보 — default on,
 *    active toggle highlighted with primaryNormal border
 *  - Primary CTA "알림 받기" → notificationService.requestPermissions()
 *    then navigate to FavoritesOnboarding regardless of the result
 *  - Secondary text link "다음에" — skip the permission ask and continue
 */
import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';
import { OnboardingStackParamList } from '@/navigation/types';
import { notificationService } from '@/services/notification/notificationService';
import { CommuteNotifications, DEFAULT_COMMUTE_NOTIFICATIONS } from '@/models/commute';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPermission'>;

type ToggleId = 'transferAlert' | 'delayAlert' | 'incidentAlert';

interface ToggleSpec {
  id: ToggleId;
  label: string;
  hint: string;
  recommended?: boolean;
}

// Onboarding step 3 surfaces three of the most user-visible alert types
// (transfer / delay / incident). The full CommuteNotifications shape is
// committed downstream in step 4, with these three values overlaid on
// DEFAULT_COMMUTE_NOTIFICATIONS.
const TOGGLES: readonly ToggleSpec[] = [
  { id: 'transferAlert', label: '환승 알림', hint: '환승역 도착 전 미리 알림' },
  { id: 'delayAlert', label: '지연 알림', hint: '내가 자주 타는 노선의 지연·운행 변동', recommended: true },
  { id: 'incidentAlert', label: '사고·운행 중단 알림', hint: '사고나 점검으로 인한 운행 중단 안내' },
];

export const NotificationPermissionScreen: React.FC<Props> = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { onSkip } = useOnboardingCallbacks();

  // Local toggle state. The values flow forward through navigation to the
  // Favorites step which commits them with the route.
  const [transferAlert, setTransferAlert] = useState(true);
  const [delayAlert, setDelayAlert] = useState(true);
  const [incidentAlert, setIncidentAlert] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const toggleValues: Record<ToggleId, boolean> = {
    transferAlert,
    delayAlert,
    incidentAlert,
  };
  const toggleSetters: Record<ToggleId, (v: boolean) => void> = {
    transferAlert: setTransferAlert,
    delayAlert: setDelayAlert,
    incidentAlert: setIncidentAlert,
  };

  const buildNotifications = useCallback((): CommuteNotifications => ({
    ...DEFAULT_COMMUTE_NOTIFICATIONS,
    transferAlert,
    delayAlert,
    incidentAlert,
  }), [transferAlert, delayAlert, incidentAlert]);

  const proceed = useCallback(
    (notificationGranted: boolean) => {
      navigation.navigate('FavoritesOnboarding', {
        route: route.params.route,
        notificationGranted,
        notifications: buildNotifications(),
      });
    },
    [navigation, route.params.route, buildNotifications],
  );

  const handleAllow = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      // Returns Notifications.PermissionResponse — granted iff status is
      // 'granted'. We don't block the flow on denial.
      const response = await notificationService.requestPermissions();
      const granted = response?.granted === true || response?.status === 'granted';
      proceed(granted);
    } catch (err) {
      console.error('Notification permission request error:', err);
      proceed(false);
    } finally {
      setRequesting(false);
    }
  }, [requesting, proceed]);

  const handleLater = useCallback(() => {
    proceed(false);
  }, [proceed]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: semantic.bgBase }]}
      testID="notification-permission"
    >
      <OnbHeader
        currentStep={3}
        onBack={() => navigation.canGoBack() && navigation.goBack()}
        onSkip={onSkip}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text
          style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
          testID="notification-title"
        >
          알림을 켜둘까요?
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
        >
          출퇴근 시각·지연·실시간 제보를 잠금화면에서 바로 받아볼 수 있어요
        </Text>

        {/* Lock-screen notification preview (static visual) */}
        <View
          style={[
            styles.preview,
            { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
          ]}
          testID="notification-preview"
        >
          <View style={styles.previewHeader}>
            <View style={[styles.previewIcon, { backgroundColor: semantic.primaryNormal }]}>
              <Bell size={14} color={semantic.labelOnColor} strokeWidth={2.4} />
            </View>
            <Text
              style={[styles.previewApp, { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') }]}
            >
              LiveMetro · 지금
            </Text>
          </View>
          <Text
            style={[styles.previewTitle, { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') }]}
          >
            지연이 감지되었어요
          </Text>
          <Text
            style={[styles.previewBody, { color: semantic.labelNormal, fontFamily: weightToFontFamily('500') }]}
          >
            2호선 강남행, 평소보다 4분 지연. 5분 일찍 출발을 추천합니다.
          </Text>
        </View>

        {/* Toggle cards */}
        <View style={styles.toggles} testID="notification-toggles">
          {TOGGLES.map((t) => {
            const value = toggleValues[t.id];
            const setter = toggleSetters[t.id];
            return (
              <View
                key={t.id}
                testID={`toggle-${t.id}`}
                style={[
                  styles.toggle,
                  {
                    backgroundColor: semantic.bgBase,
                    borderColor: value ? semantic.primaryNormal : semantic.lineSubtle,
                    borderWidth: value ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.toggleBody}>
                  <View style={styles.toggleHeader}>
                    <Text
                      style={[
                        styles.toggleLabel,
                        { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
                      ]}
                    >
                      {t.label}
                    </Text>
                    {t.recommended ? (
                      <Text
                        style={[
                          styles.recommendedTag,
                          {
                            color: semantic.primaryNormal,
                            backgroundColor: isDark
                              ? 'rgba(51,133,255,0.14)'
                              : 'rgba(0,102,255,0.08)',
                            fontFamily: weightToFontFamily('700'),
                          },
                        ]}
                      >
                        추천
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.toggleHint,
                      { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
                    ]}
                  >
                    {t.hint}
                  </Text>
                </View>
                <Switch
                  testID={`switch-${t.id}`}
                  value={value}
                  onValueChange={setter}
                  trackColor={{ true: semantic.primaryNormal, false: semantic.lineNormal }}
                />
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          testID="notification-allow"
          style={[
            styles.primary,
            { backgroundColor: requesting ? semantic.primaryHover : semantic.primaryNormal },
          ]}
          onPress={handleAllow}
          disabled={requesting}
          accessibilityRole="button"
          accessibilityLabel="알림 받기"
        >
          <Text
            style={[
              styles.primaryLabel,
              { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') },
            ]}
          >
            {requesting ? '요청 중…' : '알림 받기'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="notification-later"
          style={styles.later}
          onPress={handleLater}
          accessibilityRole="button"
          accessibilityLabel="다음에"
        >
          <Text
            style={[
              styles.laterLabel,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
            ]}
          >
            다음에
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  title: {
    fontSize: WANTED_TOKENS.type.title3.size,
    lineHeight: WANTED_TOKENS.type.title3.lh,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  preview: {
    marginTop: WANTED_TOKENS.spacing.s6,
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
  previewIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewApp: {
    fontSize: WANTED_TOKENS.type.caption2.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  previewTitle: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  previewBody: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  toggles: {
    marginTop: WANTED_TOKENS.spacing.s6,
    gap: WANTED_TOKENS.spacing.s2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
  },
  toggleBody: {
    flex: 1,
    paddingRight: WANTED_TOKENS.spacing.s3,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  recommendedTag: {
    fontSize: WANTED_TOKENS.type.caption2.size,
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 2,
    borderRadius: WANTED_TOKENS.radius.pill,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  toggleHint: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  primary: {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s6,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  later: {
    marginTop: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    alignItems: 'center',
  },
  laterLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});

export default NotificationPermissionScreen;
