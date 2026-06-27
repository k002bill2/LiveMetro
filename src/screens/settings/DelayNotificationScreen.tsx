/**
 * Delay Notification Settings Screen
 * Configure delay alerts and thresholds.
 *
 * Wanted handoff (settings-detail.jsx:385-528 SettingsAlertsScreen) —
 * 블루 그라디언트 마스터 히어로 카드, 알림 기준 디스크리트 슬라이더
 * (3/5/10/15분), 원형 노선 배지 pill 그리드, 출처별 알림 종류 3토글
 * (공식/제보/긴급 — 틴트 아이콘).
 *
 * 시안에 없는 "상세 알림 종류" 5토글·테스트 알림 버튼·인포 박스는
 * 실기능(notificationService의 alertTypes 필터링)이 배선되어 있어
 * 시안 섹션 아래에 보존한다.
 */

import React, { useMemo, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { AlertTriangle, ArrowRightLeft, Building2, Check, Megaphone, Train, Users, XCircle, Zap, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/services/auth/AuthContext';

import { useNotifications } from '@/hooks/useNotifications';
import { getSubwayLineColor } from '@/utils/colorUtils';
import type { AlertSourcePreferences } from '@/models/user';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';

// Includes numbered subway lines + major Seoul metro lines that the Wanted
// design references (신분당/경의중앙/공항철도/수인분당). LINE_LABELS aliases
// for these were registered in PR #34 (commit f906021).
const LINE_IDS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '신분당선', '경의중앙선', '공항철도', '수인분당선',
];

const formatLineLabel = (lineId: string): string =>
  /선$|철도$/.test(lineId) ? lineId : `${lineId}호선`;

// 시안 pill의 원형 배지 텍스트 (LM_DATA.LINES[id].label 대응). 숫자 노선은
// 번호 그대로, 광역 노선은 LineBadge.tsx LINE_LABELS와 동일한 축약형.
const LINE_BADGE_LABELS: Record<string, string> = {
  '신분당선': '신분당',
  '경의중앙선': '경의중앙',
  '공항철도': '공항',
  '수인분당선': '수인분당',
};

const DEFAULT_ALERT_SOURCES: AlertSourcePreferences = {
  official: true,
  community: true,
  urgent: true,
};

// 시안 thresholdSteps (settings-detail.jsx:399). 레거시 슬라이더(5~30분)로
// 저장된 값은 가장 가까운 스텝으로 스냅해 표시한다.
const THRESHOLD_STEPS: readonly number[] = [3, 5, 10, 15];

const snapToThresholdStep = (value: number): number =>
  THRESHOLD_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );

// wanted-tokens.css --red-500 — WANTED_TOKENS에 red 스케일이 없어 로컬 상수.
const RED_500 = '#FF4242';
// 시안 hero: linear-gradient(135deg, #0066FF 0%, #2C7BFF 100%)
const HERO_GRADIENT_COLORS = ['#0066FF', '#2C7BFF'];

interface AlertSourceRowSpec {
  readonly key: keyof AlertSourcePreferences;
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly sub: string;
  /** 시안 Row iconBg/iconFg — 미지정 시 기본(회색 틴트/labelNeutral) */
  readonly iconBg?: string;
  readonly iconFg?: string;
}

// 시안 알림 종류 3행 (settings-detail.jsx:502-523)
const ALERT_SOURCE_ROWS: readonly AlertSourceRowSpec[] = [
  {
    key: 'official',
    Icon: Building2,
    label: '공식 운영기관 발표',
    sub: '서울교통공사 · 코레일 공지',
  },
  {
    key: 'community',
    Icon: Megaphone,
    label: '실시간 제보',
    sub: '검증된 사용자 제보 3건 이상',
    iconBg: 'rgba(255,180,0,0.16)',
    iconFg: '#A06A00',
  },
  {
    key: 'urgent',
    Icon: Zap,
    label: '긴급 푸시',
    sub: '10분 이상 심각한 지연만 진동/소리',
    iconBg: 'rgba(255,66,66,0.10)',
    iconFg: RED_500,
  },
];

export const DelayNotificationScreen: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();
  const { sendTestNotification } = useNotifications();
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [saving, setSaving] = useState(false);

  const notificationSettings = user?.preferences.notificationSettings;
  const enabled = notificationSettings?.enabled || false;
  const lineFilter = notificationSettings?.lineFilter ?? [];
  const alertSources = notificationSettings?.alertSources ?? DEFAULT_ALERT_SOURCES;
  const threshold = snapToThresholdStep(
    notificationSettings?.delayThresholdMinutes ?? 5,
  );
  const thresholdFillPct =
    (THRESHOLD_STEPS.indexOf(threshold) / (THRESHOLD_STEPS.length - 1)) * 100;

  const handleToggleLine = async (lineId: string): Promise<void> => {
    if (!user) return;
    const next = lineFilter.includes(lineId)
      ? lineFilter.filter((id) => id !== lineId)
      : [...lineFilter, lineId];
    try {
      setSaving(true);
      await updateUserPreferences({
        notificationSettings: {
          ...user.preferences.notificationSettings,
          lineFilter: next,
        },
      });
    } catch (error) {
      console.error('Error updating line filter:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAlertSource = async (
    key: keyof AlertSourcePreferences,
    value: boolean,
  ): Promise<void> => {
    if (!user) return;
    try {
      setSaving(true);
      await updateUserPreferences({
        notificationSettings: {
          ...user.preferences.notificationSettings,
          alertSources: { ...alertSources, [key]: value },
        },
      });
    } catch (error) {
      console.error(`Error updating alert source ${key}:`, error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (value: boolean): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserPreferences({
        notificationSettings: {
          ...user.preferences.notificationSettings,
          enabled: value,
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
      await updateUserPreferences({
        notificationSettings: {
          ...user.preferences.notificationSettings,
          delayThresholdMinutes: value,
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
      await updateUserPreferences({
        notificationSettings: {
          ...user.preferences.notificationSettings,
          alertTypes: {
            ...user.preferences.notificationSettings.alertTypes,
            [alertType]: value,
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

  // Hero 내용은 ON(그라디언트)/OFF(플레인 카드) 컨테이너가 갈려 공유 변수로 구성
  const heroContent = (
    <>
      <View
        style={[
          styles.heroIconSquare,
          {
            backgroundColor: enabled
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(255,66,66,0.10)',
          },
        ]}
      >
        <AlertTriangle
          size={22}
          color={enabled ? '#FFFFFF' : RED_500}
          strokeWidth={2.2}
        />
      </View>
      <View style={styles.heroTextColumn}>
        <Text
          style={[
            styles.heroTitle,
            { color: enabled ? '#FFFFFF' : semantic.labelStrong },
          ]}
        >
          지연 알림
        </Text>
        <Text
          style={[
            styles.heroSub,
            { color: enabled ? 'rgba(255,255,255,0.9)' : semantic.labelAlt },
          ]}
        >
          {enabled
            ? '내 노선의 지연을 실시간으로 알려드려요'
            : '지연 알림이 꺼져 있어요'}
        </Text>
      </View>
      <Switch
        testID="delay-master-toggle"
        accessibilityLabel="지연 알림"
        value={enabled}
        onValueChange={handleToggleEnabled}
        disabled={saving}
        // 블루 그라디언트 위에서는 흰 트랙 + 블루 thumb이 시안의 대비
        trackColor={{ false: semantic.lineNormal, true: '#FFFFFF' }}
        thumbColor={enabled ? WANTED_TOKENS.blue[500] : '#FFFFFF'}
        ios_backgroundColor={semantic.lineNormal}
        style={styles.switchScale}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Master hero (handoff 405-429) */}
        {enabled ? (
          <LinearGradient
            colors={HERO_GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {heroContent}
          </LinearGradient>
        ) : (
          <View style={[styles.heroCard, styles.heroCardOff]}>{heroContent}</View>
        )}

        {/* Threshold (handoff 431-467) */}
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabelText}>알림 기준</Text>
          <Text style={styles.groupLabelHint}>{threshold}분 이상 지연</Text>
        </View>
        <View style={styles.groupCard}>
          <View style={styles.sliderInner}>
            <View style={styles.sliderLabelsRow}>
              {THRESHOLD_STEPS.map((step) => (
                <Text
                  key={step}
                  style={[
                    styles.sliderLabel,
                    step === threshold && styles.sliderLabelActive,
                  ]}
                >
                  {step}분
                </Text>
              ))}
            </View>
            <View style={styles.sliderTrackArea}>
              <View style={styles.sliderTrackBase} />
              <View
                style={[styles.sliderTrackFill, { width: `${thresholdFillPct}%` }]}
              />
              {THRESHOLD_STEPS.map((step, index) => {
                const active = step === threshold;
                const pct = (index / (THRESHOLD_STEPS.length - 1)) * 100;
                return (
                  <TouchableOpacity
                    key={step}
                    testID={`threshold-step-${step}`}
                    onPress={() => handleThresholdChange(step)}
                    accessibilityRole="button"
                    accessibilityLabel={`${step}분 이상 지연 시 알림`}
                    accessibilityState={{ selected: active }}
                    style={[styles.sliderStepTouch, { left: `${pct}%` }]}
                  >
                    <View style={active ? styles.sliderThumbActive : styles.sliderDot} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
        <Text style={styles.groupFooter}>
          설정한 시간보다 짧은 지연은 알림이 오지 않아요.
        </Text>

        {/* Lines (handoff 469-499) */}
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabelText}>알림 받을 노선</Text>
          <Text style={styles.groupLabelHint}>
            {lineFilter.length === 0
              ? '전체 노선'
              : `${lineFilter.length}개 선택됨`}
          </Text>
        </View>
        <View style={styles.groupCard}>
          <View style={styles.linesWrap}>
            {LINE_IDS.map((lineId) => {
              const selected = lineFilter.includes(lineId);
              const lineColor = getSubwayLineColor(lineId);
              return (
                <TouchableOpacity
                  key={lineId}
                  onPress={() => handleToggleLine(lineId)}
                  // Intentionally not gated by `saving` — chips are optimistic
                  // multi-select. Each tap derives `next` from the latest
                  // lineFilter snapshot; rapid toggles remain responsive.
                  hitSlop={{ top: 3, bottom: 3 }}
                  accessibilityRole="button"
                  accessibilityLabel={formatLineLabel(lineId)}
                  accessibilityState={{ selected }}
                  style={[
                    styles.linePill,
                    selected
                      ? { backgroundColor: lineColor, borderColor: lineColor }
                      : {
                          backgroundColor: semantic.bgSubtlePage,
                          borderColor: semantic.lineNormal,
                        },
                  ]}
                >
                  <View
                    style={[
                      styles.lineBadge,
                      {
                        backgroundColor: selected
                          ? 'rgba(255,255,255,0.22)'
                          : lineColor,
                      },
                    ]}
                  >
                    <Text style={styles.lineBadgeText}>
                      {LINE_BADGE_LABELS[lineId] ?? lineId}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.linePillText,
                      { color: selected ? '#fff' : semantic.labelNeutral },
                    ]}
                  >
                    {formatLineLabel(lineId)}
                  </Text>
                  {selected ? (
                    <Check size={13} color="#fff" strokeWidth={3} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Sources (handoff 501-523) */}
        <View style={styles.groupLabelRow}>
          <Text style={styles.groupLabelText}>알림 종류</Text>
        </View>
        <View style={[styles.groupCard, styles.sourcesCard]}>
          {ALERT_SOURCE_ROWS.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.sourceRow,
                index === ALERT_SOURCE_ROWS.length - 1 && styles.sourceRowLast,
              ]}
            >
              <View
                style={[
                  styles.sourceIconSquare,
                  { backgroundColor: row.iconBg ?? semantic.bgSubtle },
                ]}
              >
                <row.Icon
                  size={16}
                  color={row.iconFg ?? semantic.labelNeutral}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.sourceTextColumn}>
                <Text style={styles.sourceLabel}>{row.label}</Text>
                <Text style={styles.sourceSub}>{row.sub}</Text>
              </View>
              <Switch
                testID={`source-toggle-${row.key}`}
                accessibilityLabel={row.label}
                value={alertSources[row.key]}
                onValueChange={(value) => handleToggleAlertSource(row.key, value)}
                disabled={saving}
                trackColor={{
                  false: semantic.lineNormal,
                  true: WANTED_TOKENS.blue[500],
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={semantic.lineNormal}
                style={styles.switchScale}
              />
            </View>
          ))}
        </View>

        {/* Detailed Alert Types — preserved legacy 5-toggle for fine-grained control */}
        <SettingSection title="상세 알림 종류" style={styles.legacySectionTop}>
          <Text style={styles.sectionDisclaimer}>
            상세 알림 종류는 위 알림 종류 안에서 다시 한번 필터링됩니다. 알림 종류가 OFF면 해당 출처의 모든 알림이 차단됩니다.
          </Text>
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

DelayNotificationScreen.displayName = 'DelayNotificationScreen';

// Body line height: 13 * 1.6 = 20.8 (relaxed reading rhythm).
const INFO_FONT_SIZE = 13;
const INFO_LINE_HEIGHT = INFO_FONT_SIZE * 1.6;

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    content: {
      flex: 1,
    },
    // ── Hero (handoff 405-429: radius 18, padding 18/20, gap 14) ──
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s2,
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 20,
    },
    heroCardOff: {
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    heroIconSquare: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    heroTextColumn: {
      flex: 1,
      marginRight: 14,
    },
    heroTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('800'),
      letterSpacing: -0.16,
    },
    heroSub: {
      fontSize: 12,
      fontFamily: weightToFontFamily('600'),
      marginTop: 2,
    },
    switchScale: {
      // Wanted handoff toggles are 44×26 — RN iOS default(51×31)에 0.85 스케일
      transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    },
    // ── Group label / card / footer (handoff GroupLabel·GroupCard) ──
    groupLabelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
      paddingTop: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s2,
    },
    groupLabelText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    groupLabelHint: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    groupCard: {
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    sourcesCard: {
      overflow: 'hidden',
    },
    groupFooter: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 17,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
      paddingTop: WANTED_TOKENS.spacing.s2,
    },
    // ── Threshold discrete slider (handoff 434-465) ──
    sliderInner: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s4,
      paddingBottom: 14,
    },
    sliderLabelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    sliderLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    sliderLabelActive: {
      color: WANTED_TOKENS.blue[500],
    },
    // height 44 = 스텝 터치 타깃. 트랙(4px)은 수직 중앙(top 20)에 absolute.
    sliderTrackArea: {
      position: 'relative',
      height: 44,
      marginHorizontal: WANTED_TOKENS.spacing.s2,
    },
    sliderTrackBase: {
      position: 'absolute',
      top: 20,
      left: 0,
      right: 0,
      height: 4,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: 'rgba(112,115,124,0.18)',
    },
    sliderTrackFill: {
      position: 'absolute',
      top: 20,
      left: 0,
      height: 4,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: WANTED_TOKENS.blue[500],
    },
    sliderStepTouch: {
      position: 'absolute',
      top: 0,
      width: 44,
      height: 44,
      marginLeft: -22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sliderDot: {
      width: 12,
      height: 12,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: 'rgba(112,115,124,0.32)',
    },
    sliderThumbActive: {
      width: 20,
      height: 20,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: '#FFFFFF',
      borderWidth: 4,
      borderColor: WANTED_TOKENS.blue[500],
      shadowColor: WANTED_TOKENS.blue[500],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    // ── Line pills with circular badge (handoff 472-498) ──
    linesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: WANTED_TOKENS.spacing.s3,
    },
    linePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 12,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
    },
    lineBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: WANTED_TOKENS.radius.pill,
      paddingHorizontal: 5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    lineBadgeText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('800'),
      color: '#FFFFFF',
    },
    linePillText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('700'),
    },
    // ── Alert source rows (handoff Row: 32px icon square + 14/600 label) ──
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    sourceRowLast: {
      borderBottomWidth: 0,
    },
    sourceIconSquare: {
      width: 32,
      height: 32,
      borderRadius: WANTED_TOKENS.radius.r4,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    sourceTextColumn: {
      flex: 1,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    sourceLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    sourceSub: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 16,
      marginTop: 2,
    },
    // ── Legacy sections (unchanged) ──
    legacySectionTop: {
      marginTop: WANTED_TOKENS.spacing.s5,
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
    sectionDisclaimer: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s3,
      paddingBottom: WANTED_TOKENS.spacing.s2,
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 16,
    },
  });

export default DelayNotificationScreen;
