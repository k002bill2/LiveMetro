/**
 * Delay Certificate Screen
 * 지연증명서 조회 및 발급 화면
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import {
  FileText,
  Clock,
  MapPin,
  Calendar,
  Share2,
  Trash2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme, ThemeColors } from '@/services/theme';
import { delayHistoryService } from '@/services/delay/delayHistoryService';
import {
  DelayCertificate,
  DelayHistoryEntry,
  DelayReasonLabels,
} from '@/models/delayCertificate';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';

export const DelayCertificateScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [certificates, setCertificates] = useState<DelayCertificate[]>([]);
  const [history, setHistory] = useState<DelayHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'certificates' | 'history'>('certificates');

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [userCerts, userHistory] = await Promise.all([
        delayHistoryService.getUserCertificates(user.id),
        delayHistoryService.getUserHistory(user.id),
      ]);

      setCertificates(userCerts);
      setHistory(userHistory);
    } catch (error) {
      console.error('Failed to load delay data:', error);
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

  const handleShareCertificate = async (certificate: DelayCertificate) => {
    const text = delayHistoryService.formatCertificateText(certificate);

    try {
      await Share.share({
        message: text,
        title: '지연증명서',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleDeleteCertificate = (certificate: DelayCertificate) => {
    Alert.alert(
      '증명서 삭제',
      '이 지연증명서를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await delayHistoryService.deleteCertificate(certificate.id);
            await loadData();
          },
        },
      ]
    );
  };

  const handleGenerateCertificate = async (entry: DelayHistoryEntry) => {
    if (entry.certificateGenerated) {
      Alert.alert('알림', '이미 증명서가 발급되었습니다.');
      return;
    }

    // For simplicity, use current time as actual time
    const timestamp = new Date(entry.timestamp);
    const scheduledTime = timestamp.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const actualTimestamp = new Date(timestamp.getTime() + entry.delayMinutes * 60000);
    const actualTime = actualTimestamp.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const certificate = await delayHistoryService.generateCertificate(
      entry.id,
      scheduledTime,
      actualTime
    );

    if (certificate) {
      Alert.alert('발급 완료', '지연증명서가 발급되었습니다.');
      await loadData();
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderCertificateItem = (certificate: DelayCertificate) => {
    const lineColor = getSubwayLineColor(certificate.lineId);

    return (
      <View key={certificate.id} style={styles.certificateCard}>
        <View style={[styles.lineAccent, { backgroundColor: lineColor }]} />

        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.certificateNumber}>
              <FileText size={16} color={colors.textSecondary} />
              <Text style={styles.certificateNumberText}>
                {certificate.certificateNumber}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {formatDate(new Date(certificate.date))}
            </Text>
          </View>

          {/* Info */}
          <View style={styles.infoRow}>
            <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
              <Text style={styles.lineBadgeText}>{certificate.lineId}호선</Text>
            </View>
            <Text style={styles.stationText}>{certificate.stationName}역</Text>
          </View>

          <View style={styles.delayInfo}>
            <Clock size={14} color={colors.error} />
            <Text style={styles.delayText}>
              {certificate.delayMinutes}분 지연
            </Text>
            <Text style={styles.timeText}>
              ({certificate.scheduledTime} → {certificate.actualTime})
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShareCertificate(certificate)}
            >
              <Share2 size={18} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                공유
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteCertificate(certificate)}
            >
              <Trash2 size={18} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>
                삭제
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderHistoryItem = (entry: DelayHistoryEntry) => {
    const lineColor = getSubwayLineColor(entry.lineId);

    return (
      <TouchableOpacity
        key={entry.id}
        style={styles.historyCard}
        onPress={() => !entry.certificateGenerated && handleGenerateCertificate(entry)}
        disabled={entry.certificateGenerated}
      >
        <View style={[styles.lineAccent, { backgroundColor: lineColor }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.infoRow}>
              <View style={[styles.lineBadge, { backgroundColor: lineColor }]}>
                <Text style={styles.lineBadgeText}>{entry.lineId}호선</Text>
              </View>
              <Text style={styles.stationText}>{entry.stationName}역</Text>
            </View>
            <Text style={styles.dateText}>
              {formatDate(new Date(entry.timestamp))}
            </Text>
          </View>

          <View style={styles.delayInfo}>
            <AlertCircle size={14} color={colors.error} />
            <Text style={styles.delayText}>
              {entry.delayMinutes}분 지연
            </Text>
            <Text style={styles.timeText}>
              {formatTime(new Date(entry.timestamp))}
            </Text>
          </View>

          {entry.reason && (
            <Text style={styles.reasonText}>
              사유: {DelayReasonLabels[entry.reason]}
            </Text>
          )}

          {entry.certificateGenerated ? (
            <View style={styles.generatedBadge}>
              <FileText size={12} color={colors.success} />
              <Text style={styles.generatedText}>증명서 발급됨</Text>
            </View>
          ) : (
            <View style={styles.generateHint}>
              <Text style={styles.generateHintText}>탭하여 증명서 발급</Text>
              <ChevronRight size={16} color={colors.textTertiary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <FileText size={64} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>
        {activeTab === 'certificates'
          ? '발급된 증명서가 없습니다'
          : '지연 이력이 없습니다'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'certificates'
          ? '지연 발생 시 자동으로 기록되며,\n이력에서 증명서를 발급할 수 있습니다.'
          : '지연이 감지되면 자동으로 기록됩니다.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>지연증명서</Text>
        <Text style={styles.headerSubtitle}>
          지연 이력 조회 및 증명서 발급
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'certificates' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('certificates')}
        >
          <FileText
            size={18}
            color={activeTab === 'certificates' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'certificates' && styles.tabTextActive,
            ]}
          >
            증명서 ({certificates.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'history' && styles.tabActive,
          ]}
          onPress={() => setActiveTab('history')}
        >
          <Clock
            size={18}
            color={activeTab === 'history' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'history' && styles.tabTextActive,
            ]}
          >
            이력 ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textPrimary}
          />
        }
      >
        {activeTab === 'certificates' ? (
          certificates.length === 0 ? (
            renderEmptyState()
          ) : (
            certificates.map(renderCertificateItem)
          )
        ) : history.length === 0 ? (
          renderEmptyState()
        ) : (
          history.map(renderHistoryItem)
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <AlertCircle size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            공식 지연증명서는 또타지하철 앱에서 발급받으실 수 있습니다.
            본 서비스는 참고용 기록입니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: {
      fontSize: TYPOGRAPHY.fontSize['2xl'],
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      marginTop: SPACING.xs,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.md,
      gap: SPACING.xs,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: SPACING.lg,
    },
    certificateCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.md,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    historyCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      marginBottom: SPACING.md,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    lineAccent: {
      width: 4,
    },
    cardContent: {
      flex: 1,
      padding: SPACING.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    certificateNumber: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    certificateNumberText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
      fontFamily: 'monospace',
    },
    dateText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    lineBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
    },
    lineBadgeText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    stationText: {
      fontSize: TYPOGRAPHY.fontSize.base,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    delayInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
    },
    delayText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '600',
      color: colors.error,
    },
    timeText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
    },
    reasonText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
      marginTop: SPACING.xs,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.md,
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    actionText: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      fontWeight: '500',
    },
    generatedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
    },
    generatedText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.success,
      fontWeight: '500',
    },
    generateHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: SPACING.sm,
    },
    generateHintText: {
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textTertiary,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING['3xl'],
    },
    emptyTitle: {
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: SPACING.lg,
    },
    emptySubtitle: {
      fontSize: TYPOGRAPHY.fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.sm,
      lineHeight: 20,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.backgroundSecondary,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      marginTop: SPACING.lg,
      gap: SPACING.sm,
    },
    infoText: {
      flex: 1,
      fontSize: TYPOGRAPHY.fontSize.xs,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });

export default DelayCertificateScreen;
