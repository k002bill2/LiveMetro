/**
 * Statistics Summary Card
 * Displays key statistics metrics in a card layout
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatsSummary } from '@/services/statistics/statisticsService';

// ============================================================================
// Types
// ============================================================================

interface StatsSummaryCardProps {
  summary: StatsSummary;
}

// ============================================================================
// Component
// ============================================================================

const StatsSummaryCard: React.FC<StatsSummaryCardProps> = ({ summary }) => {
  const getOnTimeRateColor = (rate: number): string => {
    if (rate >= 90) return '#4CAF50';
    if (rate >= 70) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      {/* Main Stats Row */}
      <View style={styles.mainStats}>
        <View style={styles.mainStatItem}>
          <Text style={styles.mainStatValue}>{summary.totalTrips}</Text>
          <Text style={styles.mainStatLabel}>총 이동</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.mainStatItem}>
          <Text
            style={[
              styles.mainStatValue,
              { color: getOnTimeRateColor(summary.onTimeRate) },
            ]}
          >
            {summary.onTimeRate.toFixed(0)}%
          </Text>
          <Text style={styles.mainStatLabel}>정시율</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.mainStatItem}>
          <Text style={styles.mainStatValue}>{summary.streakDays}</Text>
          <Text style={styles.mainStatLabel}>연속 🔥</Text>
        </View>
      </View>

      {/* Secondary Stats */}
      <View style={styles.secondaryStats}>
        <View style={styles.secondaryStatRow}>
          <View style={styles.secondaryStatItem}>
            <Text style={styles.secondaryStatIcon}>⏱️</Text>
            <View style={styles.secondaryStatText}>
              <Text style={styles.secondaryStatLabel}>총 지연 시간</Text>
              <Text style={styles.secondaryStatValue}>
                {summary.totalDelayMinutes}분
              </Text>
            </View>
          </View>

          <View style={styles.secondaryStatItem}>
            <Text style={styles.secondaryStatIcon}>📊</Text>
            <View style={styles.secondaryStatText}>
              <Text style={styles.secondaryStatLabel}>평균 지연</Text>
              <Text style={styles.secondaryStatValue}>
                {summary.avgDelayMinutes.toFixed(1)}분
              </Text>
            </View>
          </View>
        </View>

        {(summary.mostUsedLine || summary.mostUsedStation) && (
          <View style={styles.secondaryStatRow}>
            {summary.mostUsedLine && (
              <View style={styles.secondaryStatItem}>
                <Text style={styles.secondaryStatIcon}>🚇</Text>
                <View style={styles.secondaryStatText}>
                  <Text style={styles.secondaryStatLabel}>주요 노선</Text>
                  <Text style={styles.secondaryStatValue}>
                    {summary.mostUsedLine}
                  </Text>
                </View>
              </View>
            )}

            {summary.mostDelayedLine && (
              <View style={styles.secondaryStatItem}>
                <Text style={styles.secondaryStatIcon}>⚠️</Text>
                <View style={styles.secondaryStatText}>
                  <Text style={styles.secondaryStatLabel}>지연 잦은 노선</Text>
                  <Text style={styles.secondaryStatValue}>
                    {summary.mostDelayedLine}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Last Trip Info */}
      {summary.lastTripDate && (
        <View style={styles.lastTrip}>
          <Text style={styles.lastTripText}>
            마지막 기록: {summary.lastTripDate}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  mainStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  mainStatValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  mainStatLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  secondaryStats: {
    paddingTop: 16,
    gap: 12,
  },
  secondaryStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  secondaryStatIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  secondaryStatText: {
    flex: 1,
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: '#999',
  },
  secondaryStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  lastTrip: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  lastTripText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default StatsSummaryCard;
