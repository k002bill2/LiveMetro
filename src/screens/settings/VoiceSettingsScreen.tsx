/**
 * Voice Settings Screen
 * Allows users to configure TTS voice settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { ttsService, TTSSettings, VoiceOption } from '@/services/speech/ttsService';

// ============================================================================
// Component
// ============================================================================

const VoiceSettingsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TTSSettings | null>(null);
  const [voices, setVoices] = useState<readonly VoiceOption[]>([]);
  const [testing, setTesting] = useState(false);

  const loadData = useCallback(async () => {
    await ttsService.initialize();
    setSettings(ttsService.getSettings());
    const availableVoices = await ttsService.loadAvailableVoices();
    setVoices(availableVoices);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleEnabled = async (value: boolean): Promise<void> => {
    if (value) {
      await ttsService.enable();
    } else {
      await ttsService.disable();
    }
    setSettings(ttsService.getSettings());
  };

  const handlePitchChange = async (value: number): Promise<void> => {
    await ttsService.updateSettings({ pitch: value });
    setSettings(ttsService.getSettings());
  };

  const handleRateChange = async (value: number): Promise<void> => {
    await ttsService.updateSettings({ rate: value });
    setSettings(ttsService.getSettings());
  };

  const handleVolumeChange = async (value: number): Promise<void> => {
    await ttsService.updateSettings({ volume: value });
    setSettings(ttsService.getSettings());
  };

  const handleVoiceSelect = async (voiceId: string): Promise<void> => {
    await ttsService.updateSettings({ voiceId });
    setSettings(ttsService.getSettings());
  };

  const handleTest = async (): Promise<void> => {
    setTesting(true);
    await ttsService.test();
    setTesting(false);
  };

  const handleTestArrival = async (): Promise<void> => {
    setTesting(true);
    await ttsService.enable(); // Temporarily enable
    await ttsService.announceArrival({
      lineName: '2호선',
      stationName: '강남',
      direction: '외선순환',
      minutes: 3,
    });
    if (!settings?.enabled) {
      await ttsService.disable();
    }
    setTesting(false);
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🔊 음성 설정</Text>
          <Text style={styles.subtitle}>
            열차 도착 및 알림을 음성으로 안내받을 수 있습니다
          </Text>
        </View>

        {/* Enable TTS */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>음성 안내</Text>
              <Text style={styles.rowDescription}>
                알림을 음성으로 읽어줍니다
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: '#E0E0E0', true: '#81D4FA' }}
              thumbColor={settings.enabled ? '#007AFF' : '#F5F5F5'}
            />
          </View>
        </View>

        {/* Voice Selection */}
        {settings.enabled && voices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>음성 선택</Text>
            {voices.filter(v => v.language.startsWith('ko')).map((voice) => (
              <TouchableOpacity
                key={voice.id}
                style={[
                  styles.voiceOption,
                  settings.voiceId === voice.id && styles.voiceOptionSelected,
                ]}
                onPress={() => handleVoiceSelect(voice.id)}
              >
                <View style={styles.voiceInfo}>
                  <Text style={styles.voiceName}>{voice.name}</Text>
                  <Text style={styles.voiceLanguage}>
                    {voice.language} • {voice.quality === 'enhanced' ? '고품질' : '기본'}
                  </Text>
                </View>
                {settings.voiceId === voice.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Voice Settings */}
        {settings.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>음성 조절</Text>

            {/* Pitch */}
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>음높이</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={2.0}
                value={settings.pitch}
                onSlidingComplete={handlePitchChange}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#007AFF"
              />
              <Text style={styles.sliderValue}>{settings.pitch.toFixed(1)}</Text>
            </View>

            {/* Rate */}
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>속도</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={2.0}
                value={settings.rate}
                onSlidingComplete={handleRateChange}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#007AFF"
              />
              <Text style={styles.sliderValue}>{settings.rate.toFixed(1)}</Text>
            </View>

            {/* Volume */}
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>음량</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={settings.volume}
                onSlidingComplete={handleVolumeChange}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#007AFF"
              />
              <Text style={styles.sliderValue}>
                {Math.round(settings.volume * 100)}%
              </Text>
            </View>
          </View>
        )}

        {/* Test Section */}
        {settings.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>테스트</Text>

            <TouchableOpacity
              style={[styles.testButton, testing && styles.testButtonDisabled]}
              onPress={handleTest}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.testButtonText}>🔊 음성 테스트</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.testButton,
                styles.testButtonSecondary,
                testing && styles.testButtonDisabled,
              ]}
              onPress={handleTestArrival}
              disabled={testing}
            >
              <Text style={[styles.testButtonText, styles.testButtonTextSecondary]}>
                🚇 도착 안내 테스트
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 안내</Text>
          <Text style={styles.infoText}>
            • 음성 안내는 다음 상황에서 작동합니다:{'\n'}
            {'  '}- 열차 도착 알림{'\n'}
            {'  '}- 지연 알림{'\n'}
            {'  '}- 출발 시간 알림{'\n'}
            {'  '}- 환승 안내{'\n'}
            • 기기가 무음 모드일 경우 음성이 재생되지 않을 수 있습니다{'\n'}
            • 배터리 절약을 위해 필요한 경우에만 활성화하세요
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  voiceOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  voiceLanguage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  sliderLabel: {
    width: 60,
    fontSize: 14,
    color: '#333',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 50,
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  testButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 6,
  },
  testButtonSecondary: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testButtonTextSecondary: {
    color: '#007AFF',
  },
  infoSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF9E6',
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

export default VoiceSettingsScreen;
