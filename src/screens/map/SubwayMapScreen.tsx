/**
 * Subway Map Screen Component
 * Interactive Seoul subway line map with station selection
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getSubwayLineColor, getLineTextColor } from '@utils/colorUtils';
import { Station } from '@models/train';

// Simplified subway line data for MVP
interface SubwayLineData {
  id: string;
  name: string;
  stations: {
    id: string;
    name: string;
    nameEn: string;
    isTransfer: boolean;
    transferLines?: string[];
  }[];
}

const SUBWAY_LINES: SubwayLineData[] = [
  {
    id: '1',
    name: '1호선',
    stations: [
      { id: '1001', name: '서울역', nameEn: 'Seoul Station', isTransfer: true, transferLines: ['4'] },
      { id: '1002', name: '시청', nameEn: 'City Hall', isTransfer: true, transferLines: ['2'] },
      { id: '1003', name: '종각', nameEn: 'Jonggak', isTransfer: false },
      { id: '1004', name: '종로3가', nameEn: 'Jongno 3-ga', isTransfer: true, transferLines: ['3', '5'] },
      { id: '1005', name: '종로5가', nameEn: 'Jongno 5-ga', isTransfer: false },
      { id: '1006', name: '동대문', nameEn: 'Dongdaemun', isTransfer: true, transferLines: ['4'] },
    ],
  },
  {
    id: '2',
    name: '2호선',
    stations: [
      { id: '2001', name: '시청', nameEn: 'City Hall', isTransfer: true, transferLines: ['1'] },
      { id: '2002', name: '을지로입구', nameEn: 'Euljiro 1-ga', isTransfer: false },
      { id: '2003', name: '을지로3가', nameEn: 'Euljiro 3-ga', isTransfer: true, transferLines: ['3'] },
      { id: '2004', name: '을지로4가', nameEn: 'Euljiro 4-ga', isTransfer: true, transferLines: ['5'] },
      { id: '2005', name: '동대문역사문화공원', nameEn: 'DDP', isTransfer: true, transferLines: ['4', '5'] },
      { id: '2006', name: '신당', nameEn: 'Sindang', isTransfer: true, transferLines: ['6'] },
      { id: '2007', name: '강남', nameEn: 'Gangnam', isTransfer: true, transferLines: ['신분당'] },
      { id: '2008', name: '역삼', nameEn: 'Yeoksam', isTransfer: false },
      { id: '2009', name: '선릉', nameEn: 'Seolleung', isTransfer: true, transferLines: ['분당'] },
    ],
  },
  {
    id: '3',
    name: '3호선',
    stations: [
      { id: '3001', name: '종로3가', nameEn: 'Jongno 3-ga', isTransfer: true, transferLines: ['1', '5'] },
      { id: '3002', name: '을지로3가', nameEn: 'Euljiro 3-ga', isTransfer: true, transferLines: ['2'] },
      { id: '3003', name: '충무로', nameEn: 'Chungmuro', isTransfer: true, transferLines: ['4'] },
      { id: '3004', name: '동대입구', nameEn: 'Dongguk Univ.', isTransfer: false },
      { id: '3005', name: '약수', nameEn: 'Yaksu', isTransfer: true, transferLines: ['6'] },
      { id: '3006', name: '금호', nameEn: 'Geumho', isTransfer: false },
      { id: '3007', name: '옥수', nameEn: 'Oksu', isTransfer: false },
    ],
  },
  {
    id: '4',
    name: '4호선',
    stations: [
      { id: '4001', name: '서울역', nameEn: 'Seoul Station', isTransfer: true, transferLines: ['1'] },
      { id: '4002', name: '회현', nameEn: 'Hoehyeon', isTransfer: false },
      { id: '4003', name: '명동', nameEn: 'Myeongdong', isTransfer: false },
      { id: '4004', name: '충무로', nameEn: 'Chungmuro', isTransfer: true, transferLines: ['3'] },
      { id: '4005', name: '동대문역사문화공원', nameEn: 'DDP', isTransfer: true, transferLines: ['2', '5'] },
      { id: '4006', name: '동대문', nameEn: 'Dongdaemun', isTransfer: true, transferLines: ['1'] },
    ],
  },
  {
    id: '5',
    name: '5호선',
    stations: [
      { id: '5001', name: '종로3가', nameEn: 'Jongno 3-ga', isTransfer: true, transferLines: ['1', '3'] },
      { id: '5002', name: '을지로4가', nameEn: 'Euljiro 4-ga', isTransfer: true, transferLines: ['2'] },
      { id: '5003', name: '동대문역사문화공원', nameEn: 'DDP', isTransfer: true, transferLines: ['2', '4'] },
      { id: '5004', name: '청구', nameEn: 'Cheonggu', isTransfer: false },
      { id: '5005', name: '왕십리', nameEn: 'Wangsimni', isTransfer: true, transferLines: ['2', '경의중앙'] },
    ],
  },
];

export const SubwayMapScreen: React.FC = () => {
  const [selectedLine, setSelectedLine] = useState<string | null>('2'); // Default to Line 2
  const [selectedStation, setSelectedStation] = useState<SubwayLineData['stations'][0] | null>(null);
  const [showStationModal, setShowStationModal] = useState(false);

  const handleLineSelect = (lineId: string) => {
    setSelectedLine(lineId);
  };

  const handleStationPress = (station: SubwayLineData['stations'][0]) => {
    setSelectedStation(station);
    setShowStationModal(true);
  };

  const selectedLineData = SUBWAY_LINES.find(line => line.id === selectedLine);

  return (
    <View style={styles.container}>
      {/* Line Selector */}
      <View style={styles.lineSelector}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.lineSelectorContent}
        >
          {SUBWAY_LINES.map((line) => {
            const lineColor = getSubwayLineColor(line.id);
            const lineTextColor = getLineTextColor(line.id);
            const isSelected = selectedLine === line.id;

            return (
              <TouchableOpacity
                key={line.id}
                style={[
                  styles.lineButton,
                  {
                    backgroundColor: isSelected ? lineColor : '#f3f4f6',
                    borderColor: lineColor,
                    borderWidth: isSelected ? 0 : 2,
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

          {/* Visual Line with Stations */}
          <View style={styles.lineVisualization}>
            {selectedLineData.stations.map((station, index) => {
              const lineColor = getSubwayLineColor(selectedLineData.id);
              const isLast = index === selectedLineData.stations.length - 1;

              return (
                <View key={station.id} style={styles.stationItem}>
                  {/* Station Circle and Line */}
                  <View style={styles.stationMarkerContainer}>
                    <TouchableOpacity
                      style={[
                        styles.stationCircle,
                        {
                          backgroundColor: station.isTransfer ? '#ffffff' : lineColor,
                          borderColor: lineColor,
                          borderWidth: station.isTransfer ? 4 : 0,
                        },
                      ]}
                      onPress={() => handleStationPress(station)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${station.name}역${station.isTransfer ? ', 환승역' : ''}`}
                    >
                      {station.isTransfer && (
                        <Ionicons name="swap-horizontal" size={16} color={lineColor} />
                      )}
                    </TouchableOpacity>

                    {!isLast && (
                      <View
                        style={[
                          styles.stationConnector,
                          { backgroundColor: lineColor },
                        ]}
                      />
                    )}
                  </View>

                  {/* Station Info */}
                  <TouchableOpacity
                    style={styles.stationInfo}
                    onPress={() => handleStationPress(station)}
                  >
                    <Text style={styles.stationName}>{station.name}</Text>
                    <Text style={styles.stationNameEn}>{station.nameEn}</Text>

                    {station.isTransfer && station.transferLines && (
                      <View style={styles.transferBadges}>
                        {station.transferLines.map((transferLine) => {
                          const transferColor = getSubwayLineColor(transferLine);
                          const transferTextColor = getLineTextColor(transferLine);

                          return (
                            <View
                              key={transferLine}
                              style={[
                                styles.transferBadge,
                                { backgroundColor: transferColor },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.transferBadgeText,
                                  { color: transferTextColor },
                                ]}
                              >
                                {transferLine}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Chevron */}
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </View>
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
                    <Ionicons name="close" size={28} color="#6b7280" />
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
                        const lineName = SUBWAY_LINES.find(l => l.id === line)?.name || line;

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
                    onPress={() => {
                      // Navigate to arrival info
                      setShowStationModal(false);
                      // TODO: Navigate to HomeScreen with selected station
                    }}
                  >
                    <Ionicons name="train" size={20} color="#2563eb" />
                    <Text style={styles.viewArrivalButtonText}>
                      도착 정보 보기
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#2563eb" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.addFavoriteButton}
                  onPress={() => {
                    // TODO: Add to favorites
                    setShowStationModal(false);
                  }}
                >
                  <Ionicons name="heart-outline" size={20} color="#ffffff" />
                  <Text style={styles.addFavoriteButtonText}>
                    즐겨찾기 추가
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  lineSelector: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  lineButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  stationList: {
    flex: 1,
  },
  stationListHeader: {
    padding: 20,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  stationListTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stationListSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  lineVisualization: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stationMarkerContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  stationCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  stationConnector: {
    width: 4,
    height: 40,
    marginTop: 2,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  stationNameEn: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  transferBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  transferBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  transferBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
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
    color: '#111827',
    marginBottom: 4,
  },
  modalStationNameEn: {
    fontSize: 16,
    color: '#6b7280',
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
    color: '#374151',
    marginBottom: 12,
  },
  viewArrivalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  viewArrivalButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 12,
  },
  addFavoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addFavoriteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
