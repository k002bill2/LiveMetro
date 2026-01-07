/**
 * Delay Feed Screen
 * 실시간 지연 제보 피드 화면
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import {
  MessageSquare,
  ThumbsUp,
  Filter,
  Plus,
  Clock,
  MapPin,
  CheckCircle,
} from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme, ThemeColors } from '@/services/theme';
import { delayReportService } from '@/services/delay/delayReportService';
import {
  DelayReport,
  ReportTypeLabels,
  getReportTypeEmoji,
  getSeverityColor,
  calculateCredibilityScore,
  shouldHighlightReport,
} from '@/models/delayReport';
import { DelayReportForm } from '@/components/delays/DelayReportForm';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';

const LINES = ['전체', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const DelayFeedScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [reports, setReports] = useState<DelayReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLine, setSelectedLine] = useState('전체');
  const [showReportModal, setShowReportModal] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const data = await delayReportService.getActiveReports(50);
      setReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = delayReportService.subscribeToActiveReports(
      newReports => {
        setReports(newReports);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReports();
  }, [loadReports]);

  const handleUpvote = async (report: DelayReport) => {
    if (!user) return;

    const hasUpvoted = report.upvotedBy.includes(user.id);

    try {
      if (hasUpvoted) {
        await delayReportService.removeUpvote(report.id, user.id);
      } else {
        await delayReportService.upvoteReport(report.id, user.id);
      }
    } catch (error) {
      console.error('Failed to toggle upvote:', error);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    return '1일 이상 전';
  };

  const filteredReports = selectedLine === '전체'
    ? reports
    : reports.filter(r => r.lineId === selectedLine);

  const renderReportItem = ({ item: report }: { item: DelayReport }) => {
    const lineColor = getSubwayLineColor(report.lineId);
    const severityColor = getSeverityColor(report.severity);
    const credibility = calculateCredibilityScore(report);
    const isHighlighted = shouldHighlightReport(report);
    const hasUpvoted = user ? report.upvotedBy.includes(user.id) : false;

    return (
      <View
        style={[
          styles.reportCard,
          isHighlighted && styles.reportCardHighlighted,
        ]}
      >
        {/* Line Accent */}
        <View style={[styles.lineAccent, { backgroundColor: lineColor }]} />

        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.reportHeader}>
            <View style={styles.reportMeta}>
              <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
                <Text style={styles.lineBadgeText}>{report.lineId}호선</Text>
              </View>
              <Text style={styles.stationText}>{report.stationName}역</Text>
            </View>
            <Text style={styles.timeText}>
              {formatTimeAgo(new Date(report.timestamp))}
            </Text>
          </View>

          {/* Report Type */}
          <View style={styles.reportTypeRow}>
            <Text style={styles.reportEmoji}>
              {getReportTypeEmoji(report.reportType)}
            </Text>
            <Text style={[styles.reportType, { color: severityColor }]}>
              {ReportTypeLabels[report.reportType]}
            </Text>
            {report.estimatedDelayMinutes && (
              <View style={styles.delayBadge}>
                <Clock size={12} color={colors.error} />
                <Text style={styles.delayText}>
                  +{report.estimatedDelayMinutes}분
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {report.description && (
            <Text style={styles.description} numberOfLines={2}>
              {report.description}
            </Text>
          )}

          {/* Footer */}
          <View style={styles.reportFooter}>
            <View style={styles.reporterInfo}>
              <Text style={styles.reporterName}>
                {report.userDisplayName}
              </Text>
              {report.verified && (
                <CheckCircle size={14} color={colors.success} />
              )}
            </View>

            <View style={styles.reportActions}>
              {/* Credibility Score */}
              <View style={styles.credibilityBadge}>
                <Text style={styles.credibilityText}>
                  신뢰도 {credibility}%
                </Text>
              </View>

              {/* Upvote Button */}
              <TouchableOpacity
                style={[
                  styles.upvoteButton,
                  hasUpvoted && styles.upvoteButtonActive,
                ]}
                onPress={() => handleUpvote(report)}
              >
                <ThumbsUp
                  size={16}
                  color={hasUpvoted ? colors.primary : colors.textSecondary}
                  fill={hasUpvoted ? colors.primary : 'transparent'}
                />
                <Text
                  style={[
                    styles.upvoteCount,
                    hasUpvoted && styles.upvoteCountActive,
                  ]}
                >
                  {report.upvotes}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MessageSquare size={64} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>제보가 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        {selectedLine === '전체'
          ? '현재 활성화된 지연 제보가 없습니다.\n지연이 발생하면 제보해주세요!'
          : `${selectedLine}호선에 활성화된 제보가 없습니다.`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>실시간 제보</Text>
          <Text style={styles.headerSubtitle}>
            승객들의 실시간 지연 정보
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowReportModal(true)}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Line Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={LINES}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: line }) => {
            const isSelected = selectedLine === line;
            const lineColor =
              line === '전체' ? colors.textPrimary : getSubwayLineColor(line);

            return (
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  isSelected && { backgroundColor: lineColor },
                ]}
                onPress={() => setSelectedLine(line)}
              >
                <Text
                  style={[
                    styles.filterText,
                    isSelected && styles.filterTextSelected,
                    !isSelected && { color: lineColor },
                  ]}
                >
                  {line === '전체' ? '전체' : `${line}호선`}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Report Count */}
      <View style={styles.countBar}>
        <MessageSquare size={14} color={colors.textSecondary} />
        <Text style={styles.countText}>
          {filteredReports.length}개의 활성 제보
        </Text>
      </View>

      {/* Report List */}
      <FlatList
        data={filteredReports}
        keyExtractor={item => item.id}
        renderItem={renderReportItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textPrimary}
          />
        }
      />

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportModal(false)}
      >
        <DelayReportForm
          onSubmitSuccess={() => setShowReportModal(false)}
          onCancel={() => setShowReportModal(false)}
        />
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: {
      fontSize: TYPOGRAPHY.fontSize['2xl'],
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterContainer: {
      backgroundColor: colors.surface,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    filterList: {
      paddingHorizontal: SPACING.md,
      gap: SPACING.sm,
    },
    filterButton: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginRight: SPACING.sm,
    },
    filterText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '500',
    },
    filterTextSelected: {
      color: '#FFFFFF',
    },
    countBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      gap: SPACING.xs,
    },
    countText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
    },
    listContent: {
      padding: SPACING.md,
    },
    reportCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.md,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    reportCardHighlighted: {
      borderWidth: 1,
      borderColor: colors.warning,
    },
    lineAccent: {
      width: 4,
    },
    cardContent: {
      flex: 1,
      padding: SPACING.md,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    reportMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    lineBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
    },
    lineBadgeText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    stationText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    timeText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
    },
    reportTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    reportEmoji: {
      fontSize: 20,
    },
    reportType: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: '600',
    },
    delayBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.error + '20',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
      gap: 4,
    },
    delayText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.error,
      fontWeight: '600',
    },
    description: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.sm,
      lineHeight: 20,
    },
    reportFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    reporterInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    reporterName: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
    },
    reportActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    credibilityBadge: {
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
    },
    credibilityText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
    },
    upvoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    upvoteButtonActive: {
      backgroundColor: colors.primary + '20',
      borderRadius: RADIUS.sm,
    },
    upvoteCount: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    upvoteCountActive: {
      color: colors.primary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING['3xl'],
    },
    emptyTitle: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: SPACING.lg,
    },
    emptySubtitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.sm,
      lineHeight: 20,
    },
  });

export default DelayFeedScreen;
