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

import React, { useCallback } from 'react';
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
import { StationCard } from '../../components/train/StationCard';
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
    refresh,
  } = useFavorites();

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
        onPress={() => navigation.navigate('MainTabs' as never)}
      >
        <Text style={styles.emptyButtonText}>역 찾아보기</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render favorite item
   */
  const renderFavoriteItem = (favorite: typeof favoritesWithDetails[0], index: number) => {
    const { station } = favorite;

    if (!station) {
      return (
        <View key={favorite.id} style={styles.errorCard}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle-outline" size={24} color={COLORS.text.secondary} />
            <View style={styles.errorTextContainer}>
              <Text style={styles.errorText}>역 정보를 불러올 수 없습니다</Text>
              <Text style={styles.errorSubtext}>
                역 ID: {favorite.stationId}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteIconButton}
            onPress={() => handleRemoveFavorite(favorite.id, '알 수 없는 역')}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View key={favorite.id} style={styles.favoriteItemContainer}>
        {/* Alias/Custom Name */}
        {favorite.alias && (
          <View style={styles.aliasContainer}>
            <Ionicons name="pricetag" size={14} color={COLORS.text.secondary} />
            <Text style={styles.aliasText}>{favorite.alias}</Text>
          </View>
        )}

        {/* Station Card */}
        <View style={styles.cardWrapper}>
          <StationCard
            station={station}
            onPress={() => handleStationPress(favorite)}
            showArrivals={true}
            enableFavorite={false}
            animationDelay={index * 50}
          />

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFavorite(favorite.id, station.name)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={24} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Direction & Commute Indicator */}
        <View style={styles.metadataRow}>
          {favorite.direction !== 'both' && (
            <View style={styles.metadataItem}>
              <Ionicons
                name={favorite.direction === 'up' ? 'arrow-up' : 'arrow-down'}
                size={14}
                color={COLORS.text.secondary}
              />
              <Text style={styles.metadataText}>
                {favorite.direction === 'up' ? '상행' : '하행'}
              </Text>
            </View>
          )}
          {favorite.isCommuteStation && (
            <View style={[styles.metadataItem, styles.commuteIndicator]}>
              <Ionicons name="briefcase" size={14} color={COLORS.black} />
              <Text style={styles.commuteText}>출퇴근</Text>
            </View>
          )}
        </View>
      </View>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>즐겨찾기</Text>
        <Text style={styles.headerSubtitle}>
          {favoritesWithDetails.length}개의 역
        </Text>
      </View>

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
        {favoritesWithDetails.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.listContainer}>
            {favoritesWithDetails.map((favorite, index) =>
              renderFavoriteItem(favorite, index)
            )}
          </View>
        )}
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
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
