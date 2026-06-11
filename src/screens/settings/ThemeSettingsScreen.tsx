/**
 * Theme Settings Screen
 * Configure app theme (light/dark/system)
 *
 * Wanted handoff (settings-detail-2) — 모드 선택을 미니 앱 미리보기
 * 3장 그리드로 표시하고, 접근성 빠른 토글(고대비·굵은 글씨·모션 줄이기)을
 * AccessibilityContext에 배선. 디자인의 강조 색상 8종 · 일출/일몰 자동
 * 전환은 테마 시스템 미지원으로 생략 (PR 참고).
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Aperture, Contrast, Type } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme, ThemeMode } from '@/services/theme';
import { useI18n } from '@/services/i18n';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { SettingsStackParamList } from '@/navigation/types';
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
  const { themeMode, setThemeMode, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { language, t } = useI18n();
  const { settings, updateSettings } = useAccessibility();

  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // 미리보기 카드 탭 — 화면 유지(즉시 미리보기 반영), goBack 없음 (핸드오프 동작)
  const handleThemeChange = useCallback(
    (theme: ThemeMode): void => {
      void setThemeMode(theme);
    },
    [setThemeMode],
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* 모드 — 미니 앱 미리보기 3장 그리드 (카드 밖, 페이지 배경 위) */}
        <View style={styles.modeSection}>
          <Text style={styles.modeSectionTitle}>{t.themeSettings.title}</Text>
          <View style={styles.modeGrid}>
            {THEME_MODE_OPTIONS.map((option) => (
              <ThemeModePreviewCard
                key={option.id}
                mode={option.id}
                title={ko ? option.titleKo : option.titleEn}
                selected={themeMode === option.id}
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
    footerCaption: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
      fontSize: 11.5,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 11.5 * 1.45,
    },
  });

export default ThemeSettingsScreen;
