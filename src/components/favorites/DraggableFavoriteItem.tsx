/**
 * Draggable Favorite Item Component
 * Wraps StationCard with edit and drag functionality
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AlertCircle, Trash2, Bell, BellOff, Briefcase } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
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
  /**
   * Phase B placeholder: invoked when the user taps the swipe-out
   * "알림 끄기" action. Phase C will wire this to a per-favorite
   * notificationEnabled field; for now it can be any side-effect (e.g.
   * an Alert) supplied by the caller.
   */
  onMuteToggle?: () => void;
  /**
   * Phase D drag-and-drop reorder. Provided by react-native-draggable-flatlist's
   * `renderItem`. When defined, long-pressing the ⋮⋮ handle area starts
   * the drag gesture. Undefined when reorder is disabled (search/filter
   * active) so the row falls back to a static card.
   */
  drag?: () => void;
  /** Whether this card is currently being dragged (drives elevation/opacity). */
  isActive?: boolean;
  isDragEnabled?: boolean; // legacy — kept for callers that still pass it
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
  onMuteToggle,
  drag,
  isActive = false,
  isDragEnabled: _isDragEnabled = false,
  arrivalsEnabled = true,
}) => {
  // Imperatively close the swipe drawer after an action so the row snaps
  // back to its resting position once the user has decided.
  const swipeableRef = useRef<Swipeable>(null);

  const handleMute = useCallback(() => {
    swipeableRef.current?.close();
    onMuteToggle?.();
  }, [onMuteToggle]);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    onRemove();
  }, [onRemove]);
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

  // Phase C: notification flag drives whether the swipe action mutes or
  // unmutes. `notificationEnabled === undefined` is treated as ON, so
  // pre-existing favorites without the field default to "알림 끄기".
  const isNotificationOn = favorite.notificationEnabled !== false;
  const muteLabel = isNotificationOn ? '알림 끄기' : '알림 켜기';
  const MuteIcon = isNotificationOn ? BellOff : Bell;

  // Phase B: right-side swipe drawer with [알림 끄기/켜기] [삭제]. The
  // drawer mounts only while the user is dragging — Swipeable handles
  // its own visibility, so this function just describes layout.
  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.swipeAction, styles.swipeActionMute]}
        onPress={handleMute}
        accessibilityLabel={`${station.name}역 ${muteLabel}`}
        accessibilityRole="button"
        testID="favorite-swipe-mute"
      >
        <MuteIcon size={20} color={semantic.labelStrong} />
        <Text style={styles.swipeActionMuteLabel}>{muteLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.swipeAction, styles.swipeActionDelete]}
        onPress={handleDelete}
        accessibilityLabel={`${station.name}역 즐겨찾기 삭제`}
        accessibilityRole="button"
        testID="favorite-swipe-delete"
      >
        <Trash2 size={20} color="#FFFFFF" />
        <Text style={styles.swipeActionDeleteLabel}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, isActive && styles.containerDragActive]}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        friction={1.6}
        overshootRight={false}
        containerStyle={styles.swipeableContainer}
        // Disable swipe while a drag is in flight so the two gestures don't
        // fight over the same touch — users almost never want to mute and
        // reorder simultaneously.
        enabled={!isActive}
      >
        <View style={styles.cardInner}>
          <FavoriteRow
            lines={linesForRow}
            stationName={station.name}
            nickname={favorite.alias ?? undefined}
            destinationLabel={directionToLabel(favorite.direction)}
            nextMinutes={nextMinutes}
            showDragHandle
            onPress={onPress}
          />
          {drag && (
            <TouchableOpacity
              style={styles.dragHandleArea}
              onLongPress={drag}
              // Short tap on the handle area should still navigate the
              // user to StationDetail — without forwarding onPress here
              // the overlay would silently swallow taps on the card's
              // left edge (Gemini cross-review catch).
              onPress={onPress}
              delayLongPress={150}
              accessibilityRole="button"
              accessibilityLabel={`${station.name}역 순서 이동 (꾹 누르고 드래그)`}
              testID="favorite-drag-handle"
            />
          )}
        </View>
      </Swipeable>

      {/* Edit Form — entered via the upcoming global "편집" mode (Phase B+).
          Hidden by default; isEditing is currently never true post-overlay
          removal but we keep the integration point so the per-favorite
          edit UI doesn't have to be re-plumbed when the global mode lands. */}
      <FavoriteEditForm
        favorite={favorite}
        isExpanded={isEditing}
        onSave={onSaveEdit}
        onCancel={onEditToggle}
      />

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
  containerDragActive: {
    // Lift the card while it's being reordered. Both shadow and elevation
    // are set so iOS and Android show consistent depth.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  cardInner: {
    position: 'relative',
  },
  dragHandleArea: {
    // Invisible touch overlay sized to FavoriteRow's left padding (16) +
    // GripVertical icon (16) + a few pixels of breathing room. Lives
    // above the row so long-press triggers drag instead of card press.
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'transparent',
    zIndex: 2,
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
  swipeableContainer: {
    // Match FavoriteRow's outer radius so swipe-revealed actions align
    // with the card's corners instead of bleeding past them.
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeActions: {
    flexDirection: 'row',
    height: '100%',
  },
  swipeAction: {
    width: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeActionMute: {
    backgroundColor: semantic.bgSubtle,
  },
  swipeActionMuteLabel: {
    fontSize: 12,
    color: semantic.labelStrong,
    fontFamily: weightToFontFamily('700'),
  },
  swipeActionDelete: {
    backgroundColor: '#FF3B30',
  },
  swipeActionDeleteLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: weightToFontFamily('700'),
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
