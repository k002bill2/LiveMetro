/**
 * Language Settings Screen
 * Configure app language (Korean / English)
 *
 * Wanted handoff (settings-detail-2) — 플래그 + 이름/원어 2줄 + 우측 라디오
 * 서클 row 패턴. 디자인의 8개국어 목록 중 앱이 실제 지원하는 한국어/영어만
 * 노출 (시스템 언어 따르기 · 역명 병기 · 제보 자동 번역은 미지원으로 생략).
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useI18n, Language } from '@/services/i18n';
import { useTheme } from '@/services/theme';
import { SettingsStackParamList } from '@/navigation/types';
import SettingSection from '@/components/settings/SettingSection';

type Props = NativeStackScreenProps<SettingsStackParamList, 'LanguageSettings'>;

interface LanguageOptionData {
  id: Language;
  flag: string;
  /** 해당 언어 표기 (디자인: name 15/700) */
  name: string;
  /** 현재 언어 기준 보조 표기 (디자인: native 11.5/600) */
  native: string;
}

const LANGUAGE_OPTIONS: readonly LanguageOptionData[] = [
  { id: 'ko', flag: '🇰🇷', name: '한국어', native: 'Korean' },
  { id: 'en', flag: '🇺🇸', name: 'English', native: '영어' },
];

export const LanguageSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { language, setLanguage, t } = useI18n();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const handleLanguageChange = useCallback(
    async (lang: Language): Promise<void> => {
      if (lang !== language) {
        await setLanguage(lang);
      }
      navigation.goBack();
    },
    [language, setLanguage, navigation],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <SettingSection title={t.languageSettings.title}>
          {LANGUAGE_OPTIONS.map((option, index) => {
            const selected = language === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.languageRow,
                  index === LANGUAGE_OPTIONS.length - 1 && styles.languageRowLast,
                ]}
                onPress={() => handleLanguageChange(option.id)}
                accessibilityRole="button"
                accessibilityLabel={option.name}
                accessibilityState={{ selected }}
                testID={`language-${option.id}`}
              >
                <Text style={styles.flag}>{option.flag}</Text>
                <View style={styles.labelColumn}>
                  <Text style={styles.name}>{option.name}</Text>
                  <Text style={styles.native}>{option.native}</Text>
                </View>
                {selected ? (
                  <View style={styles.checkCircle}>
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={styles.emptyCircle} />
                )}
              </TouchableOpacity>
            );
          })}
        </SettingSection>

        <Text style={styles.footerCaption}>
          {language === 'ko'
            ? '언어를 변경하면 앱 전체에 즉시 적용됩니다.'
            : 'Language changes will be applied immediately throughout the app.'}
        </Text>
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
    languageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(112,115,124,0.10)',
    },
    languageRowLast: {
      borderBottomWidth: 0,
    },
    flag: {
      fontSize: 24,
      lineHeight: 28,
    },
    labelColumn: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: 15,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      letterSpacing: -0.08,
    },
    native: {
      fontSize: 11.5,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 999,
      backgroundColor: WANTED_TOKENS.blue[500],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCircle: {
      width: 22,
      height: 22,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: 'rgba(112,115,124,0.30)',
      backgroundColor: semantic.bgBase,
    },
    footerCaption: {
      marginTop: -WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s5,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      fontSize: 11.5,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 11.5 * 1.45,
    },
  });

export default LanguageSettingsScreen;
