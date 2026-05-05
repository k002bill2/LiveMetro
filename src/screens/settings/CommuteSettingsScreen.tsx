/**
 * Commute Settings Screen
 * Allows users to view and configure commute routes.
 *
 * Phase 46 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens. RouteWithTransfer atom (chunk 6/6
 * commit 1dd3af1) and ChevronRight icon already follow Wanted tokens.
 */

import React, { useState, useCallback, useMemo } from 'react';
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
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  ChevronRight,
  Moon,
  PlusCircle,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { SettingsStackParamList } from '@/navigation/types';
import { useAuth } from '@/services/auth/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import { CommuteRoute, TransferStation } from '@/models/commute';
import {
  RouteWithTransfer,
  TransferOption,
} from '@/components/commute/RouteWithTransfer';

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
  transferStations: {
    stationId: string;
    stationName: string;
    lineId: string;
  }[];
}

// Static recommended transfer alternatives for the 출근 / 퇴근 cards.
// chat3 design hand-off referenced 합정(직행, 추천) / 신도림 / 사당 / 교대.
// Replacing this with `useAlternativeRoutes` lookup is a follow-up phase.
const STATIC_TRANSFER_ALTERNATIVES: readonly TransferOption[] = [
  {
    id: 'direct',
    transfer: null,
    etaMinutes: 28,
    reason: '환승 없음, 가장 빠름',
    recommended: true,
  },
  {
    id: 'sindorim',
    transfer: { stationId: 'stn-sindorim', stationName: '신도림', lineId: '2', lineName: '2호선', order: 0 },
    etaMinutes: 33,
    reason: '1·2호선 환승',
  },
  {
    id: 'sadang',
    transfer: { stationId: 'stn-sadang', stationName: '사당', lineId: '4', lineName: '4호선', order: 0 },
    etaMinutes: 35,
    reason: '2·4호선 환승',
  },
  {
    id: 'gyodae',
    transfer: { stationId: 'stn-gyodae', stationName: '교대', lineId: '3', lineName: '3호선', order: 0 },
    etaMinutes: 32,
    reason: '2·3호선 환승',
  },
];

export const CommuteSettingsScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const { user } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [morningRoute, setMorningRoute] = useState<CommuteRouteData | null>(null);
  const [eveningRoute, setEveningRoute] = useState<CommuteRouteData | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-route transfer editing state. The "out" suffix maps to the 출근 card,
  // "in" to the 퇴근 card, mirroring chat3 nomenclature.
  const [outTransfer, setOutTransfer] = useState<TransferStation | null>(null);
  const [inTransfer, setInTransfer] = useState<TransferStation | null>(null);
  const [outExpanded, setOutExpanded] = useState(false);
  const [inExpanded, setInExpanded] = useState(false);

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
        // Initialize the transfer-edit state from the first transfer station
        // of the loaded route. Multi-transfer routes show only the first
        // transfer in this UI; full multi-transfer editing is out of scope
        // for the Topic 2 surgical addition.
        const morningFirst = settings.morningRoute?.transferStations?.[0];
        const eveningFirst = settings.eveningRoute?.transferStations?.[0];
        setOutTransfer(morningFirst ? { ...morningFirst } : null);
        setInTransfer(eveningFirst ? { ...eveningFirst } : null);
        console.log('Commute settings loaded from Firebase');
      } else {
        console.log('No commute settings found in Firebase');
        setMorningRoute(null);
        setEveningRoute(null);
        setOutTransfer(null);
        setInTransfer(null);
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
    icon: LucideIcon;
    route: CommuteRouteData | null;
    onEdit: () => void;
    transfer: TransferStation | null;
    onTransferChange: (next: TransferStation | null) => void;
    expanded: boolean;
    onToggleExpanded: () => void;
  }> = ({ title, icon: IconComponent, route, onEdit, transfer, onTransferChange, expanded, onToggleExpanded }) => (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <View style={styles.routeIconContainer}>
          <IconComponent size={24} color={semantic.labelStrong} strokeWidth={2} />
        </View>
        <Text style={styles.routeTitle}>{title}</Text>
      </View>

      {route ? (
        <View style={styles.routeContent}>
          <View style={styles.routeRow}>
            <Text style={styles.routeLabel}>출발 시간</Text>
            <Text style={styles.routeValue}>{route.departureTime}</Text>
          </View>
          {/* Editable origin → transfer → destination diagram (Topic 2). */}
          <RouteWithTransfer
            origin={route.departureStation}
            destination={route.arrivalStation}
            transfer={transfer}
            alternatives={STATIC_TRANSFER_ALTERNATIVES}
            onTransferChange={(next) => {
              onTransferChange(next);
              onToggleExpanded();
            }}
            expanded={expanded}
            onToggleExpanded={onToggleExpanded}
          />
        </View>
      ) : (
        <View style={styles.emptyContent}>
          <PlusCircle size={48} color={semantic.lineNormal} strokeWidth={1.5} />
          <Text style={styles.emptyText}>설정된 경로가 없습니다</Text>
        </View>
      )}

      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>
          {route ? '수정하기' : '설정하기'}
        </Text>
        <ChevronRight size={16} color={WANTED_TOKENS.blue[500]} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={WANTED_TOKENS.blue[500]} />
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
          icon={Sun}
          route={morningRoute}
          onEdit={handleSetupCommute}
          transfer={outTransfer}
          onTransferChange={setOutTransfer}
          expanded={outExpanded}
          onToggleExpanded={() => setOutExpanded((v) => !v)}
        />

        <RouteCard
          title="퇴근"
          icon={Moon}
          route={eveningRoute}
          onEdit={handleSetupCommute}
          transfer={inTransfer}
          onTransferChange={setInTransfer}
          expanded={inExpanded}
          onToggleExpanded={() => setInExpanded((v) => !v)}
        />

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Bell size={20} color={semantic.labelNeutral} strokeWidth={2} />
            <Text style={styles.infoText}>출발 시간에 맞춰 실시간 도착 정보 알림</Text>
          </View>
          <View style={styles.infoItem}>
            <ArrowRightLeft size={20} color={semantic.labelNeutral} strokeWidth={2} />
            <Text style={styles.infoText}>환승역 도착 전 미리 알림</Text>
          </View>
          <View style={styles.infoItem}>
            <AlertTriangle size={20} color={semantic.labelNeutral} strokeWidth={2} />
            <Text style={styles.infoText}>지연/사고 발생 시 즉시 알림</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    content: {
      flex: 1,
      padding: WANTED_TOKENS.spacing.s4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    header: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s1,
    },
    headerSubtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    routeCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      marginBottom: WANTED_TOKENS.spacing.s4,
      overflow: 'hidden',
    },
    routeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
      backgroundColor: semantic.bgSubtle,
    },
    routeIconContainer: {
      width: 40,
      height: 40,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    routeTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    routeContent: {
      padding: WANTED_TOKENS.spacing.s4,
    },
    routeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    routeLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    routeValue: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    emptyContent: {
      padding: WANTED_TOKENS.spacing.s5,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      backgroundColor: semantic.bgSubtle,
    },
    editButtonText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: WANTED_TOKENS.blue[500],
      marginRight: WANTED_TOKENS.spacing.s1,
    },
    infoSection: {
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    infoText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      marginLeft: WANTED_TOKENS.spacing.s2,
      flex: 1,
    },
  });

export default CommuteSettingsScreen;
