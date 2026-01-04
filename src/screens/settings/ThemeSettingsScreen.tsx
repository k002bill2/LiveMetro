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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useTheme, ThemeMode } from '@/services/theme';
import { useI18n } from '@/services/i18n';
import { SettingsStackParamList } from '@/navigation/types';
import SettingSection from '@/components/settings/SettingSection';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ThemeSettings'>;

interface ThemeOptionData {
  id: ThemeMode;
  icon: keyof typeof Ionicons.glyphMap;
  titleKo: string;
  titleEn: string;
  descKo: string;
  descEn: string;
}

const themeOptions: ThemeOptionData[] = [
  {
    id: 'system',
    icon: 'phone-portrait',
    titleKo: '시스템 설정 따름',
    titleEn: 'Follow System',
    descKo: '기기의 테마 설정을 따릅니다',
    descEn: 'Follow device theme settings',
  },
  {
    id: 'light',
    icon: 'sunny',
    titleKo: '라이트 모드',
    titleEn: 'Light Mode',
    descKo: '밝은 화면으로 표시합니다',
    descEn: 'Display with light background',
  },
  {
    id: 'dark',
    icon: 'moon',
    titleKo: '다크 모드',
    titleEn: 'Dark Mode',
    descKo: '어두운 화면으로 표시합니다',
    descEn: 'Display with dark background',
  },
];

export const ThemeSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const { language, t } = useI18n();

  const handleThemeChange = async (theme: ThemeMode): Promise<void> => {
    await setThemeMode(theme);
    navigation.goBack();
  };

  const styles = createStyles(colors);

  const ThemeOptionItem: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    value: ThemeMode;
    isSelected: boolean;
  }> = ({ icon, title, description, value, isSelected }) => (
    <TouchableOpacity
      style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
      onPress={() => handleThemeChange(value)}
    >
      <View style={styles.themeIconContainer}>
        <Ionicons
          name={icon}
          size={32}
          color={isSelected ? colors.primary : colors.textTertiary}
        />
      </View>
      <View style={styles.themeContent}>
        <View style={styles.themeTitleRow}>
          <Text style={[styles.themeTitle, isSelected && styles.selectedText]}>
            {title}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          )}
        </View>
        <Text style={styles.themeDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <SettingSection title={t.themeSettings.title}>
          {themeOptions.map((option) => (
            <ThemeOptionItem
              key={option.id}
              icon={option.icon}
              title={language === 'ko' ? option.titleKo : option.titleEn}
              description={language === 'ko' ? option.descKo : option.descEn}
              value={option.id}
              isSelected={themeMode === option.id}
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

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
      backgroundColor: colors.surface,
    },
    themeOptionSelected: {
      borderLeftColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    themeIconContainer: {
      width: 56,
      height: 56,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.lg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.lg,
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
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
      flex: 1,
    },
    selectedText: {
      color: colors.primary,
    },
    themeDescription: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textTertiary,
    },
    infoBox: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.xl,
      marginBottom: SPACING.xl,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    infoText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
    },
  });

export default ThemeSettingsScreen;
