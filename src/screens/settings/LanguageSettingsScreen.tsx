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
import { WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const handleLanguageChange = async (lang: Language): Promise<void> => {
    if (lang !== language) {
      await setLanguage(lang);
    }
    navigation.goBack();
  };

  const styles = createStyles(semantic);

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
        <Ionicons name="checkmark-circle" size={24} color={semantic.primaryNormal} />
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

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    content: {
      flex: 1,
    },
    languageOption: {
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
    languageOptionSelected: {
      borderLeftColor: semantic.primaryNormal,
      backgroundColor: semantic.primaryBg,
    },
    languageFlagContainer: {
      width: 56,
      height: 56,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s4,
    },
    languageFlag: {
      fontSize: 32,
    },
    languageContent: {
      flex: 1,
    },
    languageTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      color: semantic.labelStrong,
      marginBottom: 4,
    },
    selectedText: {
      color: semantic.primaryNormal,
    },
    languageSubtitle: {
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

export default LanguageSettingsScreen;
