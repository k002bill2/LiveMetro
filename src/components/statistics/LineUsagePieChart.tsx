/**
 * Line Usage Pie Chart
 * Displays subway line usage distribution
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineUsageData } from '@/services/statistics/statisticsService';

// ============================================================================
// Types
// ============================================================================

interface LineUsagePieChartProps {
  data: readonly LineUsageData[];
}

// ============================================================================
// Component
// ============================================================================

const LineUsagePieChart: React.FC<LineUsagePieChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>데이터가 없습니다</Text>
      </View>
    );
  }

  // Calculate cumulative percentages for pie segments
  let cumulativePercentage = 0;
  const segments = data.map(item => {
    const startAngle = cumulativePercentage * 3.6; // 360 / 100
    cumulativePercentage += item.percentage;
    const endAngle = cumulativePercentage * 3.6;
    return { ...item, startAngle, endAngle };
  });

  // Simple pie visualization using bars (for compatibility)
  const totalTrips = data.reduce((sum, d) => sum + d.tripCount, 0);

  return (
    <View style={styles.container}>
      {/* Visual Representation */}
      <View style={styles.visualContainer}>
        {/* Horizontal Bar Chart as Alternative to Pie */}
        <View style={styles.barChart}>
          {data.slice(0, 5).map((item, index) => (
            <View key={index} style={styles.barRow}>
              <View style={styles.barLabel}>
                <View
                  style={[styles.colorIndicator, { backgroundColor: item.color }]}
                />
                <Text style={styles.lineName}>{item.lineName}</Text>
              </View>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.percentage}>{item.percentage}%</Text>
            </View>
          ))}
        </View>

        {/* Circular Progress Indicator */}
        <View style={styles.circleContainer}>
          <View style={styles.outerCircle}>
            {segments.map((segment, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  {
                    backgroundColor: segment.color,
                    transform: [{ rotate: `${segment.startAngle}deg` }],
                    opacity: 0.9 - index * 0.1,
                  },
                ]}
              />
            ))}
            <View style={styles.innerCircle}>
              <Text style={styles.totalLabel}>총</Text>
              <Text style={styles.totalValue}>{totalTrips}</Text>
              <Text style={styles.totalUnit}>회</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: item.color }]}
            />
            <Text style={styles.legendText}>
              {item.lineName}: {item.tripCount}회
            </Text>
          </View>
        ))}
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
  visualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  barChart: {
    flex: 1,
    paddingRight: 16,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  lineName: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
    height: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
  },
  percentage: {
    width: 40,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  circleContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    width: 50,
    height: 100,
    left: 50,
    transformOrigin: 'left center',
  },
  innerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 10,
    color: '#999',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  totalUnit: {
    fontSize: 10,
    color: '#999',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
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

export default LineUsagePieChart;
