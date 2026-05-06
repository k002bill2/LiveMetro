/**
 * Delay Feed Screen
 * 실시간 지연 제보 피드 화면
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Megaphone,
  Clock,
} from 'lucide-react-native';
import { Pill } from '@/components/design/Pill';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
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
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

const LINES = ['전체', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const DelayFeedScreen: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  // Memoize styles — feed re-renders on report stream updates (cross-review).
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [reports, setReports] = useState<DelayReport[]>([]);
  const [_loading, setLoading] = useState(true);
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
              <Text style={styles.stationText}>{report.stationName}</Text>
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
                <Clock size={12} color={semantic.statusNegative} />
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
                <Pill tone="warn" size="sm">검증됨</Pill>
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
                  color={hasUpvoted ? semantic.primaryNormal : semantic.labelAlt}
                  fill={hasUpvoted ? semantic.primaryNormal : 'transparent'}
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
      <MessageSquare size={64} color={semantic.labelAlt} />
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
      {/* Header — Phase 4 redesign: 28px title + round add button */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text
            style={styles.headerTitle}
            accessibilityRole="header"
            testID="delay-feed-header-title"
          >
            실시간 제보
          </Text>
          <Text style={styles.headerSubtitle}>승객들의 실시간 지연 정보</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          accessibilityRole="button"
          accessibilityLabel="제보 작성"
          testID="delay-feed-add-button"
          onPress={() => setShowReportModal(true)}
        >
          <Megaphone size={18} color={WANTED_TOKENS.light.labelOnColor} strokeWidth={2.2} />
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
              line === '전체' ? semantic.labelStrong : getSubwayLineColor(line);

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
        <MessageSquare size={14} color={semantic.labelAlt} />
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
            tintColor={semantic.labelStrong}
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

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitleWrap: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      letterSpacing: -0.6,
    },
    headerSubtitle: {
      fontSize: 13,
      color: semantic.labelAlt,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      marginTop: 2,
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      backgroundColor: semantic.primaryNormal,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: semantic.primaryNormal,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
    filterContainer: {
      backgroundColor: semantic.bgBase,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    filterList: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    filterButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      marginRight: WANTED_TOKENS.spacing.s2,
    },
    filterText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
    },
    filterTextSelected: {
      color: semantic.labelOnColor,
    },
    countBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      gap: WANTED_TOKENS.spacing.s1,
    },
    countText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
    },
    listContent: {
      padding: WANTED_TOKENS.spacing.s3,
    },
    reportCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      marginBottom: WANTED_TOKENS.spacing.s3,
      overflow: 'hidden',
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    reportCardHighlighted: {
      borderWidth: 1,
      borderColor: semantic.statusCautionary,
    },
    lineAccent: {
      width: 4,
    },
    cardContent: {
      flex: 1,
      padding: WANTED_TOKENS.spacing.s3,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    reportMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    lineBadge: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
    },
    lineBadgeText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelOnColor,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    stationText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    timeText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    reportTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    reportEmoji: {
      fontSize: 20,
    },
    reportType: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    delayBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.statusNegative + '20',
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
      gap: 4,
    },
    delayText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.statusNegative,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    description: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
      marginBottom: WANTED_TOKENS.spacing.s2,
      lineHeight: 20,
    },
    reportFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: WANTED_TOKENS.spacing.s2,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    reporterInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s1,
    },
    reporterName: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    reportActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
    },
    credibilityBadge: {
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 2,
      borderRadius: WANTED_TOKENS.radius.r2,
    },
    credibilityText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    upvoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
    },
    upvoteButtonActive: {
      backgroundColor: semantic.primaryNormal + '20',
      borderRadius: WANTED_TOKENS.radius.r2,
    },
    upvoteCount: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
    },
    upvoteCountActive: {
      color: semantic.primaryNormal,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s12,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
      marginTop: WANTED_TOKENS.spacing.s4,
    },
    emptySubtitle: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
      textAlign: 'center',
      marginTop: WANTED_TOKENS.spacing.s2,
      lineHeight: 20,
    },
  });

export default DelayFeedScreen;
