/**
 * Statistics Dashboard Screen
 * Displays user commute statistics with charts and insights
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { statisticsService, StatsSummary, WeeklyStats } from '@/services/statistics/statisticsService';
import { commuteLogService } from '@/services/pattern';
import { CommuteLog } from '@/models/pattern';
import StatsSummaryCard from '@/components/statistics/StatsSummaryCard';
import WeeklyStatsChart from '@/components/statistics/WeeklyStatsChart';
import DelayStatsChart from '@/components/statistics/DelayStatsChart';
import LineUsagePieChart from '@/components/statistics/LineUsagePieChart';

// ============================================================================
// Types
// ============================================================================

// Time range type - exported for future use
export type TimeRange = 'week' | 'month' | 'all';

// ============================================================================
// Component
// ============================================================================

const StatisticsDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<readonly CommuteLog[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  // Time range filter - to be implemented
  // const [timeRange, setTimeRange] = useState<TimeRange>('month');

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Load commute logs
      const allLogs = await commuteLogService.getCommuteLogs(user.id);
      setLogs(allLogs);

      // Calculate summary
      const summaryData = await statisticsService.calculateSummary(allLogs);
      setSummary(summaryData);

      // Get current week stats
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      const weekData = statisticsService.getWeeklyStats(allLogs, weekStart);
      setWeeklyStats(weekData);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    const initData = async (): Promise<void> => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };

    initData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={semantic.primaryNormal} />
          <Text style={styles.loadingText}>통계 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary || logs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>통계 데이터가 없습니다</Text>
          <Text style={styles.emptyDescription}>
            출퇴근 기록이 쌓이면 통계를 확인할 수 있어요
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const lineUsageData = statisticsService.getLineUsageData(logs);
  const delayDistribution = statisticsService.getDelayDistribution(logs);
  const weeklyTrendData = statisticsService.getWeeklyTrendData(logs);
  const delayByDayData = statisticsService.getDelayByDayData(logs);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>통계 대시보드</Text>
          <Text style={styles.subtitle}>
            {summary.memberSince} 이후 기록
          </Text>
        </View>

        {/* Summary Card */}
        <StatsSummaryCard summary={summary} />

        {/* Weekly On-Time Rate Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>주간 정시율 추이</Text>
          <WeeklyStatsChart data={weeklyTrendData} />
        </View>

        {/* Delay by Day Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>요일별 평균 지연</Text>
          <DelayStatsChart data={delayByDayData} />
        </View>

        {/* Line Usage Pie Chart */}
        {lineUsageData.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>노선별 이용 현황</Text>
            <LineUsagePieChart data={lineUsageData} />
          </View>
        )}

        {/* Delay Distribution */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>지연 시간 분포</Text>
          <View style={styles.distributionContainer}>
            {delayDistribution.map((item, index) => (
              <View key={index} style={styles.distributionItem}>
                <View style={styles.distributionBar}>
                  <View
                    style={[
                      styles.distributionFill,
                      { width: `${Math.min(item.percentage * 2, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.distributionLabel}>{item.range}</Text>
                <Text style={styles.distributionValue}>
                  {item.count}회 ({item.percentage}%)
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* This Week Summary */}
        {weeklyStats && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>이번 주 요약</Text>
            <View style={styles.weekSummary}>
              <View style={styles.weekSummaryItem}>
                <Text style={styles.weekSummaryValue}>
                  {weeklyStats.totalTrips}
                </Text>
                <Text style={styles.weekSummaryLabel}>총 이동</Text>
              </View>
              <View style={styles.weekSummaryItem}>
                <Text style={styles.weekSummaryValue}>
                  {weeklyStats.delayedTrips}
                </Text>
                <Text style={styles.weekSummaryLabel}>지연 횟수</Text>
              </View>
              <View style={styles.weekSummaryItem}>
                <Text style={styles.weekSummaryValue}>
                  {weeklyStats.onTimeRate.toFixed(0)}%
                </Text>
                <Text style={styles.weekSummaryLabel}>정시율</Text>
              </View>
            </View>
          </View>
        )}

        {/* Insights */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>인사이트</Text>
          <View style={styles.insightCard}>
            {summary.mostUsedLine && (
              <Text style={styles.insightText}>
                • 가장 많이 이용한 노선: {summary.mostUsedLine}
              </Text>
            )}
            {summary.mostDelayedLine && (
              <Text style={styles.insightText}>
                • 지연이 잦은 노선: {summary.mostDelayedLine}
              </Text>
            )}
            {summary.streakDays > 0 && (
              <Text style={styles.insightText}>
                • 연속 기록: {summary.streakDays}일 🔥
              </Text>
            )}
            {summary.avgDelayMinutes > 0 && (
              <Text style={styles.insightText}>
                • 평균 지연 시간: {summary.avgDelayMinutes.toFixed(1)}분
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: semantic.labelAlt,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginBottom: 8,
    },
    emptyDescription: {
      fontSize: 14,
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.6,
    },
    subtitle: {
      fontSize: 14,
      color: semantic.labelAlt,
      marginTop: 4,
    },
    chartSection: {
      backgroundColor: semantic.bgBase,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      shadowColor: '#171717',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: 16,
    },
    distributionContainer: {
      gap: 12,
    },
    distributionItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    distributionBar: {
      flex: 1,
      height: 24,
      backgroundColor: 'rgba(112,115,124,0.14)',
      borderRadius: 12,
      overflow: 'hidden',
      marginRight: 12,
    },
    distributionFill: {
      height: '100%',
      backgroundColor: semantic.primaryNormal,
      borderRadius: 12,
    },
    distributionLabel: {
      width: 60,
      fontSize: 13,
      color: semantic.labelAlt,
    },
    distributionValue: {
      width: 80,
      fontSize: 13,
      color: semantic.labelNormal,
      textAlign: 'right',
    },
    weekSummary: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    weekSummaryItem: {
      alignItems: 'center',
    },
    weekSummaryValue: {
      fontSize: 32,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
      letterSpacing: -0.4,
    },
    weekSummaryLabel: {
      fontSize: 14,
      color: semantic.labelAlt,
      marginTop: 4,
    },
    insightsSection: {
      marginBottom: 16,
    },
    insightCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      shadowColor: '#171717',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    insightText: {
      fontSize: 14,
      color: semantic.labelNormal,
      lineHeight: 24,
    },
    footer: {
      height: 40,
    },
  });

export default StatisticsDashboardScreen;
