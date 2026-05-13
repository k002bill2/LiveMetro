/**
 * Report Detail Screen
 *
 * 시안 #4 — 단일 제보 상세 페이지. 큰 hero(severity-tinted) + 작성자 신뢰도
 * + 상세 본문 + 해시태그 + 제보 추이 + 영향 구간 timeline + 관련 제보.
 *
 * 피드백(반응/댓글) 화면으로 이동하는 CTA를 포함한다.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ChevronLeft, MoreHorizontal, MessageSquare, MapPin } from 'lucide-react-native';

import { useTheme } from '@/services/theme';
import { delayReportService } from '@/services/delay/delayReportService';
import {
  DelayReport,
  ReportTypeLabels,
  calculateCredibilityScore,
} from '@/models/delayReport';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { LineBadge, Pill, type LineId } from '@/components/design';

interface ReportDetailScreenProps {
  report: DelayReport;
  onBack?: () => void;
  onOpenFeedback?: (report: DelayReport) => void;
}

const formatHHmm = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatMinAgo = (date: Date): string => {
  const diffM = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffM < 1) return '방금 전';
  if (diffM < 60) return `${diffM}분 전`;
  return `${Math.floor(diffM / 60)}시간 전`;
};

/**
 * Build a simple 6-tick timeline ending at "now" — Phase D wires real
 * historic counts; for Phase C we visualize one mark at the report time
 * to communicate "minutes ago".
 */
const buildTrendTicks = (anchor: Date): { time: string; isAnchor: boolean }[] => {
  const ticks: { time: string; isAnchor: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const t = new Date(anchor.getTime() - i * 6 * 60_000);
    ticks.push({ time: formatHHmm(t), isAnchor: i === Math.floor((Date.now() - anchor.getTime()) / 60_000 / 6) });
  }
  return ticks;
};

/**
 * Compute impact-station rows. Without a real `affectedStations` field,
 * we synthesize a 4-row column anchored on the reported station — Phase E
 * wires real station-graph adjacency.
 */
const synthesizeImpactRows = (report: DelayReport): { name: string; status: '정상' | '정차 중' | '대기' }[] => {
  return [
    { name: '교대', status: '정상' },
    { name: report.stationName || '강남', status: '정차 중' },
    { name: '역삼', status: '대기' },
    { name: '선릉', status: '대기' },
  ];
};

export const ReportDetailScreen: React.FC<ReportDetailScreenProps> = ({ report, onBack, onOpenFeedback }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const credibility = calculateCredibilityScore(report);
  const lineColor = getSubwayLineColor(report.lineId);
  const trendTicks = useMemo(() => buildTrendTicks(new Date(report.timestamp)), [report.timestamp]);
  const impactRows = useMemo(() => synthesizeImpactRows(report), [report]);

  const [related, setRelated] = useState<DelayReport[]>([]);
  useEffect(() => {
    let cancelled = false;
    delayReportService
      .getLineReports(report.lineId, 10)
      .then(list => {
        if (cancelled) return;
        // exclude the report itself
        setRelated(list.filter(r => r.id !== report.id).slice(0, 3));
      })
      .catch(error => {
        console.error('Failed to load related reports:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [report.id, report.lineId]);

  const reportAt = new Date(report.timestamp);
  const sectionLabel = `${report.stationName ?? ''}-${impactRows[2]?.name ?? ''} 구간`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="report-detail-back"
          onPress={onBack}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <ChevronLeft size={24} color={semantic.labelStrong} />
        </TouchableOpacity>
        <Text testID="report-detail-header-title" style={styles.headerTitle}>
          제보 상세
        </Text>
        <TouchableOpacity
          testID="report-detail-more"
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="더보기"
        >
          <MoreHorizontal size={20} color={semantic.labelStrong} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: lineColor }]} testID="report-detail-hero">
          <View style={styles.heroTopRow}>
            <LineBadge line={report.lineId as LineId} size={28} />
            {report.verified && (
              <View style={styles.heroVerified}>
                <Pill tone="warn" size="sm">검증됨</Pill>
              </View>
            )}
          </View>
          <Text style={styles.heroTitle}>
            {report.stationName}역 {ReportTypeLabels[report.reportType]}
          </Text>
          {report.estimatedDelayMinutes != null && (
            <Text style={styles.heroSubtitle}>약 {report.estimatedDelayMinutes}분 정차 중</Text>
          )}
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>{formatMinAgo(reportAt)}</Text>
            <Text style={styles.heroMetaDot}>·</Text>
            <Text style={styles.heroMeta}>{sectionLabel}</Text>
            <Text style={styles.heroMetaDot}>·</Text>
            <Text style={styles.heroMeta} testID="report-detail-affected">
              {report.upvotes * 14}명 영향
            </Text>
          </View>
        </View>

        {/* Reporter row */}
        <View style={styles.reporterCard}>
          <View style={styles.reporterAvatar}>
            <Text style={styles.reporterAvatarText}>{(report.userDisplayName ?? '익')[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reporterName}>{report.userDisplayName ?? '익명'}</Text>
            <Text style={styles.reporterMeta} testID="report-detail-credibility">
              신뢰도 {credibility} · 누적 제보 {report.upvotes}건 · GPS 검증
            </Text>
          </View>
          <TouchableOpacity
            testID="report-detail-follow"
            style={styles.followBtn}
            accessibilityRole="button"
            accessibilityLabel="팔로우"
          >
            <Text style={styles.followBtnText}>팔로우</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>상세 내용</Text>
          <Text style={styles.bodyText} testID="report-detail-body">
            {report.description || '추가 설명이 없는 제보입니다.'}
          </Text>
          <View style={styles.hashtagRow}>
            <Pill tone="neutral" size="sm">{`#${ReportTypeLabels[report.reportType]}`}</Pill>
            {report.estimatedDelayMinutes != null && (
              <Pill tone="neutral" size="sm">{`#${report.estimatedDelayMinutes}분`}</Pill>
            )}
            <Pill tone="neutral" size="sm">{`#${report.lineId}호선`}</Pill>
          </View>
        </View>

        {/* Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제보 추이</Text>
          <Text style={styles.sectionHint}>최근 30분간 같은 구간</Text>
          <View style={styles.trendRow}>
            {trendTicks.map((tick, idx) => (
              <View key={idx} style={styles.trendTick} testID={`trend-tick-${idx}`}>
                <View style={[styles.trendDot, tick.isAnchor && styles.trendDotActive]} />
                <Text style={[styles.trendLabel, tick.isAnchor && styles.trendLabelActive]}>{tick.time}</Text>
              </View>
            ))}
          </View>
          {trendTicks.some(t => t.isAnchor) && (
            <Text style={styles.trendAnchorLabel} testID="trend-anchor-label">
              {formatHHmm(reportAt)} 정점 · 동시 제보 {Math.max(1, report.upvotes)}건
            </Text>
          )}
        </View>

        {/* Impact stations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>영향 구간</Text>
          <View style={styles.impactList}>
            {impactRows.map((row, idx) => (
              <View key={row.name} style={styles.impactRow} testID={`impact-row-${idx}`}>
                <View style={[styles.impactDot, { backgroundColor: lineColor }]} />
                <Text style={styles.impactName}>{row.name}</Text>
                <Text style={[styles.impactStatus, row.status === '정차 중' && styles.impactStatusBad]}>
                  {row.status}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Related reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>관련 제보</Text>
          <Text style={styles.sectionHint}>같은 노선 · 30분 이내</Text>
          {related.length === 0 ? (
            <Text style={styles.emptyHint} testID="related-empty">
              관련 제보가 없습니다.
            </Text>
          ) : (
            related.map(r => (
              <View key={r.id} style={styles.relatedItem} testID={`related-${r.id}`}>
                <LineBadge line={r.lineId as LineId} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.relatedTitle}>
                    {r.stationName} {(r.userDisplayName ?? '익')[0]}** · {formatMinAgo(new Date(r.timestamp))}
                  </Text>
                  {r.description ? (
                    <Text style={styles.relatedDesc} numberOfLines={1}>
                      {r.description}
                    </Text>
                  ) : null}
                </View>
                <MapPin size={16} color={semantic.labelAlt} />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="report-detail-open-feedback"
          style={styles.feedbackCta}
          onPress={() => onOpenFeedback?.(report)}
          accessibilityRole="button"
          accessibilityLabel="제보 피드백 보기"
        >
          <MessageSquare size={18} color={WANTED_TOKENS.light.labelOnColor} />
          <Text style={styles.feedbackCtaText}>이 제보에 반응 남기기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

ReportDetailScreen.displayName = 'ReportDetailScreen';

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
    hero: {
      margin: WANTED_TOKENS.spacing.s4,
      padding: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      gap: WANTED_TOKENS.spacing.s2,
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroVerified: {},
    heroTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: WANTED_TOKENS.light.labelOnColor,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    heroSubtitle: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: WANTED_TOKENS.light.labelOnColor,
      opacity: 0.95,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: WANTED_TOKENS.spacing.s1,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    heroMeta: { fontSize: WANTED_TOKENS.type.caption1.size, color: WANTED_TOKENS.light.labelOnColor, opacity: 0.9 },
    heroMetaDot: { color: WANTED_TOKENS.light.labelOnColor, opacity: 0.7 },
    reporterCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      marginHorizontal: WANTED_TOKENS.spacing.s4,
      padding: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      backgroundColor: semantic.bgBase,
    },
    reporterAvatar: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      backgroundColor: semantic.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reporterAvatarText: { fontSize: 16, fontWeight: '700', fontFamily: weightToFontFamily('700'), color: semantic.labelStrong },
    reporterName: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    reporterMeta: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt, marginTop: 2 },
    followBtn: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      borderColor: semantic.primaryNormal,
    },
    followBtnText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.primaryNormal,
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
    sectionHint: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt, marginTop: 2 },
    bodyText: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.label1.size,
      color: semantic.labelStrong,
      lineHeight: 22,
    },
    hashtagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: WANTED_TOKENS.spacing.s1, marginTop: WANTED_TOKENS.spacing.s2 },
    trendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: WANTED_TOKENS.spacing.s3 },
    trendTick: { alignItems: 'center', gap: 6 },
    trendDot: { width: 10, height: 10, borderRadius: 9999, backgroundColor: semantic.lineSubtle },
    trendDotActive: { backgroundColor: semantic.primaryNormal },
    trendLabel: { fontSize: WANTED_TOKENS.type.caption2.size, color: semantic.labelAlt },
    trendLabelActive: { color: semantic.primaryNormal, fontWeight: '700', fontFamily: weightToFontFamily('700') },
    trendAnchorLabel: { marginTop: WANTED_TOKENS.spacing.s2, fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.primaryNormal },
    impactList: { marginTop: WANTED_TOKENS.spacing.s2, gap: WANTED_TOKENS.spacing.s2 },
    impactRow: { flexDirection: 'row', alignItems: 'center', gap: WANTED_TOKENS.spacing.s3 },
    impactDot: { width: 10, height: 10, borderRadius: 9999 },
    impactName: { flex: 1, fontSize: WANTED_TOKENS.type.label1.size, color: semantic.labelStrong },
    impactStatus: { fontSize: WANTED_TOKENS.type.label2.size, color: semantic.labelAlt },
    impactStatusBad: { color: semantic.statusNegative, fontWeight: '700', fontFamily: weightToFontFamily('700') },
    emptyHint: { marginTop: WANTED_TOKENS.spacing.s2, fontSize: WANTED_TOKENS.type.label2.size, color: semantic.labelAlt },
    relatedItem: {
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingTop: WANTED_TOKENS.spacing.s3,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
    },
    relatedTitle: { fontSize: WANTED_TOKENS.type.label1.size, fontWeight: '600', fontFamily: weightToFontFamily('600'), color: semantic.labelStrong },
    relatedDesc: { fontSize: WANTED_TOKENS.type.caption1.size, color: semantic.labelAlt, marginTop: 2 },
    footer: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgBase,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    feedbackCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: semantic.primaryNormal,
    },
    feedbackCtaText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: WANTED_TOKENS.light.labelOnColor,
    },
  });

export default ReportDetailScreen;
