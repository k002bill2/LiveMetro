/**
 * Location Permission Settings Screen
 * Manage location permissions
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { useTheme, ThemeColors } from '@/services/theme';
import SettingSection from '@/components/settings/SettingSection';

export const LocationPermissionScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [permissionStatus, setPermissionStatus] = useState<string>('loading');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async (): Promise<void> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking location permission:', error);
      setPermissionStatus('undetermined');
    }
  };

  const requestPermission = async (): Promise<void> => {
    try {
      setRequesting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status === 'granted') {
        Alert.alert('권한 허용됨', '위치 권한이 성공적으로 허용되었습니다.');
      } else {
        Alert.alert(
          '권한 거부됨',
          '위치 권한이 거부되었습니다. 설정에서 직접 허용해주세요.'
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('오류', '권한 요청에 실패했습니다.');
    } finally {
      setRequesting(false);
    }
  };

  const openSettings = (): void => {
    Alert.alert(
      '설정 열기',
      'LiveMetro 앱의 위치 권한을 변경하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '설정 열기',
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]
    );
  };

  const getStatusColor = (): string => {
    switch (permissionStatus) {
      case 'granted':
        return colors.success;
      case 'denied':
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const getStatusText = (): string => {
    switch (permissionStatus) {
      case 'granted':
        return '위치 권한이 허용되었습니다';
      case 'denied':
        return '위치 권한이 거부되었습니다';
      case 'loading':
        return '권한 상태 확인 중...';
      default:
        return '위치 권한을 요청하지 않았습니다';
    }
  };

  const getStatusIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (permissionStatus) {
      case 'granted':
        return 'checkmark-circle';
      case 'denied':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Permission Status */}
        <View style={styles.statusCard}>
          <View
            style={[styles.statusIcon, { backgroundColor: getStatusColor() + '20' }]}
          >
            <Ionicons
              name={getStatusIcon()}
              size={48}
              color={getStatusColor()}
            />
          </View>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>

        {/* Location Uses */}
        <SettingSection title="위치 정보 사용 목적">
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="locate" size={24} color={colors.textPrimary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>주변 역 찾기</Text>
              <Text style={styles.featureDescription}>
                현재 위치에서 가까운 지하철역을 자동으로 찾아줍니다
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="subway" size={24} color={colors.textPrimary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>출퇴근 경로 설정</Text>
              <Text style={styles.featureDescription}>
                자주 이용하는 경로를 추천하고 설정할 수 있습니다
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="notifications" size={24} color={colors.textPrimary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>맞춤 알림</Text>
              <Text style={styles.featureDescription}>
                위치 기반으로 실시간 지연 알림을 받을 수 있습니다
              </Text>
            </View>
          </View>
        </SettingSection>

        {/* Permission Actions */}
        <SettingSection title="권한 관리">
          {permissionStatus !== 'granted' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={requestPermission}
              disabled={requesting}
            >
              <Ionicons name="location" size={20} color={colors.textInverse} />
              <Text style={styles.actionButtonText}>
                {requesting ? '권한 요청 중...' : '위치 권한 요청'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={openSettings}
          >
            <Ionicons name="settings" size={20} color={colors.textPrimary} />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              앱 설정 열기
            </Text>
          </TouchableOpacity>
        </SettingSection>

        {/* Privacy Notice */}
        <View style={styles.privacyBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.textSecondary} />
          <Text style={styles.privacyText}>
            위치 정보는 기기에만 저장되며 서버로 전송되지 않습니다. 개인정보는
            안전하게 보호됩니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: colors.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    paddingVertical: SPACING['2xl'],
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  featureIcon: {
    width: 40,
    height: 40,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textTertiary,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
    paddingVertical: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textInverse,
    marginLeft: SPACING.sm,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
  },
  privacyBox: {
    flexDirection: 'row',
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
  privacyText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
    marginLeft: SPACING.md,
  },
});

export default LocationPermissionScreen;
