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
import { WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';
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
  const { themeMode, setThemeMode, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { language, t } = useI18n();

  const handleThemeChange = async (theme: ThemeMode): Promise<void> => {
    await setThemeMode(theme);
    navigation.goBack();
  };

  const styles = createStyles(semantic);

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
          color={isSelected ? semantic.primaryNormal : semantic.labelAlt}
        />
      </View>
      <View style={styles.themeContent}>
        <View style={styles.themeTitleRow}>
          <Text style={[styles.themeTitle, isSelected && styles.selectedText]}>
            {title}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={semantic.primaryNormal} />
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
