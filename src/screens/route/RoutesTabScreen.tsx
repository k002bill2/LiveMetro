/**
 * RoutesTabScreen — entry screen for the bottom tab "경로".
 *
 * Acts as the empty-state launcher for the existing AlternativeRoutesScreen.
 * Tapping the search CTA navigates to AlternativeRoutes (defined on the
 * outer Stack) with the user's closest station seeded as the origin and
 * Gangnam as the placeholder destination — matching HomeScreen's
 * QuickActionsGrid '경로검색' behavior so users get a consistent entry.
 *
 * Wanted bundle reference: `rest.jsx:7-142` (RoutesScreen). The full
 * RoutesScreen implementation (search bar, time chips, journey strips) is
 * deferred to a follow-up phase; this minimal screen unblocks the TabBar v3
 * migration without expanding scope.
 */
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight, Route as RouteIcon, Search } from 'lucide-react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useNearbyStations } from '@/hooks/useNearbyStations';
import type { AppStackParamList } from '@/navigation/types';

export const RoutesTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  // Use closestStation to pre-seed the search; if location is unavailable the
  // AlternativeRoutesScreen receives an undefined route and shows its own
  // empty state.
  const { closestStation } = useNearbyStations({
    radius: 1000,
    maxStations: 1,
    autoUpdate: true,
    minUpdateInterval: 30000,
  });

  const handleSearch = useCallback((): void => {
    if (closestStation) {
      navigation.navigate('AlternativeRoutes', {
        fromStationId: closestStation.id,
        toStationId: 'gangnam',
        fromStationName: closestStation.name,
        toStationName: '강남',
      });
      return;
    }
    navigation.navigate('AlternativeRoutes' as never);
  }, [closestStation, navigation]);

  return (
    <ScrollView style={styles.container} testID="routes-tab-screen">
      <View style={styles.header}>
        <Text style={styles.title}>경로 검색</Text>
        <Text style={styles.subtitle}>
          출발역과 도착역을 선택해 가장 빠른 경로를 비교해보세요
        </Text>
      </View>

      <View style={styles.emptyState}>
        <RouteIcon size={48} color={semantic.labelAlt} strokeWidth={1.7} />
        <Text style={styles.emptyTitle}>경로를 검색해 보세요</Text>
        <Text style={styles.emptyBody}>
          가까운 역을 출발지로, 자주 가는 역을 도착지로 설정하면 가장 빠른 경로를 찾아드려요.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: semantic.primaryNormal,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleSearch}
          accessibilityRole="button"
          accessibilityLabel="경로 검색 시작"
          testID="routes-tab-search-cta"
        >
          <Search size={18} color={semantic.labelOnColor} />
          <Text style={[styles.ctaText, { color: semantic.labelOnColor }]}>
            경로 검색
          </Text>
          <ArrowRight size={18} color={semantic.labelOnColor} />
        </Pressable>

        {closestStation && (
          <Text style={styles.hint}>
            {`현재 위치 기준 출발역: ${closestStation.name}`}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s6,
      paddingBottom: WANTED_TOKENS.spacing.s4,
    },
    title: {
      fontSize: WANTED_TOKENS.type.heading1.size,
      lineHeight: WANTED_TOKENS.type.heading1.lh,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    subtitle: {
      marginTop: WANTED_TOKENS.spacing.s2,
      fontSize: WANTED_TOKENS.type.body2.size,
      lineHeight: WANTED_TOKENS.type.body2.lh,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s10,
      rowGap: WANTED_TOKENS.spacing.s3,
    },
    emptyTitle: {
      fontSize: WANTED_TOKENS.type.heading2.size,
      lineHeight: WANTED_TOKENS.type.heading2.lh,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginTop: WANTED_TOKENS.spacing.s3,
    },
    emptyBody: {
      fontSize: WANTED_TOKENS.type.body2.size,
      lineHeight: WANTED_TOKENS.type.body2.lh,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      textAlign: 'center',
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.pill,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    ctaText: {
      fontSize: WANTED_TOKENS.type.label1.size,
      fontFamily: weightToFontFamily('700'),
    },
    hint: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      lineHeight: WANTED_TOKENS.type.caption1.lh,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
  });
