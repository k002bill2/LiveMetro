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
import { ArrowRight, Check, Search, Star } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { useAuth } from '@/services/auth/AuthContext';
import { OnbHeader } from '@/components/onboarding/OnbHeader';
import { LineBadge } from '@/components/design/LineBadge';
import { Pill } from '@/components/design/Pill';
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

// `time` overrides data.departureTime so the same OnboardingRouteData can
// produce both the morning leg (with data.departureTime) and the evening
// leg (with data.eveningDepartureTime). Stations remain identical because
// onboarding doesn't model evening reversal yet — that's a follow-up.
const FALLBACK_EVENING_TIME = '18:30';
const toCommuteRoute = (
  data: OnboardingRouteData,
  notifications: CommuteRoute['notifications'],
  time: string = data.departureTime,
): CommuteRoute => ({
  departureTime: time,
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
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const { user } = useAuth();
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

      // 1. Save commute route — morning + evening legs share stations
      // (no reversal modelling yet) but carry distinct times when the user
      // configured them in CommuteTime. eveningDepartureTime falls back
      // to FALLBACK_EVENING_TIME for legacy callers that skipped that step.
      const morningRoute = toCommuteRoute(
        route.params.route,
        route.params.notifications,
        route.params.route.departureTime,
      );
      const eveningRoute = toCommuteRoute(
        route.params.route,
        route.params.notifications,
        route.params.route.eveningDepartureTime ?? FALLBACK_EVENING_TIME,
      );
      const saveResult = await saveCommuteRoutes(uid, morningRoute, eveningRoute);
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

        <View
          style={[
            styles.searchRow,
            { backgroundColor: semantic.bgSubtlePage, borderColor: semantic.lineSubtle },
          ]}
        >
          <Search size={16} color={semantic.labelAlt} strokeWidth={2} />
          <TextInput
            testID="favorites-search"
            value={query}
            onChangeText={setQuery}
            placeholder="역 이름 검색"
            placeholderTextColor={semantic.labelAlt}
            style={[
              styles.searchInput,
              { color: semantic.labelStrong, fontFamily: weightToFontFamily('600') },
            ]}
          />
        </View>

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
          {visible.map((s) => {
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
