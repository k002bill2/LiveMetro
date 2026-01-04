/**
 * Commute Settings Screen
 * Allows users to view and configure commute routes
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { SettingsStackParamList } from '@/navigation/types';
import { useAuth } from '@/services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import { CommuteRoute } from '@/models/commute';

type Props = NativeStackScreenProps<SettingsStackParamList, 'CommuteSettings'>;

interface CommuteRouteData {
  departureTime: string;
  departureStation: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  arrivalStation: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  transferStations: Array<{
    stationId: string;
    stationName: string;
    lineId: string;
  }>;
}

export const CommuteSettingsScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const { user } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const [morningRoute, setMorningRoute] = useState<CommuteRouteData | null>(null);
  const [eveningRoute, setEveningRoute] = useState<CommuteRouteData | null>(null);
  const [loading, setLoading] = useState(true);

  // Convert Firebase CommuteRoute to local CommuteRouteData format
  const convertToRouteData = (route: CommuteRoute | null): CommuteRouteData | null => {
    if (!route) return null;
    return {
      departureTime: route.departureTime,
      departureStation: {
        stationId: route.departureStationId,
        stationName: route.departureStationName,
        lineId: route.departureLineId,
      },
      arrivalStation: {
        stationId: route.arrivalStationId,
        stationName: route.arrivalStationName,
        lineId: route.arrivalLineId,
      },
      transferStations: (route.transferStations || []).map(t => ({
        stationId: t.stationId,
        stationName: t.stationName,
        lineId: t.lineId,
      })),
    };
  };

  // Load commute settings from Firebase
  const loadSettings = useCallback(async (): Promise<void> => {
    const uid = user?.id;
    if (!uid) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const settings = await loadCommuteRoutes(uid);

      if (settings) {
        setMorningRoute(convertToRouteData(settings.morningRoute));
        setEveningRoute(convertToRouteData(settings.eveningRoute));
        console.log('Commute settings loaded from Firebase');
      } else {
        console.log('No commute settings found in Firebase');
        setMorningRoute(null);
        setEveningRoute(null);
      }
    } catch (error) {
      console.error('Error loading commute settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load on mount and when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleSetupCommute = (): void => {
    Alert.alert(
      '출퇴근 설정',
      '출퇴근 경로를 설정하시겠습니까?\n온보딩 화면으로 이동합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '설정하기',
          onPress: async () => {
            // Reset onboarding status to trigger onboarding flow
            await resetOnboarding();
          },
        },
      ],
    );
  };

  const RouteCard: React.FC<{
    title: string;
    icon: string;
    route: CommuteRouteData | null;
    onEdit: () => void;
  }> = ({ title, icon, route, onEdit }) => (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <View style={styles.routeIconContainer}>
          <Ionicons name={icon as any} size={24} color={COLORS.black} />
        </View>
        <Text style={styles.routeTitle}>{title}</Text>
      </View>

      {route ? (
        <View style={styles.routeContent}>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>출발 시간</Text>
            <Text style={styles.routeValue}>{route.departureTime}</Text>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>출발역</Text>
            <Text style={styles.routeValue}>{route.departureStation.stationName}역</Text>
          </View>
          {route.transferStations.length > 0 && (
            <View style={styles.routeRow}>
              <Text style={styles.routeLabel}>환승역</Text>
              <Text style={styles.routeValue}>
                {route.transferStations.map(s => s.stationName).join(' → ')}역
              </Text>
            </View>
          )}
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>도착역</Text>
            <Text style={styles.routeValue}>{route.arrivalStation.stationName}역</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContent}>
          <Ionicons name="add-circle-outline" size={48} color={COLORS.gray[300]} />
          <Text style={styles.emptyText}>설정된 경로가 없습니다</Text>
        </View>
      )}

      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>
          {route ? '수정하기' : '설정하기'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.black} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>출퇴근 설정을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>출퇴근 설정</Text>
          <Text style={styles.headerSubtitle}>
            출퇴근 경로를 설정하면 맞춤 알림을 받을 수 있습니다
          </Text>
        </View>

        <RouteCard
          title="출근"
          icon="sunny-outline"
          route={morningRoute}
          onEdit={handleSetupCommute}
        />

        <RouteCard
          title="퇴근"
          icon="moon-outline"
          route={eveningRoute}
          onEdit={handleSetupCommute}
        />

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.text.secondary} />
            <Text style={styles.infoText}>출발 시간에 맞춰 실시간 도착 정보 알림</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="swap-horizontal-outline" size={20} color={COLORS.text.secondary} />
            <Text style={styles.infoText}>환승역 도착 전 미리 알림</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="warning-outline" size={20} color={COLORS.text.secondary} />
            <Text style={styles.infoText}>지연/사고 발생 시 즉시 알림</Text>
          </View>
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
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  routeCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.surface.card,
  },
  routeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  routeTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  routeContent: {
    padding: SPACING.lg,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  routeLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  routeValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  emptyContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    backgroundColor: COLORS.surface.card,
  },
  editButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.black,
    marginRight: SPACING.xs,
  },
  infoSection: {
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
});

export default CommuteSettingsScreen;
