/**
 * Subway Map Screen Component
 * Interactive Seoul subway line map with station selection
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import {
  ArrowRightLeft,
  ChevronRight,
  Heart,
  Train,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getSubwayLineColor, getLineTextColor } from '@utils/colorUtils';
import { LINE_NAMES } from '@utils/transferLabel';
import { getLocalStationsByLine } from '@services/data/stationsDataService';
import { useFavorites } from '@hooks/useFavorites';
import { useTheme } from '@services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { LineBadge, type LineId } from '@/components/design';
import type { Station } from '@models/train';
import type { AppStackParamList } from '@/navigation/types';

interface StationDisplay {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly isTransfer: boolean;
  readonly transferLines: readonly string[];
  readonly originalStation: Station;
}

interface SubwayLineData {
  readonly id: string;
  readonly name: string;
  readonly stations: readonly StationDisplay[];
}

/** All supported subway line IDs (mapped from seoulStations.json line_num) */
const LINE_IDS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '공항철도', '경의선', '경춘선', '수인분당선', '신분당선',
  '경강선', '서해선', '인천선', '인천2', '용인경전철',
  '의정부경전철', '우이신설경전철', '김포도시철도', '신림선', 'GTX-A',
] as const;

/**
 * Build transfer map: station name → set of lineIds it appears on
 */
const buildTransferMap = (): Map<string, Set<string>> => {
  const transferMap = new Map<string, Set<string>>();

  for (const lineId of LINE_IDS) {
    const stations = getLocalStationsByLine(lineId);
    for (const station of stations) {
      if (!transferMap.has(station.name)) {
        transferMap.set(station.name, new Set());
      }
      transferMap.get(station.name)!.add(lineId);
    }
  }

  return transferMap;
};

/**
 * Build all subway line data from stationsDataService
 */
const buildSubwayLines = (): SubwayLineData[] => {
  const transferMap = buildTransferMap();

  return LINE_IDS.map((lineId) => {
    const stations = getLocalStationsByLine(lineId);
    const displayStations: StationDisplay[] = stations.map((station) => {
      const lineSet = transferMap.get(station.name);
      const otherLines = lineSet
        ? [...lineSet].filter((l) => l !== lineId)
        : [];

      return {
        id: station.id,
        name: station.name,
        nameEn: station.nameEn,
        isTransfer: otherLines.length > 0,
        transferLines: otherLines,
        originalStation: station,
      };
    });

    return {
      id: lineId,
      name: LINE_NAMES[lineId] ?? `${lineId}호선`,
      stations: displayStations,
    };
  });
};

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const SubwayMapScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const subwayLines = useMemo(() => buildSubwayLines(), []);
  const [selectedLine, setSelectedLine] = useState<string | null>('2');
  const [selectedStation, setSelectedStation] = useState<StationDisplay | null>(null);
  const [showStationModal, setShowStationModal] = useState(false);

  const handleLineSelect = (lineId: string): void => {
    setSelectedLine(lineId);
  };

  const handleStationPress = (station: StationDisplay): void => {
    setSelectedStation(station);
    setShowStationModal(true);
  };

  const handleViewArrival = useCallback((): void => {
    if (!selectedStation || !selectedLine) return;
    setShowStationModal(false);
    navigation.navigate('StationDetail', {
      stationId: selectedStation.id,
      stationName: selectedStation.name,
      lineId: selectedLine,
    });
  }, [selectedStation, selectedLine, navigation]);

  const handleToggleFavorite = useCallback(async (): Promise<void> => {
    if (!selectedStation) return;
    try {
      await toggleFavorite(selectedStation.originalStation);
      setShowStationModal(false);
    } catch (error) {
      Alert.alert(
        '알림',
        error instanceof Error ? error.message : '즐겨찾기 처리에 실패했습니다.'
      );
    }
  }, [selectedStation, toggleFavorite]);

  const isStationFavorite = selectedStation ? isFavorite(selectedStation.id) : false;
  const selectedLineData = subwayLines.find(line => line.id === selectedLine);

  return (
    <View style={styles.container}>
      {/* Line Selector */}
      <View style={styles.lineSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.lineSelectorContent}
        >
          {subwayLines.map((line) => {
            const lineColor = getSubwayLineColor(line.id);
            const lineTextColor = getLineTextColor(line.id);
            const isSelected = selectedLine === line.id;

            return (
              <TouchableOpacity
                key={line.id}
                style={[
                  styles.lineButton,
                  {
                    backgroundColor: isSelected ? lineColor : semantic.bgSubtle,
                    borderColor: lineColor,
                    borderWidth: isSelected ? 0 : 2,
                  },
                  isSelected && {
                    shadowColor: lineColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 10,
                    elevation: 4,
                  },
                ]}
                onPress={() => handleLineSelect(line.id)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${line.name} 선택`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.lineButtonText,
                    { color: isSelected ? lineTextColor : lineColor },
                  ]}
                >
                  {line.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Station List */}
      {selectedLineData && (
        <ScrollView style={styles.stationList}>
          <View style={styles.stationListHeader}>
            <Text style={styles.stationListTitle}>
              {selectedLineData.name} 역 목록
            </Text>
            <Text style={styles.stationListSubtitle}>
              총 {selectedLineData.stations.length}개 역
            </Text>
          </View>

          {/* Vertical timeline — design handoff (rest.jsx 405-471): a
              grid-equivalent layout where the left rail column hosts
              absolutely-positioned tracks (top half + bottom half) so the
              line color flows continuously between station nodes.
              Transfer nodes are 30px outlined circles with an icon;
              normal nodes are 18px solid dots. */}
          <View style={styles.lineVisualization}>
            {selectedLineData.stations.map((station, index) => {
              const lineColor = getSubwayLineColor(selectedLineData.id);
              const isFirst = index === 0;
              const isLast = index === selectedLineData.stations.length - 1;

              return (
                <TouchableOpacity
                  key={station.id}
                  style={styles.stationItem}
                  onPress={() => handleStationPress(station)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${station.name}${station.isTransfer ? ', 환승역' : ''}`}
                  activeOpacity={0.7}
                >
                  {/* Rail column — 64 wide, hosts both tracks + node */}
                  <View style={styles.railColumn}>
                    {!isFirst && (
                      <View
                        style={[styles.railTrackTop, { backgroundColor: lineColor }]}
                      />
                    )}
                    {!isLast && (
                      <View
                        style={[styles.railTrackBottom, { backgroundColor: lineColor }]}
                      />
                    )}
                    <View
                      style={
                        station.isTransfer
                          ? [
                              styles.nodeTransfer,
                              { backgroundColor: semantic.bgBase, borderColor: lineColor },
                            ]
                          : [styles.nodeNormal, { backgroundColor: lineColor }]
                      }
                    >
                      {station.isTransfer && (
                        <ArrowRightLeft size={14} color={lineColor} strokeWidth={2.6} />
                      )}
                    </View>
                  </View>

                  {/* Station info — flex 1 */}
                  <View style={styles.stationInfo}>
                    <Text style={styles.stationName}>{station.name}</Text>
                    <Text style={styles.stationNameEn}>{station.nameEn}</Text>
                    {station.isTransfer && station.transferLines.length > 0 && (
                      <View style={styles.transferBadges}>
                        {station.transferLines.map((transferLine) => (
                          <LineBadge
                            key={transferLine}
                            line={transferLine as LineId}
                            size={20}
                          />
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Chevron — 24 wide */}
                  <View style={styles.chevronColumn}>
                    <ChevronRight size={18} color={semantic.labelAlt} strokeWidth={2} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Station Detail Modal */}
      <Modal
        visible={showStationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedStation && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalStationName}>
                      {selectedStation.name}
                    </Text>
                    <Text style={styles.modalStationNameEn}>
                      {selectedStation.nameEn}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowStationModal(false)}
                    style={styles.modalCloseButton}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="닫기"
                  >
                    <X size={24} color={semantic.labelAlt} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {selectedStation.isTransfer && selectedStation.transferLines && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>환승 노선</Text>
                    <View style={styles.transferBadges}>
                      {[selectedLineData?.id, ...selectedStation.transferLines].map((line) => {
                        if (!line) return null;
                        const lineColor = getSubwayLineColor(line);
                        const lineTextColor = getLineTextColor(line);
                        const lineName = subwayLines.find(l => l.id === line)?.name || line;

                        return (
                          <View
                            key={line}
                            style={[
                              styles.transferBadgeLarge,
                              { backgroundColor: lineColor },
                            ]}
                          >
                            <Text
                              style={[
                                styles.transferBadgeTextLarge,
                                { color: lineTextColor },
                              ]}
                            >
                              {lineName}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>실시간 정보</Text>
                  <TouchableOpacity
                    style={styles.viewArrivalButton}
                    onPress={handleViewArrival}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="도착 정보 보기"
                  >
                    <Train size={20} color={semantic.primaryNormal} />
                    <Text style={styles.viewArrivalButtonText}>
                      도착 정보 보기
                    </Text>
                    <ChevronRight size={18} color={semantic.primaryNormal} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.addFavoriteButton,
                    isStationFavorite && styles.removeFavoriteButton,
                  ]}
                  onPress={handleToggleFavorite}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={isStationFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                >
                  <Heart
                    size={20}
                    color="#ffffff"
                    fill={isStationFavorite ? '#ffffff' : 'transparent'}
                    strokeWidth={2}
                  />
                  <Text style={styles.addFavoriteButtonText}>
                    {isStationFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.bgSubtlePage,
  },
  lineSelector: {
    backgroundColor: semantic.bgBase,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  lineSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  lineButton: {
    height: 48,
    minWidth: 84,
    paddingHorizontal: 18,
    borderRadius: 9999,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineButtonText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.16,
  },
  stationList: {
    flex: 1,
  },
  stationListHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: semantic.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: semantic.lineSubtle,
  },
  stationListTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    color: semantic.labelStrong,
    letterSpacing: -0.44,
  },
  stationListSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelAlt,
    marginTop: 2,
  },
  lineVisualization: {
    backgroundColor: semantic.bgBase,
    paddingTop: 8,
    paddingBottom: 24,
  },
  // Grid 3-col equivalent: 64 rail | flex 1 info | 24 chevron column.
  // alignItems 'stretch' lets the rail tracks span the full row height
  // for continuous line coloring.
  stationItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 76,
  },
  railColumn: {
    width: 64,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Top half of the rail line — drawn only when a station above exists.
  railTrackTop: {
    position: 'absolute',
    top: 0,
    bottom: '50%',
    left: '50%',
    width: 4,
    marginLeft: -2,
  },
  // Bottom half — drawn only when a station below exists.
  railTrackBottom: {
    position: 'absolute',
    top: '50%',
    bottom: 0,
    left: '50%',
    width: 4,
    marginLeft: -2,
  },
  nodeTransfer: {
    width: 30,
    height: 30,
    borderRadius: 9999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  nodeNormal: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    zIndex: 1,
  },
  stationInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingLeft: 8,
    paddingRight: 4,
  },
  stationName: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    color: semantic.labelStrong,
    letterSpacing: -0.17,
  },
  stationNameEn: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
    color: semantic.labelAlt,
    marginTop: 2,
  },
  transferBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  chevronColumn: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 16,
  },
  transferBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
  },
  transferBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  transferBadgeTextLarge: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: semantic.bgBase,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  modalStationName: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
    color: semantic.labelStrong,
    marginBottom: 4,
  },
  modalStationNameEn: {
    fontSize: 16,
    color: semantic.labelAlt,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.labelNormal,
    marginBottom: 12,
  },
  viewArrivalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: semantic.primaryBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  viewArrivalButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: semantic.primaryNormal,
    marginLeft: 12,
  },
  addFavoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantic.primaryNormal,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addFavoriteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: weightToFontFamily('bold'),
    color: semantic.labelOnColor,
  },
  removeFavoriteButton: {
    backgroundColor: semantic.statusNegative,
  },
});
