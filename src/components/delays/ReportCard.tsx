/**
 * Report Card
 *
 * 실시간 제보 피드의 단일 카드 — 시안 #1 풀매칭.
 * LineBadge + 역명 + 검증됨 헤더, 본문(설명), 푸터(#해시태그 | 👍 💬 공유).
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { ThumbsUp, MessageCircle, Share2 } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import { DelayReport, ReportTypeLabels } from '@/models/delayReport';
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

/**
 * 설명이 없는 제보의 본문 대체 문구 — 시안은 항상 본문 텍스트를 보여주므로
 * 가장 가까운 실데이터(유형·지연분)로 구성한다.
 */
const buildBodyText = (report: DelayReport): string => {
  if (report.description) return report.description;
  const label = ReportTypeLabels[report.reportType];
  if (report.estimatedDelayMinutes) {
    return `약 ${report.estimatedDelayMinutes}분 ${label} 중`;
  }
  return `${label} 제보`;
};

export const ReportCard: React.FC<ReportCardProps> = ({ report, currentUserId, onUpvote, onOpen }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const hasUpvoted = currentUserId ? report.upvotedBy.includes(currentUserId) : false;

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `[LiveMetro] ${report.stationName} ${ReportTypeLabels[report.reportType]} — ${buildBodyText(report)}`,
      });
    } catch (error) {
      console.error('Failed to share report:', error);
    }
  }, [report]);

  const handleCardPress = onOpen ? () => onOpen(report) : undefined;
  const CardWrapper: React.ComponentType<{ children: React.ReactNode }> = onOpen
    ? ({ children }) => (
        <TouchableOpacity
          testID="report-card-open"
          activeOpacity={0.85}
          onPress={handleCardPress}
          accessibilityRole="button"
          accessibilityLabel={`${report.stationName} ${ReportTypeLabels[report.reportType]} 상세 보기`}
          style={styles.reportCard}
        >
          {children}
        </TouchableOpacity>
      )
    : ({ children }) => <View style={styles.reportCard}>{children}</View>;

  return (
    <CardWrapper>
      {/* Header — LineBadge + 역명 (no auto suffix per [역명 double-suffix 금지])
          + 검증됨 Pill (warn tone), 시간 우측 */}
      <View style={styles.reportHeader}>
        <View style={styles.reportMeta}>
          <LineBadge line={report.lineId as LineId} size={26} />
          <Text style={styles.stationText}>{report.stationName}</Text>
          {report.verified && <Pill tone="warn" size="sm">검증됨</Pill>}
        </View>
        <Text style={styles.timeText}>{formatTimeAgo(new Date(report.timestamp))}</Text>
      </View>

      {/* Body — 설명 본문 (없으면 유형·지연분 기반 대체 문구) */}
      <Text style={styles.bodyText} numberOfLines={2}>
        {buildBodyText(report)}
      </Text>

      {/* Footer — 좌측 해시태그, 우측 좋아요·댓글·공유 */}
      <View style={styles.reportFooter}>
        <Pill tone="neutral" size="sm">
          {`# ${ReportTypeLabels[report.reportType]}`}
        </Pill>

        <View style={styles.reportActions}>
          <TouchableOpacity
            style={[styles.actionButton, hasUpvoted && styles.actionButtonActive]}
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
              style={[styles.actionCount, hasUpvoted && styles.actionCountActive]}
            >
              {report.upvotes}
            </Text>
          </TouchableOpacity>

          <View style={styles.commentStub} testID="report-comment-stub">
            <MessageCircle size={16} color={semantic.labelAlt} />
            <Text style={styles.actionCount}>{report.commentCount ?? 0}</Text>
          </View>

          <TouchableOpacity
            testID="report-share-button"
            style={styles.shareButton}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="제보 공유"
          >
            <Share2 size={16} color={semantic.labelAlt} />
          </TouchableOpacity>
        </View>
      </View>
    </CardWrapper>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    reportCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r10,
      marginBottom: WANTED_TOKENS.spacing.s3,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      padding: WANTED_TOKENS.spacing.s4,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    reportMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    stationText: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      letterSpacing: -0.2,
    },
    timeText: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      color: semantic.labelAlt,
    },
    bodyText: {
      fontSize: 15,
      color: semantic.labelNormal,
      lineHeight: 22,
      marginBottom: WANTED_TOKENS.spacing.s3,
    },
    reportFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reportActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
    },
    actionButtonActive: {
      backgroundColor: semantic.primaryBg,
      borderRadius: WANTED_TOKENS.radius.r2,
    },
    actionCount: {
      fontSize: WANTED_TOKENS.type.label2.size,
      color: semantic.labelAlt,
      fontWeight: '500',
      fontFamily: weightToFontFamily('500'),
    },
    actionCountActive: {
      color: semantic.primaryNormal,
    },
    commentStub: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    shareButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default ReportCard;
