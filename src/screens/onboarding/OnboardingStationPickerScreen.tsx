/**
 * Onboarding Station Picker Screen — Phase 52
 *
 * Full-screen drill-in from CommuteRouteScreen for selecting departure /
 * transfer / arrival stations. Replaces the legacy StationSearchModal
 * pattern with the Wanted handoff design's in-screen flow:
 *
 *   - Visual route slot summary (3 slots, active one highlighted)
 *   - Slot-aware search bar
 *   - Recommended list (favorites for from/to, simple list for transfer)
 *   - browseMode toggle → 노선 탭 + 노선별 가나다순 역 목록 (manual selection)
 *
 * Returns the selection to CommuteRouteScreen via
 * `navigation.navigate('CommuteRoute', { pickedStation }, { merge: true })`.
 * The payload is JSON-serializable so React Navigation does not warn.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Check,
  Home,
  Building2,
  ArrowLeftRight,
  Search,
  Sparkles,
  List,
  X as XIcon,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';
import { getSubwayLineColor } from '@/utils/colorUtils';
import { getLocalStation, getLocalStationsByLine } from '@/services/data/stationsDataService';
import { useFavorites } from '@/hooks/useFavorites';
import type {
  OnboardingStackParamList,
  SettingsStackParamList,
  PickedStationPayload,
} from '@/navigation/types';
import type { StationSelection } from '@/models/commute';

// Picker serves two stacks (onboarding + settings/edit). Branch on
// route.name to pick which screen receives the merged-param handoff.
type Props =
  | NativeStackScreenProps<OnboardingStackParamList, 'OnboardingStationPicker'>
  | NativeStackScreenProps<SettingsStackParamList, 'EditCommuteStationPicker'>;

const LINE_IDS_BROWSE = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '신분당선', '경의선', '수인분당선',
] as const;

const LINE_NAMES_BROWSE: Record<string, string> = {
  '1': '1호선', '2': '2호선', '3': '3호선',
  '4': '4호선', '5': '5호선', '6': '6호선',
  '7': '7호선', '8': '8호선', '9': '9호선',
  '신분당선': '신분당',
  '경의선': '경의중앙',
  '수인분당선': '수인분당',
};

interface SlotMeta {
  label: string;
  Icon: LucideIcon;
  hint: string;
  browseHint: string;
}

const SLOT_META: Record<'departure' | 'transfer' | 'arrival', SlotMeta> = {
  departure: {
    label: '승차역',
    Icon: Home,
    hint: '집 근처 역을 선택해주세요',
    browseHint: '노선을 선택하고 역을 골라주세요',
  },
  transfer: {
    label: '환승역',
    Icon: ArrowLeftRight,
    hint: '환승역을 선택해주세요',
    browseHint: '노선을 선택하고 역을 골라주세요',
  },
  arrival: {
    label: '도착역',
    Icon: Building2,
    hint: '회사 근처 역을 선택해주세요',
    browseHint: '노선을 선택하고 역을 골라주세요',
  },
};

export const OnboardingStationPickerScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { selectionType, excludeStationIds, currentName } = route.params;
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const { favoritesWithDetails } = useFavorites();

  const [query, setQuery] = useState('');
  // For transfer slot, default to browseMode (no GPS-style recommendation
  // exists for transfer pairs in this MVP). For from/to, default to
  // recommend mode (favorites first).
  const [browseMode, setBrowseMode] = useState(selectionType === 'transfer');
  const [selectedLineId, setSelectedLineId] = useState<string>('2');

  const meta = SLOT_META[selectionType];
  const SlotIcon = meta.Icon;

  /** Commit selection back to the host CommuteRoute screen via merged
   *  params. Returns to 'EditCommuteRoute' when invoked from the settings
   *  stack, otherwise the onboarding 'CommuteRoute'.
   */
  const returnRouteName =
    route.name === 'EditCommuteStationPicker' ? 'EditCommuteRoute' : 'CommuteRoute';
  const handlePick = useCallback(
    (station: StationSelection): void => {
      const payload: PickedStationPayload = {
        selectionType,
        station,
      };
      (navigation as unknown as NavigationProp<ParamListBase>).navigate({
        name: returnRouteName,
        params: { pickedStation: payload },
        merge: true,
      });
    },
    [navigation, selectionType, returnRouteName],
  );

  /** Recommended list: commute favorites filtered by exclusion + query. */
  const recommended = useMemo(() => {
    const list = favoritesWithDetails
      .filter(
        (fav) =>
          fav.isCommuteStation &&
          fav.station &&
          !excludeStationIds.includes(fav.stationId),
      )
      .map((fav) => ({
        stationId: fav.stationId,
        stationName: fav.station!.name,
        lineId: fav.station!.lineId,
        lineName: LINE_NAMES_BROWSE[fav.station!.lineId] ?? `${fav.station!.lineId}호선`,
      }));
    if (!query) return list;
    return list.filter((s) => s.stationName.includes(query));
  }, [favoritesWithDetails, excludeStationIds, query]);

  // 환승역은 노선별로 stationId가 다른 row를 가진다(seoulStations.json).
  // exclude를 id만으로 비교하면 다른 노선 탭의 같은 물리적 역이 그대로
  // 노출돼 중복 선택을 허용한다. name으로도 비교해 같은 역을 모두 제외.
  const excludeNames = useMemo(
    () =>
      excludeStationIds
        .map((id) => getLocalStation(id)?.name)
        .filter((n): n is string => Boolean(n)),
    [excludeStationIds],
  );

  /** Browse mode: stations on the selected line, filtered by query, excluded. */
  const browseStations = useMemo(() => {
    const list = getLocalStationsByLine(selectedLineId).filter(
      (s) => !excludeStationIds.includes(s.id) && !excludeNames.includes(s.name),
    );
    if (!query) return list;
    return list.filter((s) => s.name.includes(query));
  }, [selectedLineId, excludeStationIds, excludeNames, query]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header — back + slot label + (placeholder for symmetry) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          accessible
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <ArrowLeft size={24} color={semantic.labelStrong} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{meta.label} 선택</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Active slot summary */}
        <View style={styles.slotSummary}>
          <View style={styles.slotIconWrap}>
            <SlotIcon size={20} color={semantic.primaryNormal} strokeWidth={2.2} />
          </View>
          <View style={styles.slotTextWrap}>
            <Text style={styles.slotLabel}>{meta.label}</Text>
            <Text style={styles.slotValue}>
              {currentName ?? '역을 선택해주세요'}
            </Text>
          </View>
        </View>

        {/* Mode toggle (browse vs recommend) — hidden for transfer (browse-only MVP) */}
        {selectionType !== 'transfer' && (
          <View style={styles.modeRow}>
            <Text style={styles.modeHint}>
              {browseMode ? meta.browseHint : meta.hint}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setBrowseMode((b) => !b);
                setQuery('');
              }}
              style={[
                styles.modeChip,
                browseMode ? styles.modeChipActive : styles.modeChipInactive,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={browseMode ? '추천 보기로 전환' : '직접 선택으로 전환'}
            >
              {browseMode ? (
                <Sparkles size={12} color={semantic.labelOnColor} strokeWidth={2.4} />
              ) : (
                <List size={12} color={semantic.primaryNormal} strokeWidth={2.4} />
              )}
              <Text
                style={[
                  styles.modeChipText,
                  browseMode
                    ? styles.modeChipTextActive
                    : styles.modeChipTextInactive,
                ]}
              >
                {browseMode ? '추천 보기' : '직접 선택'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={semantic.labelAlt} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder={`${meta.label} 이름으로 검색`}
            placeholderTextColor={semantic.labelAlt}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel={`${meta.label} 검색`}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={styles.searchClear}
              accessible
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
            >
              <XIcon size={11} color={semantic.labelOnColor} strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>

        {/* Browse-mode line tabs */}
        {browseMode && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lineTabsRow}
          >
            {LINE_IDS_BROWSE.map((lid) => {
              const lineColor = getSubwayLineColor(lid);
              const isActive = selectedLineId === lid;
              return (
                <TouchableOpacity
                  key={lid}
                  onPress={() => setSelectedLineId(lid)}
                  style={[
                    styles.lineTab,
                    {
                      backgroundColor: isActive ? lineColor : semantic.bgBase,
                      borderColor: isActive ? lineColor : semantic.lineSubtle,
                    },
                  ]}
                  accessible
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${LINE_NAMES_BROWSE[lid]} 선택`}
                >
                  <Text
                    style={[
                      styles.lineTabText,
                      { color: isActive ? semantic.labelOnColor : semantic.labelNeutral },
                    ]}
                  >
                    {LINE_NAMES_BROWSE[lid]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Content area */}
        {browseMode ? (
          /* Browse: stations on selected line, 가나다순 (data already sorted) */
          <View style={styles.browseCard}>
            <View style={styles.browseHeader}>
              <Text style={styles.browseHeaderText}>
                {LINE_NAMES_BROWSE[selectedLineId] ?? selectedLineId} · 총{' '}
                {browseStations.length}개역
              </Text>
            </View>
            {browseStations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {query
                    ? `"${query}"와 일치하는 역이 없어요`
                    : '역 목록이 없어요'}
                </Text>
              </View>
            ) : (
              browseStations.map((s, idx) => {
                const isSelected = s.name === currentName;
                return (
                  <TouchableOpacity
                    key={`${s.id}-${idx}`}
                    onPress={() =>
                      handlePick({
                        stationId: s.id,
                        stationName: s.name,
                        lineId: selectedLineId,
                        lineName:
                          LINE_NAMES_BROWSE[selectedLineId] ??
                          `${selectedLineId}호선`,
                      })
                    }
                    style={[
                      styles.browseRow,
                      idx === browseStations.length - 1 && styles.browseRowLast,
                      isSelected && styles.browseRowSelected,
                    ]}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`${s.name}역 선택`}
                  >
                    <View
                      style={[
                        styles.browseDot,
                        {
                          borderColor: getSubwayLineColor(selectedLineId),
                          backgroundColor: isSelected
                            ? getSubwayLineColor(selectedLineId)
                            : semantic.bgBase,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.browseRowName,
                        isSelected && styles.browseRowNameSelected,
                      ]}
                    >
                      {s.name}
                    </Text>
                    {isSelected ? (
                      <View style={styles.checkBadge}>
                        <Check size={13} color={semantic.labelOnColor} strokeWidth={3} />
                      </View>
                    ) : (
                      <ChevronRight size={15} color={semantic.labelAlt} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          /* Recommended: commute favorites filtered */
          <View style={styles.recommendSection}>
            <Text style={styles.recommendLabel}>
              {query ? '검색 결과' : '추천'}
            </Text>
            {recommended.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {query
                    ? `"${query}"와 일치하는 즐겨찾기가 없어요`
                    : '추천할 역이 없어요. 직접 선택을 눌러 노선별 역 목록에서 골라주세요.'}
                </Text>
              </View>
            ) : (
              recommended.map((s) => (
                <TouchableOpacity
                  key={s.stationId}
                  onPress={() => handlePick(s)}
                  style={styles.recommendRow}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${s.stationName}역 선택`}
                >
                  <View
                    style={[
                      styles.recommendBadge,
                      { backgroundColor: getSubwayLineColor(s.lineId) },
                    ]}
                  >
                    <Text style={styles.recommendBadgeText}>{s.lineId}</Text>
                  </View>
                  <View style={styles.recommendInfo}>
                    <Text style={styles.recommendName}>{s.stationName}</Text>
                    <Text style={styles.recommendLine}>{s.lineName}</Text>
                  </View>
                  <ChevronRight size={18} color={semantic.labelAlt} strokeWidth={2} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgBase,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    headerButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: WANTED_TOKENS.type.headline2.size,
      lineHeight: WANTED_TOKENS.type.headline2.lh,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    scroll: {
      paddingBottom: WANTED_TOKENS.spacing.s10,
    },
    /* Slot summary */
    slotSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    slotIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: semantic.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    slotTextWrap: {
      flex: 1,
    },
    slotLabel: {
      fontSize: WANTED_TOKENS.type.caption1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.primaryNormal,
      letterSpacing: WANTED_TOKENS.type.caption1.size * 0.04,
    },
    slotValue: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginTop: 2,
    },
    /* Mode toggle row */
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s4,
    },
    modeHint: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    modeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
    },
    modeChipActive: {
      backgroundColor: semantic.primaryNormal,
      borderColor: semantic.primaryNormal,
    },
    modeChipInactive: {
      backgroundColor: semantic.bgBase,
      borderColor: semantic.primaryNormal,
    },
    modeChipText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      marginLeft: 4,
    },
    modeChipTextActive: {
      color: semantic.labelOnColor,
    },
    modeChipTextInactive: {
      color: semantic.primaryNormal,
    },
    /* Search bar */
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      marginTop: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      height: 44,
    },
    searchInput: {
      flex: 1,
      marginLeft: WANTED_TOKENS.spacing.s2,
      fontSize: 14,
      color: semantic.labelStrong,
      fontFamily: weightToFontFamily('500'),
    },
    searchClear: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(112,115,124,0.30)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* Line tabs (browse mode) */
    lineTabsRow: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s4,
      paddingBottom: WANTED_TOKENS.spacing.s2,
    },
    lineTab: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
      marginRight: 6,
    },
    lineTabText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    /* Browse list */
    browseCard: {
      backgroundColor: semantic.bgBase,
      marginHorizontal: WANTED_TOKENS.spacing.s5,
      marginTop: WANTED_TOKENS.spacing.s3,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      overflow: 'hidden',
    },
    browseHeader: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      backgroundColor: semantic.bgSubtlePage,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    browseHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      letterSpacing: 11 * 0.04,
    },
    browseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(112,115,124,0.10)',
    },
    browseRowLast: {
      borderBottomWidth: 0,
    },
    browseRowSelected: {
      backgroundColor: semantic.primaryBg,
    },
    browseDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 3,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    browseRowName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    browseRowNameSelected: {
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
    },
    checkBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: semantic.primaryNormal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* Recommend list */
    recommendSection: {
      paddingHorizontal: WANTED_TOKENS.spacing.s5,
      paddingTop: WANTED_TOKENS.spacing.s3,
    },
    recommendLabel: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelAlt,
      letterSpacing: 11 * 0.04,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    recommendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      marginBottom: WANTED_TOKENS.spacing.s2,
    },
    recommendBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    recommendBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelOnColor,
    },
    recommendInfo: {
      flex: 1,
    },
    recommendName: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    recommendLine: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    /* Empty states */
    emptyState: {
      paddingVertical: WANTED_TOKENS.spacing.s8,
      alignItems: 'center',
    },
    emptyCard: {
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r6,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      padding: WANTED_TOKENS.spacing.s5,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

export default OnboardingStationPickerScreen;
