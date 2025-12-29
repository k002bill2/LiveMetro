/**
 * Station Navigator Screen - Modern Design
 * Minimal grayscale design with black accent
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';
import { useStationNavigation } from '../../hooks/useStationNavigation';
import { useRealtimeTrains } from '../../hooks/useRealtimeTrains';
import { TrainArrivalList } from '../../components/train/TrainArrivalList';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';

type Props = NativeStackScreenProps<AppStackParamList, 'StationNavigator'>;

export const StationNavigatorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { stationId, lineId } = route.params;

  const {
    currentStation,
    previousStation,
    nextStation,
    currentIndex,
    allStations,
    loading,
    error,
    goToPrevious,
    goToNext,
    canGoPrevious,
    canGoNext,
    refresh,
  } = useStationNavigation({
    initialStationId: stationId,
    lineId,
  });

  const {
    loading: trainsLoading,
    refetch: refreshTrains,
  } = useRealtimeTrains(currentStation?.name || '', {
    enabled: !!currentStation,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshTrains()]);
  }, [refresh, refreshTrains]);

  const handleStationDetail = useCallback(() => {
    if (!currentStation) return;

    navigation.navigate('StationDetail', {
      stationId: currentStation.id,
      stationName: currentStation.name,
      lineId: currentStation.lineId,
    });
  }, [currentStation, navigation]);

  const renderStationCard = (
    station: typeof currentStation,
    type: 'previous' | 'current' | 'next'
  ) => {
    if (!station) {
      return (
        <View style={[styles.stationCard, styles.emptyCard]}>
          <Ionicons
            name={type === 'previous' ? 'remove-outline' : 'remove-outline'}
            size={20}
            color={COLORS.gray[300]}
          />
          <Text style={styles.emptyText}>
            {type === 'previous' ? '첫 번째 역' : '마지막 역'}
          </Text>
        </View>
      );
    }

    const isCurrent = type === 'current';

    return (
      <TouchableOpacity
        style={[
          styles.stationCard,
          isCurrent && styles.currentStationCard,
        ]}
        onPress={isCurrent ? handleStationDetail : undefined}
        disabled={!isCurrent}
        activeOpacity={0.6}
      >
        <View style={styles.stationCardContent}>
          {type !== 'current' && (
            <View style={styles.directionIndicator}>
              <Text style={styles.directionText}>
                {type === 'previous' ? '↑' : '↓'}
              </Text>
            </View>
          )}
          <View style={styles.stationInfo}>
            <Text style={[styles.stationName, isCurrent && styles.currentStationName]}>
              {station.name}
            </Text>
            {station.nameEn && (
              <Text style={styles.stationNameEn}>{station.nameEn}</Text>
            )}
            {station.transfers && station.transfers.length > 0 && (
              <View style={styles.transferBadge}>
                <Text style={styles.transferText}>환승</Text>
              </View>
            )}
          </View>
          {isCurrent && (
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>역 정보 로딩중</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !currentStation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray[400]} />
          </View>
          <Text style={styles.errorTitle}>{error || '역 정보를 찾을 수 없습니다'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Line {currentStation.lineId}</Text>
          <Text style={styles.headerSubtitle}>
            {currentIndex + 1} of {allStations.length}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
          <Ionicons name="refresh" size={24} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading || trainsLoading}
            onRefresh={handleRefresh}
            tintColor={COLORS.black}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Previous Station */}
        {previousStation && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Previous</Text>
            {renderStationCard(previousStation, 'previous')}
            {canGoPrevious && (
              <TouchableOpacity style={styles.navButton} onPress={goToPrevious}>
                <Ionicons name="chevron-up" size={16} color={COLORS.black} />
                <Text style={styles.navButtonText}>이전 역</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Current Station */}
        <View style={[styles.section, styles.currentSection]}>
          <Text style={styles.currentLabel}>Current Station</Text>
          {renderStationCard(currentStation, 'current')}

          {/* Train Arrivals */}
          <View style={styles.arrivalsContainer}>
            <View style={styles.arrivalsHeader}>
              <Text style={styles.arrivalsTitle}>실시간 도착</Text>
              <View style={styles.liveDot} />
            </View>
            <TrainArrivalList stationId={currentStation.id} />
          </View>
        </View>

        {/* Next Station */}
        {nextStation && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Next</Text>
            {renderStationCard(nextStation, 'next')}
            {canGoNext && (
              <TouchableOpacity style={styles.navButton} onPress={goToNext}>
                <Text style={styles.navButtonText}>다음 역</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.black} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Station List */}
        <View style={styles.stationList}>
          <Text style={styles.listTitle}>전체 경로</Text>
          <View style={styles.stationChips}>
            {allStations.map((station, index) => (
              <View
                key={station.id}
                style={[
                  styles.stationChip,
                  index === currentIndex && styles.currentChip,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    index === currentIndex && styles.currentChipText,
                  ]}
                >
                  {station.name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: SPACING['3xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    marginTop: 2,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING['2xl'],
  },
  currentSection: {
    marginBottom: SPACING['3xl'],
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.tertiary,
    marginBottom: SPACING.sm,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  currentLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  stationCard: {
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  currentStationCard: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  stationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  directionIndicator: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  currentStationName: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    color: COLORS.white,
  },
  stationNameEn: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    marginTop: 2,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  transferBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  transferText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  navButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  arrivalsContainer: {
    marginTop: SPACING.xl,
  },
  arrivalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  arrivalsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.black,
  },
  stationList: {
    marginTop: SPACING['2xl'],
  },
  listTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  stationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  stationChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  currentChip: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  currentChipText: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
  },
  errorIcon: {
    marginBottom: SPACING.lg,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  retryButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.base,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});

export default StationNavigatorScreen;
