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
import Slider from '@react-native-community/slider';
import { useAccessibility } from '@/contexts/AccessibilityContext';

// ============================================================================
// Component
// ============================================================================

const AccessibilitySettingsScreen: React.FC = () => {
  const { settings, updateSettings, resetSettings, isDarkMode, effectiveTextScale } =
    useAccessibility();

  const handleToggle = useCallback(
    (key: keyof typeof settings) => async (value: boolean) => {
      await updateSettings({ [key]: value });
    },
    [updateSettings]
  );

  const handleTextScaleChange = useCallback(
    async (value: number) => {
      await updateSettings({ textScale: Math.round(value * 10) / 10 });
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

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>큰 텍스트</Text>
              <Text style={styles.rowDescription}>
                텍스트 크기를 기본보다 크게 표시합니다
              </Text>
            </View>
            <Switch
              value={settings.largeTextEnabled}
              onValueChange={handleToggle('largeTextEnabled')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.largeTextEnabled ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="큰 텍스트"
            />
          </View>

          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.rowTitle}>텍스트 크기</Text>
              <Text style={styles.sliderValue}>{(effectiveTextScale * 100).toFixed(0)}%</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.8}
              maximumValue={2.0}
              value={settings.textScale}
              onSlidingComplete={handleTextScaleChange}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#007AFF"
              accessibilityLabel="텍스트 크기 조절"
              accessibilityHint={`현재 ${(effectiveTextScale * 100).toFixed(0)}퍼센트입니다`}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>작게</Text>
              <Text style={styles.sliderLabel}>크게</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>굵은 텍스트</Text>
              <Text style={styles.rowDescription}>
                모든 텍스트를 굵게 표시합니다
              </Text>
            </View>
            <Switch
              value={settings.boldTextEnabled}
              onValueChange={handleToggle('boldTextEnabled')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.boldTextEnabled ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="굵은 텍스트"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>여백 늘리기</Text>
              <Text style={styles.rowDescription}>
                버튼과 요소 사이 간격을 넓힙니다
              </Text>
            </View>
            <Switch
              value={settings.increasedSpacing}
              onValueChange={handleToggle('increasedSpacing')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.increasedSpacing ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="여백 늘리기"
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

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>햅틱 피드백</Text>
              <Text style={styles.rowDescription}>
                버튼 터치 시 진동으로 알려줍니다
              </Text>
            </View>
            <Switch
              value={settings.hapticFeedbackEnabled}
              onValueChange={handleToggle('hapticFeedbackEnabled')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.hapticFeedbackEnabled ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="햅틱 피드백"
            />
          </View>
        </View>

        {/* Audio Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>소리</Text>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>음성 안내</Text>
              <Text style={styles.rowDescription}>
                알림을 음성으로 읽어줍니다
              </Text>
            </View>
            <Switch
              value={settings.voiceAnnouncementsEnabled}
              onValueChange={handleToggle('voiceAnnouncementsEnabled')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.voiceAnnouncementsEnabled ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="음성 안내"
            />
          </View>
        </View>

        {/* Theme Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>테마</Text>

          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>시스템 테마 사용</Text>
              <Text style={styles.rowDescription}>
                기기 설정에 따라 밝기/어두운 테마를 자동 적용
              </Text>
            </View>
            <Switch
              value={settings.useSystemTheme}
              onValueChange={handleToggle('useSystemTheme')}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.useSystemTheme ? '#007AFF' : '#F5F5F5'}
              accessibilityLabel="시스템 테마 사용"
            />
          </View>

          {!settings.useSystemTheme && (
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>다크 모드</Text>
                <Text style={styles.rowDescription}>
                  어두운 배경의 테마를 사용합니다
                </Text>
              </View>
              <Switch
                value={settings.forceDarkMode}
                onValueChange={handleToggle('forceDarkMode')}
                trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
                thumbColor={settings.forceDarkMode ? '#007AFF' : '#F5F5F5'}
                accessibilityLabel="다크 모드"
              />
            </View>
          )}

          <View style={styles.currentTheme}>
            <Text style={styles.currentThemeLabel}>현재 테마:</Text>
            <Text style={styles.currentThemeValue}>
              {isDarkMode ? '🌙 다크 모드' : '☀️ 라이트 모드'}
            </Text>
          </View>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>미리보기</Text>
          <View
            style={[
              styles.previewCard,
              settings.highContrastEnabled && styles.previewCardHighContrast,
            ]}
          >
            <Text
              style={[
                styles.previewTitle,
                {
                  fontSize: 18 * effectiveTextScale,
                  fontWeight: settings.boldTextEnabled ? 'bold' : 'normal',
                },
              ]}
            >
              2호선 강남역
            </Text>
            <Text
              style={[
                styles.previewText,
                {
                  fontSize: 14 * effectiveTextScale,
                  fontWeight: settings.boldTextEnabled ? '600' : 'normal',
                },
              ]}
            >
              외선순환 방면 3분 후 도착
            </Text>
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
            • 텍스트 크기는 200%까지 조절 가능합니다{'\n'}
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
    color: '#333',
  },
  rowDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  sliderSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slider: {
    height: 40,
    marginTop: 8,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999',
  },
  currentTheme: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  currentThemeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  currentThemeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  previewCard: {
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewCardHighContrast: {
    backgroundColor: '#FFF',
    borderColor: '#000',
    borderWidth: 2,
  },
  previewTitle: {
    color: '#007AFF',
    marginBottom: 4,
  },
  previewText: {
    color: '#333',
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
