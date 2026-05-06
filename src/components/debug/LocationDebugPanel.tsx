/**
 * Location Debug Panel Component
 * Displays real-time GPS coordinates and nearby station info for development debugging
 * Only renders in __DEV__ environment.
 *
 * Phase 51 — migrated to Wanted Design System tokens.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { LocationCoordinates, NearbyStation } from '@/services/location/locationService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LocationDelta {
  deltaLat: number;
  deltaLng: number;
  distance: number;
}

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000;
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

const formatDelta = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(6)}`;
};

const formatDistanceDisplay = (meters: number): string => {
  if (meters < 1) return '<1m';
  if (meters < 1000) return `~${Math.round(meters)}m`;
  return `~${(meters / 1000).toFixed(1)}km`;
};

const getTrackingStatus = (
  isTracking: boolean,
  hasPermission: boolean,
  error: string | null
): { label: string; color: string } => {
  if (error) return { label: '에러', color: WANTED_TOKENS.status.red500 };
  if (!hasPermission) return { label: '권한 없음', color: WANTED_TOKENS.status.yellow500 };
  if (isTracking) return { label: '추적 중', color: WANTED_TOKENS.status.green500 };
  return { label: '정지', color: WANTED_TOKENS.neutral[700] };
};

interface LocationDebugPanelProps {
  closestStation?: NearbyStation | null;
  lastUpdated?: Date | null;
  stationsLoading?: boolean;
}

export const LocationDebugPanel: React.FC<LocationDebugPanelProps> = ({
  closestStation = null,
  lastUpdated = null,
  stationsLoading = false,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [isExpanded, setIsExpanded] = useState(false);
  const previousLocationRef = useRef<LocationCoordinates | null>(null);
  const [delta, setDelta] = useState<LocationDelta | null>(null);

  const {
    location,
    accuracy,
    isTracking,
    hasPermission,
    error: locationError,
    startTracking,
  } = useLocation({
    enableHighAccuracy: true,
    distanceFilter: 10,
  });

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

  useEffect(() => {
    if (hasPermission && !isTracking) {
      startTracking();
    }
  }, [hasPermission, isTracking, startTracking]);

  const toggleExpanded = useCallback((): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  }, []);

  if (!__DEV__) return null;

  const trackingStatus = getTrackingStatus(isTracking, hasPermission, locationError);
  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  const collapsedContent = location ? (
    <Text style={styles.collapsedCoords}>
      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
      {accuracy ? ` ±${Math.round(accuracy)}m` : ''}
    </Text>
  ) : (
    <Text style={styles.collapsedCoords}>위치 없음</Text>
  );

  return (
    <View style={styles.container}>
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
            <ChevronDown size={20} color={semantic.labelNeutral} />
          ) : (
            <ChevronUp size={20} color={semantic.labelNeutral} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Crosshair size={16} color={semantic.labelNeutral} />
              <Text style={styles.sectionTitle}>GPS 좌표</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>위도:</Text>
              <Text style={styles.value}>{location?.latitude.toFixed(6) ?? '-'}</Text>
              <Text style={styles.label}>경도:</Text>
              <Text style={styles.value}>{location?.longitude.toFixed(6) ?? '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>정확도:</Text>
              <Text style={styles.value}>
                {accuracy ? `±${Math.round(accuracy)}m` : '-'}
              </Text>
              <Text style={styles.label}>상태:</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: trackingStatus.color }]} />
                <Text style={[styles.value, { color: trackingStatus.color }]}>
                  {trackingStatus.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Navigation size={16} color={semantic.labelNeutral} />
              <Text style={styles.sectionTitle}>좌표 변화</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Δ위도:</Text>
              <Text style={styles.value}>{delta ? formatDelta(delta.deltaLat) : '-'}</Text>
              <Text style={styles.label}>Δ경도:</Text>
              <Text style={styles.value}>{delta ? formatDelta(delta.deltaLng) : '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>이동 거리:</Text>
              <Text style={styles.value}>
                {delta ? formatDistanceDisplay(delta.distance) : '-'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Train size={16} color={semantic.labelNeutral} />
              <Text style={styles.sectionTitle}>가장 가까운 역</Text>
            </View>
            {stationsLoading ? (
              <Text style={styles.loadingText}>검색 중...</Text>
            ) : closestStation ? (
              <>
                <View style={styles.stationRow}>
                  <MapPin size={14} color={WANTED_TOKENS.blue[500]} />
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

          <View style={styles.divider} />
          <View style={styles.footer}>
            <Clock size={14} color={semantic.labelAlt} />
            <Text style={styles.footerText}>
              마지막 업데이트: {formattedTime}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 100,
      left: WANTED_TOKENS.spacing.s3,
      right: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      ...WANTED_TOKENS.shadow.popover,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      backgroundColor: semantic.bgSubtlePage,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerRight: {
      marginLeft: WANTED_TOKENS.spacing.s2,
    },
    headerIcon: {
      fontSize: 16,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    headerTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    collapsedCoords: {
      fontSize: 13,
      fontFamily: MONO_FONT,
      color: semantic.labelNeutral,
    },
    content: {
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    section: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelNeutral,
      marginLeft: WANTED_TOKENS.spacing.s1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s1,
      flexWrap: 'wrap',
    },
    label: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginRight: WANTED_TOKENS.spacing.s1,
    },
    value: {
      fontSize: 13,
      fontFamily: MONO_FONT,
      color: semantic.labelStrong,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    valueHighlight: {
      fontSize: 13,
      fontFamily: MONO_FONT,
      color: WANTED_TOKENS.blue[500],
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: WANTED_TOKENS.spacing.s1,
    },
    divider: {
      height: 1,
      backgroundColor: semantic.lineSubtle,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginVertical: WANTED_TOKENS.spacing.s1,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    stationName: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginLeft: WANTED_TOKENS.spacing.s1,
    },
    loadingText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      fontStyle: 'italic',
    },
    noDataText: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s2,
    },
    footerText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginLeft: WANTED_TOKENS.spacing.s1,
    },
  });

export default LocationDebugPanel;
