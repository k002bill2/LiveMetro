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

import React, { useCallback, useState, useMemo, useEffect, memo } from 'react';
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
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Heart, Search, AlertCircle, LogIn, Plus } from 'lucide-react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../services/auth/AuthContext';
import { AppStackParamList } from '../../navigation/types';
import { FavoritesSearchBar } from '../../components/favorites/FavoritesSearchBar';
import { FavoritesLineChips } from '../../components/favorites/FavoritesLineChips';
import { DraggableFavoriteItem } from '../../components/favorites/DraggableFavoriteItem';
import { StationSearchModal } from '../../components/commute/StationSearchModal';
import { StationSelection } from '../../models/commute';
import { Station } from '../../models/train';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '../../styles/modernTheme';
import { useTheme } from '../../services/theme';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  // Pause Seoul API polling on the per-card StationCards when this screen
  // is unfocused (e.g. user opens SubwayMap). Without this, favorites kept
  // re-fetching realtime arrivals while the user was elsewhere.
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const {
    favoritesWithDetails,
    loading,
    error,
    removeFavorite,
    updateFavorite,
    addFavorite,
    setNotificationEnabled,
    reorderFavorites,
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
   * Unique lineIds present in the user's favorites — drives the line filter
   * chip row. Empty when the user has no favorites yet, so the chips
   * gracefully disappear with the empty state instead of showing a static
   * full-network list.
   */
  const availableLineIds = useMemo(() => {
    const seen = new Set<string>();
    for (const fav of favoritesWithDetails) {
      if (fav.lineId) seen.add(fav.lineId);
    }
    return Array.from(seen);
  }, [favoritesWithDetails]);

  const handleLineFilter = useCallback(
    (lineId: string | undefined) => {
      setActiveFilters((prev) => {
        if (lineId === undefined) {
          const { lineId: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, lineId };
      });
    },
    [],
  );

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
            } catch {
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
   * Navigate to StationDetail (departure intent)
   */
  const handleSetStart = useCallback((favorite: typeof favoritesWithDetails[0]) => {
    if (!favorite.station) return;

    navigation.navigate('StationDetail', {
      stationId: favorite.stationId,
      stationName: favorite.station.name,
      lineId: favorite.lineId,
    });
  }, [navigation]);

  /**
   * Navigate to StationDetail (arrival intent)
   */
  const handleSetEnd = useCallback((favorite: typeof favoritesWithDetails[0]) => {
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
    } catch {
      setIsSearchModalVisible(false);
      Alert.alert('오류', '즐겨찾기 추가에 실패했습니다.');
    }
  }, [addFavorite, favoritesWithDetails]);

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Heart size={64} color={semantic.labelAlt} />
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
      <Search size={64} color={semantic.labelAlt} />
      <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        다른 검색어나 필터를 시도해보세요
      </Text>
    </View>
  );

  /**
   * Reorder is meaningful only when the user is looking at the full
   * list — otherwise the drag would shuffle the *filtered subset* into
   * the global array, scrambling the underlying order. We disable the
   * drag handle when any filter is active.
   */
  const isReorderable = useMemo(
    () =>
      searchQuery.length === 0 &&
      activeFilters.lineId === undefined &&
      activeFilters.direction === undefined &&
      !activeFilters.commuteOnly,
    [searchQuery, activeFilters],
  );

  const handleDragEnd = useCallback(
    ({ data }: { data: typeof favoritesWithDetails }) => {
      if (!isReorderable) return;
      // Strip FavoriteWithDetails → FavoriteStation. The `station` lookup
      // is hydrated client-side and must not be persisted to Firestore.
      const reordered = data.map(({ station: _station, ...fav }) => fav);
      void reorderFavorites(reordered);
    },
    [isReorderable, reorderFavorites],
  );

  const renderFavoriteItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<typeof favoritesWithDetails[0]>) => (
      <DraggableFavoriteItem
        key={item.id}
        favorite={item}
        index={0}
        isEditing={editingFavoriteId === item.id}
        onEditToggle={() => handleEditToggle(item.id)}
        onRemove={() => handleRemoveFavorite(item.id, item.station?.name || '알 수 없는 역')}
        onPress={() => handleStationPress(item)}
        onSetStart={() => handleSetStart(item)}
        onSetEnd={() => handleSetEnd(item)}
        onSaveEdit={(updates) => handleSaveEdit(item.id, updates)}
        onMuteToggle={async () => {
          const nextEnabled = item.notificationEnabled === false;
          try {
            await setNotificationEnabled(item.id, nextEnabled);
          } catch {
            Alert.alert('오류', '알림 설정을 변경할 수 없습니다.');
          }
        }}
        drag={isReorderable ? drag : undefined}
        isActive={isActive}
        arrivalsEnabled={isFocused}
      />
    ),
    [
      editingFavoriteId,
      handleEditToggle,
      handleRemoveFavorite,
      handleStationPress,
      handleSetStart,
      handleSetEnd,
      handleSaveEdit,
      setNotificationEnabled,
      isReorderable,
      isFocused,
    ],
  );

  // Show loading state
  if (loading && favoritesWithDetails.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={semantic.labelStrong} />
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
          <AlertCircle size={64} color={semantic.labelAlt} />
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
          <LogIn size={64} color={semantic.labelAlt} />
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
      {/* Header — Phase 3 redesign: large title + sort/add round buttons */}
      <View style={styles.header}>
        <Text
          style={styles.headerTitle}
          accessibilityRole="header"
        >
          즐겨찾기
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.editButton}
            accessibilityLabel="편집"
            accessibilityRole="button"
            testID="favorites-edit-button"
            onPress={() => {
              // Phase B will wire this to a global edit/reorder mode that
              // exposes drag handles + bulk delete. For now the button is
              // present so the header layout matches the design contract.
              Alert.alert('편집', '편집 모드는 곧 제공될 예정입니다.');
            }}
          >
            <Text style={styles.editButtonText}>편집</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            accessibilityLabel="즐겨찾기 추가"
            accessibilityRole="button"
            testID="favorites-add-button"
            onPress={() => setIsSearchModalVisible(true)}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
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

      {/* Line filter chips — derived from the user's own favorites so the
          row is empty (and naturally hidden) when there are no favorites. */}
      {availableLineIds.length > 0 && (
        <FavoritesLineChips
          lineIds={availableLineIds}
          selectedLineId={activeFilters.lineId}
          onSelect={handleLineFilter}
          semantic={semantic}
          testID="favorites-line-chips"
        />
      )}

      {/* Content */}
      {hasNoFavorites ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={semantic.labelStrong}
            />
          }
        >
          {renderEmptyState()}
        </ScrollView>
      ) : hasNoResults ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={semantic.labelStrong}
            />
          }
        >
          {renderNoResults()}
        </ScrollView>
      ) : (
        <DraggableFlatList
          data={filteredFavorites}
          keyExtractor={(item) => item.id}
          renderItem={renderFavoriteItem}
          onDragEnd={handleDragEnd}
          containerStyle={styles.content}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={semantic.labelStrong}
            />
          }
          // Match Swipeable's drag activation: the long-press is owned by
          // each row's invisible handle overlay (DraggableFavoriteItem's
          // dragHandleArea). DraggableFlatList itself only animates.
          activationDistance={20}
        />
      )}

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

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s1,
      backgroundColor: 'transparent',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    editButton: {
      paddingHorizontal: 16,
      height: 36,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editButtonText: {
      fontSize: 14,
      lineHeight: 20,
      color: semantic.labelNeutral,
      fontFamily: weightToFontFamily('600'),
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.primaryNormal,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: WANTED_TOKENS.type.title2.size,
      lineHeight: WANTED_TOKENS.type.title2.lh,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing:
        WANTED_TOKENS.type.title2.size * WANTED_TOKENS.type.title2.tracking,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
    },
    listContainer: {
      padding: WANTED_TOKENS.spacing.s4,
    },
    favoriteItemContainer: {
      marginBottom: WANTED_TOKENS.spacing.s5,
    },
    aliasContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
    },
    aliasText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginLeft: WANTED_TOKENS.spacing.s1,
    },
    cardWrapper: {
      position: 'relative',
    },
    removeButton: {
      position: 'absolute',
      top: WANTED_TOKENS.spacing.s2,
      right: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.pill,
      padding: WANTED_TOKENS.spacing.s1,
    },
    metadataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
      gap: WANTED_TOKENS.spacing.s2,
    },
    metadataItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metadataText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    commuteIndicator: {
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    commuteText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelStrong,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: semantic.bgSubtle,
      padding: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      marginBottom: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    errorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: WANTED_TOKENS.spacing.s2,
    },
    errorTextContainer: {
      flex: 1,
    },
    errorText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginBottom: 2,
    },
    errorSubtext: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    deleteButton: {
      padding: WANTED_TOKENS.spacing.s1,
    },
    deleteIconButton: {
      padding: WANTED_TOKENS.spacing.s1,
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s4,
    },
    loadingText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s4,
    },
    errorTitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.primaryNormal,
      borderRadius: WANTED_TOKENS.radius.r5,
    },
    retryButtonText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s10,
      gap: WANTED_TOKENS.spacing.s3,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      lineHeight: WANTED_TOKENS.type.heading2.lh,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    emptySubtitle: {
      fontSize: WANTED_TOKENS.type.body2.size,
      color: semantic.labelAlt,
      textAlign: 'center',
      lineHeight: WANTED_TOKENS.type.body2.lh,
    },
    emptyButton: {
      marginTop: WANTED_TOKENS.spacing.s4,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.primaryNormal,
      borderRadius: WANTED_TOKENS.radius.r5,
    },
    emptyButtonText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
  });

// Memoize to prevent unnecessary re-renders
export default memo(FavoritesScreen);
