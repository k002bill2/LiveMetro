/**
 * Language Settings Screen
 * Configure app language (Korean / English)
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
import { useI18n, Language } from '@/services/i18n';
import { useTheme } from '@/services/theme';
import { SettingsStackParamList } from '@/navigation/types';
import SettingSection from '@/components/settings/SettingSection';

type Props = NativeStackScreenProps<SettingsStackParamList, 'LanguageSettings'>;

interface LanguageOptionData {
  id: Language;
  flag: string;
  title: string;
  subtitle: string;
}

const languageOptions: LanguageOptionData[] = [
  { id: 'ko', flag: '🇰🇷', title: '한국어', subtitle: 'Korean' },
  { id: 'en', flag: '🇺🇸', title: 'English', subtitle: '영어' },
];

export const LanguageSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { language, setLanguage, t } = useI18n();
  const { colors } = useTheme();

  const handleLanguageChange = async (lang: Language): Promise<void> => {
    if (lang !== language) {
      await setLanguage(lang);
    }
    navigation.goBack();
  };

  const styles = createStyles(colors);

  const LanguageOption: React.FC<{
    flag: string;
    title: string;
    subtitle: string;
    value: Language;
    isSelected: boolean;
  }> = ({ flag, title, subtitle, value, isSelected }) => (
    <TouchableOpacity
      style={[styles.languageOption, isSelected && styles.languageOptionSelected]}
      onPress={() => handleLanguageChange(value)}
    >
      <View style={styles.languageFlagContainer}>
        <Text style={styles.languageFlag}>{flag}</Text>
      </View>
      <View style={styles.languageContent}>
        <Text style={[styles.languageTitle, isSelected && styles.selectedText]}>
          {title}
        </Text>
        <Text style={styles.languageSubtitle}>{subtitle}</Text>
      </View>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <SettingSection title={t.languageSettings.title}>
          {languageOptions.map((option) => (
            <LanguageOption
              key={option.id}
              flag={option.flag}
              title={option.title}
              subtitle={option.subtitle}
              value={option.id}
              isSelected={language === option.id}
            />
          ))}
        </SettingSection>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {language === 'ko'
              ? 'ℹ️ 언어를 변경하면 앱 전체에 즉시 적용됩니다.'
              : 'ℹ️ Language changes will be applied immediately throughout the app.'}
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
    languageOption: {
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
    languageOptionSelected: {
      borderLeftColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    languageFlagContainer: {
      width: 56,
      height: 56,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: RADIUS.lg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.lg,
    },
    languageFlag: {
      fontSize: 32,
    },
    languageContent: {
      flex: 1,
    },
    languageTitle: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    selectedText: {
      color: colors.primary,
    },
    languageSubtitle: {
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

export default LanguageSettingsScreen;
