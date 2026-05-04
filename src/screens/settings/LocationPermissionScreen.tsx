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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import SettingSection from '@/components/settings/SettingSection';
import { locationService } from '@/services/location/locationService';

interface PermissionState {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}

type PermissionStatusString = 'granted' | 'denied' | 'undetermined' | 'loading';

export const LocationPermissionScreen: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    foreground: Location.PermissionStatus.UNDETERMINED,
    background: Location.PermissionStatus.UNDETERMINED,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestingBackground, setRequestingBackground] = useState(false);

  // For backward compatibility with UI rendering
  const permissionStatus: PermissionStatusString = isLoading
    ? 'loading'
    : permissionState.foreground === Location.PermissionStatus.GRANTED
    ? 'granted'
    : permissionState.foreground === Location.PermissionStatus.DENIED
    ? 'denied'
    : 'undetermined';

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { status: foreground } = await Location.getForegroundPermissionsAsync();
      const { status: background } = await Location.getBackgroundPermissionsAsync();
      setPermissionState({ foreground, background });
    } catch (error) {
      console.error('Error checking location permission:', error);
      setPermissionState({
        foreground: Location.PermissionStatus.UNDETERMINED,
        background: Location.PermissionStatus.UNDETERMINED,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Show permission explanation before requesting
   */
  const showPermissionExplanation = (): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        '위치 권한이 필요합니다',
        '주변 역 찾기와 도착 알림을 위해 위치 정보가 필요합니다.\n\n• 현재 위치 기반 가까운 역 표시\n• 역 도착 시 자동 알림\n• 출퇴근 경로 추천',
        [
          { text: '허용 안함', onPress: () => resolve(false), style: 'cancel' },
          { text: '계속', onPress: () => resolve(true) },
        ]
      );
    });
  };

  const requestPermission = async (): Promise<void> => {
    try {
      // Show explanation first
      const proceed = await showPermissionExplanation();
      if (!proceed) return;

      setRequesting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionState(prev => ({ ...prev, foreground: status }));

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

  /**
   * Request background permission with Android 11+ guide
   */
  const requestBackgroundPermission = async (): Promise<void> => {
    try {
      // Ensure foreground permission first
      if (permissionState.foreground !== 'granted') {
        Alert.alert(
          '전경 권한 필요',
          '먼저 위치 권한을 허용해주세요.'
        );
        return;
      }

      // Show Android 11+ guide
      if (Platform.OS === 'android' && Platform.Version >= 30) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            '항상 허용 설정 필요',
            '백그라운드에서 알림을 받으려면:\n\n1. "권한" 메뉴 선택\n2. "위치" 선택\n3. "항상 허용" 선택',
            [{ text: '설정으로 이동', onPress: () => resolve() }]
          );
        });
      }

      setRequestingBackground(true);
      const granted = await locationService.requestBackgroundPermission();

      // Refresh permission state
      await checkPermission();

      if (granted) {
        Alert.alert('권한 허용됨', '백그라운드 위치 권한이 허용되었습니다.');
      } else {
        Alert.alert(
          '권한 거부됨',
          '백그라운드 위치 권한이 거부되었습니다. 설정에서 "항상 허용"을 선택해주세요.'
        );
      }
    } catch (error) {
      console.error('Error requesting background permission:', error);
      Alert.alert('오류', '백그라운드 권한 요청에 실패했습니다.');
    } finally {
      setRequestingBackground(false);
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
        return semantic.statusPositive;
      case 'denied':
        return semantic.statusNegative;
      default:
        return semantic.statusCautionary;
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
              <Ionicons name="locate" size={24} color={semantic.labelStrong} />
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
              <Ionicons name="subway" size={24} color={semantic.labelStrong} />
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
              <Ionicons name="notifications" size={24} color={semantic.labelStrong} />
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
              <Ionicons name="location" size={20} color={'#FFFFFF'} />
              <Text style={styles.actionButtonText}>
                {requesting ? '권한 요청 중...' : '위치 권한 요청'}
              </Text>
            </TouchableOpacity>
          )}

          {permissionStatus === 'granted' && permissionState.background !== 'granted' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={requestBackgroundPermission}
              disabled={requestingBackground}
            >
              <Ionicons name="navigate" size={20} color={'#FFFFFF'} />
              <Text style={styles.actionButtonText}>
                {requestingBackground ? '권한 요청 중...' : '백그라운드 권한 요청'}
              </Text>
            </TouchableOpacity>
          )}

          {permissionState.background === 'granted' && (
            <View style={styles.permissionGrantedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={semantic.statusPositive} />
              <Text style={[styles.badgeText, { color: semantic.statusPositive }]}>
                백그라운드 위치 허용됨
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={openSettings}
          >
            <Ionicons name="settings" size={20} color={semantic.labelStrong} />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              앱 설정 열기
            </Text>
          </TouchableOpacity>
        </SettingSection>

        {/* Privacy Notice */}
        <View style={styles.privacyBox}>
          <Ionicons name="shield-checkmark" size={20} color={semantic.labelAlt} />
          <Text style={styles.privacyText}>
            위치 정보는 기기에만 저장되며 서버로 전송되지 않습니다. 개인정보는
            안전하게 보호됩니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.bgSubtlePage,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: semantic.bgBase,
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginTop: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s5,
    paddingVertical: WANTED_TOKENS.spacing.s8,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    alignItems: 'center',
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: WANTED_TOKENS.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: WANTED_TOKENS.spacing.s4,
  },
  statusText: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    textAlign: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: WANTED_TOKENS.spacing.s4,
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
  },
  featureIcon: {
    width: 40,
    height: 40,
    backgroundColor: semantic.bgSubtle,
    borderRadius: WANTED_TOKENS.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: WANTED_TOKENS.spacing.s3,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: WANTED_TOKENS.type.label2.size,
    color: semantic.labelAlt,
    lineHeight: WANTED_TOKENS.type.label2.lh,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantic.labelStrong,
    paddingVertical: WANTED_TOKENS.spacing.s4,
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r6,
  },
  secondaryButton: {
    backgroundColor: semantic.bgBase,
    borderWidth: 1,
    borderColor: semantic.lineNormal,
  },
  actionButtonText: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    color: '#FFFFFF',
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
  secondaryButtonText: {
    color: semantic.labelStrong,
  },
  privacyBox: {
    flexDirection: 'row',
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
  privacyText: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.label2.size,
    color: semantic.labelAlt,
    lineHeight: 1.5 * WANTED_TOKENS.type.label2.size,
    marginLeft: WANTED_TOKENS.spacing.s3,
  },
  permissionGrantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s3,
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  badgeText: {
    fontSize: WANTED_TOKENS.type.label2.size,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginLeft: WANTED_TOKENS.spacing.s2,
  },
});

export default LocationPermissionScreen;
