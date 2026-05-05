/**
 * Route Preview Component
 * Visual representation of commute route with stations and connections.
 *
 * Phase 49 — migrated to Wanted Design System tokens. Subway line colors
 * now resolve through getSubwayLineColor utility (consistent with
 * TransferStationList commit `779086d` and JourneyStrip atom).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  GitBranch,
  Clock,
  ArrowLeftRight,
  MapPin,
  Flag
} from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { routeToSteps, CommuteRoute } from '@/models/commute';

interface RoutePreviewProps {
  route: Partial<CommuteRoute>;
  showTime?: boolean;
  compact?: boolean;
}

export const RoutePreview: React.FC<RoutePreviewProps> = ({
  route,
  showTime = true,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const steps = routeToSteps(route);
  const hasRoute = steps.length >= 2;

  if (!hasRoute) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <GitBranch
          size={32}
          color={semantic.lineNormal}
        />
        <Text style={styles.emptyText}>경로를 설정해주세요</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {showTime && route.departureTime && (
        <View style={styles.timeContainer}>
          <Clock
            size={16}
            color={semantic.labelAlt}
          />
          <Text style={styles.timeText}>{formatTime(route.departureTime)}</Text>
        </View>
      )}

      <View style={styles.routeContainer}>
        {steps.map((step, index) => (
          <View key={`${step.stationId}-${index}`} style={styles.stepContainer}>
            {/* Connection Line */}
            {index > 0 && (
              <View style={styles.connectionContainer}>
                <View
                  style={[
                    styles.connectionLine,
                    {
                      backgroundColor:
                        step.type === 'transfer'
                          ? semantic.lineNormal
                          : getSubwayLineColor(step.lineId),
                    },
                  ]}
                />
                {step.type === 'transfer' && (
                  <View style={styles.transferBadge}>
                    <ArrowLeftRight
                      size={12}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </View>
            )}

            {/* Station Node */}
            <View style={styles.stationNode}>
              <View
                style={[
                  styles.stationDot,
                  step.type === 'departure' && styles.stationDotDeparture,
                  step.type === 'arrival' && styles.stationDotArrival,
                  step.type === 'transfer' && styles.stationDotTransfer,
                  { borderColor: getSubwayLineColor(step.lineId) },
                ]}
              >
                {step.type === 'departure' && (
                  <MapPin size={12} color={WANTED_TOKENS.blue[500]} />
                )}
                {step.type === 'arrival' && (
                  <Flag size={12} color={WANTED_TOKENS.status.red500} />
                )}
                {step.type === 'transfer' && (
                  <View
                    style={[
                      styles.transferDotInner,
                      { backgroundColor: getSubwayLineColor(step.lineId) },
                    ]}
                  />
                )}
              </View>

              <View style={styles.stationInfo}>
                <Text
                  style={[
                    styles.stationName,
                    compact && styles.stationNameCompact,
                  ]}
                  numberOfLines={1}
                >
                  {step.stationName}
                </Text>
                {!compact && (
                  <View style={styles.stationMeta}>
                    <View
                      style={[
                        styles.lineTag,
                        { backgroundColor: getSubwayLineColor(step.lineId) },
                      ]}
                    >
                      <Text style={styles.lineTagText}>{step.lineId}호선</Text>
                    </View>
                    {step.type === 'departure' && (
                      <Text style={styles.stepLabel}>출발</Text>
                    )}
                    {step.type === 'arrival' && (
                      <Text style={styles.stepLabel}>도착</Text>
                    )}
                    {step.type === 'transfer' && (
                      <Text style={styles.stepLabelTransfer}>환승</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Format time from HH:mm to display format
const formatTime = (time: string): string => {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const period = hours >= 12 ? '오후' : '오전';
  const displayHours = hours % 12 || 12;
  return `${period} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    containerCompact: {
      padding: WANTED_TOKENS.spacing.s3,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s6,
    },
    emptyText: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
      paddingBottom: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    timeText: {
      marginLeft: WANTED_TOKENS.spacing.s1,
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    routeContainer: {
      paddingLeft: WANTED_TOKENS.spacing.s2,
    },
    stepContainer: {
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    connectionContainer: {
      position: 'absolute',
      left: 11,
      top: -WANTED_TOKENS.spacing.s3,
      height: WANTED_TOKENS.spacing.s3,
      alignItems: 'center',
    },
    connectionLine: {
      width: 2,
      height: '100%',
    },
    transferBadge: {
      position: 'absolute',
      top: '50%',
      marginTop: -8,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: WANTED_TOKENS.blue[500],
      alignItems: 'center',
      justifyContent: 'center',
    },
    stationNode: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stationDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: semantic.bgBase,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    stationDotDeparture: {
      backgroundColor: 'rgba(0,102,255,0.10)',
      borderColor: WANTED_TOKENS.blue[500],
    },
    stationDotArrival: {
      backgroundColor: 'rgba(255,66,66,0.10)',
      borderColor: WANTED_TOKENS.status.red500,
    },
    stationDotTransfer: {
      backgroundColor: semantic.bgBase,
    },
    transferDotInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    stationInfo: {
      flex: 1,
    },
    stationName: {
      fontSize: 16,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    stationNameCompact: {
      fontSize: 14,
    },
    stationMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    lineTag: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    lineTagText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: '#FFFFFF',
    },
    stepLabel: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    stepLabelTransfer: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.blue[500],
    },
  });

export default RoutePreview;
