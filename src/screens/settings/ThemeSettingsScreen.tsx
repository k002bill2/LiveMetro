/**
 * Theme Settings Screen
 * Configure app theme (light/dark/system)
 *
 * Wanted handoff (settings-detail-2) — 모드 선택 미니 앱 미리보기 3장
 * 그리드 + 시간대별 자동 전환(서울 일출/일몰, sunSchedule) + 강조 색상
 * 8종(colors.primary 계열 오버라이드) + 접근성 빠른 토글
 * (AccessibilityContext). 강조 색상의 정적 WANTED_TOKENS 화면 전면
 * 적용은 후속 작업.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Aperture, Contrast, MoonStar, Type } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme, ThemeMode, useSemanticTokens } from '@/services/theme';
import {
  getAccentColorOption,
  type AccentColorId,
} from '@/services/theme/accentColors';
import { useI18n } from '@/services/i18n';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { SettingsStackParamList } from '@/navigation/types';
import AccentColorSwatches from '@/components/settings/AccentColorSwatches';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import ThemeModePreviewCard from '@/components/settings/ThemeModePreviewCard';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ThemeSettings'>;

interface ThemeModeOption {
  id: ThemeMode;
  titleKo: string;
  titleEn: string;
}

// 디자인 순서: 라이트 → 다크 → 시스템
const THEME_MODE_OPTIONS: readonly ThemeModeOption[] = [
  { id: 'light', titleKo: '라이트', titleEn: 'Light' },
  { id: 'dark', titleKo: '다크', titleEn: 'Dark' },
  { id: 'system', titleKo: '시스템', titleEn: 'System' },
];

export const ThemeSettingsScreen: React.FC<Props> = () => {
  const {
    themeMode,
    setThemeMode,
    isDark,
    accentColorId,
    setAccentColor,
    autoSwitchEnabled,
    setAutoSwitchEnabled,
  } = useTheme();
  const semantic = useSemanticTokens();
  const { language } = useI18n();
  const { settings, updateSettings } = useAccessibility();

  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // 미리보기 카드 탭 — 화면 유지(즉시 미리보기 반영), goBack 없음 (핸드오프 동작)
  // 자동 전환 중이면 수동 선택이 우선하도록 자동 전환을 해제한다.
  const handleThemeChange = useCallback(
    (theme: ThemeMode): void => {
      if (autoSwitchEnabled) {
        void setAutoSwitchEnabled(false);
      }
      void setThemeMode(theme);
    },
    [autoSwitchEnabled, setAutoSwitchEnabled, setThemeMode],
  );

  const handleToggleAutoSwitch = useCallback(
    (value: boolean): void => {
      void setAutoSwitchEnabled(value);
    },
    [setAutoSwitchEnabled],
  );

  const handleSelectAccent = useCallback(
    (id: AccentColorId): void => {
      void setAccentColor(id);
    },
    [setAccentColor],
  );

  const handleToggleHighContrast = useCallback(
    (value: boolean): void => {
      void updateSettings({ highContrastEnabled: value });
    },
    [updateSettings],
  );

  const handleToggleBoldText = useCallback(
    (value: boolean): void => {
      void updateSettings({ boldTextEnabled: value });
    },
    [updateSettings],
  );

  const handleToggleReduceMotion = useCallback(
    (value: boolean): void => {
      void updateSettings({ reduceMotionEnabled: value });
    },
    [updateSettings],
  );

  const ko = language === 'ko';
  const currentAccent = getAccentColorOption(accentColorId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* 모드 — 미니 앱 미리보기 3장 그리드 (카드 밖, 페이지 배경 위) */}
        <View style={styles.modeSection}>
          <Text style={styles.modeSectionTitle}>{ko ? '모드' : 'Mode'}</Text>
          <View
            style={[styles.modeGrid, autoSwitchEnabled && styles.modeGridDimmed]}
          >
            {THEME_MODE_OPTIONS.map((option) => (
              <ThemeModePreviewCard
                key={option.id}
                mode={option.id}
                title={ko ? option.titleKo : option.titleEn}
                selected={!autoSwitchEnabled && themeMode === option.id}
                onPress={() => handleThemeChange(option.id)}
              />
            ))}
          </View>
          <Text style={styles.footerCaption}>
            {ko
              ? `현재 적용된 테마: ${isDark ? '다크 모드' : '라이트 모드'}`
              : `Currently applied: ${isDark ? 'Dark Mode' : 'Light Mode'}`}
          </Text>
        </View>

        {/* 다크 모드 자동 전환 — 서울 일출/일몰 기준 (themeContext 실연동) */}
        <SettingSection
          title={ko ? '다크 모드 자동 전환' : 'Auto Dark Mode'}
          style={styles.sectionTight}
        >
          <SettingToggle
            icon={MoonStar}
            label={ko ? '시간대별 자동 전환' : 'Switch by Time of Day'}
            subtitle={
              ko
                ? '해 진 후 다크 · 해 뜬 후 라이트'
                : 'Dark after sunset · light after sunrise'
            }
            value={autoSwitchEnabled}
            onValueChange={handleToggleAutoSwitch}
          />
        </SettingSection>
        <Text style={styles.sectionCaption}>
          {autoSwitchEnabled
            ? ko
              ? '서울 일출 · 일몰 기준으로 자동 전환돼요.'
              : 'Switches automatically at Seoul sunrise and sunset.'
            : ko
              ? '직접 모드를 선택해 사용해요.'
              : 'Pick a mode above to use it manually.'}
        </Text>

        {/* 강조 색상 — colors.primary 계열 오버라이드 */}
        <View style={styles.accentSection}>
          <View style={styles.accentHeaderRow}>
            <Text style={styles.accentTitle}>
              {ko ? '강조 색상' : 'Accent Color'}
            </Text>
            <Text style={styles.accentCurrentLabel} testID="accent-current-label">
              {ko ? currentAccent.labelKo : currentAccent.labelEn}
            </Text>
          </View>
          <AccentColorSwatches
            selectedId={accentColorId}
            onSelect={handleSelectAccent}
          />
        </View>
        <Text style={styles.sectionCaption}>
          {ko
            ? '버튼, 링크, 활성 탭 등 주요 액션에 사용되는 색상이에요.'
            : 'Used for buttons, links, active tabs, and other key actions.'}
        </Text>

        {/* 접근성 빠른 설정 — AccessibilityContext 실연동 */}
        <SettingSection title={ko ? '접근성' : 'Accessibility'}>
          <SettingToggle
            icon={Contrast}
            label={ko ? '고대비 모드' : 'High Contrast'}
            subtitle={ko ? '텍스트와 배경 대비 강화' : 'Stronger text/background contrast'}
            value={settings.highContrastEnabled}
            onValueChange={handleToggleHighContrast}
          />
          <SettingToggle
            icon={Type}
            label={ko ? '굵은 글씨' : 'Bold Text'}
            subtitle={ko ? '모든 텍스트를 굵게' : 'Bolder text everywhere'}
            value={settings.boldTextEnabled}
            onValueChange={handleToggleBoldText}
          />
          <SettingToggle
            icon={Aperture}
            label={ko ? '모션 줄이기' : 'Reduce Motion'}
            subtitle={ko ? '화면 전환 애니메이션 비활성화' : 'Disable transition animations'}
            value={settings.reduceMotionEnabled}
            onValueChange={handleToggleReduceMotion}
          />
        </SettingSection>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    content: {
      flex: 1,
    },
    modeSection: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    modeSectionTitle: {
      // GroupLabel idiom (settings-detail.jsx:25-37): 12/800/0.04em uppercase
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s2,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    modeGrid: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
    },
    modeGridDimmed: {
      opacity: 0.5,
    },
    footerCaption: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 12 * 1.45,
    },
    sectionTight: {
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    sectionCaption: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s5,
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 12 * 1.45,
    },
    accentSection: {
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    accentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    accentTitle: {
      // GroupLabel idiom — SettingSection.sectionTitle과 동일 규격
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
      textTransform: 'uppercase',
    },
    accentCurrentLabel: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelNeutral,
    },
  });

export default ThemeSettingsScreen;
