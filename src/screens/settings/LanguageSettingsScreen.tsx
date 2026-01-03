/**
 * Language Settings Screen
 * Configure app language
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useAuth } from '@/services/auth/AuthContext';
import SettingSection from '@/components/settings/SettingSection';

type LanguageOption = 'ko' | 'en';

export const LanguageSettingsScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const currentLanguage = user?.preferences.language || 'ko';

  const handleLanguageChange = async (language: LanguageOption): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          language,
        },
      });

      Alert.alert(
        '언어 변경됨',
        '언어 설정이 저장되었습니다. 앱을 다시 시작하면 변경된 언어가 적용됩니다.',
        [{ text: '확인' }]
      );
    } catch (error) {
      console.error('Error updating language:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const LanguageOption: React.FC<{
    flag: string;
    title: string;
    subtitle: string;
    value: LanguageOption;
    isSelected: boolean;
  }> = ({ flag, title, subtitle, value, isSelected }) => (
    <TouchableOpacity
      style={[styles.languageOption, isSelected && styles.languageOptionSelected]}
      onPress={() => handleLanguageChange(value)}
      disabled={saving}
    >
      <View style={styles.languageFlagContainer}>
        <Text style={styles.languageFlag}>{flag}</Text>
      </View>
      <View style={styles.languageContent}>
        <Text style={styles.languageTitle}>{title}</Text>
        <Text style={styles.languageSubtitle}>{subtitle}</Text>
      </View>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={24} color={COLORS.black} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <SettingSection title="앱 언어">
          <LanguageOption
            flag="🇰🇷"
            title="한국어"
            subtitle="Korean"
            value="ko"
            isSelected={currentLanguage === 'ko'}
          />
          <LanguageOption
            flag="🇺🇸"
            title="English"
            subtitle="영어 (준비 중)"
            value="en"
            isSelected={currentLanguage === 'en'}
          />
        </SettingSection>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ 언어 변경 후 앱을 다시 시작하면 설정이 적용됩니다. 현재는
            한국어만 지원하며, 영어는 곧 추가될 예정입니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
    borderBottomColor: COLORS.border.light,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  languageOptionSelected: {
    borderLeftColor: COLORS.black,
    backgroundColor: COLORS.surface.card,
  },
  languageFlagContainer: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.surface.card,
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
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  languageSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  infoBox: {
    backgroundColor: COLORS.primary.light,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
});

export default LanguageSettingsScreen;
