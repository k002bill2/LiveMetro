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
 *  - Search bar — taps open the app-wide StationSearchModal (full station
 *    DB, line filters). Picked stations are appended to the list, pre-
 *    selected, and persisted alongside the recommendations on complete.
 *  - Recommended stations: 홍대입구 / 강남 / 잠실 / 서울역 / 신촌 / 합정.
 *    Departure + arrival from the previous step are pre-selected and
 *    annotated with their reason ("출발역" / "도착역") so the user sees
 *    why they're already toggled on.
 *  - "완료 ({n})" CTA — disabled when n=0. Tap →
 *      saveCommuteRoutes(uid, morning, reverseCommuteRoute(morning))
 *                                            // evening = reversed morning leg
 *      addFavorites(selection)               // single bulk write via
 *                                            // FavoritesContext (SSOT)
 *      onComplete()
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight, Check, Search, Star } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

import { useAuth } from '@/services/auth/AuthContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { LineBadge } from '@/components/design/LineBadge';
import { Pill } from '@/components/design/Pill';
import { useOnboardingCallbacks } from '@/navigation/OnboardingNavigator';
import { OnboardingStackParamList } from '@/navigation/types';
import { saveCommuteRoutes } from '@/services/commute/commuteService';
import { useFavorites } from '@/hooks/useFavorites';
import { StationSearchModal } from '@/components/commute/StationSearchModal';
import {
  CommuteRoute,
  StationSelection,
  reverseCommuteRoute,
  DEFAULT_EVENING_DEPARTURE_TIME,
} from '@/models/commute';
import type { OnboardingRouteData } from '@/navigation/types';
import { Station } from '@/models/train';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FavoritesOnboarding'>;

interface RecommendedStation {
  id: string;
  name: string;
  nameEn: string;
  lineIds: string[];
  reason?: string; // "출발역", "도착역", or topical reason
}

// Wanted handoff captions: each non-route station carries a short
// signal-rich reason ("주변 역", "환승 빈도 높음", "KTX/공항"). Route
// stations are annotated dynamically below with "집 근처 · 출발역" and
// "회사 근처 · 도착역".
const RECOMMENDATIONS: readonly RecommendedStation[] = [
  { id: 'stn-sadang',   name: '사당',   nameEn: 'Sadang',   lineIds: ['2', '4'],          reason: '환승 빈도 높음' },
  { id: 'stn-seoul',    name: '서울역', nameEn: 'Seoul Station', lineIds: ['1', '4', '경의선'], reason: 'KTX/공항' },
  { id: 'stn-yongsan',  name: '용산',   nameEn: 'Yongsan',  lineIds: ['1'],               reason: '주변 역' },
  { id: 'stn-jamsil',   name: '잠실',   nameEn: 'Jamsil',   lineIds: ['2', '8'],          reason: '주변 역' },
  { id: 'stn-hongik',   name: '홍대입구', nameEn: 'Hongik Univ.', lineIds: ['2', '6', '경의선'], reason: '주변 역' },
  { id: 'stn-gangnam',  name: '강남',   nameEn: 'Gangnam',  lineIds: ['2', '신분당선'],   reason: '주변 역' },
];

// Materialises the morning (출근) leg from the collected OnboardingRouteData.
// The evening (퇴근) leg is derived separately by reversing this morning leg
// (reverseCommuteRoute), so this helper only ever emits the forward direction.
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
  const lineId = 'lineIds' in rec ? (rec.lineIds[0] ?? '') : rec.lineId;
  return {
    id,
    name,
    nameEn,
    lineId,
    coordinates: { latitude: 0, longitude: 0 },
    transfers: [],
  };
};

export const FavoritesOnboardingScreen: React.FC<Props> = ({ navigation, route }) => {
  const semantic = useSemanticTokens();
  const { user } = useAuth();
  const { addFavorites } = useFavorites();
  const { onComplete, onSkip } = useOnboardingCallbacks();

  // Annotate recommendations with the user's route stations as pre-selections.
  const annotated = useMemo<RecommendedStation[]>(() => {
    const dep = route.params.route.departureStation;
    const arr = route.params.route.arrivalStation;
    const fromRoute: RecommendedStation[] = [
      { id: dep.stationId, name: dep.stationName, nameEn: '', lineIds: [dep.lineId], reason: '집 근처 · 출발역' },
      { id: arr.stationId, name: arr.stationName, nameEn: '', lineIds: [arr.lineId], reason: '회사 근처 · 도착역' },
    ];
    // Drop any recommendation that duplicates a route station, then prepend
    // the route stations.
    const filtered = RECOMMENDATIONS.filter(
      (r) => r.id !== dep.stationId && r.id !== arr.stationId,
    );
    return [...fromRoute, ...filtered];
  }, [route.params.route]);

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  // Stations added via the full-DB search modal (station_cd ids). Kept
  // separate from the static recommendations so the save chain can persist
  // them too — the recommendation slugs and search station_cds share one
  // selection Set but distinct origin lists.
  const [searchAdded, setSearchAdded] = useState<RecommendedStation[]>([]);
  // Pre-select departure + arrival.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set([
      route.params.route.departureStation.stationId,
      route.params.route.arrivalStation.stationId,
    ]);
  });
  const [submitting, setSubmitting] = useState(false);

  // Recommendations (incl. route stations) + search-added stations. This is
  // the single pool the list renders and the save chain persists from.
  const pool = useMemo<RecommendedStation[]>(
    () => [...annotated, ...searchAdded],
    [annotated, searchAdded],
  );

  // Already-listed stations are hidden from the search modal. Names cover the
  // whole pool (recommendations use slug ids that an id-only exclude misses,
  // and one name can map to several sibling-line station_cds); ids add an
  // exact guard for search-added station_cds.
  const excludeIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const excludeNames = useMemo(() => pool.map((s) => s.name), [pool]);

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

  // Add a station picked from the full-DB search modal. Match against the
  // pool by BOTH id and name: recommendations use slug ids while the search
  // returns station_cd, so id alone misses cross-space collisions (mirrors
  // OnboardingStationPicker's name-based exclude). On a match we SELECT the
  // existing row rather than rejecting the pick — picking a station already
  // shown (an unselected recommendation, a sibling-line transfer code, or a
  // deselected search add) honors the user's intent without a duplicate row.
  const handleSearchSelect = useCallback(
    (selection: StationSelection) => {
      setSearchModalVisible(false);
      const match = pool.find(
        (s) => s.id === selection.stationId || s.name === selection.stationName,
      );
      if (match) {
        setSelectedIds((prev) => new Set(prev).add(match.id));
        return;
      }
      const added: RecommendedStation = {
        id: selection.stationId,
        name: selection.stationName,
        nameEn: '',
        lineIds: [selection.lineId],
        reason: '검색으로 추가',
      };
      setSearchAdded((prev) => [...prev, added]);
      setSelectedIds((prev) => new Set(prev).add(selection.stationId));
    },
    [pool],
  );

  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount > 0 && !submitting;
  const depId = route.params.route.departureStation.stationId;
  const arrId = route.params.route.arrivalStation.stationId;
  const isRecommended = (id: string): boolean => id === depId || id === arrId;

  const handleComplete = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const uid = user?.id;
      if (!uid) {
        Alert.alert('오류', '사용자 인증이 필요합니다. 다시 로그인해주세요.');
        return;
      }

      // 1. Save commute route — the morning (출근) leg comes straight from the
      // collected route; the evening (퇴근) leg is its reverse
      // (reverseCommuteRoute): endpoints swapped and the transfer chain walked
      // backwards, carrying the evening departure time. eveningDepartureTime
      // falls back to DEFAULT_EVENING_DEPARTURE_TIME for legacy callers that
      // skipped the CommuteTime step.
      const morningRoute = toCommuteRoute(
        route.params.route,
        route.params.notifications,
      );
      const eveningRoute = reverseCommuteRoute(
        morningRoute,
        route.params.route.eveningDepartureTime ?? DEFAULT_EVENING_DEPARTURE_TIME,
      );
      const saveResult = await saveCommuteRoutes(uid, morningRoute, eveningRoute);
      if (!saveResult.success) {
        Alert.alert('저장 실패', saveResult.error ?? '경로 저장에 실패했습니다.');
        return;
      }

      // 2. Add every selected station as a favorite — through FavoritesContext,
      //    never favoritesService directly: the context only reloads on its
      //    own mutations, so a bypassed write leaves every screen showing an
      //    empty list until the next in-context mutation. One bulk call: the
      //    whole selection lands in a single Firestore write and triggers a
      //    single reload (no per-station round-trip, no reloads racing a not-
      //    yet-written sibling add). Failures are logged but don't block
      //    onComplete — partial favorites are recoverable from the Favorites
      //    screen.
      const selected = pool.filter((r) => selectedIds.has(r.id));
      try {
        await addFavorites(
          selected.map((s) => ({
            station: toStationModel(s),
            isCommuteStation:
              s.id === route.params.route.departureStation.stationId ||
              s.id === route.params.route.arrivalStation.stationId,
          })),
        );
      } catch (err) {
        console.error('Add favorites failed', err);
      }

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
    pool,
    selectedIds,
    addFavorites,
    onComplete,
  ]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: semantic.bgBase }]}
      testID="favorites-onboarding"
    >
      <OnbHeader
        currentStep={5}
        totalSteps={5}
        onBack={() => navigation.canGoBack() && navigation.goBack()}
        onSkip={onSkip}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text
          style={[styles.stepEyebrow, { color: semantic.primaryNormal }]}
          testID="favorites-eyebrow"
          accessibilityRole="text"
        >
          STEP 5 / 5
        </Text>
        <Text
          style={[styles.title, { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') }]}
          testID="favorites-title"
        >
          자주 가는 역을{'\n'}골라주세요
        </Text>
        <Text
          style={[styles.subtitle, { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') }]}
        >
          홈 화면 상단에 빠르게 확인할 수 있어요.{'\n'}최소 1개 이상 선택해주세요.
        </Text>

        <TouchableOpacity
          testID="favorites-search"
          onPress={() => setSearchModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="전체 역 검색"
          style={[
            styles.searchRow,
            { backgroundColor: semantic.bgSubtlePage, borderColor: semantic.lineSubtle },
          ]}
        >
          <Search size={16} color={semantic.labelAlt} strokeWidth={2} />
          <Text
            style={[
              styles.searchInput,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
            ]}
          >
            전체 역 검색
          </Text>
        </TouchableOpacity>

        <View style={styles.sectionRow}>
          <Text
            style={[
              styles.sectionLabel,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('800') },
            ]}
          >
            추천
          </Text>
          <Text
            style={[
              styles.sectionCount,
              { color: semantic.labelAlt, fontFamily: weightToFontFamily('700') },
            ]}
            testID="favorites-selected-count"
          >
            {selectedCount}개 선택됨
          </Text>
        </View>

        <View style={styles.list} testID="favorites-list">
          {pool.map((s) => {
            const selected = selectedIds.has(s.id);
            const recommended = isRecommended(s.id);
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
                    backgroundColor: selected
                      ? `${semantic.primaryNormal}0F`
                      : semantic.bgBase,
                    borderColor: selected ? semantic.primaryNormal : semantic.lineSubtle,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.starContainer,
                    {
                      backgroundColor: selected
                        ? semantic.primaryNormal
                        : 'rgba(112,115,124,0.10)',
                    },
                  ]}
                >
                  <Star
                    size={16}
                    color={selected ? semantic.labelOnColor : semantic.labelAlt}
                    strokeWidth={2.2}
                    fill={selected ? semantic.labelOnColor : 'transparent'}
                  />
                </View>

                <View style={styles.rowBody}>
                  <View style={styles.rowNameRow}>
                    <Text
                      style={[
                        styles.rowName,
                        { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
                      ]}
                    >
                      {s.name}
                    </Text>
                    {recommended ? (
                      <Pill tone="primary" size="sm">
                        추천
                      </Pill>
                    ) : null}
                  </View>
                  <View style={styles.rowMetaRow}>
                    {s.lineIds.map((id) => (
                      <LineBadge key={id} line={id} size={16} />
                    ))}
                    {s.reason ? (
                      <Text
                        style={[
                          styles.rowReason,
                          { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
                        ]}
                      >
                        {s.reason}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View
                  style={[
                    styles.checkbox,
                    selected
                      ? { backgroundColor: semantic.primaryNormal, borderWidth: 0 }
                      : { backgroundColor: 'transparent', borderColor: 'rgba(112,115,124,0.28)', borderWidth: 2 },
                  ]}
                >
                  {selected ? (
                    <Check size={14} color={semantic.labelOnColor} strokeWidth={3} />
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
            canSubmit
              ? {
                  backgroundColor: semantic.primaryNormal,
                  shadowColor: semantic.primaryNormal,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                  elevation: 6,
                }
              : { backgroundColor: 'rgba(112,115,124,0.30)' },
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
                color: semantic.labelOnColor,
                fontFamily: weightToFontFamily('800'),
              },
            ]}
          >
            {submitting
              ? '저장 중…'
              : canSubmit
              ? `${selectedCount}개 추가하고 시작하기`
              : '역을 선택해주세요'}
          </Text>
          {canSubmit && !submitting ? (
            <ArrowRight size={18} color={semantic.labelOnColor} strokeWidth={2.4} />
          ) : null}
        </TouchableOpacity>
      </ScrollView>

      <StationSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onSelect={handleSearchSelect}
        title="역 검색"
        placeholder="자주 가는 역을 검색하세요"
        excludeStationIds={excludeIds}
        excludeStationNames={excludeNames}
      />
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
  stepEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.55,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: WANTED_TOKENS.spacing.s2,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  searchRow: {
    marginTop: WANTED_TOKENS.spacing.s5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: WANTED_TOKENS.radius.r6,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionRow: {
    marginTop: WANTED_TOKENS.spacing.s4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: WANTED_TOKENS.spacing.s2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  list: {
    gap: WANTED_TOKENS.spacing.s2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: WANTED_TOKENS.spacing.s3,
  },
  starContainer: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rowReason: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
    marginLeft: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  primary: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: WANTED_TOKENS.spacing.s6,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: -0.16,
  },
});

export default FavoritesOnboardingScreen;
