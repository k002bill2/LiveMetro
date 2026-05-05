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
import { AlertCircle, Trash2, Pencil, XCircle, Briefcase } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY, WANTED_TOKENS, WantedSemanticTheme, weightToFontFamily } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';
import { FavoriteWithDetails } from '../../hooks/useFavorites';
import { useRealtimeTrains } from '../../hooks/useRealtimeTrains';
import { FavoriteEditForm } from './FavoriteEditForm';
import { FavoriteRow, Pill, type LineId } from '../design';

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

/**
 * Map favorite.direction to a human-friendly destination label that fits
 * the FavoriteRow layout. Returns undefined for unknown values so the row
 * gracefully omits the line.
 */
const directionToLabel = (
  direction?: 'up' | 'down' | 'both'
): string | undefined => {
  if (direction === 'up') return '상행 방면';
  if (direction === 'down') return '하행 방면';
  if (direction === 'both') return '양방향';
  return undefined;
};

export const DraggableFavoriteItem: React.FC<DraggableFavoriteItemProps> = ({
  favorite,
  index: _index,
  isEditing,
  onEditToggle,
  onRemove,
  onPress,
  onSetStart: _onSetStart,
  onSetEnd: _onSetEnd,
  onSaveEdit,
  isDragEnabled = false,
  arrivalsEnabled = true,
}) => {
  const { colors, isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(colors, semantic), [colors, semantic]);
  const { station } = favorite;

  // Per-row arrival fetch — replaces StationCard's internal polling.
  // Gated by `arrivalsEnabled` (parent uses useIsFocused) and disabled
  // when editing (no need to refresh during a non-visible card).
  const shouldFetchArrivals = !!station && arrivalsEnabled && !isEditing;
  const { trains } = useRealtimeTrains(station?.name ?? '', {
    enabled: shouldFetchArrivals,
    refetchInterval: 30_000,
  });

  // Pick the next train matching the favorite's direction (or the soonest
  // overall when 'both' / unknown). Returns minutes-until-arrival for the
  // FavoriteRow primary signal, or 0 when nothing is available.
  const nextMinutes = useMemo(() => {
    if (!trains?.length) return 0;
    const now = Date.now();
    const filtered = trains.filter((t) => {
      if (!t.arrivalTime) return false;
      if (favorite.direction === 'both' || !favorite.direction) return true;
      return t.direction === favorite.direction;
    });
    if (filtered.length === 0) return 0;
    const earliest = filtered.reduce((min, t) =>
      t.arrivalTime!.getTime() < min.arrivalTime!.getTime() ? t : min
    );
    const diffMin = Math.max(
      0,
      Math.ceil((earliest.arrivalTime!.getTime() - now) / 60_000)
    );
    return diffMin;
  }, [trains, favorite.direction]);

  // Lines passing through this station — bundle's FavoriteRow stacks up to 2
  // LineBadges (primary + first transfer).
  const linesForRow = useMemo<LineId[]>(() => {
    if (!station) return [];
    const all = [station.lineId, ...(station.transfers ?? [])];
    return all.slice(0, 2) as LineId[];
  }, [station]);

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
      {/* Phase 34: FavoriteRow atom replaces StationCard for the bundle's
          dense vertical row. Edit/Delete buttons remain as a small overlay
          at the row's top-right; they sit above the minutes label and
          surface most clearly during the brief edit interaction. */}
      <View style={styles.cardWrapper}>
        <FavoriteRow
          lines={linesForRow}
          stationName={station.name}
          nickname={favorite.alias ?? undefined}
          destinationLabel={directionToLabel(favorite.direction)}
          nextMinutes={nextMinutes}
          showDragHandle={isDragEnabled}
          onPress={onPress}
        />

        {/* Action Buttons Overlay (top-right). Smaller than the StationCard
            era because the row's right edge is occupied by the minutes
            label — a 24px chip is enough to remain tappable. */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, isEditing && styles.actionButtonActive]}
            onPress={onEditToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? '편집 완료' : '편집'}
          >
            <Pencil
              size={14}
              color={isEditing ? colors.textPrimary : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="즐겨찾기 삭제"
          >
            <XCircle size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Form */}
      <FavoriteEditForm
        favorite={favorite}
        isExpanded={isEditing}
        onSave={onSaveEdit}
        onCancel={onEditToggle}
      />

      {/* Commute pill — alias + direction are now rendered inside FavoriteRow,
          so the metadata row only carries the commute marker. Hidden during
          edit to keep the form focused. */}
      {!isEditing && favorite.isCommuteStation && (
        <View style={styles.metadataRow}>
          <Pill tone="neutral" size="sm" testID="favorite-commute-pill">
            <View style={styles.pillContent}>
              <Briefcase size={11} color={semantic.labelNeutral} />
              <Text style={styles.commuteTextPill}>출퇴근</Text>
            </View>
          </Pill>
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
    fontFamily: weightToFontFamily('700'),
    color: semantic.primaryPress,
  },
  commuteTextPill: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
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
