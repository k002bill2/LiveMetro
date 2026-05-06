/**
 * Station Navigator Screen — Modern Design.
 *
 * Phase 52 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens. Strong-contrast emphasis (current
 * station card / active direction / current chip) maps to
 * `semantic.labelStrong` so the inversion works in both light and dark
 * modes. Inverse text on those surfaces uses `semantic.bgBase`.
 */

import React, { useCallback, useState, useMemo } from 'react';
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
import {
  Minus,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Flag,
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';
import { useStationNavigation } from '../../hooks/useStationNavigation';
import { useRealtimeTrains } from '../../hooks/useRealtimeTrains';
import { TrainArrivalList } from '../../components/train/TrainArrivalList';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '../../styles/modernTheme';
import { useTheme } from '../../services/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'StationNavigator'>;

export const StationNavigatorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { stationId, lineId, mode } = route.params;
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // 방향 선택 상태 (출발 모드에서 사용)
  const [selectedDirection, setSelectedDirection] = useState<'up' | 'down'>('down');

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
    refresh,
  } = useStationNavigation({
    initialStationId: stationId,
    lineId,
  });

  // Pause polling when this screen is unfocused so a stack-mounted screen
  // doesn't keep hitting Seoul API behind another screen.
  const isFocused = useIsFocused();
  const {
    loading: trainsLoading,
    refetch: refreshTrains,
  } = useRealtimeTrains(currentStation?.name || '', {
    enabled: !!currentStation && isFocused,
  });

  // 선택된 방향으로 앞으로 지나갈 역들 계산 (최대 4정거장)
  const MAX_UPCOMING_STATIONS = 4;

  const upcomingStations = useMemo(() => {
    if (!allStations || allStations.length === 0 || currentIndex < 0) {
      return [];
    }

    if (selectedDirection === 'up') {
      return allStations.slice(0, currentIndex).reverse().slice(0, MAX_UPCOMING_STATIONS);
    } else {
      return allStations.slice(currentIndex + 1, currentIndex + 1 + MAX_UPCOMING_STATIONS);
    }
  }, [allStations, currentIndex, selectedDirection]);

  const totalRemainingStations = useMemo(() => {
    if (!allStations || allStations.length === 0 || currentIndex < 0) {
      return 0;
    }
    if (selectedDirection === 'up') {
      return currentIndex;
    } else {
      return allStations.length - currentIndex - 1;
    }
  }, [allStations, currentIndex, selectedDirection]);

  const terminalStation = useMemo(() => {
    if (selectedDirection === 'up') {
      return allStations[0];
    } else {
      return allStations[allStations.length - 1];
    }
  }, [allStations, selectedDirection]);

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
          <Minus size={20} color={semantic.lineNormal} />
          <Text style={styles.emptyText}>
            {type === 'previous' ? '첫 번째 역' : '마지막 역'}
          </Text>
        </View>
      );
    }

    const isCurrent = type === 'current';

    const handlePress = isCurrent
      ? handleStationDetail
      : type === 'previous'
      ? goToPrevious
      : type === 'next'
      ? goToNext
      : undefined;

    return (
      <TouchableOpacity
        style={[
          styles.stationCard,
          isCurrent && styles.currentStationCard,
        ]}
        onPress={handlePress}
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
              <Text style={[styles.stationNameEn, isCurrent && styles.currentStationNameEn]}>
                {station.nameEn}
              </Text>
            )}
            {station.transfers && station.transfers.length > 0 && (
              <View style={[styles.transferBadge, isCurrent && styles.currentTransferBadge]}>
                <Text style={[styles.transferText, isCurrent && styles.currentTransferText]}>
                  환승
                </Text>
              </View>
            )}
          </View>
          {isCurrent && (
            <ChevronRight size={20} color={semantic.bgBase} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={WANTED_TOKENS.blue[500]} />
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
            <AlertCircle size={48} color={semantic.labelAlt} />
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
          <ArrowLeft size={24} color={semantic.labelStrong} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Line {currentStation.lineId}</Text>
          <Text style={styles.headerSubtitle}>
            {currentIndex + 1} of {allStations.length}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
          <RefreshCw size={24} color={semantic.labelStrong} />
        </TouchableOpacity>
      </View>

      {/* 출발 모드: 방향 선택 UI */}
      {mode === 'departure' && (
        <View style={styles.directionSelector}>
          <TouchableOpacity
            style={[
              styles.directionButton,
              selectedDirection === 'up' && styles.directionButtonActive,
            ]}
            onPress={() => setSelectedDirection('up')}
          >
            <ArrowUp
              size={16}
              color={selectedDirection === 'up' ? semantic.bgBase : semantic.labelStrong}
            />
            <Text
              style={[
                styles.directionButtonText,
                selectedDirection === 'up' && styles.directionButtonTextActive,
              ]}
            >
              상행 ({allStations[0]?.name || '종착'} 방면)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.directionButton,
              selectedDirection === 'down' && styles.directionButtonActive,
            ]}
            onPress={() => setSelectedDirection('down')}
          >
            <ArrowDown
              size={16}
              color={selectedDirection === 'down' ? semantic.bgBase : semantic.labelStrong}
            />
            <Text
              style={[
                styles.directionButtonText,
                selectedDirection === 'down' && styles.directionButtonTextActive,
              ]}
            >
              하행 ({allStations[allStations.length - 1]?.name || '종착'} 방면)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading || trainsLoading}
            onRefresh={handleRefresh}
            tintColor={semantic.labelStrong}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 출발 모드 상행: 현재역 위에 표시 */}
        {mode === 'departure' && selectedDirection === 'up' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              상행 방향 (
              {totalRemainingStations > MAX_UPCOMING_STATIONS
                ? `${upcomingStations.length}/${totalRemainingStations}개 역`
                : `${upcomingStations.length}개 역`}
              )
            </Text>
            {terminalStation && (
              <View style={styles.terminalInfo}>
                <Flag size={14} color={semantic.labelNeutral} />
                <Text style={styles.terminalText}>
                  종착: {terminalStation.name}
                </Text>
              </View>
            )}
            <View style={styles.upcomingStationsList}>
              {upcomingStations.length === 0 ? (
                <Text style={styles.noStationsText}>첫 번째 역입니다</Text>
              ) : (
                upcomingStations.map((station, index) => (
                  <View key={station.id} style={styles.upcomingStationItem}>
                    <View style={styles.stationDot} />
                    {index < upcomingStations.length - 1 && <View style={styles.stationLine} />}
                    <Text style={styles.upcomingStationName}>{station.name}</Text>
                    {station.transfers && station.transfers.length > 0 && (
                      <View style={styles.transferBadgeSmall}>
                        <Text style={styles.transferTextSmall}>환승</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* 일반 모드: Previous Station */}
        {mode !== 'departure' && previousStation && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Previous</Text>
            {renderStationCard(previousStation, 'previous')}
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
            <TrainArrivalList stationId={currentStation.id} stationName={currentStation.name} />
          </View>
        </View>

        {/* 출발 모드 하행: 현재역 아래에 표시 */}
        {mode === 'departure' && selectedDirection === 'down' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              하행 방향 (
              {totalRemainingStations > MAX_UPCOMING_STATIONS
                ? `${upcomingStations.length}/${totalRemainingStations}개 역`
                : `${upcomingStations.length}개 역`}
              )
            </Text>
            {terminalStation && (
              <View style={styles.terminalInfo}>
                <Flag size={14} color={semantic.labelNeutral} />
                <Text style={styles.terminalText}>
                  종착: {terminalStation.name}
                </Text>
              </View>
            )}
            <View style={styles.upcomingStationsList}>
              {upcomingStations.length === 0 ? (
                <Text style={styles.noStationsText}>마지막 역입니다</Text>
              ) : (
                upcomingStations.map((station, index) => (
                  <View key={station.id} style={styles.upcomingStationItem}>
                    <View style={styles.stationDot} />
                    {index < upcomingStations.length - 1 && <View style={styles.stationLine} />}
                    <Text style={styles.upcomingStationName}>{station.name}</Text>
                    {station.transfers && station.transfers.length > 0 && (
                      <View style={styles.transferBadgeSmall}>
                        <Text style={styles.transferTextSmall}>환승</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* 일반 모드: Next Station */}
        {mode !== 'departure' && nextStation && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Next</Text>
            {renderStationCard(nextStation, 'next')}
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

        <View style={{ height: WANTED_TOKENS.spacing.s8 }} />
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
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
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
      letterSpacing: 0.5,
    },
    directionSelector: {
      flexDirection: 'row',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    directionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: WANTED_TOKENS.spacing.s1,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    directionButtonActive: {
      backgroundColor: semantic.labelStrong,
      borderColor: semantic.labelStrong,
    },
    directionButtonText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    directionButtonTextActive: {
      color: semantic.bgBase,
    },
    terminalInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    terminalText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    upcomingStationsList: {
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    upcomingStationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s2,
      position: 'relative',
    },
    stationDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: semantic.labelStrong,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    stationLine: {
      position: 'absolute',
      left: 4,
      top: 24,
      width: 2,
      height: 24,
      backgroundColor: semantic.lineNormal,
    },
    upcomingStationName: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
      flex: 1,
    },
    transferBadgeSmall: {
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
    },
    transferTextSmall: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    noStationsText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s4,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: WANTED_TOKENS.spacing.s4,
    },
    section: {
      marginBottom: WANTED_TOKENS.spacing.s6,
    },
    currentSection: {
      marginBottom: WANTED_TOKENS.spacing.s8,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s2,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    currentLabel: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s3,
      letterSpacing: -0.2,
    },
    stationCard: {
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    currentStationCard: {
      backgroundColor: semantic.labelStrong,
      borderColor: semantic.labelStrong,
    },
    emptyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s5,
      gap: WANTED_TOKENS.spacing.s2,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    stationCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
    },
    directionIndicator: {
      width: 24,
      height: 24,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      alignItems: 'center',
      justifyContent: 'center',
    },
    directionText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    stationInfo: {
      flex: 1,
    },
    stationName: {
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      letterSpacing: -0.3,
    },
    currentStationName: {
      fontSize: 24,
      fontFamily: weightToFontFamily('700'),
      color: semantic.bgBase,
    },
    stationNameEn: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    currentStationNameEn: {
      color: 'rgba(255,255,255,0.7)',
    },
    transferBadge: {
      alignSelf: 'flex-start',
      backgroundColor: semantic.bgBase,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    currentTransferBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    transferText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    currentTransferText: {
      color: semantic.bgBase,
    },
    arrivalsContainer: {
      marginTop: WANTED_TOKENS.spacing.s5,
    },
    arrivalsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    arrivalsTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: WANTED_TOKENS.status.green500,
    },
    stationList: {
      marginTop: WANTED_TOKENS.spacing.s6,
    },
    listTitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    stationChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
    },
    stationChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    currentChip: {
      backgroundColor: semantic.labelStrong,
      borderColor: semantic.labelStrong,
    },
    chipText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    currentChipText: {
      color: semantic.bgBase,
      fontFamily: weightToFontFamily('500'),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s4,
    },
    loadingText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s6,
    },
    errorIcon: {
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    errorTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    retryButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: WANTED_TOKENS.blue[500],
      borderRadius: WANTED_TOKENS.radius.r4,
    },
    retryButtonText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: '#FFFFFF',
    },
  });

export default StationNavigatorScreen;
