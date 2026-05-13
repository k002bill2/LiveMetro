/**
 * Report Card Skeleton
 *
 * 실시간 제보 피드 로딩 중 placeholder. ReportCard와 동일한 외곽선/spacing을
 * 유지해 데이터 도착 시 시각 점프(layout shift)를 방지.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, type WantedSemanticTheme } from '@/styles/modernTheme';

export const ReportCardSkeleton: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={styles.card} testID="report-card-skeleton" accessibilityLabel="제보 로딩 중">
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.lineBadge} />
          <View style={styles.stationBar} />
          <View style={styles.spacer} />
          <View style={styles.timeBar} />
        </View>
        <View style={styles.typeBar} />
        <View style={styles.bodyBarLong} />
        <View style={styles.bodyBarShort} />
        <View style={styles.footerRow}>
          <View style={styles.reporterBar} />
          <View style={styles.actionBar} />
        </View>
      </View>
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      marginBottom: WANTED_TOKENS.spacing.s3,
      overflow: 'hidden',
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    accent: {
      width: 4,
      backgroundColor: semantic.bgSubtle,
    },
    content: {
      flex: 1,
      padding: WANTED_TOKENS.spacing.s3,
      gap: WANTED_TOKENS.spacing.s2,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    lineBadge: {
      width: 22,
      height: 22,
      borderRadius: 9999,
      backgroundColor: semantic.bgSubtle,
    },
    stationBar: {
      width: 60,
      height: 14,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
    spacer: {
      flex: 1,
    },
    timeBar: {
      width: 40,
      height: 10,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
    typeBar: {
      width: 80,
      height: 16,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
    bodyBarLong: {
      width: '100%',
      height: 12,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
    bodyBarShort: {
      width: '70%',
      height: 12,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: WANTED_TOKENS.spacing.s2,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    reporterBar: {
      width: 50,
      height: 10,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
    actionBar: {
      width: 70,
      height: 16,
      borderRadius: 4,
      backgroundColor: semantic.bgSubtle,
    },
  });

ReportCardSkeleton.displayName = 'ReportCardSkeleton';

export default ReportCardSkeleton;
