/**
 * Location Permission Settings Screen
 * Manage location permissions.
 *
 * Wanted handoff (settings-detail-2.jsx:433-533 SettingsLocationScreen) —
 * 상태 히어로 카드(56px 아이콘 사각 + 상태 Pill + 풀폭 액션 버튼),
 * 사용 목적 4행, 세부 설정 3토글, 개인정보 링크 카드.
 *
 * Honesty 매핑: "정확한 위치"는 실상태 표시(Android=권한 accuracy, iOS=권한
 * granted proxy — SDK 49 expo-location이 iOS precise 미노출) + 시스템 설정
 * 위임. "자동 주변 역 검색"은 nearbySearchPreference 실연동(useNearbyStations
 * 게이트). 권한 비즈니스 로직(checkPermission/requestPermission/
 * requestBackgroundPermission/openSettings)은 무수정.
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
import {
  BellRing,
  Check,
  ChevronRight,
  Crosshair,
  MapPin,
  Navigation,
  Route,
  RotateCw,
  Settings,
  ShieldCheck,
  TrainFront,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { SettingsStackParamList } from '@/navigation/types';
import SettingSection from '@/components/settings/SettingSection';
import SettingToggle from '@/components/settings/SettingToggle';
import { locationService } from '@/services/location/locationService';
import {
  getNearbyAutoSearchEnabled,
  setNearbyAutoSearchEnabled,
  subscribeNearbyAutoSearch,
} from '@/services/location/nearbySearchPreference';

type Props = NativeStackScreenProps<SettingsStackParamList, 'LocationPermission'>;

interface PermissionState {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
  /** Android=권한 accuracy 'fine', iOS=granted proxy (SDK 49 precise 미노출) */
  precise: boolean;
}

type PermissionStatusString = 'granted' | 'denied' | 'undetermined' | 'loading';

interface PurposeRow {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly sub: string;
  readonly tinted?: boolean;
}

// 디자인 4행. sub 카피는 실기능 기준으로 보정: "가까운 5개역"=홈 maxStations:5,
// 환승 안내는 위치 자동이 아닌 길안내 화면 기능이라 "길안내 중"으로 한정.
const PURPOSE_ROWS: readonly PurposeRow[] = [
  { Icon: Navigation, label: '주변 역 자동 검색', sub: '현재 위치 기준 가까운 5개역', tinted: true },
  { Icon: TrainFront, label: '출발/도착 자동 인식', sub: '가까운 역의 노선·도착 정보 자동 표시' },
  { Icon: BellRing, label: '역 근처 알림', sub: '설정한 출퇴근 역 도착 시 알림' },
  { Icon: Route, label: '환승 안내', sub: '길안내 중 환승역에서 다음 노선 안내' },
];

export const LocationPermissionScreen: React.FC<Props> = ({ navigation }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    foreground: Location.PermissionStatus.UNDETERMINED,
    background: Location.PermissionStatus.UNDETERMINED,
    precise: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestingBackground, setRequestingBackground] = useState(false);
  const [nearbyAutoSearch, setNearbyAutoSearch] = useState(true);

  // "자동 주변 역 검색" preference 로드 + 구독 (다른 화면 변경 반영)
  useEffect(() => {
    let alive = true;
    getNearbyAutoSearchEnabled().then((enabled) => {
      if (alive) setNearbyAutoSearch(enabled);
    });
    const unsubscribe = subscribeNearbyAutoSearch(setNearbyAutoSearch);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // For backward compatibility with UI rendering
  const permissionStatus: PermissionStatusString = isLoading
    ? 'loading'
    : permissionState.foreground === Location.PermissionStatus.GRANTED
    ? 'granted'
    : permissionState.foreground === Location.PermissionStatus.DENIED
    ? 'denied'
    : 'undetermined';

  const backgroundGranted = permissionState.background === Location.PermissionStatus.GRANTED;

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const foregroundResponse = await Location.getForegroundPermissionsAsync();
      const { status: background } = await Location.getBackgroundPermissionsAsync();
      const granted = foregroundResponse.status === Location.PermissionStatus.GRANTED;
      // Android는 권한 응답의 accuracy로 정확한 위치 여부를 직접 읽는다.
      // iOS는 SDK 49 expo-location이 precise 플래그를 노출하지 않아 granted를
      // proxy로 사용 (변경은 시스템 설정 위임이라 표시 오차만 존재).
      const precise =
        Platform.OS === 'android'
          ? foregroundResponse.android?.accuracy === 'fine'
          : granted;
      setPermissionState({
        foreground: foregroundResponse.status,
        background,
        precise,
      });
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Error checking location permission:', error);
      }
      setPermissionState({
        foreground: Location.PermissionStatus.UNDETERMINED,
        background: Location.PermissionStatus.UNDETERMINED,
        precise: false,
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
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Error requesting location permission:', error);
      }
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
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Error requesting background permission:', error);
      }
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

  // 백그라운드 토글: off→on 은 기존 요청 플로우, on→off 는 프로그램으로
  // 회수가 불가하므로 시스템 설정 안내로 위임.
  const handleBackgroundToggle = (value: boolean): void => {
    if (value) {
      void requestBackgroundPermission();
    } else {
      openSettings();
    }
  };

  // 정확한 위치는 OS만 변경 가능 — 시스템 설정으로 위임
  const handlePreciseToggle = (): void => {
    Alert.alert(
      '정확한 위치',
      '정확한 위치 사용 여부는 시스템 설정에서만 변경할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '설정 열기', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const handleNearbyAutoSearchToggle = (value: boolean): void => {
    setNearbyAutoSearch(value); // 낙관적 반영 (구독 통지로도 동기화)
    void setNearbyAutoSearchEnabled(value);
  };

  const handlePrivacyPress = (): void => {
    navigation.navigate('PrivacyPolicy');
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

  const getStatusTitle = (): string => {
    switch (permissionStatus) {
      case 'granted':
        return '위치 권한 활성화';
      case 'denied':
        return '위치 권한 꺼짐';
      case 'loading':
        return '위치 권한 확인 중';
      default:
        return '위치 권한 필요';
    }
  };

  const getStatusPillText = (): string => {
    switch (permissionStatus) {
      case 'granted':
        return '허용됨';
      case 'denied':
        return '거부됨';
      case 'loading':
        return '확인 중';
      default:
        return '미설정';
    }
  };

  const getStatusDescription = (): string => {
    switch (permissionStatus) {
      case 'granted':
        return permissionState.precise ? '정확한 위치 사용 중' : '대략적인 위치 사용 중';
      case 'denied':
        return '위치 권한이 거부되었습니다';
      case 'loading':
        return '권한 상태 확인 중...';
      default:
        return '위치 권한을 요청하지 않았습니다';
    }
  };

  const statusColor = getStatusColor();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Status hero card (handoff 443-491) */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIconSquare, { backgroundColor: statusColor + '20' }]}>
              <MapPin size={26} color={statusColor} strokeWidth={2.2} />
              {permissionStatus === 'granted' && (
                <View style={styles.heroBadgeOuter}>
                  <View style={styles.heroBadgeInner}>
                    <Check size={9} color="#FFFFFF" strokeWidth={4} />
                  </View>
                </View>
              )}
            </View>
            <View style={styles.heroTextColumn}>
              <View style={styles.heroPillRow}>
                <View style={[styles.heroPill, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.heroPillText, { color: statusColor }]}>
                    {getStatusPillText()}
                  </Text>
                </View>
                {permissionStatus === 'granted' && (
                  <Text style={styles.heroPillCaption}>
                    {backgroundGranted ? '항상 허용' : '앱 사용 중에만'}
                  </Text>
                )}
              </View>
              <Text style={styles.heroTitle}>{getStatusTitle()}</Text>
              <Text style={styles.heroSub}>{getStatusDescription()}</Text>
            </View>
          </View>

          {permissionStatus === 'granted' ? (
            <TouchableOpacity
              style={styles.heroButtonNeutral}
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel="시스템 설정에서 변경"
            >
              <Settings size={14} color={semantic.labelNeutral} strokeWidth={2} />
              <Text style={styles.heroButtonNeutralText}>시스템 설정에서 변경</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.heroButtonPrimary}
              onPress={requestPermission}
              disabled={requesting}
              accessibilityRole="button"
              accessibilityLabel="위치 권한 요청"
            >
              <MapPin size={14} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.heroButtonPrimaryText}>
                {requesting ? '권한 요청 중...' : '위치 권한 요청'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Why we need it (handoff 493-504, 실기능 3행) */}
        <SettingSection title="위치 정보 사용 목적">
          {PURPOSE_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.purposeRow,
                index === PURPOSE_ROWS.length - 1 && styles.purposeRowLast,
              ]}
            >
              <View
                style={[
                  styles.purposeIconSquare,
                  row.tinted && styles.purposeIconSquareTinted,
                ]}
              >
                <row.Icon
                  size={16}
                  color={row.tinted ? WANTED_TOKENS.blue[500] : semantic.labelNeutral}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.purposeTextColumn}>
                <Text style={styles.purposeLabel}>{row.label}</Text>
                <Text style={styles.purposeSub}>{row.sub}</Text>
              </View>
            </View>
          ))}
        </SettingSection>

        {/* Fine controls (handoff 506-512) */}
        <SettingSection title="세부 설정">
          <SettingToggle
            icon={Crosshair}
            label="정확한 위치 사용"
            subtitle="비활성 시 약 1km 범위로 처리"
            value={permissionState.precise}
            onValueChange={handlePreciseToggle}
            disabled={isLoading}
          />
          <SettingToggle
            icon={Zap}
            label="자동 주변 역 검색"
            subtitle="앱 실행 시 자동 감지"
            value={nearbyAutoSearch}
            onValueChange={handleNearbyAutoSearchToggle}
          />
          <SettingToggle
            icon={RotateCw}
            label="백그라운드 새로고침"
            subtitle="배터리 사용량 증가"
            value={backgroundGranted}
            onValueChange={handleBackgroundToggle}
            disabled={requestingBackground || isLoading}
          />
        </SettingSection>

        {/* Privacy link (handoff 514-528) */}
        <TouchableOpacity
          style={styles.privacyCard}
          onPress={handlePrivacyPress}
          accessibilityRole="button"
          accessibilityLabel="개인정보 처리방침 보기"
          testID="privacy-link-card"
        >
          <ShieldCheck size={20} color={WANTED_TOKENS.blue[500]} strokeWidth={2.2} />
          <Text style={styles.privacyText}>
            위치 정보는 기기에만 저장되며, LiveMetro 서버로 전송되지 않습니다.
          </Text>
          <ChevronRight size={16} color={WANTED_TOKENS.blue[500]} strokeWidth={2} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

LocationPermissionScreen.displayName = 'LocationPermissionScreen';

const createStyles = (semantic: WantedSemanticTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.bgSubtlePage,
  },
  content: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: semantic.bgBase,
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginTop: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s5,
    paddingVertical: WANTED_TOKENS.spacing.s5,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconSquare: {
    width: 56,
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroBadgeOuter: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: WANTED_TOKENS.radius.pill,
    backgroundColor: semantic.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadgeInner: {
    width: 12,
    height: 12,
    borderRadius: WANTED_TOKENS.radius.pill,
    backgroundColor: semantic.statusPositive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextColumn: {
    flex: 1,
  },
  heroPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPill: {
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 3,
    borderRadius: WANTED_TOKENS.radius.pill,
  },
  heroPillText: {
    fontSize: WANTED_TOKENS.type.caption2.size,
    fontFamily: weightToFontFamily('700'),
  },
  heroPillCaption: {
    fontSize: WANTED_TOKENS.type.caption2.size,
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelAlt,
    marginLeft: 6,
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: weightToFontFamily('800'),
    color: semantic.labelStrong,
    letterSpacing: -0.16,
    marginTop: 6,
  },
  heroSub: {
    fontSize: 11.5,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelAlt,
    marginTop: 2,
  },
  heroButtonNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s4,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: WANTED_TOKENS.radius.r6,
    backgroundColor: semantic.bgSubtle,
  },
  heroButtonNeutralText: {
    fontSize: WANTED_TOKENS.type.label2.size,
    fontFamily: weightToFontFamily('700'),
    color: semantic.labelStrong,
    marginLeft: 6,
  },
  heroButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s4,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: WANTED_TOKENS.radius.r6,
    backgroundColor: WANTED_TOKENS.blue[500],
  },
  heroButtonPrimaryText: {
    fontSize: WANTED_TOKENS.type.label2.size,
    fontFamily: weightToFontFamily('700'),
    color: '#FFFFFF',
    marginLeft: 6,
  },
  purposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
  },
  purposeRowLast: {
    borderBottomWidth: 0,
  },
  purposeIconSquare: {
    width: 32,
    height: 32,
    borderRadius: WANTED_TOKENS.radius.r4,
    backgroundColor: semantic.bgSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: WANTED_TOKENS.spacing.s3,
  },
  purposeIconSquareTinted: {
    backgroundColor: 'rgba(0,102,255,0.12)',
  },
  purposeTextColumn: {
    flex: 1,
  },
  purposeLabel: {
    fontSize: 14,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelStrong,
  },
  purposeSub: {
    fontSize: 11.5,
    fontFamily: weightToFontFamily('500'),
    color: semantic.labelAlt,
    lineHeight: 16,
    marginTop: 2,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: WANTED_TOKENS.spacing.s4,
    marginBottom: WANTED_TOKENS.spacing.s6,
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    borderRadius: 14,
    backgroundColor: 'rgba(0,102,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,102,255,0.15)',
  },
  privacyText: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelNeutral,
    lineHeight: Math.round(WANTED_TOKENS.type.caption1.size * 1.45),
    marginHorizontal: WANTED_TOKENS.spacing.s3,
  },
});

export default LocationPermissionScreen;
