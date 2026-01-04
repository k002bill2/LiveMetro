/**
 * Favorites Screen Component - Modern Design
 * Displays user's favorite stations with real-time arrival information
 * Minimal grayscale design with black accent
 *
 * Features:
 * - List of favorited stations with real-time arrivals
 * - Quick access to station details
 * - Edit and delete favorites
 * - Empty state for new users
 * - Pull to refresh
 */

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../services/auth/AuthContext';
import { AppStackParamList } from '../../navigation/types';
import { FavoritesSearchBar } from '../../components/favorites/FavoritesSearchBar';
import { DraggableFavoriteItem } from '../../components/favorites/DraggableFavoriteItem';
import { StationSearchModal } from '../../components/commute/StationSearchModal';
import { StationSelection } from '../../models/commute';
import { Station } from '../../models/train';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const {
    favoritesWithDetails,
    loading,
    error,
    removeFavorite,
    updateFavorite,
    addFavorite,
    refresh,
  } = useFavorites();

  // Station search modal state
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<{
    lineId?: string;
    direction?: 'up' | 'down';
    commuteOnly?: boolean;
  }>({});

  // Edit state
  const [editingFavoriteId, setEditingFavoriteId] = useState<string | null>(null);

  /**
   * Filter favorites based on search query and active filters
   */
  const filteredFavorites = useMemo(() => {
    return favoritesWithDetails.filter(fav => {
      // Search filter (Korean + English name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = fav.station?.name.toLowerCase().includes(query);
        const matchesNameEn = fav.station?.nameEn.toLowerCase().includes(query);
        if (!matchesName && !matchesNameEn) {
          return false;
        }
      }

      // Line filter
      if (activeFilters.lineId && fav.lineId !== activeFilters.lineId) {
        return false;
      }

      // Direction filter
      if (activeFilters.direction) {
        if (fav.direction !== 'both' && fav.direction !== activeFilters.direction) {
          return false;
        }
      }

      // Commute filter
      if (activeFilters.commuteOnly && !fav.isCommuteStation) {
        return false;
      }

      return true;
    });
  }, [favoritesWithDetails, searchQuery, activeFilters]);

  /**
   * Auto-close edit mode when search becomes active
   */
  useEffect(() => {
    if (searchQuery.length > 0 || Object.keys(activeFilters).length > 0) {
      setEditingFavoriteId(null);
    }
  }, [searchQuery, activeFilters]);

  /**
   * Handle edit toggle
   */
  const handleEditToggle = useCallback((favoriteId: string) => {
    setEditingFavoriteId(prev => prev === favoriteId ? null : favoriteId);
  }, []);

  /**
   * Handle save edit
   */
  const handleSaveEdit = useCallback(
    async (
      favoriteId: string,
      updates: {
        alias?: string | null;
        direction?: 'up' | 'down' | 'both';
        isCommuteStation?: boolean;
      }
    ) => {
      try {
        // Convert null to undefined for type compatibility
        await updateFavorite(favoriteId, {
          ...updates,
          alias: updates.alias ?? undefined,
        });
        setEditingFavoriteId(null);
      } catch (error) {
        Alert.alert('오류', '즐겨찾기 수정에 실패했습니다.');
        throw error;
      }
    },
    [updateFavorite]
  );

  /**
   * Handle favorite removal with confirmation
   */
  const handleRemoveFavorite = useCallback((favoriteId: string, stationName: string) => {
    Alert.alert(
      '즐겨찾기 삭제',
      `${stationName}역을 즐겨찾기에서 삭제하시겠습니까?`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFavorite(favoriteId);
            } catch (error) {
              Alert.alert('오류', '즐겨찾기 삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  }, [removeFavorite]);

  /**
   * Navigate to station detail
   */
  const handleStationPress = useCallback((favorite: typeof favoritesWithDetails[0]) => {
    if (!favorite.station) return;

    navigation.navigate('StationDetail', {
      stationId: favorite.stationId,
      stationName: favorite.station.name,
      lineId: favorite.lineId,
    });
  }, [navigation]);

  /**
   * Handle station selection from search modal
   */
  const handleStationSelect = useCallback(async (selection: StationSelection) => {
    // Check if already in favorites first (before closing modal)
    const alreadyExists = favoritesWithDetails.some(
      fav => fav.stationId === selection.stationId && fav.lineId === selection.lineId
    );

    if (alreadyExists) {
      setIsSearchModalVisible(false);
      Alert.alert('알림', '이미 즐겨찾기에 추가된 역입니다.');
      return;
    }

    try {
      // Convert StationSelection to Station format
      const station: Station = {
        id: selection.stationId,
        name: selection.stationName,
        nameEn: '',
        lineId: selection.lineId,
        coordinates: { latitude: 0, longitude: 0 },
        transfers: [],
      };

      // Add favorite first, then close modal to avoid animation conflicts
      await addFavorite(station);
      setIsSearchModalVisible(false);
      Alert.alert('완료', `${selection.stationName}역이 즐겨찾기에 추가되었습니다.`);
    } catch (error) {
      setIsSearchModalVisible(false);
      Alert.alert('오류', '즐겨찾기 추가에 실패했습니다.');
    }
  }, [addFavorite, favoritesWithDetails]);

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={64} color={COLORS.gray[300]} />
      <Text style={styles.emptyTitle}>즐겨찾기가 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        자주 이용하는 역을 즐겨찾기에 추가해보세요
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => setIsSearchModalVisible(true)}
      >
        <Text style={styles.emptyButtonText}>역 찾아보기</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render no results state (when filtered list is empty but favorites exist)
   */
  const renderNoResults = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={64} color={COLORS.gray[300]} />
      <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        다른 검색어나 필터를 시도해보세요
      </Text>
    </View>
  );

  /**
   * Render favorite item
   */
  const renderFavoriteItem = (favorite: typeof favoritesWithDetails[0], index: number) => {
    return (
      <DraggableFavoriteItem
        key={favorite.id}
        favorite={favorite}
        index={index}
        isEditing={editingFavoriteId === favorite.id}
        onEditToggle={() => handleEditToggle(favorite.id)}
        onRemove={() => handleRemoveFavorite(favorite.id, favorite.station?.name || '알 수 없는 역')}
        onPress={() => handleStationPress(favorite)}
        onSaveEdit={(updates) => handleSaveEdit(favorite.id, updates)}
        isDragEnabled={false} // Will be enabled in Phase 3
      />
    );
  };

  // Show loading state
  if (loading && favoritesWithDetails.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.black} />
          <Text style={styles.loadingText}>즐겨찾기를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && favoritesWithDetails.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.gray[400]} />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show login prompt for unauthenticated users
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="log-in-outline" size={64} color={COLORS.gray[300]} />
          <Text style={styles.emptyTitle}>로그인이 필요합니다</Text>
          <Text style={styles.emptySubtitle}>
            즐겨찾기를 사용하려면 로그인해주세요
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Determine which content to show
  const hasNoFavorites = favoritesWithDetails.length === 0;
  const hasNoResults = !hasNoFavorites && filteredFavorites.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>즐겨찾기</Text>
          <Text style={styles.headerSubtitle}>
            {favoritesWithDetails.length}개의 역
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsSearchModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {!hasNoFavorites && (
        <FavoritesSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          resultCount={filteredFavorites.length}
        />
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={COLORS.black}
          />
        }
      >
        {hasNoFavorites ? (
          renderEmptyState()
        ) : hasNoResults ? (
          renderNoResults()
        ) : (
          <View style={styles.listContainer}>
            {filteredFavorites.map((favorite, index) =>
              renderFavoriteItem(favorite, index)
            )}
          </View>
        )}
      </ScrollView>

      {/* Station Search Modal */}
      <StationSearchModal
        visible={isSearchModalVisible}
        onClose={() => setIsSearchModalVisible(false)}
        onSelect={handleStationSelect}
        title="역 검색"
        placeholder="즐겨찾기에 추가할 역을 검색하세요"
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  headerLeft: {
    flex: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  listContainer: {
    padding: SPACING.lg,
  },
  favoriteItemContainer: {
    marginBottom: SPACING.xl,
  },
  aliasContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  aliasText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginLeft: SPACING.xs,
  },
  cardWrapper: {
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    padding: SPACING.xs,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    gap: SPACING.sm,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  commuteIndicator: {
    backgroundColor: COLORS.surface.card,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  commuteText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.black,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  deleteIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
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
    gap: SPACING.lg,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    textAlign: 'center',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.sm,
  },
  emptyButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.base,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});

export default FavoritesScreen;
