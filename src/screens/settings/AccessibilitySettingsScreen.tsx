/**
 * Accessibility Settings Screen
 * Allows users to configure accessibility preferences
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { weightToFontFamily } from '@/styles/modernTheme';

// ============================================================================
// Component
// ============================================================================

const AccessibilitySettingsScreen: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useAccessibility();

  const handleToggle = useCallback(
    (key: keyof typeof settings) => async (value: boolean) => {
      await updateSettings({ [key]: value });
    },
    [updateSettings]
  );

  const handleReset = useCallback(async () => {
    await resetSettings();
  }, [resetSettings]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>♿ 접근성 설정</Text>
          <Text style={styles.subtitle}>
            앱을 더 편하게 사용할 수 있도록 설정을 조정하세요
          </Text>
        </View>

        {/* System Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시스템 감지</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>화면 읽기 프로그램</Text>
            <Text style={[styles.statusValue, settings.screenReaderEnabled && styles.statusActive]}>
              {settings.screenReaderEnabled ? '활성화됨' : '비활성화됨'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>동작 줄이기</Text>
            <Text style={[styles.statusValue, settings.reduceMotionEnabled && styles.statusActive]}>
              {settings.reduceMotionEnabled ? '활성화됨' : '비활성화됨'}
            </Text>
          </View>
        </View>

        {/* Visual Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>시각</Text>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>고대비 모드</Text>
              <Text style={styles.rowDescription}>
                텍스트와 UI 요소의 대비를 높입니다
              </Text>
            </View>
            <Switch
              value={settings.highContrastEnabled}
              onValueChange={handleToggle('highContrastEnabled')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.highContrastEnabled ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="고대비 모드"
              accessibilityHint="활성화하면 화면의 대비가 높아집니다"
            />
          </View>

        </View>

        {/* Motion Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>동작</Text>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>자동 애니메이션</Text>
              <Text style={styles.rowDescription}>
                화면 전환 애니메이션을 재생합니다
              </Text>
            </View>
            <Switch
              value={settings.autoplayAnimations}
              onValueChange={handleToggle('autoplayAnimations')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.autoplayAnimations ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="자동 애니메이션"
            />
          </View>

        </View>

        {/* Reset Button */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleReset}
          accessibilityLabel="설정 초기화"
          accessibilityHint="모든 접근성 설정을 기본값으로 되돌립니다"
        >
          <Text style={styles.resetButtonText}>설정 초기화</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 도움말</Text>
          <Text style={styles.infoText}>
            • 화면 읽기 프로그램은 기기의 설정 앱에서 변경할 수 있습니다{'\n'}
            • 고대비 모드는 WCAG 2.1 AA 기준을 충족합니다{'\n'}
            • 문제가 있으시면 설정 {'>'} 피드백에서 알려주세요
          </Text>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 15,
    color: '#333',
  },
  statusValue: {
    fontSize: 14,
    color: '#999',
  },
  statusActive: {
    color: '#4CAF50',
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowContent: {
    flex: 1,
    marginRight: 16,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    color: '#333',
  },
  rowDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  resetButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  infoSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    height: 40,
  },
});

export default AccessibilitySettingsScreen;
