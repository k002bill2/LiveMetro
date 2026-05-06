/**
 * Commute Route Screen
 * Screen for setting departure, transfer, and arrival stations during onboarding
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  GitBranch,
  MapPin,
  Flag,
  ChevronRight,
  Search,
  ArrowLeft,
  ArrowRight
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { OnboardingStackParamList } from '@/navigation/types';
import { TransferStationList } from '@/components/commute/TransferStationList';
import { RoutePreview } from '@/components/commute/RoutePreview';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';
import {
  StationSelection,
  TransferStation,
  MAX_TRANSFER_STATIONS,
  CommuteRoute,
} from '@/models/commute';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CommuteRoute'>;

type StationSelectionType = 'departure' | 'arrival' | 'transfer';

// Default departure time — the dedicated CommuteTime step was removed in
// Chunk 5; users adjust this later from the SettingsCommute screen.
const DEFAULT_DEPARTURE_TIME = '08:00';

export const CommuteRouteScreen: React.FC<Props> = ({ navigation, route }) => {
  const departureTime = DEFAULT_DEPARTURE_TIME;
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const { onSkip } = useOnboardingCallbacks();

  // Station states
  const [departureStation, setDepartureStation] = useState<StationSelection | null>(null);
  const [arrivalStation, setArrivalStation] = useState<StationSelection | null>(null);
  const [transferStations, setTransferStations] = useState<TransferStation[]>([]);

  // Phase 52: consume picker return param. The picker writes back via
  // `navigation.navigate('CommuteRoute', { pickedStation }, { merge: true })`;
  // we apply once then clear the param so back-navigation doesn't replay it.
  useEffect(() => {
    const picked = route.params?.pickedStation;
    if (!picked) return;
    const { selectionType: pickedType, station } = picked;
    if (pickedType === 'departure') {
      setDepartureStation(station);
    } else if (pickedType === 'arrival') {
      setArrivalStation(station);
    } else if (pickedType === 'transfer') {
      if (transferStations.length < MAX_TRANSFER_STATIONS) {
        setTransferStations((prev) => [
          ...prev,
          {
            stationId: station.stationId,
            stationName: station.stationName,
            lineId: station.lineId,
            lineName: station.lineName,
            order: prev.length,
          },
        ]);
      }
    }
    navigation.setParams({ pickedStation: undefined });
  }, [route.params?.pickedStation, transferStations.length, navigation]);

  // Morning/evening branching is retained as a no-op until Chunk 5 simplifies
  // the OnboardingStackParamList to single-route. The onboarding flow is now
  // single-route per chat3 redefinition; the existing param shape is bridged
  // until then.
  // (commuteType + departureTime are still in route.params but unused for
  // copy decisions — single-label "출퇴근 경로 설정" is shown.)

  // Get excluded station IDs (can't select same station twice)
  const getExcludedStationIds = useCallback((): string[] => {
    const ids: string[] = [];
    if (departureStation) ids.push(departureStation.stationId);
    if (arrivalStation) ids.push(arrivalStation.stationId);
    transferStations.forEach((t) => ids.push(t.stationId));
    return ids;
  }, [departureStation, arrivalStation, transferStations]);

  // Phase 52: drill into the dedicated picker screen for station selection.
  // The picker returns its choice via `pickedStation` route param (see
  // useEffect above) — no callback prop needed.
  const openStationPicker = useCallback(
    (type: StationSelectionType) => {
      const currentName =
        type === 'departure'
          ? departureStation?.stationName
          : type === 'arrival'
            ? arrivalStation?.stationName
            : undefined;
      navigation.navigate('OnboardingStationPicker', {
        selectionType: type,
        excludeStationIds: getExcludedStationIds(),
        currentName,
      });
    },
    [navigation, departureStation, arrivalStation, getExcludedStationIds],
  );

  // Remove transfer station
  const handleRemoveTransfer = useCallback((index: number) => {
    setTransferStations((prev) =>
      prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i }))
    );
  }, []);

  // Build current route for preview
  const currentRoute: Partial<CommuteRoute> = {
    departureTime,
    departureStationId: departureStation?.stationId,
    departureStationName: departureStation?.stationName,
    departureLineId: departureStation?.lineId,
    transferStations,
    arrivalStationId: arrivalStation?.stationId,
    arrivalStationName: arrivalStation?.stationName,
    arrivalLineId: arrivalStation?.lineId,
  };

  // Validation
  const isValid = departureStation && arrivalStation;

  // Handle next — single-route flow forwards to NotificationPermission with
  // a packaged OnboardingRouteData. departureTime carries forward from the
  // bridge param shape (Chunk 5 will drop it from ParamList entirely).
  const handleNext = () => {
    if (!isValid || !departureStation || !arrivalStation) return;

    navigation.navigate('NotificationPermission', {
      route: {
        departureTime,
        departureStation,
        arrivalStation,
        transferStations,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnbHeader
        currentStep={2}
        onBack={() => navigation.canGoBack() && navigation.goBack()}
        onSkip={onSkip}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <GitBranch
              size={48}
              color={semantic.primaryNormal}
            />
          </View>
          <Text style={styles.title}>출퇴근 경로 설정</Text>
          <Text style={styles.subtitle}>
            출발역과 도착역을 알려주세요
          </Text>
        </View>

        {/* Station Selection */}
        <View style={styles.stationSection}>
          {/* Departure Station */}
          <View style={styles.stationGroup}>
            <Text style={styles.stationLabel}>승차역</Text>
            <TouchableOpacity
              style={[
                styles.stationButton,
                departureStation && styles.stationButtonSelected,
              ]}
              onPress={() => openStationPicker('departure')}
            >
              {departureStation ? (
                <View style={styles.selectedStation}>
                  <View style={styles.stationIconContainer}>
                    <MapPin
                      size={20}
                      color={semantic.primaryNormal}
                    />
                  </View>
                  <View style={styles.stationInfo}>
                    <Text style={styles.stationName}>
                      {departureStation.stationName}
                    </Text>
                    <Text style={styles.stationLine}>
                      {departureStation.lineName}
                    </Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={semantic.labelAlt}
                  />
                </View>
              ) : (
                <View style={styles.placeholderContent}>
                  <Search
                    size={20}
                    color={semantic.labelAlt}
                  />
                  <Text style={styles.placeholderText}>승차역을 검색하세요</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Transfer Stations */}
          <View style={styles.transferSection}>
            <TransferStationList
              transfers={transferStations}
              onAddTransfer={() => openStationPicker('transfer')}
              onRemoveTransfer={handleRemoveTransfer}
              maxTransfers={MAX_TRANSFER_STATIONS}
            />
          </View>

          {/* Arrival Station */}
          <View style={styles.stationGroup}>
            <Text style={styles.stationLabel}>도착역</Text>
            <TouchableOpacity
              style={[
                styles.stationButton,
                arrivalStation && styles.stationButtonSelected,
              ]}
              onPress={() => openStationPicker('arrival')}
            >
              {arrivalStation ? (
                <View style={styles.selectedStation}>
                  <View
                    style={[
                      styles.stationIconContainer,
                      styles.arrivalIconContainer,
                    ]}
                  >
                    <Flag
                      size={20}
                      color={semantic.statusNegative}
                    />
                  </View>
                  <View style={styles.stationInfo}>
                    <Text style={styles.stationName}>
                      {arrivalStation.stationName}
                    </Text>
                    <Text style={styles.stationLine}>
                      {arrivalStation.lineName}
                    </Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={semantic.labelAlt}
                  />
                </View>
              ) : (
                <View style={styles.placeholderContent}>
                  <Search
                    size={20}
                    color={semantic.labelAlt}
                  />
                  <Text style={styles.placeholderText}>도착역을 검색하세요</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Preview */}
        {(departureStation || arrivalStation) && (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>경로 미리보기</Text>
            <RoutePreview route={currentRoute} showTime={true} />
          </View>
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color={semantic.labelNeutral} />
          <Text style={styles.backButtonText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !isValid && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!isValid}
        >
          <Text
            style={[
              styles.nextButtonText,
              !isValid && styles.nextButtonTextDisabled,
            ]}
          >
            다음
          </Text>
          <ArrowRight
            size={20}
            color={isValid ? COLORS.white : COLORS.gray[400]}
          />
        </TouchableOpacity>
      </View>

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
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: semantic.bgSubtlePage,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontSize: TYPOGRAPHY.fontSize['3xl'],
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: semantic.labelStrong,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      fontSize: TYPOGRAPHY.fontSize.base,
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    stationSection: {
      marginBottom: SPACING.xl,
    },
    stationGroup: {
      marginBottom: SPACING.lg,
    },
    stationLabel: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: semantic.labelNeutral,
      marginBottom: SPACING.sm,
      marginLeft: SPACING.xs,
    },
    stationButton: {
      backgroundColor: semantic.bgBase,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    stationButtonSelected: {
      borderColor: semantic.primaryNormal,
      backgroundColor: semantic.primaryBg,
    },
    selectedStation: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stationIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: semantic.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    arrivalIconContainer: {
      backgroundColor: COLORS.secondary.redLight,
    },
    stationInfo: {
      flex: 1,
    },
    stationName: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: semantic.labelStrong,
    },
    stationLine: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: semantic.labelAlt,
      marginTop: 2,
    },
    placeholderContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    placeholderText: {
      marginLeft: SPACING.sm,
      fontSize: TYPOGRAPHY.fontSize.base,
      color: semantic.labelAlt,
    },
    transferSection: {
      marginBottom: SPACING.lg,
    },
    previewSection: {
      marginTop: SPACING.md,
    },
    previewLabel: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: semantic.labelNeutral,
      marginBottom: SPACING.sm,
      marginLeft: SPACING.xs,
    },
    bottomContainer: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.lg,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      gap: SPACING.md,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.base,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      gap: SPACING.xs,
    },
    backButtonText: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: semantic.labelNeutral,
    },
    nextButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.primaryNormal,
      paddingVertical: SPACING.lg,
      borderRadius: RADIUS.base,
      gap: SPACING.sm,
    },
    nextButtonDisabled: {
      backgroundColor: 'rgba(112,115,124,0.14)',
    },
    nextButtonText: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: semantic.labelOnColor,
    },
    nextButtonTextDisabled: {
      color: semantic.labelDisabled,
    },
  });

export default CommuteRouteScreen;
