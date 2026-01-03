/**
 * Draggable Favorite Item Component
 * Wraps StationCard with edit and drag functionality
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
import { FavoriteWithDetails } from '../../hooks/useFavorites';
import { StationCard } from '../train/StationCard';
import { FavoriteEditForm } from './FavoriteEditForm';

interface DraggableFavoriteItemProps {
  favorite: FavoriteWithDetails;
  index: number;
  isEditing: boolean;
  onEditToggle: () => void;
  onRemove: () => void;
  onPress: () => void;
  onSaveEdit: (updates: {
    alias?: string | null;
    direction?: 'up' | 'down' | 'both';
    isCommuteStation?: boolean;
  }) => Promise<void>;
  isDragEnabled?: boolean; // For future drag implementation
}

export const DraggableFavoriteItem: React.FC<DraggableFavoriteItemProps> = ({
  favorite,
  index,
  isEditing,
  onEditToggle,
  onRemove,
  onPress,
  onSaveEdit,
  isDragEnabled = false,
}) => {
  const { station } = favorite;

  /**
   * Render error card if station data is missing
   */
  if (!station) {
    return (
      <View style={styles.errorCard}>
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
          onPress={onRemove}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.text.secondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Alias/Custom Name */}
      {favorite.alias && (
        <View style={styles.aliasContainer}>
          <Ionicons name="pricetag" size={14} color={COLORS.text.secondary} />
          <Text style={styles.aliasText}>{favorite.alias}</Text>
        </View>
      )}

      {/* Station Card with Action Buttons */}
      <View style={styles.cardWrapper}>
        <StationCard
          station={station}
          onPress={onPress}
          showArrivals={true}
          enableFavorite={false}
          animationDelay={index * 50}
        />

        {/* Action Buttons Overlay */}
        <View style={styles.actionButtons}>
          {/* Edit Button */}
          <TouchableOpacity
            style={[styles.actionButton, isEditing && styles.actionButtonActive]}
            onPress={onEditToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isEditing ? 'pencil' : 'pencil-outline'}
              size={20}
              color={isEditing ? COLORS.black : COLORS.text.secondary}
            />
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={24} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Drag Handle (shown when drag is enabled - Phase 3) */}
        {isDragEnabled && (
          <View style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={24} color={COLORS.gray[400]} />
          </View>
        )}
      </View>

      {/* Edit Form */}
      <FavoriteEditForm
        favorite={favorite}
        isExpanded={isEditing}
        onSave={onSaveEdit}
        onCancel={onEditToggle}
      />

      {/* Direction & Commute Metadata (hidden when editing) */}
      {!isEditing && (
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  actionButtons: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    padding: SPACING.xs,
  },
  actionButtonActive: {
    backgroundColor: COLORS.surface.background,
  },
  dragHandle: {
    position: 'absolute',
    left: SPACING.sm,
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: COLORS.gray[200],
    borderRadius: RADIUS.sm,
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
  deleteIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
});
