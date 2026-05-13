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
import { MessageSquare, Megaphone } from 'lucide-react-native';

import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import { useFavorites } from '@/hooks/useFavorites';
import { delayReportService } from '@/services/delay/delayReportService';
import { stashReport } from '@/services/delay/reportNavCache';
import { DelayReport } from '@/models/delayReport';
import { DelayReportForm } from '@/components/delays/DelayReportForm';
import { ReportCard } from '@/components/delays/ReportCard';
import { ReportCardSkeleton } from '@/components/delays/ReportCardSkeleton';
import { ReportFilterBar, type FilterCategory } from '@/components/delays/ReportFilterBar';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

export const DelayFeedScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  // Memoize styles — feed re-renders on report stream updates (cross-review).
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  const { favorites } = useFavorites();
  const myLineIds = useMemo(
    () => new Set(favorites.map(f => f.lineId)),
    [favorites],
  );

  const [reports, setReports] = useState<DelayReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<FilterCategory>('all');
  const [onlyMyLines, setOnlyMyLines] = useState(false);
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

  const filteredReports = useMemo(
    () =>
      reports
        .filter(r => category === 'all' || r.reportType === category)
        .filter(r => !onlyMyLines || myLineIds.has(r.lineId)),
    [reports, category, onlyMyLines, myLineIds],
  );

  const handleOpenDetail = useCallback(
    (report: DelayReport) => {
      stashReport(report);
      navigation.navigate('ReportDetail', { reportId: report.id });
    },
    [navigation],
  );

  const renderReportItem = ({ item: report }: { item: DelayReport }) => (
    <ReportCard
      report={report}
      currentUserId={user?.id}
      onUpvote={handleUpvote}
      onOpen={handleOpenDetail}
    />
  );

  const renderEmptyState = () => {
    const hasFilter = category !== 'all' || onlyMyLines;
    return (
      <View style={styles.emptyState}>
        <MessageSquare size={64} color={semantic.labelAlt} />
        <Text style={styles.emptyTitle}>제보가 없습니다</Text>
        <Text style={styles.emptySubtitle}>
          {hasFilter
            ? '선택한 필터에 해당하는 제보가 없습니다.'
            : '현재 활성화된 지연 제보가 없습니다.\n지연이 발생하면 제보해주세요!'}
        </Text>
      </View>
    );
  };

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

      {/* Category + my-lines filter */}
      <ReportFilterBar
        selectedCategory={category}
        onSelectCategory={setCategory}
        onlyMyLines={onlyMyLines}
        onToggleMyLines={() => setOnlyMyLines(prev => !prev)}
        myLinesAvailable={myLineIds.size > 0}
      />

      {/* Report Count */}
      <View style={styles.countBar}>
        <MessageSquare size={14} color={semantic.labelAlt} />
        <Text style={styles.countText}>
          {filteredReports.length}개의 활성 제보
        </Text>
      </View>

      {/* Report List — show skeleton placeholders on first load */}
      {loading && reports.length === 0 ? (
        <View style={styles.listContent} testID="delay-feed-skeleton-list">
          <ReportCardSkeleton />
          <ReportCardSkeleton />
          <ReportCardSkeleton />
        </View>
      ) : (
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
      )}

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
