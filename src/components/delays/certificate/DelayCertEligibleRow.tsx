/**
 * DelayCertEligibleRow — 발급 가능 탭 이력 row.
 *
 * Wanted handoff (settings-detail-2.jsx 96-150행): 날짜 컬럼(MM.DD + 요일) +
 * LineBadge + 역명 13/700 + "HH:MM 탑승 · 사유" 11.5 + 우측 지연 분 20/800.
 * 만료=회색 + opacity 0.55 + "발급 기한 만료", 발급됨 배지, "발급" pill.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DelayHistoryEntry } from '@/models/delayCertificate';
import { LineBadge } from '@/components/design/LineBadge';
import { truncateMinutes } from '@/utils/dateUtils';
import { WEEKDAY_SHORT, formatEntrySub, formatMonthDay, isEntryExpired, toDate } from '@/components/delays/certificate/delayCertFormat';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

interface DelayCertEligibleRowProps {
  entry: DelayHistoryEntry;
  isFirst: boolean;
  isLast: boolean;
  onGenerate: (entry: DelayHistoryEntry) => void;
}

const DelayCertEligibleRowImpl: React.FC<DelayCertEligibleRowProps> = ({
  entry,
  isFirst,
  isLast,
  onGenerate,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const handleGenerate = useCallback(() => {
    onGenerate(entry);
  }, [entry, onGenerate]);

  const timestamp = toDate(entry.timestamp);
  const expired = isEntryExpired(entry.timestamp);
  const delayColor = expired ? semantic.labelAlt : semantic.statusNegative;

  return (
    <View
      style={[
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLastRadius,
        expired && styles.rowExpired,
      ]}
      testID={`history-row-${entry.id}`}
    >
      {/* 날짜 컬럼 */}
      <View style={styles.dateCol}>
        <Text style={styles.dateColMonthDay}>{formatMonthDay(timestamp)}</Text>
        <Text style={styles.dateColWeekday}>
          {WEEKDAY_SHORT[timestamp.getDay()]}
        </Text>
      </View>

      {/* 본문 */}
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <LineBadge line={entry.lineId} size={18} />
          <Text style={styles.rowStation} numberOfLines={1}>
            {entry.stationName}
          </Text>
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {formatEntrySub(entry)}
        </Text>
      </View>

      {/* 우측 — 지연 분 + 액션 */}
      <View style={styles.rowRight}>
        <View style={styles.rowDelayLine}>
          <Text style={[styles.rowDelayValue, { color: delayColor }]}>
            {truncateMinutes(entry.delayMinutes)}
          </Text>
          <Text style={[styles.rowDelayUnit, { color: delayColor }]}>분</Text>
        </View>
        {expired ? (
          <Text style={styles.rowExpiredLabel}>발급 기한 만료</Text>
        ) : entry.certificateGenerated ? (
          <View style={styles.rowIssuedBadge}>
            <Text style={styles.rowIssuedBadgeText}>발급됨</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.rowIssuePill}
            onPress={handleGenerate}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`${entry.stationName} 지연증명서 발급`}
            testID={`issue-pill-${entry.id}`}
          >
            <Text style={styles.rowIssuePillText}>발급</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingVertical: 14,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    rowFirst: {
      borderTopLeftRadius: WANTED_TOKENS.radius.r8,
      borderTopRightRadius: WANTED_TOKENS.radius.r8,
    },
    rowLastRadius: {
      borderBottomLeftRadius: WANTED_TOKENS.radius.r8,
      borderBottomRightRadius: WANTED_TOKENS.radius.r8,
      borderBottomWidth: 0,
    },
    rowExpired: {
      opacity: 0.55,
    },
    dateCol: {
      width: 44,
      flexShrink: 0,
      alignItems: 'center',
    },
    dateColMonthDay: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    dateColWeekday: {
      fontSize: 18,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
      marginTop: 2,
      letterSpacing: -0.36,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowStation: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      flexShrink: 1,
    },
    rowSub: {
      fontSize: 11.5,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 3,
    },
    rowRight: {
      flexShrink: 0,
      alignItems: 'flex-end',
    },
    rowDelayLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
    },
    rowDelayValue: {
      fontSize: 20,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      letterSpacing: -0.4,
    },
    rowDelayUnit: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    rowExpiredLabel: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    rowIssuedBadge: {
      marginTop: WANTED_TOKENS.spacing.s1,
      paddingHorizontal: 10,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgSubtle,
    },
    rowIssuedBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
    },
    rowIssuePill: {
      marginTop: WANTED_TOKENS.spacing.s1,
      paddingHorizontal: 10,
      paddingVertical: WANTED_TOKENS.spacing.s1,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.primaryBg,
    },
    rowIssuePillText: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.primaryNormal,
    },
  });

export const DelayCertEligibleRow = memo(DelayCertEligibleRowImpl);
DelayCertEligibleRow.displayName = 'DelayCertEligibleRow';
