/**
 * Commute Route Screen
 * Screen for setting departure, transfer, and arrival stations during onboarding
 */

import React, { useState, useCallback } from 'react';
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
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/styles/modernTheme';
import { OnboardingStackParamList } from '@/navigation/types';
import { StationSearchModal } from '@/components/commute/StationSearchModal';
import { TransferStationList } from '@/components/commute/TransferStationList';
import { RoutePreview } from '@/components/commute/RoutePreview';
import {
  StationSelection,
  TransferStation,
  MAX_TRANSFER_STATIONS,
  CommuteRoute,
} from '@/models/commute';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CommuteRoute'>;

type StationSelectionType = 'departure' | 'arrival' | 'transfer';

export const CommuteRouteScreen: React.FC<Props> = ({ navigation, route }) => {
  const { commuteType, departureTime } = route.params;

  // Station states
  const [departureStation, setDepartureStation] = useState<StationSelection | null>(null);
  const [arrivalStation, setArrivalStation] = useState<StationSelection | null>(null);
  const [transferStations, setTransferStations] = useState<TransferStation[]>([]);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectionType, setSelectionType] = useState<StationSelectionType>('departure');

  const isMorning = commuteType === 'morning';

  // Get excluded station IDs (can't select same station twice)
  const getExcludedStationIds = useCallback((): string[] => {
    const ids: string[] = [];
    if (departureStation) ids.push(departureStation.stationId);
    if (arrivalStation) ids.push(arrivalStation.stationId);
    transferStations.forEach((t) => ids.push(t.stationId));
    return ids;
  }, [departureStation, arrivalStation, transferStations]);

  // Open modal for station selection
  const openStationModal = useCallback((type: StationSelectionType) => {
    setSelectionType(type);
    setModalVisible(true);
  }, []);

  // Handle station selection from modal
  const handleStationSelect = useCallback(
    (station: StationSelection) => {
      switch (selectionType) {
        case 'departure':
          setDepartureStation(station);
          break;
        case 'arrival':
          setArrivalStation(station);
          break;
        case 'transfer':
          if (transferStations.length < MAX_TRANSFER_STATIONS) {
            const newTransfer: TransferStation = {
              stationId: station.stationId,
              stationName: station.stationName,
              lineId: station.lineId,
              lineName: station.lineName,
              order: transferStations.length,
            };
            setTransferStations((prev) => [...prev, newTransfer]);
          }
          break;
      }
    },
    [selectionType, transferStations.length]
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

  // Handle next
  const handleNext = () => {
    if (!isValid || !departureStation || !arrivalStation) return;

    navigation.navigate('CommuteNotification', {
      commuteType,
      departureTime,
      departureStation,
      arrivalStation,
      transferStations,
      morningRoute: route.params.morningRoute,
    });
  };

  // Get modal title based on selection type
  const getModalTitle = (): string => {
    switch (selectionType) {
      case 'departure':
        return '승차역 선택';
      case 'arrival':
        return '도착역 선택';
      case 'transfer':
        return '환승역 선택';
    }
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
            <GitBranch
              size={48}
              color={COLORS.primary.main}
            />
          </View>
          <Text style={styles.title}>
            {isMorning ? '출근 경로 설정' : '퇴근 경로 설정'}
          </Text>
          <Text style={styles.subtitle}>
            {isMorning
              ? '출근할 때 이용하는 경로를 알려주세요'
              : '퇴근할 때 이용하는 경로를 알려주세요'}
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
              onPress={() => openStationModal('departure')}
            >
              {departureStation ? (
                <View style={styles.selectedStation}>
                  <View style={styles.stationIconContainer}>
                    <MapPin
                      size={20}
                      color={COLORS.primary.main}
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
                    color={COLORS.gray[400]}
                  />
                </View>
              ) : (
                <View style={styles.placeholderContent}>
                  <Search
                    size={20}
                    color={COLORS.gray[400]}
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
              onAddTransfer={() => openStationModal('transfer')}
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
              onPress={() => openStationModal('arrival')}
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
                      color={COLORS.semantic.error}
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
                    color={COLORS.gray[400]}
                  />
                </View>
              ) : (
                <View style={styles.placeholderContent}>
                  <Search
                    size={20}
                    color={COLORS.gray[400]}
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
          <ArrowLeft size={20} color={COLORS.text.secondary} />
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

      {/* Station Search Modal */}
      <StationSearchModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelect={handleStationSelect}
        title={getModalTitle()}
        excludeStationIds={getExcludedStationIds()}
      />
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  stationButton: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  stationButtonSelected: {
    borderColor: COLORS.primary.main,
    backgroundColor: COLORS.primary.light,
  },
  selectedStation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary.light,
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
    color: COLORS.text.primary,
  },
  stationLine: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  placeholderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderText: {
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.gray[400],
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
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  bottomContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
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
    borderColor: COLORS.border.medium,
    gap: SPACING.xs,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.base,
    gap: SPACING.sm,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.gray[200],
  },
  nextButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
  nextButtonTextDisabled: {
    color: COLORS.gray[400],
  },
});

export default CommuteRouteScreen;
