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
import { WANTED_TOKENS } from '@/styles/modernTheme';
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
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
          <AlertTriangle size={18} color={semantic.statusNegative} />
          <Text style={[styles.affectedTitle, { color: semantic.statusNegative }]}>
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
          <ActivityIndicator size="large" color={semantic.primaryNormal} />
          <Text style={[styles.loadingText, { color: semantic.labelAlt }]}>
            대체 경로를 계산하고 있습니다...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <AlertTriangle size={48} color={semantic.statusNegative} />
          <Text style={[styles.errorText, { color: semantic.statusNegative }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: semantic.primaryNormal }]}
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
          <Map size={48} color={semantic.statusPositive} />
          <Text style={[styles.noDelayTitle, { color: semantic.labelStrong }]}>
            현재 경로에 지연이 없습니다
          </Text>
          <Text style={[styles.noDelaySubtitle, { color: semantic.labelAlt }]}>
            {fromStationName} → {toStationName} 경로는{'\n'}
            정상 운행 중입니다
          </Text>
          {originalRoute && (
            <View
              style={[
                styles.originalRouteInfo,
                { backgroundColor: semantic.bgBase },
              ]}
            >
              <Text style={[styles.originalRouteLabel, { color: semantic.labelAlt }]}>
                예상 소요 시간
              </Text>
              <Text style={[styles.originalRouteTime, { color: semantic.labelStrong }]}>
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
          <AlertTriangle size={48} color={semantic.statusCautionary} />
          <Text style={[styles.noAlternativeTitle, { color: semantic.labelStrong }]}>
            대체 경로를 찾을 수 없습니다
          </Text>
          <Text style={[styles.noAlternativeSubtitle, { color: semantic.labelAlt }]}>
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
            tintColor={semantic.primaryNormal}
          />
        }
      >
        {renderAffectedLines()}

        <Text style={[styles.sectionTitle, { color: semantic.labelStrong }]}>
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
      style={[styles.container, { backgroundColor: semantic.bgSubtlePage }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: semantic.lineNormal }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <ArrowLeft size={24} color={semantic.labelStrong} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: semantic.labelStrong }]}>
            {showComparison ? '경로 비교' : '대체 경로'}
          </Text>
          {fromStationName && toStationName && (
            <Text style={[styles.headerSubtitle, { color: semantic.labelAlt }]}>
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
            color={loading ? semantic.labelAlt : semantic.labelStrong}
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
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: WANTED_TOKENS.spacing.s1,
    marginRight: WANTED_TOKENS.spacing.s2,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    marginTop: 2,
  },
  refreshButton: {
    padding: WANTED_TOKENS.spacing.s1,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: WANTED_TOKENS.spacing.s3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s5,
  },
  loadingText: {
    marginTop: WANTED_TOKENS.spacing.s3,
    fontSize: WANTED_TOKENS.type.body1.size,
  },
  errorText: {
    marginTop: WANTED_TOKENS.spacing.s3,
    fontSize: WANTED_TOKENS.type.body1.size,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s1,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    borderRadius: WANTED_TOKENS.radius.r4,
    marginTop: WANTED_TOKENS.spacing.s4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '600',
  },
  noDelayTitle: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    fontWeight: '700',
    marginTop: WANTED_TOKENS.spacing.s3,
    textAlign: 'center',
  },
  noDelaySubtitle: {
    fontSize: WANTED_TOKENS.type.body1.size,
    marginTop: WANTED_TOKENS.spacing.s1,
    textAlign: 'center',
    lineHeight: 22,
  },
  originalRouteInfo: {
    marginTop: WANTED_TOKENS.spacing.s4,
    padding: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r4,
    alignItems: 'center',
  },
  originalRouteLabel: {
    fontSize: WANTED_TOKENS.type.caption1.size,
  },
  originalRouteTime: {
    fontSize: WANTED_TOKENS.type.title3.size,
    fontWeight: '700',
    marginTop: WANTED_TOKENS.spacing.s1,
  },
  noAlternativeTitle: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    fontWeight: '700',
    marginTop: WANTED_TOKENS.spacing.s3,
    textAlign: 'center',
  },
  noAlternativeSubtitle: {
    fontSize: WANTED_TOKENS.type.body1.size,
    marginTop: WANTED_TOKENS.spacing.s1,
    textAlign: 'center',
    lineHeight: 22,
  },
  affectedContainer: {
    marginBottom: WANTED_TOKENS.spacing.s3,
  },
  affectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s1,
    marginBottom: WANTED_TOKENS.spacing.s1,
  },
  affectedTitle: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '600',
  },
  affectedLines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: WANTED_TOKENS.spacing.s1,
  },
  affectedLineChip: {
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 4,
    borderRadius: WANTED_TOKENS.radius.r2,
  },
  affectedLineText: {
    color: '#FFFFFF',
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: WANTED_TOKENS.type.body1.size,
    fontWeight: '600',
    marginBottom: WANTED_TOKENS.spacing.s2,
  },
});

export default AlternativeRoutesScreen;
