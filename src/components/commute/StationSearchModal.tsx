/**
 * Station Search Modal Component
 * Full-screen modal for searching and selecting subway stations.
 *
 * Phase 49 — migrated to Wanted Design System tokens. Subway line colors
 * now resolve through getSubwayLineColor utility.
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
  ScrollView,
} from 'react-native';
import {
  Star,
  ChevronRight,
  Search,
  X,
  XCircle,
  AlertCircle
} from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { StationSelection } from '@/models/commute';
import {
  getStationsWithLineInfo,
  StationWithLineInfo,
} from '@/services/data/stationsDataService';
import { useFavorites } from '@/hooks/useFavorites';

interface StationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (station: StationSelection) => void;
  title?: string;
  placeholder?: string;
  excludeStationIds?: string[];
}

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

const LINE_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

// Use StationWithLineInfo from stationsDataService
// which provides station_cd (seoulStations.json) for consistent ID format
type StationWithLine = StationWithLineInfo;

export const StationSearchModal: React.FC<StationSearchModalProps> = ({
  visible,
  onClose,
  onSelect,
  title = '역 선택',
  placeholder = '역 이름을 검색하세요',
  excludeStationIds = [],
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [stations, setStations] = useState<StationWithLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get commute favorites
  const { favoritesWithDetails } = useFavorites();

  // Filter commute stations (isCommuteStation=true) and exclude already selected stations
  const commuteStations = useMemo(() => {
    return favoritesWithDetails.filter(fav =>
      fav.isCommuteStation &&
      fav.station &&
      !excludeStationIds.includes(fav.stationId)
    );
  }, [favoritesWithDetails, excludeStationIds]);

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
      const localStations = getStationsWithLineInfo();
      setStations(localStations);
    } catch {
      setError('역 정보를 불러오는데 실패했습니다');
      setStations(FALLBACK_STATIONS);
    } finally {
      setLoading(false);
    }
  };

  // Filter stations based on search query and selected line
  const filteredStations = useMemo(() => {
    let result = stations;

    if (selectedLine) {
      result = result.filter((s) => s.lineId === selectedLine);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((s) =>
        s.name.toLowerCase().includes(query)
      );
    }

    if (excludeStationIds.length > 0) {
      result = result.filter((s) => !excludeStationIds.includes(s.id));
    }

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

  const handleSelectCommuteFavorite = useCallback(
    (favorite: typeof favoritesWithDetails[0]) => {
      if (!favorite.station) return;

      onSelect({
        stationId: favorite.stationId,
        stationName: favorite.station.name,
        lineId: favorite.lineId,
        lineName: LINE_NAMES[favorite.lineId] || `${favorite.lineId}호선`,
      });
      setSearchQuery('');
      setSelectedLine(null);
      onClose();
    },
    [onSelect, onClose]
  );

  const renderCommuteFavorites = () => {
    if (commuteStations.length === 0) return null;

    return (
      <View style={styles.favoritesSection}>
        <View style={styles.favoritesSectionHeader}>
          <Star size={16} color={semantic.labelStrong} />
          <Text style={styles.favoritesSectionTitle}>출퇴근 즐겨찾기</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.favoritesScrollContent}
        >
          {commuteStations.map((fav) => (
            <TouchableOpacity
              key={fav.id}
              style={styles.favoriteCard}
              onPress={() => handleSelectCommuteFavorite(fav)}
            >
              <View
                style={[
                  styles.favoriteLineIndicator,
                  { backgroundColor: getSubwayLineColor(fav.lineId) },
                ]}
              />
              <View style={styles.favoriteContent}>
                {fav.alias && (
                  <Text style={styles.favoriteAlias}>{fav.alias}</Text>
                )}
                <Text style={styles.favoriteStationName}>
                  {fav.station?.name}역
                </Text>
                <Text style={styles.favoriteLineName}>
                  {LINE_NAMES[fav.lineId] || `${fav.lineId}호선`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderLineFilter = () => (
    <View style={styles.lineFilterContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={LINE_IDS as unknown as string[]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.lineFilterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.lineFilterButton,
              selectedLine === item && styles.lineFilterButtonActive,
              { borderColor: getSubwayLineColor(item) },
            ]}
            onPress={() =>
              setSelectedLine(selectedLine === item ? null : item)
            }
          >
            <View
              style={[
                styles.lineIndicator,
                { backgroundColor: getSubwayLineColor(item) },
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
          { backgroundColor: getSubwayLineColor(item.lineId) },
        ]}
      />
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{item.name}</Text>
        <Text style={styles.stationLine}>{item.lineName}</Text>
      </View>
      <ChevronRight
        size={20}
        color={semantic.labelAlt}
      />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Search
        size={48}
        color={semantic.lineNormal}
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
              <X size={24} color={semantic.labelStrong} />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {renderCommuteFavorites()}

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search
                size={20}
                color={semantic.labelAlt}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor={semantic.labelAlt}
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
                  <XCircle
                    size={20}
                    color={semantic.labelAlt}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

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
              <ActivityIndicator size="large" color={WANTED_TOKENS.blue[500]} />
              <Text style={styles.loadingText}>역 정보를 불러오는 중...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <AlertCircle
                size={48}
                color={WANTED_TOKENS.status.red500}
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
  { id: '0150', name: '서울역', nameEn: 'Seoul Station', lineId: '1', lineName: '1호선' },
  { id: '0151', name: '시청', nameEn: 'City Hall', lineId: '1', lineName: '1호선' },
  { id: '0152', name: '종각', nameEn: 'Jonggak', lineId: '1', lineName: '1호선' },
  { id: '0153', name: '종로3가', nameEn: 'Jongno 3(sam)-ga', lineId: '1', lineName: '1호선' },
  { id: '0222', name: '강남', nameEn: 'Gangnam', lineId: '2', lineName: '2호선' },
  { id: '0223', name: '역삼', nameEn: 'Yeoksam', lineId: '2', lineName: '2호선' },
  { id: '0224', name: '선릉', nameEn: 'Seolleung', lineId: '2', lineName: '2호선' },
  { id: '0225', name: '삼성', nameEn: 'Samsung', lineId: '2', lineName: '2호선' },
  { id: '0239', name: '홍대입구', nameEn: 'Hongik Univ.', lineId: '2', lineName: '2호선' },
  { id: '0240', name: '신촌', nameEn: 'Sinchon', lineId: '2', lineName: '2호선' },
  { id: '0309', name: '교대', nameEn: 'Seoul Nat\'l Univ. of Education', lineId: '3', lineName: '3호선' },
  { id: '0415', name: '명동', nameEn: 'Myeong-dong', lineId: '4', lineName: '4호선' },
  { id: '0537', name: '여의도', nameEn: 'Yeouido', lineId: '5', lineName: '5호선' },
  { id: '0756', name: '건대입구', nameEn: 'Konkuk Univ.', lineId: '7', lineName: '7호선' },
];

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 20,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    headerSpacer: {
      width: 40,
    },
    searchContainer: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    searchIcon: {
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    searchInput: {
      flex: 1,
      height: 44,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    clearButton: {
      padding: WANTED_TOKENS.spacing.s1,
    },
    lineFilterContainer: {
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    lineFilterContent: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    lineFilterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 1.5,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    lineFilterButtonActive: {
      backgroundColor: semantic.bgSubtle,
    },
    lineIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: WANTED_TOKENS.spacing.s1,
    },
    lineFilterText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
    },
    lineFilterTextActive: {
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    resultCount: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgSubtlePage,
    },
    resultCountText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    listContent: {
      paddingBottom: WANTED_TOKENS.spacing.s6,
    },
    stationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    stationLineIndicator: {
      width: 4,
      height: 32,
      borderRadius: 2,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    stationInfo: {
      flex: 1,
    },
    stationName: {
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginBottom: 2,
    },
    stationLine: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s10,
    },
    emptyStateText: {
      marginTop: WANTED_TOKENS.spacing.s3,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: WANTED_TOKENS.spacing.s3,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
    },
    errorText: {
      marginTop: WANTED_TOKENS.spacing.s3,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelNeutral,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: WANTED_TOKENS.spacing.s4,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: WANTED_TOKENS.blue[500],
      borderRadius: WANTED_TOKENS.radius.r4,
    },
    retryButtonText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: '#FFFFFF',
    },
    favoritesSection: {
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
      backgroundColor: semantic.bgSubtlePage,
    },
    favoritesSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      marginBottom: WANTED_TOKENS.spacing.s2,
      gap: WANTED_TOKENS.spacing.s1,
    },
    favoritesSectionTitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    favoritesScrollContent: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      gap: WANTED_TOKENS.spacing.s2,
    },
    favoriteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      marginRight: WANTED_TOKENS.spacing.s2,
      minWidth: 120,
    },
    favoriteLineIndicator: {
      width: 4,
      height: 36,
      borderRadius: 2,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    favoriteContent: {
      flex: 1,
    },
    favoriteAlias: {
      fontSize: 12,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: 2,
    },
    favoriteStationName: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    favoriteLineName: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });

export default StationSearchModal;
