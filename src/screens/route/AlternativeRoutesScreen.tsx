/**
 * AlternativeRoutesScreen
 * Shows alternative routes when delays occur
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Map,
} from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { AlternativeRouteCard } from '@/components/route/AlternativeRouteCard';
import { RouteComparisonView } from '@/components/route/RouteComparisonView';
import { useAlternativeRoutes } from '@/hooks/useAlternativeRoutes';
import { useDelayDetection } from '@/hooks/useDelayDetection';
import type { RootStackParamList } from '@/navigation/types';
import type { AlternativeRoute } from '@/models/route';

// ============================================================================
// Types
// ============================================================================

type AlternativeRoutesScreenRouteProp = RouteProp<
  RootStackParamList,
  'AlternativeRoutes'
>;

type AlternativeRoutesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AlternativeRoutes'
>;

// ============================================================================
// Component
// ============================================================================

export const AlternativeRoutesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<AlternativeRoutesScreenNavigationProp>();
  const route = useRoute<AlternativeRoutesScreenRouteProp>();

  const { fromStationId, toStationId, fromStationName, toStationName } =
    route.params || {};

  // State
  const [selectedAlternative, setSelectedAlternative] =
    useState<AlternativeRoute | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Hooks
  const { delays } = useDelayDetection();
  const {
    originalRoute,
    alternatives,
    loading,
    error,
    calculate,
    hasAffectedRoute,
    affectedLineIds,
  } = useAlternativeRoutes({ delays });

  // Calculate routes on mount
  useEffect(() => {
    if (fromStationId && toStationId) {
      calculate(fromStationId, toStationId);
    }
  }, [fromStationId, toStationId, calculate]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (fromStationId && toStationId) {
      await calculate(fromStationId, toStationId);
    }
    setRefreshing(false);
  }, [fromStationId, toStationId, calculate]);

  const handleAlternativePress = useCallback((alt: AlternativeRoute) => {
    setSelectedAlternative(alt);
    setShowComparison(true);
  }, []);

  const handleBackPress = useCallback(() => {
    if (showComparison) {
      setShowComparison(false);
      setSelectedAlternative(null);
    } else {
      navigation.goBack();
    }
  }, [showComparison, navigation]);

  // Render affected lines
  const renderAffectedLines = () => {
    if (affectedLineIds.length === 0) return null;

    return (
      <View style={styles.affectedContainer}>
        <View style={styles.affectedHeader}>
          <AlertTriangle size={18} color={colors.error} />
          <Text style={[styles.affectedTitle, { color: colors.error }]}>
            지연 발생 노선
          </Text>
        </View>
        <View style={styles.affectedLines}>
          {affectedLineIds.map(lineId => (
            <View
              key={lineId}
              style={[
                styles.affectedLineChip,
                { backgroundColor: getSubwayLineColor(lineId) },
              ]}
            >
              <Text style={styles.affectedLineText}>{lineId}호선</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render content
  const renderContent = () => {
    if (loading && alternatives.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            대체 경로를 계산하고 있습니다...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <AlertTriangle size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleRefresh}
          >
            <RefreshCw size={16} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (showComparison && selectedAlternative && originalRoute) {
      return (
        <RouteComparisonView
          originalRoute={originalRoute}
          alternativeRoute={selectedAlternative.alternativeRoute}
          affectedLineIds={affectedLineIds}
        />
      );
    }

    if (!hasAffectedRoute) {
      return (
        <View style={styles.centerContainer}>
          <Map size={48} color={colors.success} />
          <Text style={[styles.noDelayTitle, { color: colors.textPrimary }]}>
            현재 경로에 지연이 없습니다
          </Text>
          <Text style={[styles.noDelaySubtitle, { color: colors.textSecondary }]}>
            {fromStationName} → {toStationName} 경로는{'\n'}
            정상 운행 중입니다
          </Text>
          {originalRoute && (
            <View
              style={[
                styles.originalRouteInfo,
                { backgroundColor: isDark ? colors.surface : colors.background },
              ]}
            >
              <Text style={[styles.originalRouteLabel, { color: colors.textSecondary }]}>
                예상 소요 시간
              </Text>
              <Text style={[styles.originalRouteTime, { color: colors.textPrimary }]}>
                {originalRoute.totalMinutes}분
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (alternatives.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <AlertTriangle size={48} color={colors.warning} />
          <Text style={[styles.noAlternativeTitle, { color: colors.textPrimary }]}>
            대체 경로를 찾을 수 없습니다
          </Text>
          <Text style={[styles.noAlternativeSubtitle, { color: colors.textSecondary }]}>
            지연된 노선을 제외한 경로가 없거나{'\n'}
            너무 많은 시간이 소요됩니다
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {renderAffectedLines()}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          추천 대체 경로
        </Text>

        {alternatives.map((alt, index) => (
          <AlternativeRouteCard
            key={alt.id}
            alternative={alt}
            onPress={() => handleAlternativePress(alt)}
            isRecommended={index === 0}
            showComparison={true}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderMedium }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {showComparison ? '경로 비교' : '대체 경로'}
          </Text>
          {fromStationName && toStationName && (
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {fromStationName} → {toStationName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={loading}
        >
          <RefreshCw
            size={20}
            color={loading ? colors.textSecondary : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>
    </SafeAreaView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  refreshButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  noDelayTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  noDelaySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
    textAlign: 'center',
    lineHeight: 22,
  },
  originalRouteInfo: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  originalRouteLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  originalRouteTime: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
    marginTop: SPACING.xs,
  },
  noAlternativeTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold as '700',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  noAlternativeSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
    textAlign: 'center',
    lineHeight: 22,
  },
  affectedContainer: {
    marginBottom: SPACING.md,
  },
  affectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  affectedTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  affectedLines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  affectedLineChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  affectedLineText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
    marginBottom: SPACING.sm,
  },
});

export default AlternativeRoutesScreen;
