/**
 * Theme Settings Screen
 * Configure app theme (light/dark/system)
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

type ThemeOption = 'light' | 'dark' | 'system';

export const ThemeSettingsScreen: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const currentTheme = user?.preferences.theme || 'system';

  const handleThemeChange = async (theme: ThemeOption): Promise<void> => {
    if (!user) return;

    try {
      setSaving(true);
      await updateUserProfile({
        preferences: {
          ...user.preferences,
          theme,
        },
      });

      Alert.alert(
        '테마 변경됨',
        '테마 설정이 저장되었습니다. 다크 모드는 곧 추가될 예정입니다.',
        [{ text: '확인' }]
      );
    } catch (error) {
      console.error('Error updating theme:', error);
      Alert.alert('오류', '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const ThemeOption: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    value: ThemeOption;
    isSelected: boolean;
    isDisabled?: boolean;
  }> = ({ icon, title, description, value, isSelected, isDisabled = false }) => (
    <TouchableOpacity
      style={[
        styles.themeOption,
        isSelected && styles.themeOptionSelected,
        isDisabled && styles.themeOptionDisabled,
      ]}
      onPress={() => !isDisabled && handleThemeChange(value)}
      disabled={saving || isDisabled}
    >
      <View style={styles.themeIconContainer}>
        <Ionicons
          name={icon}
          size={32}
          color={isSelected ? COLORS.black : COLORS.gray[400]}
        />
      </View>
      <View style={styles.themeContent}>
        <View style={styles.themeTitleRow}>
          <Text style={[styles.themeTitle, isDisabled && styles.themeDisabledText]}>
            {title}
          </Text>
          {isDisabled && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>준비 중</Text>
            </View>
          )}
          {isSelected && !isDisabled && (
            <Ionicons name="checkmark-circle" size={24} color={COLORS.black} />
          )}
        </View>
        <Text style={[styles.themeDescription, isDisabled && styles.themeDisabledText]}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <SettingSection title="화면 테마">
          <ThemeOption
            icon="sunny"
            title="라이트 모드"
            description="밝은 화면으로 표시합니다"
            value="light"
            isSelected={currentTheme === 'light'}
            isDisabled={true}
          />
          <ThemeOption
            icon="moon"
            title="다크 모드"
            description="어두운 화면으로 표시합니다"
            value="dark"
            isSelected={currentTheme === 'dark'}
            isDisabled={true}
          />
          <ThemeOption
            icon="phone-portrait"
            title="시스템 설정 따름"
            description="기기의 테마 설정을 따릅니다"
            value="system"
            isSelected={currentTheme === 'system'}
          />
        </SettingSection>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ 현재는 라이트 모드만 지원합니다. 다크 모드는 곧 출시될
            예정입니다. 시스템 설정을 선택하시면 기기의 테마에 맞춰 자동으로
            변경됩니다.
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
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  themeOptionSelected: {
    borderLeftColor: COLORS.black,
    backgroundColor: COLORS.surface.card,
  },
  themeOptionDisabled: {
    opacity: 0.5,
  },
  themeIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.surface.card,
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
    marginBottom: 4,
  },
  themeTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
  },
  themeDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  themeDisabledText: {
    color: COLORS.text.disabled,
  },
  comingSoonBadge: {
    backgroundColor: COLORS.secondary.yellowLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
  },
  comingSoonText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.secondary.yellow,
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

export default ThemeSettingsScreen;
