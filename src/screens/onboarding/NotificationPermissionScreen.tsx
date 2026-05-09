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
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Megaphone,
  TrainFront,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  icon: LucideIcon;
  // Wanted handoff: each toggle has a colored 40×40 icon container.
  // Tints encode notification severity (blue=routine, red=delay, amber=incident).
  accentFg: string;
  accentBg: string;
  recommended?: boolean;
}

// Onboarding step 3 surfaces three of the most user-visible alert types
// (transfer / delay / incident). The full CommuteNotifications shape is
// committed downstream in step 4, with these three values overlaid on
// DEFAULT_COMMUTE_NOTIFICATIONS.
const TOGGLES: readonly ToggleSpec[] = [
  {
    id: 'transferAlert',
    label: '환승 알림',
    hint: '환승역 도착 전 미리 알림',
    icon: ArrowLeftRight,
    accentFg: WANTED_TOKENS.blue[500],
    accentBg: 'rgba(0,102,255,0.12)',
  },
  {
    id: 'delayAlert',
    label: '지연 알림',
    hint: '내가 자주 타는 노선의 지연·운행 변동',
    icon: AlertTriangle,
    accentFg: WANTED_TOKENS.status.red500,
    accentBg: 'rgba(255,66,66,0.10)',
    recommended: true,
  },
  {
    id: 'incidentAlert',
    label: '사고·운행 중단 알림',
    hint: '사고나 점검으로 인한 운행 중단 안내',
    icon: Megaphone,
    accentFg: WANTED_TOKENS.status.amber700,
    accentBg: 'rgba(255,180,0,0.16)',
  },
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
          {'어떤 알림을\n받고 싶으세요?'}
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
        >
          {'출퇴근 시간대에만 조용히 알려드려요\n언제든 끌 수 있어요'}
        </Text>

        {/* Lock-screen notification preview — Wanted handoff:
            outer primary-tinted gradient wrapper with eyebrow label,
            inner notification card with shadow nested inside. */}
        <LinearGradient
          colors={[
            isDark ? 'rgba(51,133,255,0.10)' : 'rgba(0,102,255,0.06)',
            isDark ? 'rgba(51,133,255,0.04)' : 'rgba(0,102,255,0.02)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.preview,
            {
              borderColor: isDark ? 'rgba(51,133,255,0.30)' : 'rgba(0,102,255,0.20)',
            },
          ]}
          testID="notification-preview"
        >
          <Text
            style={[
              styles.previewEyebrow,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('800') },
            ]}
          >
            미리보기 · 잠금 화면
          </Text>
          <View
            style={[
              styles.previewInner,
              {
                backgroundColor: semantic.bgBase,
                borderColor: semantic.lineSubtle,
              },
            ]}
          >
            <View style={[styles.previewIcon, { backgroundColor: semantic.primaryNormal }]}>
              <TrainFront size={16} color={semantic.labelOnColor} strokeWidth={2.4} />
            </View>
            <View style={styles.previewBodyCol}>
              <View style={styles.previewBodyHeader}>
                <Text
                  style={[
                    styles.previewApp,
                    { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
                  ]}
                >
                  LiveMetro
                </Text>
                <Text
                  style={[
                    styles.previewWhen,
                    { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
                  ]}
                >
                  지금
                </Text>
              </View>
              <Text
                style={[
                  styles.previewTitle,
                  { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
                ]}
              >
                홍대입구 → 강남, 오늘은{' '}
                <Text style={{ color: semantic.primaryNormal }}>32분</Text> 예상
              </Text>
              <Text
                style={[
                  styles.previewBody,
                  { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
                ]}
              >
                평소보다 4분 빠름 · 08:30 출발 권장
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Toggle cards — Wanted handoff: 40×40 colored icon + active bg/2px swap */}
        <View style={styles.toggles} testID="notification-toggles">
          {TOGGLES.map((t) => {
            const value = toggleValues[t.id];
            const setter = toggleSetters[t.id];
            const ToggleIcon = t.icon;
            return (
              <View
                key={t.id}
                testID={`toggle-${t.id}`}
                style={[
                  styles.toggle,
                  {
                    backgroundColor: value ? semantic.bgBase : semantic.bgSubtlePage,
                    borderColor: value ? semantic.primaryNormal : semantic.lineSubtle,
                    borderWidth: value ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.toggleIcon, { backgroundColor: t.accentBg }]}>
                  <ToggleIcon size={20} color={t.accentFg} strokeWidth={2.2} />
                </View>
                <View style={styles.toggleBody}>
                  <View style={styles.toggleHeader}>
                    <Text
                      style={[
                        styles.toggleLabel,
                        { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
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
                      { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
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
            {
              backgroundColor: requesting ? semantic.primaryHover : semantic.primaryNormal,
              shadowColor: semantic.primaryNormal,
            },
          ]}
          onPress={handleAllow}
          disabled={requesting}
          accessibilityRole="button"
          accessibilityLabel="허용하고 다음"
        >
          <Text
            style={[
              styles.primaryLabel,
              { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') },
            ]}
          >
            {requesting ? '요청 중…' : '허용하고 다음'}
          </Text>
          {!requesting ? (
            <ArrowRight size={18} color={semantic.labelOnColor} strokeWidth={2.4} />
          ) : null}
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
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  preview: {
    marginTop: WANTED_TOKENS.spacing.s6,
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: 18,
    borderWidth: 1,
  },
  previewEyebrow: {
    fontSize: 11,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    fontWeight: '800',
    marginBottom: 10,
  },
  previewInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    // Inner card shadow per design (`0 4px 12px rgba(0,0,0,0.06)`).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBodyCol: {
    flex: 1,
    minWidth: 0,
  },
  previewBodyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  previewApp: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  previewWhen: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginLeft: 'auto',
  },
  previewTitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  previewBody: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  toggles: {
    marginTop: WANTED_TOKENS.spacing.s6,
    gap: WANTED_TOKENS.spacing.s2 + 2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    borderRadius: 14,
    gap: 12,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBody: {
    flex: 1,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  primary: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: WANTED_TOKENS.spacing.s6,
    // Primary CTA shadow per design (`0 8px 20px rgba(0,102,255,0.30)`).
    // shadowColor is dynamically set to semantic.primaryNormal at the call site.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  primaryLabel: {
    fontSize: 16,
    letterSpacing: -0.16,
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
