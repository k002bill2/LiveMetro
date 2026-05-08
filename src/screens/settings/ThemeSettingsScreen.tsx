/**
 * Theme Settings Screen
 * Configure app theme (light/dark/system)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  AlignCenter,
  AlignJustify,
  BarChart3,
  CheckCircle,
  Circle,
  Flame,
  Moon,
  Palette,
  PaintBucket,
  Rows3,
  Smartphone,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme, ThemeMode } from '@/services/theme';
import type { CongStyle, Density } from '@/services/theme/themeContext';
import { useI18n } from '@/services/i18n';
import { SettingsStackParamList } from '@/navigation/types';
import SettingSection from '@/components/settings/SettingSection';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ThemeSettings'>;

interface OptionData<T> {
  id: T;
  icon: LucideIcon;
  titleKo: string;
  titleEn: string;
  descKo: string;
  descEn: string;
}

const themeOptions: OptionData<ThemeMode>[] = [
  {
    id: 'system',
    icon: Smartphone,
    titleKo: '시스템 설정 따름',
    titleEn: 'Follow System',
    descKo: '기기의 테마 설정을 따릅니다',
    descEn: 'Follow device theme settings',
  },
  {
    id: 'light',
    icon: Sun,
    titleKo: '라이트 모드',
    titleEn: 'Light Mode',
    descKo: '밝은 화면으로 표시합니다',
    descEn: 'Display with light background',
  },
  {
    id: 'dark',
    icon: Moon,
    titleKo: '다크 모드',
    titleEn: 'Dark Mode',
    descKo: '어두운 화면으로 표시합니다',
    descEn: 'Display with dark background',
  },
];

const densityOptions: OptionData<Density>[] = [
  {
    id: 'loose',
    icon: AlignJustify,
    titleKo: '여유',
    titleEn: 'Loose',
    descKo: '큰 여백, 시원한 레이아웃',
    descEn: 'Spacious, airy layout',
  },
  {
    id: 'balanced',
    icon: AlignCenter,
    titleKo: '균형',
    titleEn: 'Balanced',
    descKo: '기본 권장 설정',
    descEn: 'Recommended default',
  },
  {
    id: 'dense',
    icon: Rows3,
    titleKo: '조밀',
    titleEn: 'Dense',
    descKo: '많은 정보를 한눈에',
    descEn: 'See more at a glance',
  },
];

const congStyleOptions: OptionData<CongStyle>[] = [
  {
    id: 'bar',
    icon: BarChart3,
    titleKo: '막대 그래프',
    titleEn: 'Bar',
    descKo: '비율을 가로 막대로 표시',
    descEn: 'Horizontal bar showing ratio',
  },
  {
    id: 'dots',
    icon: Circle,
    titleKo: '점 그래프',
    titleEn: 'Dots',
    descKo: '4개의 점으로 단계 표시',
    descEn: 'Four dots showing level',
  },
  {
    id: 'heat',
    icon: Flame,
    titleKo: '히트맵',
    titleEn: 'Heatmap',
    descKo: '색상 강도로 표시',
    descEn: 'Color intensity',
  },
];

const lineEmphasisOptions: OptionData<boolean>[] = [
  {
    id: true,
    icon: Palette,
    titleKo: '컬러 강조 켜기',
    titleEn: 'Emphasis On',
    descKo: '노선별 고유 색상으로 표시',
    descEn: 'Distinct color per subway line',
  },
  {
    id: false,
    icon: PaintBucket,
    titleKo: '컬러 강조 끄기',
    titleEn: 'Emphasis Off',
    descKo: '회색 톤으로 통일',
    descEn: 'Unified gray tone',
  },
];

export const ThemeSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const {
    themeMode,
    setThemeMode,
    isDark,
    density,
    setDensity,
    congStyle,
    setCongStyle,
    lineEmphasis,
    setLineEmphasis,
  } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { language, t } = useI18n();

  const handleThemeChange = async (next: ThemeMode): Promise<void> => {
    await setThemeMode(next);
    navigation.goBack();
  };

  const handleDensityChange = async (next: Density): Promise<void> => {
    await setDensity(next);
  };

  const handleCongStyleChange = async (next: CongStyle): Promise<void> => {
    await setCongStyle(next);
  };

  const handleLineEmphasisChange = async (next: boolean): Promise<void> => {
    await setLineEmphasis(next);
  };

  const styles = createStyles(semantic);

  // Generic option row — used for theme/density/congStyle/lineEmphasis sections.
  function OptionItem<T>({
    icon: IconComponent,
    title,
    description,
    value,
    isSelected,
    onSelect,
    testID,
  }: {
    icon: LucideIcon;
    title: string;
    description: string;
    value: T;
    isSelected: boolean;
    onSelect: (value: T) => void | Promise<void>;
    testID?: string;
  }): React.ReactElement {
    return (
      <TouchableOpacity
        testID={testID}
        style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
        onPress={() => onSelect(value)}
      >
        <View style={styles.themeIconContainer}>
          <IconComponent
            size={32}
            color={isSelected ? semantic.primaryNormal : semantic.labelAlt}
            strokeWidth={2}
          />
        </View>
        <View style={styles.themeContent}>
          <View style={styles.themeTitleRow}>
            <Text style={[styles.themeTitle, isSelected && styles.selectedText]}>
              {title}
            </Text>
            {isSelected && (
              <CheckCircle size={24} color={semantic.primaryNormal} strokeWidth={2} />
            )}
          </View>
          <Text style={styles.themeDescription}>{description}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <SettingSection title={t.themeSettings.title}>
          {themeOptions.map((option) => (
            <OptionItem
              key={option.id}
              icon={option.icon}
              title={language === 'ko' ? option.titleKo : option.titleEn}
              description={language === 'ko' ? option.descKo : option.descEn}
              value={option.id}
              isSelected={themeMode === option.id}
              onSelect={handleThemeChange}
            />
          ))}
        </SettingSection>

        <SettingSection title={t.themeSettings.densityTitle}>
          {densityOptions.map((option) => (
            <OptionItem
              key={option.id}
              icon={option.icon}
              title={language === 'ko' ? option.titleKo : option.titleEn}
              description={language === 'ko' ? option.descKo : option.descEn}
              value={option.id}
              isSelected={density === option.id}
              onSelect={handleDensityChange}
            />
          ))}
        </SettingSection>

        <SettingSection title={t.themeSettings.congStyleTitle}>
          {congStyleOptions.map((option) => (
            <OptionItem
              key={option.id}
              icon={option.icon}
              title={language === 'ko' ? option.titleKo : option.titleEn}
              description={language === 'ko' ? option.descKo : option.descEn}
              value={option.id}
              isSelected={congStyle === option.id}
              onSelect={handleCongStyleChange}
            />
          ))}
        </SettingSection>

        <SettingSection title={t.themeSettings.lineEmphasisTitle}>
          {lineEmphasisOptions.map((option) => (
            <OptionItem
              key={String(option.id)}
              icon={option.icon}
              title={language === 'ko' ? option.titleKo : option.titleEn}
              description={language === 'ko' ? option.descKo : option.descEn}
              value={option.id}
              isSelected={lineEmphasis === option.id}
              onSelect={handleLineEmphasisChange}
            />
          ))}
        </SettingSection>

        {/* Current Theme Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {language === 'ko'
              ? `ℹ️ 현재 적용된 테마: ${isDark ? '다크 모드' : '라이트 모드'}`
              : `ℹ️ Currently applied: ${isDark ? 'Dark Mode' : 'Light Mode'}`}
          </Text>
        </View>
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
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
      backgroundColor: semantic.bgBase,
    },
    themeOptionSelected: {
      borderLeftColor: semantic.primaryNormal,
      backgroundColor: semantic.primaryBg,
    },
    themeIconContainer: {
      width: 56,
      height: 56,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s4,
    },
    themeContent: {
      flex: 1,
    },
    themeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    themeTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      flex: 1,
    },
    selectedText: {
      color: semantic.primaryNormal,
    },
    themeDescription: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
    },
    infoBox: {
      backgroundColor: semantic.primaryBg,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s5,
      marginBottom: WANTED_TOKENS.spacing.s5,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    infoText: {
      fontSize: WANTED_TOKENS.type.body2.size,
      color: semantic.labelAlt,
      lineHeight: WANTED_TOKENS.type.body2.lh,
    },
  });

export default ThemeSettingsScreen;
