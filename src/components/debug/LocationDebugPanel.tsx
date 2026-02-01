/**
 * Location Debug Panel Component
 * Displays real-time GPS coordinates and nearby station info for development debugging
 * Only renders in __DEV__ environment
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  ChevronUp,
  ChevronDown,
  MapPin,
  Navigation,
  Train,
  Clock,
  Crosshair,
} from 'lucide-react-native';

import { useLocation } from '@/hooks/useLocation';
import { useNearbyStations } from '@/hooks/useNearbyStations';
import { useTheme, ThemeColors } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { LocationCoordinates } from '@/services/location/locationService';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LocationDelta {
  deltaLat: number;
  deltaLng: number;
  distance: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format coordinate delta with sign
 */
const formatDelta = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(6)}`;
};

/**
 * Format distance for display
 */
const formatDistanceDisplay = (meters: number): string => {
  if (meters < 1) {
    return '<1m';
  }
  if (meters < 1000) {
    return `~${Math.round(meters)}m`;
  }
  return `~${(meters / 1000).toFixed(1)}km`;
};

/**
 * Get tracking status display
 */
const getTrackingStatus = (
  isTracking: boolean,
  hasPermission: boolean,
  error: string | null
): { label: string; color: string } => {
  if (error) {
    return { label: '에러', color: '#EB5757' };
  }
  if (!hasPermission) {
    return { label: '권한 없음', color: '#F2C94C' };
  }
  if (isTracking) {
    return { label: '추적 중', color: '#27AE60' };
  }
  return { label: '정지', color: '#757575' };
};

export const LocationDebugPanel: React.FC = () => {
  // Only render in development mode
  if (!__DEV__) {
    return null;
  }

  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [isExpanded, setIsExpanded] = useState(false);
  const previousLocationRef = useRef<LocationCoordinates | null>(null);
  const [delta, setDelta] = useState<LocationDelta | null>(null);

  // Location hook
  const {
    location,
    accuracy,
    isTracking,
    hasPermission,
    error: locationError,
    startTracking,
  } = useLocation({
    enableHighAccuracy: true,
    distanceFilter: 10, // More sensitive for debugging
  });

  // Nearby stations hook
  const {
    closestStation,
    lastUpdated,
    loading: stationsLoading,
  } = useNearbyStations({
    radius: 2000, // 2km
    maxStations: 1,
    autoUpdate: true,
  });

  // Calculate delta when location changes
  useEffect(() => {
    if (location && previousLocationRef.current) {
      const prev = previousLocationRef.current;
      const deltaLat = location.latitude - prev.latitude;
      const deltaLng = location.longitude - prev.longitude;
      const distance = calculateDistance(
        prev.latitude,
        prev.longitude,
        location.latitude,
        location.longitude
      );
      setDelta({ deltaLat, deltaLng, distance });
    }
    previousLocationRef.current = location;
  }, [location]);

  // Start tracking on mount if permission granted
  useEffect(() => {
    if (hasPermission && !isTracking) {
      startTracking();
    }
  }, [hasPermission, isTracking, startTracking]);

  const toggleExpanded = useCallback((): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  }, []);

  const trackingStatus = getTrackingStatus(isTracking, hasPermission, locationError);
  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  // Collapsed view content
  const collapsedContent = location ? (
    <Text style={styles.collapsedCoords}>
      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
      {accuracy ? ` \u00B1${Math.round(accuracy)}m` : ''}
    </Text>
  ) : (
    <Text style={styles.collapsedCoords}>위치 없음</Text>
  );

  return (
    <View style={styles.container}>
      {/* Header - Always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? '디버그 패널 접기' : '디버그 패널 펼치기'}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🔧</Text>
          {isExpanded ? (
            <Text style={styles.headerTitle}>Location Debug</Text>
          ) : (
            collapsedContent
          )}
        </View>
        <View style={styles.headerRight}>
          {isExpanded ? (
            <ChevronDown size={20} color={colors.textSecondary} />
          ) : (
            <ChevronUp size={20} color={colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.content}>
          {/* GPS Coordinates Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Crosshair size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>GPS 좌표</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>위도:</Text>
              <Text style={styles.value}>
                {location?.latitude.toFixed(6) ?? '-'}
              </Text>
              <Text style={styles.label}>경도:</Text>
              <Text style={styles.value}>
                {location?.longitude.toFixed(6) ?? '-'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>정확도:</Text>
              <Text style={styles.value}>
                {accuracy ? `\u00B1${Math.round(accuracy)}m` : '-'}
              </Text>
              <Text style={styles.label}>상태:</Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: trackingStatus.color },
                  ]}
                />
                <Text style={[styles.value, { color: trackingStatus.color }]}>
                  {trackingStatus.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Coordinate Delta Section */}
          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Navigation size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>좌표 변화</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>\u0394위도:</Text>
              <Text style={styles.value}>
                {delta ? formatDelta(delta.deltaLat) : '-'}
              </Text>
              <Text style={styles.label}>\u0394경도:</Text>
              <Text style={styles.value}>
                {delta ? formatDelta(delta.deltaLng) : '-'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>이동 거리:</Text>
              <Text style={styles.value}>
                {delta ? formatDistanceDisplay(delta.distance) : '-'}
              </Text>
            </View>
          </View>

          {/* Nearest Station Section */}
          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Train size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>가장 가까운 역</Text>
            </View>
            {stationsLoading ? (
              <Text style={styles.loadingText}>검색 중...</Text>
            ) : closestStation ? (
              <>
                <View style={styles.stationRow}>
                  <MapPin size={14} color={colors.primary} />
                  <Text style={styles.stationName}>
                    {closestStation.name} ({closestStation.lineId}호선)
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>역 좌표:</Text>
                  <Text style={styles.value}>
                    {closestStation.coordinates.latitude.toFixed(6)},{' '}
                    {closestStation.coordinates.longitude.toFixed(6)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>거리:</Text>
                  <Text style={styles.valueHighlight}>
                    {Math.round(closestStation.distance)}m
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.noDataText}>근처 역 없음</Text>
            )}
          </View>

          {/* Last Updated */}
          <View style={styles.divider} />
          <View style={styles.footer}>
            <Clock size={14} color={colors.textTertiary} />
            <Text style={styles.footerText}>
              마지막 업데이트: {formattedTime}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 100,
      left: SPACING.md,
      right: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      backgroundColor: colors.backgroundSecondary,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerRight: {
      marginLeft: SPACING.sm,
    },
    headerIcon: {
      fontSize: 16,
      marginRight: SPACING.sm,
    },
    headerTitle: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textPrimary,
    },
    collapsedCoords: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.textSecondary,
    },
    content: {
      paddingVertical: SPACING.md,
    },
    section: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    sectionTitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textSecondary,
      marginLeft: SPACING.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xs,
      flexWrap: 'wrap',
    },
    label: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      marginRight: SPACING.xs,
    },
    value: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.textPrimary,
      marginRight: SPACING.md,
    },
    valueHighlight: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.primary,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: SPACING.xs,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: SPACING.lg,
      marginVertical: SPACING.xs,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    stationName: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: colors.textPrimary,
      marginLeft: SPACING.xs,
    },
    loadingText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
    noDataText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textTertiary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
    },
    footerText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
      marginLeft: SPACING.xs,
    },
  });

export default LocationDebugPanel;
