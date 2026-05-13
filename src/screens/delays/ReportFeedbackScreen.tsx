/**
 * Report Feedback Screen
 *
 * 시안 #5 — 단일 제보의 반응 분포(4-bucket bar) + 댓글 list + 댓글 작성.
 * 상세 화면(`ReportDetailScreen`)에서 진입.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, Bell, Send } from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import { delayReportService } from '@/services/delay/delayReportService';
import { reportCommentService } from '@/services/delay/reportCommentService';
import {
  DelayReport,
  ReportTypeLabels,
  REACTION_KINDS,
  ReactionKind,
  ReactionLabels,
  ReactionCounts,
  emptyReactionCounts,
  totalReactions,
} from '@/models/delayReport';
import {
  CommentSortMode,
  CommentSortLabels,
  ReportComment,
  anonymizeDisplayName,
} from '@/models/reportComment';
import { LineBadge, Pill, type LineId } from '@/components/design';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface ReportFeedbackScreenProps {
  report: DelayReport;
  onBack?: () => void;
}

const REACTION_BAR_COLORS: Record<ReactionKind, string> = {
  helped: '#1D4ED8',
  same: '#16A34A',
  recovered: '#9333EA',
  differ: '#DC2626',
};

const formatMinAgo = (date: Date): string => {
  const diffM = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffM < 1) return '방금 전';
  if (diffM < 60) return `${diffM}분 전`;
  return `${Math.floor(diffM / 60)}시간 전`;
};

export const ReportFeedbackScreen: React.FC<ReportFeedbackScreenProps> = ({ report, onBack }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const initialReactions: ReactionCounts = report.reactions ?? emptyReactionCounts();
  const [reactions, setReactions] = useState<ReactionCounts>(initialReactions);
  const [myReaction, setMyReaction] = useState<ReactionKind | null>(
    user && report.reactedBy ? (report.reactedBy[user.id] ?? null) : null,
  );
  const [sort, setSort] = useState<CommentSortMode>('newest');
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [draft, setDraft] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    reportCommentService
      .listComments(report.id, sort)
      .then(list => {
        if (cancelled) return;
        setComments(list);
        setLoadingComments(false);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Failed to load comments:', error);
        setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report.id, sort]);

  const total = totalReactions(reactions);
  const totalParticipants = total === 0 ? 0 : total;

  const handleReaction = useCallback(
    async (kind: ReactionKind) => {
      if (!user) {
        Alert.alert('알림', '로그인 후 반응을 남길 수 있어요.');
        return;
      }
      try {
        if (myReaction === kind) {
          // Clear
          setReactions(prev => ({ ...prev, [kind]: Math.max(0, prev[kind] - 1) }));
          setMyReaction(null);
          await delayReportService.clearReaction(report.id, user.id, kind);
        } else {
          // Switch / set
          setReactions(prev => {
            const next = { ...prev };
            if (myReaction) next[myReaction] = Math.max(0, prev[myReaction] - 1);
            next[kind] = (prev[kind] ?? 0) + 1;
            return next;
          });
          const previousKind = myReaction;
          setMyReaction(kind);
          await delayReportService.setReaction(report.id, user.id, previousKind, kind);
        }
      } catch (error) {
        console.error('Failed to toggle reaction:', error);
        // Rollback optimistic update
        setReactions(initialReactions);
        setMyReaction(user && report.reactedBy ? (report.reactedBy[user.id] ?? null) : null);
        Alert.alert('오류', '반응을 저장하지 못했습니다.');
      }
    },
    [user, myReaction, report.id, report.reactedBy, initialReactions],
  );

  const handleSubmitComment = useCallback(async () => {
    if (!user || draft.trim().length === 0) return;
    setSubmitting(true);
    try {
      const newId = await reportCommentService.addComment({
        reportId: report.id,
        userId: user.id,
        userDisplayName: anonymizeDisplayName(user.displayName),
        text: draft,
      });
      const newComment: ReportComment = {
        id: newId,
        reportId: report.id,
        userId: user.id,
        userDisplayName: anonymizeDisplayName(user.displayName),
        text: draft.trim(),
        createdAt: new Date(),
        likes: 0,
        likedBy: [],
        replyCount: 0,
      };
      setComments(prev => [newComment, ...prev]);
      setDraft('');
    } catch (error) {
      console.error('Failed to add comment:', error);
      Alert.alert('오류', '댓글을 저장하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [user, draft, report.id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="feedback-back"
          onPress={onBack}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <ChevronLeft size={24} color={semantic.labelStrong} />
        </TouchableOpacity>
        <Text testID="feedback-header-title" style={styles.headerTitle}>
          제보 피드백
        </Text>
        <TouchableOpacity
          testID="feedback-bell"
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="알림"
        >
          <Bell size={20} color={semantic.labelStrong} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero summary */}
        <View style={styles.summary} testID="feedback-summary">
          <View style={styles.summaryHeaderRow}>
            <LineBadge line={report.lineId as LineId} size={22} />
            <Text style={styles.summaryStation}>{report.stationName}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.summaryTime}>{formatMinAgo(new Date(report.timestamp))}</Text>
          </View>
          <View style={styles.summaryHashtagRow}>
            <Pill tone="warn" size="sm">{`#${ReportTypeLabels[report.reportType]}`}</Pill>
          </View>
          <Text style={styles.summaryHeadline}>
            {report.stationName}역 사이 {ReportTypeLabels[report.reportType]}로 {report.estimatedDelayMinutes ?? 5}분 정차 중
          </Text>
        </View>

        {/* Reactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이 제보에 대한 반응</Text>
          <Text style={styles.sectionHint} testID="feedback-total-participants">
            총 {totalParticipants}명 참여
          </Text>
          <View style={styles.reactionBarRow}>
            {REACTION_KINDS.map(kind => {
              const count = reactions[kind] ?? 0;
              const pct = total === 0 ? 0 : (count / total) * 100;
              return (
                <View key={kind} style={styles.reactionBarSegmentWrap} testID={`reaction-bar-${kind}`}>
                  <View style={[styles.reactionBarSegment, { backgroundColor: REACTION_BAR_COLORS[kind], width: `${Math.max(pct, total === 0 ? 25 : 4)}%` }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.reactionTileGrid}>
            {REACTION_KINDS.map(kind => {
              const selected = myReaction === kind;
              const count = reactions[kind] ?? 0;
              return (
                <TouchableOpacity
                  key={kind}
                  testID={`reaction-tile-${kind}`}
                  onPress={() => handleReaction(kind)}
                  style={[styles.reactionTile, selected && styles.reactionTileSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={ReactionLabels[kind]}
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.reactionTileDot, { backgroundColor: REACTION_BAR_COLORS[kind] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reactionTileLabel}>{ReactionLabels[kind]}</Text>
                    <Text style={styles.reactionTileCount}>{count}명</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Comments */}
        <View style={styles.section}>
          <View style={styles.commentsHeaderRow}>
            <Text style={styles.sectionTitle}>댓글 {comments.length}</Text>
            <View style={styles.sortRow}>
              {(['newest', 'popular'] as CommentSortMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  testID={`comments-sort-${mode}`}
                  onPress={() => setSort(mode)}
                  style={[styles.sortChip, sort === mode && styles.sortChipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={CommentSortLabels[mode]}
                  accessibilityState={{ selected: sort === mode }}
                >
                  <Text style={[styles.sortText, sort === mode && styles.sortTextSelected]}>
                    {CommentSortLabels[mode]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {loadingComments ? (
            <ActivityIndicator color={semantic.labelAlt} style={{ marginVertical: WANTED_TOKENS.spacing.s4 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.emptyHint} testID="comments-empty">
              아직 댓글이 없어요. 첫 댓글을 남겨보세요.
            </Text>
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.commentItem} testID={`comment-${c.id}`}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{c.userDisplayName[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentName}>{c.userDisplayName}</Text>
                    {c.badge ? <Pill tone="warn" size="sm">{c.badge}</Pill> : null}
                    <Text style={styles.commentTime}>{formatMinAgo(c.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                  <View style={styles.commentActions}>
                    <Text style={styles.commentAction}>좋아요 {c.likes}</Text>
                    <Text style={styles.commentAction}>답글 {c.replyCount}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TextInput
          testID="comment-input"
          style={styles.commentInput}
          placeholder="댓글을 입력하세요"
          placeholderTextColor={semantic.labelAlt}
          value={draft}
          onChangeText={setDraft}
          maxLength={200}
        />
        <TouchableOpacity
          testID="comment-submit"
          style={[styles.commentSubmit, (draft.trim().length === 0 || submitting) && styles.commentSubmitDisabled]}
          onPress={handleSubmitComment}
          disabled={draft.trim().length === 0 || submitting}
          accessibilityRole="button"
          accessibilityLabel="댓글 등록"
        >
          {submitting ? (
            <ActivityIndicator color={WANTED_TOKENS.light.labelOnColor} />
          ) : (
            <Send size={18} color={WANTED_TOKENS.light.labelOnColor} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

ReportFeedbackScreen.displayName = 'ReportFeedbackScreen';

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: semantic.bgSubtlePage },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 96 },
    summary: {
      margin: WANTED_TOKENS.spacing.s4,
      padding: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
      gap: WANTED_TOKENS.spacing.s2,
    },
    summaryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: WANTED_TOKENS.spacing.s2 },
    summaryStation: { fontSize: WANTED_TOKENS.type.label1.size, fontWeight: '700', fontFamily: weightToFontFamily('700'), color: semantic.labelStrong },
    summaryTime: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt },
    summaryHashtagRow: { flexDirection: 'row', gap: WANTED_TOKENS.spacing.s1 },
    summaryHeadline: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    section: {
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      marginTop: WANTED_TOKENS.spacing.s3,
      padding: WANTED_TOKENS.spacing.s4,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    sectionTitle: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    sectionHint: { marginTop: 2, fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt },
    reactionBarRow: {
      flexDirection: 'row',
      gap: 2,
      marginTop: WANTED_TOKENS.spacing.s3,
      height: 10,
      overflow: 'hidden',
      borderRadius: 5,
      backgroundColor: semantic.lineSubtle,
    },
    reactionBarSegmentWrap: { flex: 1, height: '100%', backgroundColor: semantic.lineSubtle, overflow: 'hidden' },
    reactionBarSegment: { height: '100%' },
    reactionTileGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    reactionTile: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      padding: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    reactionTileSelected: { borderColor: semantic.primaryNormal, borderWidth: 2, backgroundColor: semantic.bgSubtle },
    reactionTileDot: { width: 12, height: 12, borderRadius: 9999 },
    reactionTileLabel: { fontSize: WANTED_TOKENS.type.label1.size, fontWeight: '700', fontFamily: weightToFontFamily('700'), color: semantic.labelStrong },
    reactionTileCount: { marginTop: 2, fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt },
    commentsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sortRow: { flexDirection: 'row', gap: WANTED_TOKENS.spacing.s1 },
    sortChip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      paddingVertical: 4,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    sortChipSelected: { backgroundColor: semantic.labelStrong, borderColor: semantic.labelStrong },
    sortText: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelStrong },
    sortTextSelected: { color: semantic.labelOnColor },
    emptyHint: { marginTop: WANTED_TOKENS.spacing.s3, fontSize: WANTED_TOKENS.type.label2.size, color: semantic.labelAlt, textAlign: 'center' },
    commentItem: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s3,
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingTop: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      backgroundColor: semantic.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentAvatarText: { fontSize: 14, fontWeight: '700', fontFamily: weightToFontFamily('700'), color: semantic.labelStrong },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: WANTED_TOKENS.spacing.s2 },
    commentName: { fontSize: WANTED_TOKENS.type.label1.size, fontWeight: '700', fontFamily: weightToFontFamily('700'), color: semantic.labelStrong },
    commentTime: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt, marginLeft: 'auto' },
    commentText: { marginTop: 4, fontSize: WANTED_TOKENS.type.label1.size, color: semantic.labelStrong, lineHeight: 20 },
    commentActions: { flexDirection: 'row', gap: WANTED_TOKENS.spacing.s3, marginTop: WANTED_TOKENS.spacing.s2 },
    commentAction: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    commentInput: {
      flex: 1,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      fontSize: WANTED_TOKENS.type.label1.size,
      color: semantic.labelStrong,
    },
    commentSubmit: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9999,
      backgroundColor: semantic.primaryNormal,
    },
    commentSubmitDisabled: { backgroundColor: semantic.lineSubtle },
  });

export default ReportFeedbackScreen;
