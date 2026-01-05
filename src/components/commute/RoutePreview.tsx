/**
 * Route Preview Component
 * Visual representation of commute route with stations and connections
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  GitBranch,
  Clock,
  ArrowLeftRight,
  MapPin,
  Flag
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { routeToSteps, CommuteRoute } from '@/models/commute';

interface RoutePreviewProps {
  route: Partial<CommuteRoute>;
  showTime?: boolean;
  compact?: boolean;
}

// Line colors for visual indication
const LINE_COLORS: Record<string, string> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#E6186C',
  '9': '#BDB092',
};

const getLineColor = (lineId: string): string => {
  return LINE_COLORS[lineId] || COLORS.gray[400];
};

export const RoutePreview: React.FC<RoutePreviewProps> = ({
  route,
  showTime = true,
  compact = false,
}) => {
  const steps = routeToSteps(route);
  const hasRoute = steps.length >= 2;

  if (!hasRoute) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <GitBranch
          size={32}
          color={COLORS.gray[300]}
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
            color={COLORS.text.tertiary}
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
                          ? COLORS.gray[300]
                          : getLineColor(step.lineId),
                    },
                  ]}
                />
                {step.type === 'transfer' && (
                  <View style={styles.transferBadge}>
                    <ArrowLeftRight
                      size={12}
                      color={COLORS.white}
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
                  { borderColor: getLineColor(step.lineId) },
                ]}
              >
                {step.type === 'departure' && (
                  <MapPin size={12} color={COLORS.primary.main} />
                )}
                {step.type === 'arrival' && (
                  <Flag size={12} color={COLORS.semantic.error} />
                )}
                {step.type === 'transfer' && (
                  <View
                    style={[
                      styles.transferDotInner,
                      { backgroundColor: getLineColor(step.lineId) },
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
                        { backgroundColor: getLineColor(step.lineId) },
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  containerCompact: {
    padding: SPACING.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['2xl'],
  },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  timeText: {
    marginLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.tertiary,
  },
  routeContainer: {
    paddingLeft: SPACING.sm,
  },
  stepContainer: {
    marginBottom: SPACING.md,
  },
  connectionContainer: {
    position: 'absolute',
    left: 11,
    top: -SPACING.md,
    height: SPACING.md,
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
    backgroundColor: COLORS.secondary.blue,
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
    backgroundColor: COLORS.white,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  stationDotDeparture: {
    backgroundColor: COLORS.primary.light,
    borderColor: COLORS.primary.main,
  },
  stationDotArrival: {
    backgroundColor: COLORS.secondary.redLight,
    borderColor: COLORS.semantic.error,
  },
  stationDotTransfer: {
    backgroundColor: COLORS.white,
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
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  stationNameCompact: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  lineTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
  },
  lineTagText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.white,
  },
  stepLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  stepLabelTransfer: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.secondary.blue,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default RoutePreview;
