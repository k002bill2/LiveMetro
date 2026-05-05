/**
 * Weekly Statistics Chart
 * Displays weekly on-time rate trend using a line chart
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { ChartDataPoint } from '@/services/statistics/statisticsService';
import { weightToFontFamily } from '@/styles/modernTheme';

// ============================================================================
// Types
// ============================================================================

interface WeeklyStatsChartProps {
  data: readonly ChartDataPoint[];
}

// ============================================================================
// Component
// ============================================================================

const WeeklyStatsChart: React.FC<WeeklyStatsChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>데이터가 부족합니다</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.y), 100);
  const minValue = Math.min(...data.map(d => d.y), 0);
  const range = maxValue - minValue;
  const chartHeight = 150;
  const chartWidth = Dimensions.get('window').width - 80;
  const barWidth = chartWidth / data.length - 8;

  const getBarHeight = (value: number): number => {
    if (range === 0) return chartHeight / 2;
    return ((value - minValue) / range) * chartHeight;
  };

  const getBarColor = (value: number): string => {
    if (value >= 90) return '#4CAF50';
    if (value >= 70) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      {/* Y-Axis Labels */}
      <View style={styles.yAxis}>
        <Text style={styles.yAxisLabel}>100%</Text>
        <Text style={styles.yAxisLabel}>50%</Text>
        <Text style={styles.yAxisLabel}>0%</Text>
      </View>

      {/* Chart Area */}
      <View style={styles.chartArea}>
        {/* Grid Lines */}
        <View style={[styles.gridLine, { top: 0 }]} />
        <View style={[styles.gridLine, { top: chartHeight / 2 }]} />
        <View style={[styles.gridLine, { top: chartHeight }]} />

        {/* Bars */}
        <View style={[styles.barsContainer, { height: chartHeight }]}>
          {data.map((point, index) => (
            <View key={index} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: getBarHeight(point.y),
                    backgroundColor: getBarColor(point.y),
                    width: barWidth,
                  },
                ]}
              >
                <Text style={styles.barValue}>{point.y.toFixed(0)}%</Text>
              </View>
            </View>
          ))}
        </View>

        {/* X-Axis Labels */}
        <View style={styles.xAxis}>
          {data.map((point, index) => (
            <View key={index} style={[styles.xLabelWrapper, { width: barWidth + 8 }]}>
              <Text style={styles.xAxisLabel}>{String(point.x)}</Text>
              {point.label && (
                <Text style={styles.xAxisSubLabel}>{point.label}</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>90%+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={styles.legendText}>70-89%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
          <Text style={styles.legendText}>70%↓</Text>
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
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 150,
    justifyContent: 'space-between',
    width: 40,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
  },
  chartArea: {
    marginLeft: 45,
    marginRight: 8,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barWrapper: {
    alignItems: 'center',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
    minHeight: 24,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    color: '#FFF',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  xLabelWrapper: {
    alignItems: 'center',
  },
  xAxisLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  xAxisSubLabel: {
    fontSize: 9,
    color: '#999',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
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

export default WeeklyStatsChart;
