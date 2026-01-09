/**
 * Station Card Component - Modern Design
 * Displays individual station information with selection state, favorites, real-time arrivals, and animations
 * Minimal grayscale design with black accent
 *
 * Features:
 * - Favorite/bookmark toggle with user persistence
 * - Real-time train arrival preview (up to 2 upcoming trains)
 * - Smooth entrance and interaction animations
 * - Modern grayscale design system
 */

import {
  Star,
  Heart,
  Shuffle,
  TrainFront,
  ArrowUp,
  ArrowDown,
  MapPin,
  Navigation,
  CheckCircle,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Pressable, GestureResponderEvent } from 'react-native';

import { useRealtimeTrains } from '../../hooks/useRealtimeTrains';
import { Station } from '../../models/train';
import { useAuth } from '../../services/auth/AuthContext';
import { RADIUS, SPACING, TRANSITIONS, TYPOGRAPHY } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';
import { getSubwayLineColor } from '../../utils/colorUtils';

interface StationCardProps {
  station: Station;
  isSelected?: boolean;
  onPress?: () => void;
  showDistance?: boolean;
  distance?: number;
  onSetStart?: () => void;
  onSetEnd?: () => void;
  /** Show real-time arrival preview (default: true) */
  showArrivals?: boolean;
  /** Enable favorite toggle button (default: true) */
  enableFavorite?: boolean;
  /** Delay before entrance animation in ms (for staggered lists) */
  animationDelay?: number;
}

export const StationCard: React.FC<StationCardProps> = memo(
  ({
    station,
    isSelected = false,
    onPress,
    showDistance = false,
    distance,
    onSetStart,
    onSetEnd,
    showArrivals = true,
    enableFavorite = true,
    animationDelay = 0,
  }) => {
    // ============ HOOKS ============
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user, updateUserProfile } = useAuth();

    // Animation values
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const favoriteScaleAnim = useRef(new Animated.Value(1)).current;

    // Local state for optimistic UI updates
    const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

    // Real-time train data (only fetch if showArrivals is enabled)
    const { trains, loading: trainsLoading } = useRealtimeTrains(station.name, {
      enabled: showArrivals,
      refetchInterval: 30000, // 30 seconds
      staleTime: 60000, // 1 minute
    });

    // ============ ANIMATIONS ============
    // Entrance animation on mount
    useEffect(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: TRANSITIONS.duration.base,
          delay: animationDelay,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: TRANSITIONS.duration.base,
          delay: animationDelay,
          useNativeDriver: true,
        }),
      ]).start();
    }, [scaleAnim, fadeAnim, animationDelay]);

    // ============ FAVORITES LOGIC ============
    const isFavorite = useMemo(() => {
      if (!user?.preferences?.favoriteStations) return false;
      return user.preferences.favoriteStations.some(
        fav => fav.stationId === station.id && fav.lineId === station.lineId
      );
    }, [user?.preferences?.favoriteStations, station.id, station.lineId]);

    const toggleFavorite = useCallback(
      async (e: GestureResponderEvent): Promise<void> => {
        // Prevent event bubbling to parent TouchableOpacity
        e.stopPropagation();

        if (!user) {
          return;
        }

        setIsTogglingFavorite(true);

        // Animate favorite button
        Animated.sequence([
          Animated.timing(favoriteScaleAnim, {
            toValue: 1.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(favoriteScaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        try {
          const currentFavorites = user.preferences?.favoriteStations || [];
          let updatedFavorites;

          if (isFavorite) {
            // Remove from favorites
            updatedFavorites = currentFavorites.filter(
              fav => !(fav.stationId === station.id && fav.lineId === station.lineId)
            );
          } else {
            // Add to favorites
            const newFavorite = {
              id: `fav_${station.id}_${Date.now()}`,
              stationId: station.id,
              lineId: station.lineId,
              alias: null,
              direction: 'both' as const,
              isCommuteStation: false,
              addedAt: new Date(),
            };
            updatedFavorites = [...currentFavorites, newFavorite];
          }

          await updateUserProfile({
            preferences: {
              ...user.preferences,
              favoriteStations: updatedFavorites,
            },
          });
        } catch {
          // Error toggling favorite
        } finally {
          setIsTogglingFavorite(false);
        }
      },
      [user, updateUserProfile, isFavorite, station, favoriteScaleAnim]
    );

    // ============ PRESS HANDLERS ============
    const handlePress = useCallback((): void => {
      if (onPress) {
        // Future: Add haptic feedback for better UX when available
        onPress();
      }
    }, [onPress]);

    // ============ COMPUTED VALUES ============
    // Memoize line color calculation
    const lineColor = useMemo(() => getSubwayLineColor(station.lineId), [station.lineId]);

    // Memoize distance formatting
    const formattedDistance = useMemo(() => {
      if (!showDistance || distance === undefined) return null;

      if (distance < 1) {
        return `${Math.round(distance * 1000)}m`;
      }
      return `${distance.toFixed(1)}km`;
    }, [distance, showDistance]);

    // Process arrival preview data (show up to 2 upcoming trains)
    const upcomingArrivals = useMemo(() => {
      if (!showArrivals || !trains || trains.length === 0) return [];

      return trains
        .filter(train => train.arrivalTime !== null)
        .sort((a, b) => {
          if (!a.arrivalTime || !b.arrivalTime) return 0;
          return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
        })
        .slice(0, 2)
        .map(train => {
          if (!train.arrivalTime) return null;

          const now = new Date();
          const arrivalTime = new Date(train.arrivalTime);
          const diffMs = arrivalTime.getTime() - now.getTime();
          const diffMinutes = Math.ceil(diffMs / (1000 * 60));

          let displayText: string;
          if (diffMinutes <= 0) {
            displayText = '도착';
          } else if (diffMinutes === 1) {
            displayText = '1분 후';
          } else {
            displayText = `${diffMinutes}분 후`;
          }

          return {
            direction: train.direction === 'up' ? '상행' : '하행',
            time: displayText,
            isImmediate: diffMinutes <= 1,
            destination: train.finalDestination,
          };
        })
        .filter(Boolean);
    }, [trains, showArrivals]);

    return (
      <Animated.View
        style={[
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.container, isSelected && styles.selectedContainer]}
          onPress={handlePress}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`${station.name} 역, ${station.lineId}호선${station.transfers && station.transfers.length > 0 ? `, 환승역: ${station.transfers.join(', ')}호선` : ''}${formattedDistance ? `, 거리: ${formattedDistance}` : ''}${isFavorite ? ', 즐겨찾기됨' : ''}`}
          accessibilityHint={isSelected ? '현재 선택된 역입니다' : '탭하여 이 역의 실시간 정보를 확인하세요'}
          accessibilityState={{ selected: isSelected }}
          testID={`station-card-${station.id}`}
        >
          {/* Accent bar */}
          <View style={[styles.accentBar, { backgroundColor: lineColor }]} />

          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.stationInfo}>
              <View style={styles.stationNameRow}>
                <Text style={[styles.stationName, isSelected && styles.selectedText]}>{station.name}</Text>
                {isFavorite && (
                  <View style={styles.favoriteBadge}>
                    <Star size={12} fill={colors.textPrimary} color={colors.textPrimary} />
                  </View>
                )}
              </View>
              <Text style={styles.stationNameEn}>{station.nameEn}</Text>
            </View>

            <View style={styles.headerRight}>
              {formattedDistance && <Text style={styles.distance}>{formattedDistance}</Text>}

              {/* Favorite Toggle Button */}
              {enableFavorite && user && (
                <Animated.View style={{ transform: [{ scale: favoriteScaleAnim }] }}>
                  <Pressable
                    style={styles.favoriteButton}
                    onPress={toggleFavorite}
                    disabled={isTogglingFavorite}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={isFavorite ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                  >
                    <Heart
                      size={22}
                      color={isFavorite ? colors.textPrimary : colors.textTertiary}
                      fill={isFavorite ? colors.textPrimary : 'transparent'}
                    />
                  </Pressable>
                </Animated.View>
              )}
            </View>
          </View>

          {/* Line Info */}
          <View style={styles.lineInfo}>
            <View style={[styles.lineIndicator, { backgroundColor: lineColor }]} />
            <Text style={styles.lineText}>{station.lineId}호선</Text>
          </View>

          {/* Transfer Info */}
          {station.transfers && station.transfers.length > 0 && (
            <View style={styles.transfersContainer}>
              <Shuffle size={14} color={colors.textSecondary} />
              <Text style={styles.transfersText}>
                환승: {station.transfers.map(lineId => `${lineId}호선`).join(', ')}
              </Text>
            </View>
          )}

          {/* Real-time Arrival Preview */}
          {showArrivals && upcomingArrivals.length > 0 && (
            <View style={styles.arrivalsContainer}>
              <View style={styles.arrivalsHeader}>
                <TrainFront size={14} color={colors.textSecondary} />
                <Text style={styles.arrivalsHeaderText}>실시간 도착 정보</Text>
              </View>
              {upcomingArrivals.map((arrival: any, index: number) => (
                <View key={index} style={styles.arrivalItem}>
                  <View style={styles.arrivalDirection}>
                    {arrival.direction === '상행' ? (
                       <ArrowUp size={12} color={lineColor} />
                    ) : (
                       <ArrowDown size={12} color={lineColor} />
                    )}
                    <Text style={[styles.arrivalDirectionText, { color: lineColor }]}>{arrival.direction}</Text>
                  </View>
                  <Text style={[styles.arrivalTime, arrival.isImmediate && styles.arrivalTimeImmediate]}>
                    {arrival.time}
                  </Text>
                  {arrival.destination && <Text style={styles.arrivalDestination}>→ {arrival.destination}</Text>}
                </View>
              ))}
            </View>
          )}

          {showArrivals && trainsLoading && upcomingArrivals.length === 0 && (
            <View style={styles.arrivalsLoading}>
              <Text style={styles.arrivalsLoadingText}>도착 정보 조회 중...</Text>
            </View>
          )}

          {/* Route Search Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, styles.startButton]}
              onPress={e => {
                e.stopPropagation();
                onSetStart?.();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MapPin size={14} color={colors.textInverse} />
              <Text style={styles.actionButtonText}>출발</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.endButton]}
              onPress={e => {
                e.stopPropagation();
                onSetEnd?.();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Navigation size={14} color={colors.textInverse} />
              <Text style={styles.actionButtonText}>도착</Text>
            </Pressable>
          </View>

          {/* Selection Indicator */}
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <CheckCircle size={20} color={colors.textPrimary} />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

// Set display name for debugging
StationCard.displayName = 'StationCard';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginRight: SPACING.md,
    minWidth: 240,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  selectedContainer: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  stationInfo: {
    flex: 1,
  },
  stationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.tight,
  },
  selectedText: {
    color: colors.primary,
  },
  favoriteBadge: {
    marginLeft: SPACING.xs,
    backgroundColor: colors.surface,
    borderRadius: RADIUS.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  stationNameEn: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  distance: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  favoriteButton: {
    padding: 4,
  },
  lineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  lineIndicator: {
    width: 14,
    height: 14,
    borderRadius: RADIUS.full,
    marginRight: SPACING.xs,
  },
  lineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  transfersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  transfersText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  // Arrivals Section
  arrivalsContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  arrivalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  arrivalsHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  arrivalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: SPACING.sm,
  },
  arrivalDirection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 45,
  },
  arrivalDirectionText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginLeft: 2,
  },
  arrivalTime: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: colors.textPrimary,
    minWidth: 60,
  },
  arrivalTimeImmediate: {
    color: colors.error,
  },
  arrivalDestination: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textTertiary,
    flex: 1,
  },
  arrivalsLoading: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  arrivalsLoadingText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  startButton: {
    backgroundColor: colors.info,
  },
  endButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    color: colors.textInverse,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  selectedIndicator: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
});
