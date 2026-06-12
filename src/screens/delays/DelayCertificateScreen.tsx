/**
 * Delay Certificate Screen — Wanted handoff (settings-detail-2.jsx §1)
 *
 * 지연증명서 조회 및 발급 화면.
 * - 히어로: 발급 가능한 최근 지연 (DelayCertHeroCard)
 * - 탭 세그먼트: 발급 가능 N / 발급 내역 N
 * - 이력 리스트: DelayCertEligibleRow / DelayCertIssuedRow
 * - 증명서 안내: 참고용 증빙 · PDF 저장 · 발급 기한
 *
 * 비즈니스 로직은 delayHistoryService(기록/발급/삭제) +
 * pdfService(PDF 생성·공유)를 그대로 사용한다.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BadgeCheck, Download, FileText, History } from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import { delayHistoryService } from '@/services/delay/delayHistoryService';
import { pdfService } from '@/services/certificate/pdfService';
import {
  DelayCertificate,
  DelayHistoryEntry,
} from '@/models/delayCertificate';
import { DelayCertHeroCard } from '@/components/delays/certificate/DelayCertHeroCard';
import { DelayCertEligibleRow } from '@/components/delays/certificate/DelayCertEligibleRow';
import { DelayCertIssuedRow } from '@/components/delays/certificate/DelayCertIssuedRow';
import {
  CERT_VALID_DAYS,
  formatBoardTime,
  isEntryExpired,
  toDate,
} from '@/components/delays/certificate/delayCertFormat';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';

type TabId = 'eligible' | 'issued';

export const DelayCertificateScreen: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const [certificates, setCertificates] = useState<DelayCertificate[]>([]);
  const [history, setHistory] = useState<DelayHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('eligible');

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [userCerts, userHistory] = await Promise.all([
        delayHistoryService.getUserCertificates(user.id),
        delayHistoryService.getUserHistory(user.id),
      ]);

      setCertificates(userCerts);
      setHistory(userHistory);
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Failed to load delay data:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  /** timestamp 내림차순 정렬 이력 (서비스 정렬에 의존하지 않음) */
  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime()
      ),
    [history]
  );

  /** 발급 가능 = 기한 내 + 미발급 */
  const eligibleCount = useMemo(
    () =>
      sortedHistory.filter(
        (entry) => !entry.certificateGenerated && !isEntryExpired(entry.timestamp)
      ).length,
    [sortedHistory]
  );

  /** 히어로 — 발급 가능한 가장 최근 지연 */
  const heroEntry = useMemo(
    () =>
      sortedHistory.find(
        (entry) => !entry.certificateGenerated && !isEntryExpired(entry.timestamp)
      ) ?? null,
    [sortedHistory]
  );

  // --------------------------------------------------------------------
  // Actions (기존 비즈니스 로직 보존)
  // --------------------------------------------------------------------

  const handleSharePdf = useCallback(async (certificate: DelayCertificate) => {
    try {
      const shared = await pdfService.generateAndSharePdf(certificate);
      if (!shared) {
        // PDF 모듈 미가용 환경(웹 등) — 텍스트 공유로 폴백
        const text = delayHistoryService.formatCertificateText(certificate);
        await Share.share({ message: text, title: '지연증명서' });
      }
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('PDF share failed:', error);
      }
      Alert.alert('오류', '증명서 공유에 실패했습니다.');
    }
  }, []);

  const handleShareText = useCallback(async (certificate: DelayCertificate) => {
    const text = delayHistoryService.formatCertificateText(certificate);

    try {
      await Share.share({ message: text, title: '지연증명서' });
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Share failed:', error);
      }
      Alert.alert('오류', '공유에 실패했습니다.');
    }
  }, []);

  const handleDeleteCertificate = useCallback(
    (certificate: DelayCertificate) => {
      Alert.alert('증명서 삭제', '이 지연증명서를 삭제하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await delayHistoryService.deleteCertificate(certificate.id);
            await loadData();
          },
        },
      ]);
    },
    [loadData]
  );

  const handleGenerateCertificate = useCallback(
    async (entry: DelayHistoryEntry) => {
      if (entry.certificateGenerated) {
        Alert.alert('알림', '이미 증명서가 발급되었습니다.');
        return;
      }

      try {
        // For simplicity, use current time as actual time
        const timestamp = toDate(entry.timestamp);
        const scheduledTime = formatBoardTime(timestamp);
        const actualTimestamp = new Date(
          timestamp.getTime() + entry.delayMinutes * 60000
        );
        const actualTime = formatBoardTime(actualTimestamp);

        const certificate = await delayHistoryService.generateCertificate(
          entry.id,
          scheduledTime,
          actualTime
        );

        if (certificate) {
          Alert.alert('발급 완료', '지연증명서가 발급되었습니다.');
          await loadData();
        }
      } catch (error) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error('Certificate generation failed:', error);
        }
        Alert.alert('오류', '증명서 발급에 실패했습니다.');
      }
    },
    [loadData]
  );

  const handleAddSampleData = useCallback(async () => {
    if (!user) return;

    try {
      await delayHistoryService.addSampleData(user.id);
      Alert.alert('완료', '샘플 데이터가 추가되었습니다.');
      await loadData();
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('Failed to add sample data:', error);
      }
      Alert.alert('오류', '샘플 데이터 추가에 실패했습니다.');
    }
  }, [user, loadData]);

  const handleSelectEligible = useCallback(() => {
    setActiveTab('eligible');
  }, []);
  const handleSelectIssued = useCallback(() => {
    setActiveTab('issued');
  }, []);

  // --------------------------------------------------------------------
  // List composition
  // --------------------------------------------------------------------

  const listData: readonly (DelayHistoryEntry | DelayCertificate)[] =
    activeTab === 'eligible' ? sortedHistory : certificates;

  const keyExtractor = useCallback(
    (item: DelayHistoryEntry | DelayCertificate) => item.id,
    []
  );

  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: DelayHistoryEntry | DelayCertificate;
      index: number;
    }) => {
      const isFirst = index === 0;
      const isLast = index === listData.length - 1;

      if (activeTab === 'eligible') {
        return (
          <DelayCertEligibleRow
            entry={item as DelayHistoryEntry}
            isFirst={isFirst}
            isLast={isLast}
            onGenerate={handleGenerateCertificate}
          />
        );
      }
      return (
        <DelayCertIssuedRow
          cert={item as DelayCertificate}
          isFirst={isFirst}
          isLast={isLast}
          onSharePdf={handleSharePdf}
          onShareText={handleShareText}
          onDelete={handleDeleteCertificate}
        />
      );
    },
    [
      activeTab,
      listData.length,
      handleGenerateCertificate,
      handleSharePdf,
      handleShareText,
      handleDeleteCertificate,
    ]
  );

  const renderListHeader = useCallback(
    () => (
      <View>
        <DelayCertHeroCard entry={heroEntry} onIssue={handleGenerateCertificate} />

        {/* 탭 세그먼트 */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabsTrack}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'eligible' && styles.tabButtonActive]}
              onPress={handleSelectEligible}
              accessibilityRole="tab"
              accessibilityLabel={`발급 가능 ${eligibleCount}건`}
              accessibilityState={{ selected: activeTab === 'eligible' }}
              testID="eligible-tab"
            >
              <Text
                style={[styles.tabLabel, activeTab === 'eligible' && styles.tabLabelActive]}
              >
                발급 가능
              </Text>
              <View
                style={[
                  styles.tabCountChip,
                  activeTab === 'eligible' && styles.tabCountChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    activeTab === 'eligible' && styles.tabCountTextActive,
                  ]}
                  testID="eligible-count"
                >
                  {eligibleCount}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'issued' && styles.tabButtonActive]}
              onPress={handleSelectIssued}
              accessibilityRole="tab"
              accessibilityLabel={`발급 내역 ${certificates.length}건`}
              accessibilityState={{ selected: activeTab === 'issued' }}
              testID="issued-tab"
            >
              <Text
                style={[styles.tabLabel, activeTab === 'issued' && styles.tabLabelActive]}
              >
                발급 내역
              </Text>
              <View
                style={[
                  styles.tabCountChip,
                  activeTab === 'issued' && styles.tabCountChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    activeTab === 'issued' && styles.tabCountTextActive,
                  ]}
                  testID="issued-count"
                >
                  {certificates.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 섹션 라벨 */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>
            {activeTab === 'eligible' ? '최근 지연 이력' : '발급 내역'}
          </Text>
          <Text style={styles.sectionLabelHint}>
            {activeTab === 'eligible'
              ? `최근 ${CERT_VALID_DAYS}일`
              : `총 ${certificates.length}건`}
          </Text>
        </View>
      </View>
    ),
    [
      heroEntry,
      handleGenerateCertificate,
      activeTab,
      eligibleCount,
      certificates.length,
      handleSelectEligible,
      handleSelectIssued,
      styles,
    ]
  );

  const renderListEmpty = useCallback(
    () => (
      <View style={styles.emptyCard} testID="list-empty">
        <FileText size={40} color={semantic.labelAlt} />
        <Text style={styles.emptyTitle}>
          {activeTab === 'eligible' ? '지연 이력이 없어요' : '발급 내역이 없어요'}
        </Text>
        <Text style={styles.emptySub}>
          {activeTab === 'eligible'
            ? '지연이 감지되면 자동으로 기록돼요'
            : '발급 가능 탭에서 증명서를 발급해 보세요'}
        </Text>
      </View>
    ),
    [activeTab, styles, semantic]
  );

  const renderListFooter = useCallback(
    () => (
      <View>
        {activeTab === 'eligible' && listData.length > 0 && (
          <Text style={styles.listFooterNote}>
            지연증명서는 지연 후 {CERT_VALID_DAYS}일까지 발급할 수 있어요. 발급한
            증명서는 PDF로 저장해 회사 · 학교에 제출할 수 있어요.
          </Text>
        )}

        {/* 증명서 안내 */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>증명서 안내</Text>
        </View>
        <View style={styles.infoCard}>
          <View style={[styles.infoRow, styles.infoRowDivider]}>
            <View style={[styles.infoIconBox, styles.infoIconBoxPositive]}>
              <BadgeCheck size={16} color={semantic.statusPositive} strokeWidth={2} />
            </View>
            <View style={styles.infoRowBody}>
              <Text style={styles.infoRowLabel}>공식 증빙 안내</Text>
              <Text style={styles.infoRowSub}>
                공식 지연증명서는 운영기관(또타지하철) 앱에서 발급 · 본 기록은
                참고용이에요
              </Text>
            </View>
          </View>
          <View style={[styles.infoRow, styles.infoRowDivider]}>
            <View style={styles.infoIconBox}>
              <Download size={16} color={semantic.labelNeutral} strokeWidth={2} />
            </View>
            <View style={styles.infoRowBody}>
              <Text style={styles.infoRowLabel}>PDF 저장 · 공유</Text>
              <Text style={styles.infoRowSub}>
                발급한 증명서를 PDF로 저장하거나 텍스트로 공유할 수 있어요
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <History size={16} color={semantic.labelNeutral} strokeWidth={2} />
            </View>
            <View style={styles.infoRowBody}>
              <Text style={styles.infoRowLabel}>발급 기한</Text>
              <Text style={styles.infoRowSub}>
                지연 발생일 기준 {CERT_VALID_DAYS}일 이내
              </Text>
            </View>
          </View>
        </View>

        {/* 시안 하단 노트 — 실제 데이터 출처에 맞춘 honest copy */}
        <Text style={styles.dataSourceNote} testID="data-source-note">
          지연 기록은 서울교통공사 · 코레일 등 운영기관 실시간 데이터를 기반으로
          자동 감지돼요.
        </Text>

        {__DEV__ && (
          <TouchableOpacity
            style={styles.sampleButton}
            onPress={handleAddSampleData}
            accessibilityRole="button"
            accessibilityLabel="샘플 데이터 추가"
            testID="add-sample-data"
          >
            <Text style={styles.sampleButtonText}>샘플 데이터 추가 (개발용)</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </View>
    ),
    [activeTab, listData.length, handleAddSampleData, styles, semantic]
  );

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* 제목은 네이티브 헤더(RootNavigator)가 담당 — 화면 내 중복 헤더 없음 */}
      {loading && history.length === 0 && certificates.length === 0 ? (
        /* 로딩 스켈레톤 — 빈 화면 금지 */
        <View style={styles.skeletonWrap} testID="delay-cert-skeleton">
          <View style={styles.skeletonHero} />
          <View style={styles.skeletonTabs} />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
          <View style={styles.skeletonRow} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={renderListFooter}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={semantic.labelStrong}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

DelayCertificateScreen.displayName = 'DelayCertificateScreen';

// ============================================================================
// Styles
// ============================================================================

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    listContent: {
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s6,
    },

    /* ---- Tabs ---- */
    tabsWrap: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s3,
    },
    tabsTrack: {
      flexDirection: 'row',
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      padding: WANTED_TOKENS.spacing.s1,
    },
    tabButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r5,
    },
    tabButtonActive: {
      backgroundColor: semantic.bgBase,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 2,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },
    tabLabelActive: {
      color: semantic.labelStrong,
    },
    tabCountChip: {
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: semantic.bgSubtle,
    },
    tabCountChipActive: {
      backgroundColor: semantic.primaryNormal,
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
    },
    tabCountTextActive: {
      color: semantic.labelOnColor,
    },

    /* ---- Section labels ---- */
    sectionLabelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s6,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingBottom: WANTED_TOKENS.spacing.s2,
    },
    sectionLabel: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '800',
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelAlt,
      letterSpacing: 0.48,
      textTransform: 'uppercase',
    },
    sectionLabelHint: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
    },

    /* ---- Empty list ---- */
    emptyCard: {
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: WANTED_TOKENS.spacing.s10,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      gap: WANTED_TOKENS.spacing.s2,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.body2.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      textAlign: 'center',
    },
    emptySub: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },

    /* ---- Footer ---- */
    listFooterNote: {
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
      fontSize: 11.5,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 17,
    },
    infoCard: {
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingVertical: 14,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
    },
    infoRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    infoIconBox: {
      width: 32,
      height: 32,
      borderRadius: WANTED_TOKENS.radius.r4,
      backgroundColor: semantic.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    infoIconBoxPositive: {
      backgroundColor: 'rgba(0,191,64,0.12)',
    },
    infoRowBody: {
      flex: 1,
      minWidth: 0,
    },
    infoRowLabel: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    infoRowSub: {
      fontSize: 11.5,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
      lineHeight: 16,
    },
    dataSourceNote: {
      marginTop: WANTED_TOKENS.spacing.s3,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      paddingHorizontal: WANTED_TOKENS.spacing.s1,
      fontSize: 11.5,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      lineHeight: 17,
    },
    sampleButton: {
      marginTop: WANTED_TOKENS.spacing.s4,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: semantic.primaryNormal,
      borderRadius: WANTED_TOKENS.radius.r4,
    },
    sampleButtonText: {
      color: semantic.labelOnColor,
      fontSize: WANTED_TOKENS.type.label1.size,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
    },
    bottomSpacer: {
      height: WANTED_TOKENS.spacing.s6,
    },

    /* ---- Skeleton ---- */
    skeletonWrap: {
      paddingTop: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      gap: WANTED_TOKENS.spacing.s3,
    },
    skeletonHero: {
      height: 180,
      borderRadius: WANTED_TOKENS.radius.r10,
      backgroundColor: semantic.bgSubtle,
    },
    skeletonTabs: {
      height: 52,
      borderRadius: WANTED_TOKENS.radius.r6,
      backgroundColor: semantic.bgSubtle,
    },
    skeletonRow: {
      height: 72,
      borderRadius: WANTED_TOKENS.radius.r8,
      backgroundColor: semantic.bgSubtle,
    },
  });

export default DelayCertificateScreen;
