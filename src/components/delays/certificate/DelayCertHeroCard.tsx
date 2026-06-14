/**
 * DelayCertHeroCard — 발급 가능한 최근 지연 히어로 카드.
 *
 * Wanted handoff (settings-detail-2.jsx 53-86행): 파랑 그라데이션
 * (135deg #0066FF→#2C7BFF, radius 20) + eyebrow + 지연 분 44/800 +
 * 날짜 pill + 노선 서클 + 역명 + 탑승 시각 + 흰색 "증명서 발급" CTA.
 * 발급 가능한 지연이 없으면 빈 상태 카드(공간 확보, 빈 화면 금지).
 */

import React, { memo, useCallback, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, FileCheck2, FileText } from 'lucide-react-native';

import { DelayHistoryEntry } from '@/models/delayCertificate';
import { getLineShortLabel } from '@/components/design/LineBadge';
import { truncateMinutes } from '@/utils/dateUtils';
import { CERT_VALID_DAYS, formatBoardTime, formatHeroDate, toDate } from '@/components/delays/certificate/delayCertFormat';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface DelayCertHeroCardProps {
  /** 발급 가능한 가장 최근 지연 — 없으면 빈 상태 카드 */
  entry: DelayHistoryEntry | null;
  onIssue: (entry: DelayHistoryEntry) => void;
}

const DelayCertHeroCardImpl: React.FC<DelayCertHeroCardProps> = ({
  entry,
  onIssue,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const handleIssue = useCallback(() => {
    if (entry) onIssue(entry);
  }, [entry, onIssue]);

  if (!entry) {
    return (
      <View style={styles.heroWrap}>
        <View style={styles.heroEmpty} testID="hero-empty">
          <FileText size={36} color={semantic.labelAlt} />
          <Text style={styles.heroEmptyTitle}>
            최근 {CERT_VALID_DAYS}일 내 발급 가능한 지연이 없어요
          </Text>
          <Text style={styles.heroEmptySub}>
            지연이 감지되면 자동으로 기록돼요
          </Text>
        </View>
      </View>
    );
  }

  const timestamp = toDate(entry.timestamp);
  const lineLabel = getLineShortLabel(entry.lineId) ?? entry.lineId;

  return (
    <View style={styles.heroWrap}>
      {/* Wanted 시안 고정 브랜드 그라데이션 (135deg #0066FF→#2C7BFF) —
          MLHeroCard와 같은 패턴으로 라이트/다크 공통 리터럴 사용 */}
      <LinearGradient
        colors={['#0066FF', '#2C7BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
        testID="hero-card"
      >
        <View style={styles.heroEyebrowRow}>
          <FileCheck2 size={14} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.heroEyebrow}>발급 가능한 최근 지연</Text>
        </View>

        <View style={styles.heroDelayRow}>
          <Text style={styles.heroDelayValue} testID="hero-delay-minutes">
            {truncateMinutes(entry.delayMinutes)}
          </Text>
          <Text style={styles.heroDelayUnit}>분 지연</Text>
          <View style={styles.heroDatePill}>
            <Text style={styles.heroDatePillText}>{formatHeroDate(timestamp)}</Text>
          </View>
        </View>

        <View style={styles.heroStationRow}>
          <View style={styles.heroLineCircle}>
            <Text style={styles.heroLineCircleText}>{lineLabel}</Text>
          </View>
          <Text style={styles.heroStationName}>{entry.stationName}</Text>
          <Text style={styles.heroBoardTime}>
            {formatBoardTime(timestamp)} 탑승
          </Text>
        </View>

        <TouchableOpacity
          style={styles.heroCta}
          onPress={handleIssue}
          accessibilityRole="button"
          accessibilityLabel="지연증명서 발급"
          testID="hero-issue-cta"
        >
          <Download size={15} color="#0066FF" strokeWidth={2.4} />
          <Text style={styles.heroCtaText}>증명서 발급</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    heroWrap: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s1,
      paddingBottom: WANTED_TOKENS.spacing.s3,
    },
    heroCard: {
      borderRadius: WANTED_TOKENS.radius.r10,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: WANTED_TOKENS.spacing.s4,
      shadowColor: '#0066FF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 6,
    },
    heroEyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      opacity: 0.85,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: '#FFFFFF',
      letterSpacing: 0.44,
      textTransform: 'uppercase',
    },
    heroDelayRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    heroDelayValue: {
      fontSize: 44,
      lineHeight: 44,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: '#FFFFFF',
      letterSpacing: -1.3,
    },
    heroDelayUnit: {
      fontSize: 18,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    heroDatePill: {
      marginLeft: 'auto',
      paddingHorizontal: 10,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroDatePillText: {
      fontSize: 11.5,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    heroStationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      marginTop: 14,
    },
    heroLineCircle: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 6,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroLineCircleText: {
      fontSize: 12,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: '#0066FF',
    },
    heroStationName: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    heroBoardTime: {
      marginLeft: 'auto',
      fontSize: 11.5,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: 'rgba(255,255,255,0.85)',
    },
    heroCta: {
      marginTop: WANTED_TOKENS.spacing.s4,
      width: '100%',
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: '#FFFFFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    heroCtaText: {
      fontSize: 14,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: '#0066FF',
    },
    heroEmpty: {
      minHeight: 150,
      borderRadius: WANTED_TOKENS.radius.r10,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      gap: WANTED_TOKENS.spacing.s2,
    },
    heroEmptyTitle: {
      fontSize: WANTED_TOKENS.type.body2.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      textAlign: 'center',
    },
    heroEmptySub: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
  });

export const DelayCertHeroCard = memo(DelayCertHeroCardImpl);
DelayCertHeroCard.displayName = 'DelayCertHeroCard';
