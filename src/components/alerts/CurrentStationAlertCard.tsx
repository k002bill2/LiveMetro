/**
 * Current Station Alert Card Component
 *
 * A settings card for configuring location-based station arrival alerts.
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getSubwayLineColor } from '@utils/colorUtils';

interface Station {
  id: string;
  name: string;
  lineId: string;
}

interface CurrentStationAlertCardProps {
  /** Whether alerts are enabled */
  enabled: boolean;
  /** List of stations to monitor */
  stations: Station[];
  /** Detection radius in meters */
  radius: number;
  /** Cooldown time in minutes */
  cooldownMinutes: number;
  /** Callback when enabled state changes */
  onEnabledChange: (enabled: boolean) => void;
  /** Callback when add station is pressed */
  onAddStation: () => void;
  /** Callback when a station is removed */
  onRemoveStation: (stationId: string) => void;
  /** Callback when radius changes */
  onRadiusChange: (radius: number) => void;
  /** Callback when cooldown changes */
  onCooldownChange: (minutes: number) => void;
}

const COOLDOWN_OPTIONS = [
  { label: '15분', value: 15 },
  { label: '30분', value: 30 },
  { label: '1시간', value: 60 },
  { label: '2시간', value: 120 },
];

/**
 * Current Station Alert Card Component
 */
export const CurrentStationAlertCard: React.FC<CurrentStationAlertCardProps> = memo(
  ({
    enabled,
    stations,
    radius,
    cooldownMinutes,
    onEnabledChange,
    onAddStation,
    onRemoveStation,
    onRadiusChange,
    onCooldownChange,
  }) => {
    const renderStationItem = useCallback(
      ({ item }: { item: Station }) => {
        const lineColor = getSubwayLineColor(item.lineId);
        const lineNumber = item.lineId.replace(/[^0-9]/g, '') || item.lineId.charAt(0);

        return (
          <View style={styles.stationItem}>
            <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
              <Text style={styles.lineBadgeText}>{lineNumber}</Text>
            </View>
            <Text style={styles.stationName}>{item.name}</Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemoveStation(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}역 제거`}
              accessibilityHint="이 역을 알림 목록에서 제거합니다"
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        );
      },
      [onRemoveStation]
    );

    const keyExtractor = useCallback((item: Station) => item.id, []);

    const formatRadius = (value: number): string => `${value}m`;

    const formatCooldown = (minutes: number): string => {
      if (minutes < 60) {
        return `${minutes}분`;
      }
      return `${minutes / 60}시간`;
    };

    return (
      <View style={styles.card}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>현재 역 알림</Text>
            <Text style={styles.subtitle}>
              설정한 역 근처에 도착하면 알림을 받습니다
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onEnabledChange}
            trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
            thumbColor={enabled ? '#FFFFFF' : '#F4F3F4'}
            ios_backgroundColor="#E0E0E0"
            accessibilityLabel="현재 역 알림 활성화"
            accessibilityHint={enabled ? '알림을 비활성화합니다' : '알림을 활성화합니다'}
          />
        </View>

        {enabled && (
          <>
            {/* Stations Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>알림받을 역</Text>
                <Text style={styles.stationCount}>{stations.length}개</Text>
              </View>

              {stations.length > 0 ? (
                <FlatList
                  data={stations}
                  renderItem={renderStationItem}
                  keyExtractor={keyExtractor}
                  style={styles.stationList}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>알림받을 역을 추가해주세요</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.addButton}
                onPress={onAddStation}
                accessibilityRole="button"
                accessibilityLabel="역 추가"
                accessibilityHint="알림받을 역을 추가합니다"
              >
                <Text style={styles.addButtonText}>+ 역 추가</Text>
              </TouchableOpacity>
            </View>

            {/* Settings Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>알림 설정</Text>

              {/* Radius Setting */}
              <View style={styles.settingItem}>
                <View style={styles.settingHeader}>
                  <Text style={styles.settingLabel}>감지 반경</Text>
                  <Text style={styles.settingValue}>{formatRadius(radius)}</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={50}
                  maximumValue={500}
                  step={50}
                  value={radius}
                  onValueChange={onRadiusChange}
                  minimumTrackTintColor="#2196F3"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#2196F3"
                  accessibilityLabel="감지 반경 조절"
                  accessibilityHint="역 근처로 인식할 범위를 설정합니다"
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>50m</Text>
                  <Text style={styles.sliderLabel}>500m</Text>
                </View>
              </View>

              {/* Cooldown Setting */}
              <View style={styles.settingItem}>
                <View style={styles.settingHeader}>
                  <Text style={styles.settingLabel}>재알림 방지</Text>
                  <Text style={styles.settingValue}>{formatCooldown(cooldownMinutes)}</Text>
                </View>
                <View style={styles.cooldownOptions}>
                  {COOLDOWN_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.cooldownOption,
                        cooldownMinutes === option.value && styles.cooldownOptionSelected,
                      ]}
                      onPress={() => onCooldownChange(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: cooldownMinutes === option.value }}
                    >
                      <Text
                        style={[
                          styles.cooldownOptionText,
                          cooldownMinutes === option.value &&
                            styles.cooldownOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.settingDescription}>
                  같은 역에서 다시 알림받기까지의 대기 시간
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }
);

CurrentStationAlertCard.displayName = 'CurrentStationAlertCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  stationCount: {
    fontSize: 14,
    color: '#666666',
  },
  stationList: {
    maxHeight: 200,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  lineBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lineBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stationName: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
  },
  addButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  settingItem: {
    marginBottom: 20,
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 15,
    color: '#2196F3',
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999999',
  },
  cooldownOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cooldownOption: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cooldownOptionSelected: {
    backgroundColor: '#2196F3',
  },
  cooldownOptionText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  cooldownOptionTextSelected: {
    color: '#FFFFFF',
  },
  settingDescription: {
    fontSize: 13,
    color: '#666666',
    marginTop: 8,
    lineHeight: 18,
  },
});
