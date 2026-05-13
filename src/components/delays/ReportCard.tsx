/**
 * Report Card
 *
 * 실시간 제보 피드의 단일 카드. DelayFeedScreen에서 추출(behavior unchanged).
 * 시각 정렬은 후속 phase에서 진행.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThumbsUp, Clock, MessageSquare } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import {
  DelayReport,
  ReportTypeLabels,
  getReportTypeEmoji,
  getSeverityColor,
  shouldHighlightReport,
} from '@/models/delayReport';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { LineBadge, Pill, type LineId } from '@/components/design';

interface ReportCardProps {
  report: DelayReport;
  currentUserId?: string;
  onUpvote: (report: DelayReport) => void;
  /** Optional — when provided, tapping the card body opens detail view. */
  onOpen?: (report: DelayReport) => void;
}

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

export const ReportCard: React.FC<ReportCardProps> = ({ report, currentUserId, onUpvote, onOpen }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const lineColor = getSubwayLineColor(report.lineId);
  const severityColor = getSeverityColor(report.severity);
  const isHighlighted = shouldHighlightReport(report);
  const hasUpvoted = currentUserId ? report.upvotedBy.includes(currentUserId) : false;

  const handleCardPress = onOpen ? () => onOpen(report) : undefined;
  const CardWrapper: React.ComponentType<{ children: React.ReactNode }> = onOpen
    ? ({ children }) => (
        <TouchableOpacity
          testID="report-card-open"
          activeOpacity={0.85}
          onPress={handleCardPress}
          accessibilityRole="button"
          accessibilityLabel={`${report.stationName} ${ReportTypeLabels[report.reportType]} 상세 보기`}
          style={[styles.reportCard, isHighlighted && styles.reportCardHighlighted]}
        >
          {children}
        </TouchableOpacity>
      )
    : ({ children }) => (
        <View style={[styles.reportCard, isHighlighted && styles.reportCardHighlighted]}>{children}</View>
      );

  return (
    <CardWrapper>
      {/* Line Accent */}
      <View style={[styles.lineAccent, { backgroundColor: lineColor }]} />

      <View style={styles.cardContent}>
        {/* Header — design handoff: LineBadge atom + 역명 (no auto suffix
            per [역명 double-suffix 금지]) + 검증됨 Pill (warn tone) inline */}
        <View style={styles.reportHeader}>
          <View style={styles.reportMeta}>
            <LineBadge line={report.lineId as LineId} size={22} />
            <Text style={styles.stationText}>{report.stationName}</Text>
            {report.verified && <Pill tone="warn" size="sm">검증됨</Pill>}
          </View>
          <Text style={styles.timeText}>{formatTimeAgo(new Date(report.timestamp))}</Text>
        </View>

        {/* Report Type */}
        <View style={styles.reportTypeRow}>
          <Text style={styles.reportEmoji}>{getReportTypeEmoji(report.reportType)}</Text>
          <Text style={[styles.reportType, { color: severityColor }]}>
            {ReportTypeLabels[report.reportType]}
          </Text>
          {report.estimatedDelayMinutes && (
            <View style={styles.delayBadge}>
              <Clock size={12} color={semantic.statusNegative} />
              <Text style={styles.delayText}>+{report.estimatedDelayMinutes}분</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {report.description && (
          <Text style={styles.description} numberOfLines={2}>
            {report.description}
          </Text>
        )}

        {/* Hashtag — design handoff: report type as hashtag pill below body */}
        <View style={styles.hashtagRow}>
          <Pill tone="neutral" size="sm">
            {`#${ReportTypeLabels[report.reportType]}`}
          </Pill>
        </View>

        {/* Footer */}
        <View style={styles.reportFooter}>
          <View style={styles.reporterInfo}>
            <Text style={styles.reporterName}>{report.userDisplayName}</Text>
          </View>

          <View style={styles.reportActions}>
            {/* Comment count stub — Phase B wires real count */}
            <View style={styles.commentStub} testID="report-comment-stub">
              <MessageSquare size={14} color={semantic.labelAlt} />
              <Text style={styles.commentText}>0</Text>
            </View>

            <TouchableOpacity
              style={[styles.upvoteButton, hasUpvoted && styles.upvoteButtonActive]}
              onPress={() => onUpvote(report)}
              accessibilityRole="button"
              accessibilityLabel={hasUpvoted ? '좋아요 취소' : '좋아요'}
            >
              <ThumbsUp
                size={16}
                color={hasUpvoted ? semantic.primaryNormal : semantic.labelAlt}
                fill={hasUpvoted ? semantic.primaryNormal : 'transparent'}
              />
              <Text
                testID="report-upvote-count"
                style={[styles.upvoteCount, hasUpvoted && styles.upvoteCountActive]}
              >
                {report.upvotes}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </CardWrapper>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
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
    hashtagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s1,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    commentStub: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    commentText: {
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
  });

export default ReportCard;
