/**
 * FavoritesOnboardingScreen — onboarding step 4/4 (즐겨찾기).
 *
 * Final step of the redefined onboarding wizard. Collects favorite stations
 * and commits the configured route + alert toggles + favorites in a single
 * sequential await chain before signaling completion.
 *
 * Layout:
 *  - OnbHeader (step 4, back + skip)
 *  - Title + subtitle
 *  - Search field (filters the recommendation list — wires to a future
 *    full-text search; for now, a simple substring filter against the
 *    static recommendation set)
 *  - Recommended stations: 홍대입구 / 강남 / 잠실 / 서울역 / 신촌 / 합정.
 *    Departure + arrival from the previous step are pre-selected and
 *    annotated with their reason ("출발역" / "도착역") so the user sees
 *    why they're already toggled on.
 *  - "완료 ({n})" CTA — disabled when n=0. Tap →
 *      saveCommuteRoutes(uid, route, route)  // single-route bridge
 *      Promise.all(favoritesService.addFavorite(...))
 *      onComplete()
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { LineBadge } from '@/components/design/LineBadge';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';
import { OnboardingStackParamList } from '@/navigation/types';
import { saveCommuteRoutes } from '@/services/commute/commuteService';
import { favoritesService } from '@/services/favorites/favoritesService';
import { CommuteRoute } from '@/models/commute';
import type { OnboardingRouteData } from '@/navigation/types';
import { Station } from '@/models/train';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FavoritesOnboarding'>;

interface RecommendedStation {
  id: string;
  name: string;
  nameEn: string;
  lineId: string;
  reason?: string; // "출발역", "도착역", or topical reason
}

const RECOMMENDATIONS: readonly RecommendedStation[] = [
  { id: 'stn-hongik', name: '홍대입구', nameEn: 'Hongik Univ.', lineId: '2', reason: '인기 역' },
  { id: 'stn-gangnam', name: '강남', nameEn: 'Gangnam', lineId: '2', reason: '인기 역' },
  { id: 'stn-jamsil', name: '잠실', nameEn: 'Jamsil', lineId: '2', reason: '환승 거점' },
  { id: 'stn-seoul', name: '서울역', nameEn: 'Seoul Station', lineId: '1', reason: '주요 환승' },
  { id: 'stn-sinchon', name: '신촌', nameEn: 'Sinchon', lineId: '2', reason: '인기 역' },
  { id: 'stn-hapjeong', name: '합정', nameEn: 'Hapjeong', lineId: '2', reason: '환승 거점' },
];

const toCommuteRoute = (
  data: OnboardingRouteData,
  notifications: CommuteRoute['notifications'],
): CommuteRoute => ({
  departureTime: data.departureTime,
  departureStationId: data.departureStation.stationId,
  departureStationName: data.departureStation.stationName,
  departureLineId: data.departureStation.lineId,
  arrivalStationId: data.arrivalStation.stationId,
  arrivalStationName: data.arrivalStation.stationName,
  arrivalLineId: data.arrivalStation.lineId,
  transferStations: data.transferStations,
  notifications,
  bufferMinutes: 5,
});

const toStationModel = (rec: RecommendedStation | { stationId: string; stationName: string; lineId: string }): Station => {
  const id = 'id' in rec ? rec.id : rec.stationId;
  const name = 'name' in rec ? rec.name : rec.stationName;
  const nameEn = 'nameEn' in rec ? rec.nameEn : '';
  return {
    id,
    name,
    nameEn,
    lineId: rec.lineId,
    coordinates: { latitude: 0, longitude: 0 },
    transfers: [],
  };
};

export const FavoritesOnboardingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { user } = useAuth();
  const { onComplete, onSkip } = useOnboardingCallbacks();

  // Annotate recommendations with the user's route stations as pre-selections.
  const annotated = useMemo<RecommendedStation[]>(() => {
    const dep = route.params.route.departureStation;
    const arr = route.params.route.arrivalStation;
    const fromRoute: RecommendedStation[] = [
      { id: dep.stationId, name: dep.stationName, nameEn: '', lineId: dep.lineId, reason: '출발역' },
      { id: arr.stationId, name: arr.stationName, nameEn: '', lineId: arr.lineId, reason: '도착역' },
    ];
    // Drop any recommendation that duplicates a route station, then prepend
    // the route stations.
    const filtered = RECOMMENDATIONS.filter(
      (r) => r.id !== dep.stationId && r.id !== arr.stationId,
    );
    return [...fromRoute, ...filtered];
  }, [route.params.route]);

  const [query, setQuery] = useState('');
  // Pre-select departure + arrival.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set([
      route.params.route.departureStation.stationId,
      route.params.route.arrivalStation.stationId,
    ]);
  });
  const [submitting, setSubmitting] = useState(false);

  const visible = useMemo(() => {
    if (!query.trim()) return annotated;
    const q = query.trim().toLowerCase();
    return annotated.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nameEn.toLowerCase().includes(q),
    );
  }, [query, annotated]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount > 0 && !submitting;

  const handleComplete = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const uid = user?.id;
      if (!uid) {
        Alert.alert('오류', '사용자 인증이 필요합니다. 다시 로그인해주세요.');
        return;
      }

      // 1. Save commute route (degenerate — same route as morning + evening
      //    until a future phase reintroduces dedicated evening flow).
      const fullRoute = toCommuteRoute(route.params.route, route.params.notifications);
      const saveResult = await saveCommuteRoutes(uid, fullRoute, fullRoute);
      if (!saveResult.success) {
        Alert.alert('저장 실패', saveResult.error ?? '경로 저장에 실패했습니다.');
        return;
      }

      // 2. Add each selected station as a favorite. Failures are logged but
      //    don't block onComplete — partial favorites are recoverable
      //    later from the Favorites screen.
      const selected = annotated.filter((r) => selectedIds.has(r.id));
      await Promise.all(
        selected.map((s) =>
          favoritesService
            .addFavorite({
              userId: uid,
              station: toStationModel(s),
              isCommuteStation:
                s.id === route.params.route.departureStation.stationId ||
                s.id === route.params.route.arrivalStation.stationId,
            })
            .catch((err) => {
              console.error('Add favorite failed for', s.id, err);
              return null;
            }),
        ),
      );

      // 3. Signal onboarding completion → RootNavigator routes to Main.
      await onComplete();
    } catch (err) {
      console.error('Onboarding completion error:', err);
      Alert.alert('오류', '온보딩 완료 처리 중 문제가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    user?.id,
    route.params.route,
    route.params.notifications,
    annotated,
    selectedIds,
    onComplete,
  ]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: semantic.bgBase }]}
      testID="favorites-onboarding"
    >
      <OnbHeader
        currentStep={4}
        onBack={() => navigation.canGoBack() && navigation.goBack()}
        onSkip={onSkip}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text
          style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
          testID="favorites-title"
        >
          자주 가는 역을 골라주세요
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
        >
          홈 화면에서 바로 도착 정보를 확인할 수 있어요. 나중에도 변경 가능합니다.
        </Text>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: semantic.bgSubtle, borderColor: semantic.lineSubtle },
          ]}
        >
          <Search size={18} color={semantic.labelAlt} strokeWidth={2} />
          <TextInput
            testID="favorites-search"
            value={query}
            onChangeText={setQuery}
            placeholder="역 이름 검색"
            placeholderTextColor={semantic.labelAlt}
            style={[styles.searchInput, { color: semantic.labelStrong }]}
          />
        </View>

        <View style={styles.list} testID="favorites-list">
          {visible.map((s) => {
            const selected = selectedIds.has(s.id);
            return (
              <TouchableOpacity
                key={s.id}
                testID={`favorite-row-${s.id}`}
                onPress={() => toggleSelect(s.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={[
                  styles.row,
                  {
                    backgroundColor: semantic.bgBase,
                    borderColor: selected ? semantic.primaryNormal : semantic.lineSubtle,
                    borderWidth: selected ? 1.5 : 1,
                  },
                ]}
              >
                <LineBadge line={s.lineId} size={28} />
                <View style={styles.rowBody}>
                  <Text
                    style={[
                      styles.rowName,
                      { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
                    ]}
                  >
                    {s.name}
                  </Text>
                  {s.reason ? (
                    <Text
                      style={[
                        styles.rowReason,
                        { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
                      ]}
                    >
                      {s.reason}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: selected ? semantic.primaryNormal : semantic.lineNormal,
                      backgroundColor: selected ? semantic.primaryNormal : 'transparent',
                    },
                  ]}
                >
                  {selected ? (
                    <Text
                      style={[
                        styles.checkmark,
                        { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') },
                      ]}
                    >
                      ✓
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          testID="favorites-cta"
          style={[
            styles.primary,
            {
              backgroundColor: canSubmit ? semantic.primaryNormal : semantic.lineSubtle,
            },
          ]}
          onPress={handleComplete}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="완료"
        >
          <Text
            style={[
              styles.primaryLabel,
              {
                color: canSubmit ? semantic.labelOnColor : semantic.labelAlt,
                fontFamily: weightToFontFamily('800'),
              },
            ]}
          >
            {submitting ? '저장 중…' : `완료 (${selectedCount})`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    paddingHorizontal: WANTED_TOKENS.spacing.s6,
    paddingTop: WANTED_TOKENS.spacing.s4,
    paddingBottom: WANTED_TOKENS.spacing.s8,
  },
  title: {
    fontSize: WANTED_TOKENS.type.title3.size,
    lineHeight: WANTED_TOKENS.type.title3.lh,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  searchRow: {
    marginTop: WANTED_TOKENS.spacing.s5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    height: 48,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: WANTED_TOKENS.type.body2.size,
  },
  list: {
    marginTop: WANTED_TOKENS.spacing.s4,
    gap: WANTED_TOKENS.spacing.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: WANTED_TOKENS.spacing.s4,
    borderRadius: WANTED_TOKENS.radius.r6,
    gap: WANTED_TOKENS.spacing.s3,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: WANTED_TOKENS.type.label1.size,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  rowReason: {
    marginTop: 2,
    fontSize: WANTED_TOKENS.type.caption1.size,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  primary: {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WANTED_TOKENS.spacing.s6,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
});

export default FavoritesOnboardingScreen;
