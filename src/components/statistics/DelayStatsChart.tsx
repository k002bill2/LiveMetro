/**
 * Delay Statistics Chart
 * Displays delay minutes by day of week as a bar chart
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChartDataPoint } from '@/services/statistics/statisticsService';

// ============================================================================
// Types
// ============================================================================

interface DelayStatsChartProps {
  data: readonly ChartDataPoint[];
}

// ============================================================================
// Component
// ============================================================================

const DelayStatsChart: React.FC<DelayStatsChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>데이터가 부족합니다</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.y), 1);
  const chartHeight = 120;

  const getBarHeight = (value: number): number => {
    if (maxValue === 0) return 0;
    return (value / maxValue) * chartHeight;
  };

  const getBarColor = (value: number): string => {
    if (value === 0) return '#E0E0E0';
    if (value <= 3) return '#4CAF50';
    if (value <= 7) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      {/* Chart Area */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {data.map((point, index) => (
          <View key={index} style={styles.barColumn}>
            <View style={styles.barWrapper}>
              {point.y > 0 && (
                <Text style={styles.barValue}>{point.y.toFixed(1)}</Text>
              )}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(getBarHeight(point.y), 4),
                    backgroundColor: getBarColor(point.y),
                  },
                ]}
              />
            </View>
            <Text style={styles.dayLabel}>{String(point.x)}</Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          평균: {(data.reduce((sum, d) => sum + d.y, 0) / data.length).toFixed(1)}분
        </Text>
        <Text style={styles.summaryText}>
          최대: {maxValue.toFixed(1)}분
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>0-3분</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>4-7분</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
          <Text style={styles.legendText}>7분+</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  emptyContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  bar: {
    width: 32,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
});

export default DelayStatsChart;
