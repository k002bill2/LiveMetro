/**
 * Station Search Modal Component
 * Full-screen modal for searching and selecting subway stations
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { StationSelection } from '@/models/commute';
import stationsData from '@/data/stations.json';

interface StationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (station: StationSelection) => void;
  title?: string;
  placeholder?: string;
  excludeStationIds?: string[];
}

// Line colors for visual indication
const LINE_COLORS: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#E6186C',
  '9': '#BDB092',
};

const LINE_NAMES: Record<string, string> = {
  '1': '1호선',
  '2': '2호선',
  '3': '3호선',
  '4': '4호선',
  '5': '5호선',
  '6': '6호선',
  '7': '7호선',
  '8': '8호선',
  '9': '9호선',
};

interface StationWithLine {
  id: string;
  name: string;
  lineId: string;
  lineName: string;
}

export const StationSearchModal: React.FC<StationSearchModalProps> = ({
  visible,
  onClose,
  onSelect,
  title = '역 선택',
  placeholder = '역 이름을 검색하세요',
  excludeStationIds = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [stations, setStations] = useState<StationWithLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all stations on mount
  useEffect(() => {
    if (visible) {
      loadStations();
    }
  }, [visible]);

  const loadStations = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Use local station data from stations.json
      // Filter stations that have line information and create entries for each line
      const localStations: StationWithLine[] = [];

      Object.values(stationsData as Record<string, { id: string; name: string; lines: string[] }>).forEach((station) => {
        // Only include stations with line information
        if (station.lines && station.lines.length > 0) {
          station.lines.forEach((line) => {
            // Only include lines 1-9
            if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(line)) {
              localStations.push({
                id: station.id,
                name: station.name,
                lineId: line,
                lineName: LINE_NAMES[line] || `${line}호선`,
              });
            }
          });
        }
      });

      setStations(localStations);
    } catch (err) {
      console.error('Failed to load stations:', err);
      setError('역 정보를 불러오는데 실패했습니다');
      // Use fallback static data if loading fails
      setStations(FALLBACK_STATIONS);
    } finally {
      setLoading(false);
    }
  };

  // Filter stations based on search query and selected line
  const filteredStations = useMemo(() => {
    let result = stations;

    // Filter by line
    if (selectedLine) {
      result = result.filter((s) => s.lineId === selectedLine);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(query)
      );
    }

    // Exclude specified stations
    if (excludeStationIds.length > 0) {
      result = result.filter((s) => !excludeStationIds.includes(s.id));
    }

    // Sort alphabetically
    return result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [stations, searchQuery, selectedLine, excludeStationIds]);

  const handleSelectStation = useCallback(
    (station: StationWithLine) => {
      onSelect({
        stationId: station.id,
        stationName: station.name,
        lineId: station.lineId,
        lineName: station.lineName,
      });
      setSearchQuery('');
      setSelectedLine(null);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSelectedLine(null);
    onClose();
  }, [onClose]);

  const renderLineFilter = () => (
    <View style={styles.lineFilterContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={Object.keys(LINE_COLORS)}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.lineFilterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.lineFilterButton,
              selectedLine === item && styles.lineFilterButtonActive,
              { borderColor: LINE_COLORS[item] },
            ]}
            onPress={() =>
              setSelectedLine(selectedLine === item ? null : item)
            }
          >
            <View
              style={[
                styles.lineIndicator,
                { backgroundColor: LINE_COLORS[item] },
              ]}
            />
            <Text
              style={[
                styles.lineFilterText,
                selectedLine === item && styles.lineFilterTextActive,
              ]}
            >
              {LINE_NAMES[item]}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderStationItem = ({ item }: { item: StationWithLine }) => (
    <TouchableOpacity
      style={styles.stationItem}
      onPress={() => handleSelectStation(item)}
    >
      <View
        style={[
          styles.stationLineIndicator,
          { backgroundColor: LINE_COLORS[item.lineId] || COLORS.gray[400] },
        ]}
      />
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{item.name}</Text>
        <Text style={styles.stationLine}>{item.lineName}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.gray[400]}
      />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="search-outline"
        size={48}
        color={COLORS.gray[300]}
      />
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? '검색 결과가 없습니다'
          : '역 이름을 검색하거나 호선을 선택하세요'}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Ionicons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color={COLORS.gray[400]}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor={COLORS.gray[400]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.gray[400]}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Line Filter */}
          {renderLineFilter()}

          {/* Results Count */}
          {!loading && (
            <View style={styles.resultCount}>
              <Text style={styles.resultCountText}>
                {filteredStations.length}개의 역
              </Text>
            </View>
          )}

          {/* Station List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary.main} />
              <Text style={styles.loadingText}>역 정보를 불러오는 중...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={COLORS.semantic.error}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadStations}
              >
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredStations}
              keyExtractor={(item) => `${item.id}-${item.lineId}`}
              renderItem={renderStationItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmptyState}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// Fallback station data in case API fails
const FALLBACK_STATIONS: StationWithLine[] = [
  { id: '0150', name: '서울역', lineId: '1', lineName: '1호선' },
  { id: '0151', name: '시청', lineId: '1', lineName: '1호선' },
  { id: '0152', name: '종각', lineId: '1', lineName: '1호선' },
  { id: '0153', name: '종로3가', lineId: '1', lineName: '1호선' },
  { id: '0222', name: '강남', lineId: '2', lineName: '2호선' },
  { id: '0223', name: '역삼', lineId: '2', lineName: '2호선' },
  { id: '0224', name: '선릉', lineId: '2', lineName: '2호선' },
  { id: '0225', name: '삼성', lineId: '2', lineName: '2호선' },
  { id: '0239', name: '홍대입구', lineId: '2', lineName: '2호선' },
  { id: '0240', name: '신촌', lineId: '2', lineName: '2호선' },
  { id: '0309', name: '교대', lineId: '3', lineName: '3호선' },
  { id: '0415', name: '명동', lineId: '4', lineName: '4호선' },
  { id: '0537', name: '여의도', lineId: '5', lineName: '5호선' },
  { id: '0756', name: '건대입구', lineId: '7', lineName: '7호선' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  lineFilterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  lineFilterContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  lineFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    marginRight: SPACING.sm,
  },
  lineFilterButtonActive: {
    backgroundColor: COLORS.surface.background,
  },
  lineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  lineFilterText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  lineFilterTextActive: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  resultCount: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface.background,
  },
  resultCountText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  listContent: {
    paddingBottom: SPACING['2xl'],
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  stationLineIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: SPACING.md,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  stationLine: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyStateText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.base,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});

export default StationSearchModal;
