/**
 * Draggable Favorite Item Component
 * Wraps StationCard with edit and drag functionality
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AlertCircle, Trash2, Tag, Pencil, XCircle, GripVertical, ArrowUp, ArrowDown, Briefcase } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY, WANTED_TOKENS, WantedSemanticTheme } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';
import { FavoriteWithDetails } from '../../hooks/useFavorites';
import { StationCard } from '../train/StationCard';
import { FavoriteEditForm } from './FavoriteEditForm';
import { Pill } from '../design';

interface DraggableFavoriteItemProps {
  favorite: FavoriteWithDetails;
  index: number;
  isEditing: boolean;
  onEditToggle: () => void;
  onRemove: () => void;
  onPress: () => void;
  onSetStart?: () => void;
  onSetEnd?: () => void;
  onSaveEdit: (updates: {
    alias?: string | null;
    direction?: 'up' | 'down' | 'both';
    isCommuteStation?: boolean;
  }) => Promise<void>;
  isDragEnabled?: boolean; // For future drag implementation
  /**
   * Forwarded to StationCard so favorites stop polling Seoul API when the
   * Favorites screen is unfocused (e.g. user navigates to SubwayMap).
   * Pass `useIsFocused()` from the parent screen.
   */
  arrivalsEnabled?: boolean;
}

export const DraggableFavoriteItem: React.FC<DraggableFavoriteItemProps> = ({
  favorite,
  index,
  isEditing,
  onEditToggle,
  onRemove,
  onPress,
  onSetStart,
  onSetEnd,
  onSaveEdit,
  isDragEnabled = false,
  arrivalsEnabled = true,
}) => {
  const { colors, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(colors, semantic), [colors, semantic]);
  const { station } = favorite;

  /**
   * Render error card if station data is missing
   */
  if (!station) {
    return (
      <View style={styles.errorCard}>
        <View style={styles.errorContent}>
          <AlertCircle size={24} color={colors.textSecondary} />
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
          <Trash2 size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Station Card with Action Buttons */}
      <View style={styles.cardWrapper}>
        <StationCard
          station={station}
          onPress={onPress}
          onSetStart={onSetStart}
          onSetEnd={onSetEnd}
          showArrivals={true}
          arrivalsEnabled={arrivalsEnabled}
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
            <Pencil
              size={20}
              color={isEditing ? colors.textPrimary : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XCircle size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Drag Handle (shown when drag is enabled - Phase 3) */}
        {isDragEnabled && (
          <View style={styles.dragHandle}>
            <GripVertical size={24} color={colors.textTertiary} />
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

      {/* Alias, Direction & Commute Metadata (hidden when editing).
          Phase 3B/5: alias + 출퇴근은 Pill atomic으로 시각 정렬 (디자인의
          nickname Pill 패턴과 동일). 방향 화살표는 inline icon 유지. */}
      {!isEditing && (
        <View style={styles.metadataRow}>
          {favorite.alias && (
            <Pill tone="primary" size="sm" testID="favorite-alias-pill">
              <View style={styles.pillContent}>
                <Tag size={11} color={semantic.primaryPress} />
                <Text style={styles.pillText}>{favorite.alias}</Text>
              </View>
            </Pill>
          )}
          <View style={styles.metadataItem}>
            {favorite.direction === 'both' ? (
              <>
                <ArrowUp size={14} color={colors.textSecondary} />
                <ArrowDown size={14} color={colors.textSecondary} />
              </>
            ) : favorite.direction === 'down' ? (
              <ArrowDown size={14} color={colors.textSecondary} />
            ) : (
              <ArrowUp size={14} color={colors.textSecondary} />
            )}
          </View>
          {favorite.isCommuteStation && (
            <Pill tone="neutral" size="sm" testID="favorite-commute-pill">
              <View style={styles.pillContent}>
                <Briefcase size={11} color={semantic.labelNeutral} />
                <Text style={styles.commuteTextPill}>출퇴근</Text>
              </View>
            </Pill>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors, semantic: WantedSemanticTheme) => {
  return StyleSheet.create({
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
    color: colors.textSecondary,
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
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: semantic.bgBase,
    borderWidth: 1,
    borderColor: semantic.lineSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: semantic.primaryBg,
    borderColor: semantic.primaryNormal,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: semantic.primaryPress,
  },
  commuteTextPill: {
    fontSize: 11,
    fontWeight: '700',
    color: semantic.labelNeutral,
  },
  dragHandle: {
    position: 'absolute',
    left: SPACING.sm,
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: colors.borderLight,
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
    color: colors.textSecondary,
  },
  commuteIndicator: {
    backgroundColor: colors.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  aliasIndicator: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  commuteText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textPrimary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
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
    color: colors.textSecondary,
    marginBottom: 2,
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textTertiary,
  },
  deleteIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  });
};
