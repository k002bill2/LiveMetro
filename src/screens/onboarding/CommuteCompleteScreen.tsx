/**
 * Commute Complete Screen
 * Final screen showing summary of commute settings during onboarding
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/styles/modernTheme';
import { OnboardingStackParamList } from '@/navigation/types';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';
import { RoutePreview } from '@/components/commute/RoutePreview';
import {
  CommuteRoute,
  createCommuteRoute,
  DEFAULT_COMMUTE_NOTIFICATIONS,
  DEFAULT_BUFFER_MINUTES,
} from '@/models/commute';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CommuteComplete'>;

// Format time for display
const formatTime = (time: string): string => {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const period = hours >= 12 ? '오후' : '오전';
  const displayHours = hours % 12 || 12;
  return `${period} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
};

export const CommuteCompleteScreen: React.FC<Props> = ({ navigation, route }) => {
  const [saving, setSaving] = useState(false);
  const { onComplete } = useOnboardingCallbacks();

  // 파라미터가 없으면 로딩 상태 표시 (Native Stack pre-render 대응)
  if (!route.params?.morningRoute || !route.params?.eveningRoute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  const { morningRoute, eveningRoute } = route.params;

  // Build full route objects
  const buildMorningRoute = (): CommuteRoute => {
    return createCommuteRoute({
      departureTime: morningRoute.departureTime,
      departureStationId: morningRoute.departureStation.stationId,
      departureStationName: morningRoute.departureStation.stationName,
      departureLineId: morningRoute.departureStation.lineId,
      transferStations: morningRoute.transferStations,
      arrivalStationId: morningRoute.arrivalStation.stationId,
      arrivalStationName: morningRoute.arrivalStation.stationName,
      arrivalLineId: morningRoute.arrivalStation.lineId,
      notifications: morningRoute.notifications || DEFAULT_COMMUTE_NOTIFICATIONS,
      bufferMinutes: DEFAULT_BUFFER_MINUTES,
    });
  };

  const buildEveningRoute = (): CommuteRoute => {
    return createCommuteRoute({
      departureTime: eveningRoute.departureTime,
      departureStationId: eveningRoute.departureStation.stationId,
      departureStationName: eveningRoute.departureStation.stationName,
      departureLineId: eveningRoute.departureStation.lineId,
      transferStations: eveningRoute.transferStations,
      arrivalStationId: eveningRoute.arrivalStation.stationId,
      arrivalStationName: eveningRoute.arrivalStation.stationName,
      arrivalLineId: eveningRoute.arrivalStation.lineId,
      notifications: eveningRoute.notifications || DEFAULT_COMMUTE_NOTIFICATIONS,
      bufferMinutes: DEFAULT_BUFFER_MINUTES,
    });
  };

  const morningRouteData = buildMorningRoute();
  const eveningRouteData = buildEveningRoute();

  // Handle complete
  const handleComplete = async () => {
    setSaving(true);
    try {
      // TODO: Save to Firebase/AsyncStorage
      // await commuteService.saveCommuteRoutes(morningRouteData, eveningRouteData);

      // Show success message
      Alert.alert(
        '설정 완료!',
        '출퇴근 설정이 완료되었습니다.\n지금부터 LiveMetro가 출퇴근을 도와드릴게요!',
        [
          {
            text: '시작하기',
            onPress: () => {
              // Complete onboarding - triggers RootNavigator to show main app
              onComplete();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save commute routes:', error);
      Alert.alert(
        '저장 실패',
        '출퇴근 설정을 저장하는데 실패했습니다. 다시 시도해주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle edit
  const handleEdit = (type: 'morning' | 'evening') => {
    // Navigate back to the appropriate time screen
    if (type === 'morning') {
      navigation.navigate('CommuteTime', {
        commuteType: 'morning',
        initialTime: morningRoute.departureTime,
        onTimeSet: () => {},
      });
    } else {
      navigation.navigate('CommuteTime', {
        commuteType: 'evening',
        initialTime: eveningRoute.departureTime,
        morningRoute,
        onTimeSet: () => {},
      });
    }
  };

  // Count active notifications
  const countActiveNotifications = (
    notifications: typeof morningRoute.notifications
  ): number => {
    if (!notifications) return 0;
    let count = 0;
    if (notifications.transferAlert) count++;
    if (notifications.arrivalAlert) count++;
    if (notifications.delayAlert) count++;
    if (notifications.incidentAlert) count++;
    return count;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={COLORS.semantic.success}
            />
          </View>
          <Text style={styles.title}>설정 완료!</Text>
          <Text style={styles.subtitle}>
            출퇴근 경로가 모두 설정되었습니다{'\n'}
            아래 내용을 확인해주세요
          </Text>
        </View>

        {/* Morning Route Summary */}
        <View style={styles.routeSection}>
          <View style={styles.routeHeader}>
            <View style={styles.routeHeaderLeft}>
              <View style={[styles.routeIcon, styles.morningIcon]}>
                <Ionicons name="sunny" size={20} color={COLORS.secondary.yellow} />
              </View>
              <View>
                <Text style={styles.routeTitle}>출근</Text>
                <Text style={styles.routeTime}>
                  {formatTime(morningRoute.departureTime)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEdit('morning')}
            >
              <Ionicons name="pencil" size={16} color={COLORS.text.tertiary} />
              <Text style={styles.editButtonText}>수정</Text>
            </TouchableOpacity>
          </View>

          <RoutePreview route={morningRouteData} showTime={false} compact />

          <View style={styles.notificationSummary}>
            <Ionicons
              name="notifications-outline"
              size={16}
              color={COLORS.text.tertiary}
            />
            <Text style={styles.notificationText}>
              {countActiveNotifications(morningRoute.notifications)}개 알림 활성화
            </Text>
          </View>
        </View>

        {/* Evening Route Summary */}
        <View style={styles.routeSection}>
          <View style={styles.routeHeader}>
            <View style={styles.routeHeaderLeft}>
              <View style={[styles.routeIcon, styles.eveningIcon]}>
                <Ionicons name="moon" size={20} color={COLORS.secondary.blue} />
              </View>
              <View>
                <Text style={styles.routeTitle}>퇴근</Text>
                <Text style={styles.routeTime}>
                  {formatTime(eveningRoute.departureTime)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEdit('evening')}
            >
              <Ionicons name="pencil" size={16} color={COLORS.text.tertiary} />
              <Text style={styles.editButtonText}>수정</Text>
            </TouchableOpacity>
          </View>

          <RoutePreview route={eveningRouteData} showTime={false} compact />

          <View style={styles.notificationSummary}>
            <Ionicons
              name="notifications-outline"
              size={16}
              color={COLORS.text.tertiary}
            />
            <Text style={styles.notificationText}>
              {countActiveNotifications(eveningRoute.notifications)}개 알림 활성화
            </Text>
          </View>
        </View>

        {/* Feature Info */}
        <View style={styles.featureSection}>
          <Text style={styles.featureTitle}>이런 기능을 이용할 수 있어요</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons
                name="time-outline"
                size={20}
                color={COLORS.primary.main}
              />
              <Text style={styles.featureText}>
                출발 시간에 맞춘 실시간 도착 정보
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={COLORS.secondary.blue}
              />
              <Text style={styles.featureText}>
                환승역/도착역 미리 알림
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={COLORS.semantic.error}
              />
              <Text style={styles.featureText}>
                연착 및 사고 발생 시 즉시 알림
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.completeButton, saving && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.completeButtonText}>시작하기</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING['2xl'],
    paddingBottom: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  routeSection: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  morningIcon: {
    backgroundColor: COLORS.secondary.yellowLight,
  },
  eveningIcon: {
    backgroundColor: COLORS.secondary.blueLight,
  },
  routeTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  routeTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
  },
  editButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  notificationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  notificationText: {
    marginLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  featureSection: {
    backgroundColor: COLORS.surface.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  featureList: {
    gap: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  bottomContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.base,
    gap: SPACING.sm,
  },
  completeButtonDisabled: {
    backgroundColor: COLORS.gray[400],
  },
  completeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});

export default CommuteCompleteScreen;
