/**
 * StationTimetableSection
 *
 * 가이드(2026-05-16) #7 follow-up: 시간표 surface를 StationDetailScreen에
 * 다시 추가. Phase 7 Wanted rewrite에서 시간표 tab이 제거된 이후 첫차/
 * 막차 정보가 사용자에게 도달하지 않았음. 본 컴포넌트는 minimum-viable
 * 복원 — 헤더에 "오늘의 첫차 · 막차"를 노출해 사용자가 운행 가능성을
 * 빠르게 판단할 수 있게 한다.
 *
 * Scope (F3.1 update — dayType 사용자 전환 tab 추가):
 *   - dayType 3-segment tab (평일/토요일/일요일·공휴일) — 기본은 오늘
 *     자동 감지, 사용자 전환 가능
 *   - 선택된 dayType 기준 첫차/막차 시각 표시
 *   - 전체 시간표 그리드 + 방면 chip은 별도 PR (F3.2, F3.3)
 *
 * 직접 부모(StationDetailScreen)에서 isFocused gating으로 hook을 가드해
 * 비활성 화면 폴링 회피 (memory: [비활성 화면 폴링 게이팅]).
 */

import { ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useTrainSchedule,
  getFirstTrain,
  getLastTrain,
  type DayTypeOverride,
} from '@/hooks/useTrainSchedule';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import { TimetableGrid } from './TimetableGrid';
import { DestinationChipRow } from './DestinationChipRow';

export interface StationTimetableSectionProps {
  /** 역명 (예: "강남") - Seoul timetable API 조회 키 */
  readonly stationName: string;
  /** 호선번호 (예: "2") */
  readonly lineId: string;
  /** 진행 방향. 'up' → 상행/내선(direction code '1'), 'down' → 하행/외선('2') */
  readonly direction: 'up' | 'down';
  /** 부모 화면이 focus 상태일 때만 hook 활성화 — 폴링 절약 */
  readonly enabled: boolean;
  /** 외부 셀렉터 / 테스트용 */
  readonly testID?: string;
}

const directionToCode = (d: 'up' | 'down'): '1' | '2' => (d === 'up' ? '1' : '2');

// "HH:MM:SS" → "HH:MM" — sub-text에 초 정밀도는 noise
const trimSeconds = (time: string): string => {
  const parts = time.split(':');
  if (parts.length < 2) return time;
  return `${parts[0]}:${parts[1]}`;
};

// Date → "HH:MM" — F3.A polish: 헤더의 "현재 HH:MM" timestamp 포맷.
// jest.config의 `process.env.TZ = 'Asia/Seoul'`이 KST를 pin하므로 로컬·CI
// 출력 일관 ([TZ-naive Date.getHours CI 회귀] 메모리 회피).
const formatHHMM = (d: Date): string => {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`;
};

// dayType tab segments. 'auto'는 UI에서 노출 안 함 — 초기 상태일 뿐.
const TAB_SEGMENTS: ReadonlyArray<{ key: Exclude<DayTypeOverride, 'auto'>; label: string }> = [
  { key: 'weekday', label: '평일' },
  { key: 'saturday', label: '토요일' },
  { key: 'holiday', label: '일요일·공휴일' },
];

// 자동 감지된 dayType('weekday'/'saturday'/'holiday')를 사용자 선택 초기값으로 변환
const detectInitialDayType = (now: Date = new Date()): Exclude<DayTypeOverride, 'auto'> => {
  const day = now.getDay();
  // 공휴일은 hook 내부 isKoreanHoliday로 추가 분기되지만, 초기 tab은 요일 기반으로 만들어 두고
  // hook의 첫 fetch가 정확한 dayType을 schedules에 채워 넣음 (item.dayType 신호로 보정 가능)
  if (day === 6) return 'saturday';
  if (day === 0) return 'holiday';
  return 'weekday';
};

export const StationTimetableSection: React.FC<StationTimetableSectionProps> = memo(
  ({ stationName, lineId, direction, enabled, testID }) => {
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

    // 사용자가 선택한 dayType. 초기값은 오늘 요일 자동 감지 결과 — useState
    // initializer 함수로 mount 시 1회만 평가.
    const [selectedDayType, setSelectedDayType] = useState<Exclude<DayTypeOverride, 'auto'>>(
      detectInitialDayType,
    );

    const handleSelectDayType = useCallback((key: Exclude<DayTypeOverride, 'auto'>) => {
      setSelectedDayType(key);
      // dayType 전환 시 destination filter는 의미가 바뀔 수 있음(다른 요일은
      // 다른 종착지 set일 수 있음) → 안전하게 "전체"로 리셋.
      setSelectedDestination(null);
    }, []);

    // 방면(destination) filter. null = 전체, string = 특정 종착지만.
    const [selectedDestination, setSelectedDestination] = useState<string | null>(null);

    // F3.C polish: 시간표 그리드 expand/collapse. 기본은 collapsed — 카드가 너무
    // 길어져 scroll 부담이 큼. 사용자가 "전체 시간표 보기"를 명시적으로 선택해야
    // 펼침. dayType / destination 전환은 collapsed 상태 유지(맥락 보존).
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const handleToggleExpand = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);
    // collapsed 시 노출할 hour group 수. 작은 카드 안에서 ~3 시간대가 한 화면에
    // 들어오는 sweet spot. expanded면 undefined로 풀어 전체 노출.
    const COLLAPSED_HOUR_GROUPS = 3;
    const maxHourGroups = isExpanded ? undefined : COLLAPSED_HOUR_GROUPS;

    const handleSelectDestination = useCallback((d: string | null) => {
      setSelectedDestination(d);
    }, []);

    const { schedules, loading, error, isViewingToday } = useTrainSchedule({
      stationName,
      lineNumber: lineId,
      direction: directionToCode(direction),
      enabled,
      dayType: selectedDayType,
    });

    // F3.A polish: "현재 HH:MM" timestamp — 사용자가 첫차/막차·다음 출발과
    // 현재 시각을 즉시 대조 가능. 분 단위 정밀도면 충분하므로 60s tick. 다른
    // 요일을 browse 중이면(isViewingToday=false) 현재 시각은 무관 정보 →
    // interval 자체를 mount하지 않음(폴링 비용 0).
    //
    // Date 인스턴스 자체를 state로 보관 — F3.C followup(Gemini #142)에서
    // TimetableGrid의 anchor 계산에 동일 시계 prop 전달용. label은 derived.
    const [nowDate, setNowDate] = useState<Date>(() => new Date());
    const nowLabel = useMemo(() => formatHHMM(nowDate), [nowDate]);
    useEffect(() => {
      if (!isViewingToday) return;
      // 분 경계 직후가 가장 자주 갱신되는 순간 — 단순 60s interval로 ±30s 오차
      // 허용. 정밀 60s 정렬은 비용 대비 가치 낮음.
      const id = setInterval(() => {
        setNowDate(new Date());
      }, 60_000);
      return () => clearInterval(id);
    }, [isViewingToday]);

    // schedules에서 unique destinations 추출 — 순서는 첫 출현 순.
    const destinations = useMemo<readonly string[]>(() => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of schedules) {
        const d = s.destinationName?.trim();
        if (!d || seen.has(d)) continue;
        seen.add(d);
        out.push(d);
      }
      return out;
    }, [schedules]);

    // selected destination가 schedule reload(다른 dayType 등) 후에도 여전히
    // 유효한지 확인. 사라지면 자동으로 "전체"로 fallback (사용자가 보이지
    // 않는 chip을 선택한 상태로 grid 비는 일 방지).
    useEffect(() => {
      if (selectedDestination && !destinations.includes(selectedDestination)) {
        setSelectedDestination(null);
      }
    }, [destinations, selectedDestination]);

    // 사용자 선택 destination이 있으면 그것만, 없으면 전체.
    const filteredSchedules = useMemo(() => {
      if (!selectedDestination) return schedules;
      return schedules.filter((s) => s.destinationName === selectedDestination);
    }, [schedules, selectedDestination]);

    // F3.C followup(Gemini #142): unique hour 개수. 토글이 의미를 가지려면
    // 총 hour 개수가 COLLAPSED_HOUR_GROUPS를 초과해야 함. 그 이하면 collapsed
    // == expanded 결과 동일 — toggle 노출은 거짓 affordance.
    //
    // arrivalTime의 첫 2글자(HH)로 unique 추출. groupSchedulesByHour와
    // approximate match — parseHHMM 실패 case(0.x%)만 차이.
    const uniqueHourCount = useMemo(() => {
      const set = new Set<string>();
      for (const s of filteredSchedules) {
        const hh = s.arrivalTime.slice(0, 2);
        if (hh.length === 2) set.add(hh);
      }
      return set.size;
    }, [filteredSchedules]);

    const { firstLabel, lastLabel } = useMemo(() => {
      const first = getFirstTrain(filteredSchedules);
      const last = getLastTrain(filteredSchedules);
      return {
        firstLabel: first ? trimSeconds(first.arrivalTime) : null,
        lastLabel: last ? trimSeconds(last.arrivalTime) : null,
      };
    }, [filteredSchedules]);

    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.headerRow}>
          <Clock size={18} color={semantic.labelStrong} />
          <Text
            style={[styles.title, { color: semantic.labelStrong }]}
            accessibilityRole="header"
          >
            시간표
          </Text>
          {isViewingToday && (
            <Text
              style={[styles.nowLabel, { color: semantic.labelAlt }]}
              accessibilityLabel={`현재 시각 ${nowLabel}`}
              testID={testID ? `${testID}-now` : undefined}
            >
              현재 {nowLabel}
            </Text>
          )}
        </View>

        {/* dayType 3-segment tab — 이미지 디자인의 평일/토요일/일요일·공휴일 */}
        <View
          style={[styles.tabRow, { backgroundColor: semantic.bgSubtle }]}
          accessibilityRole="tablist"
        >
          {TAB_SEGMENTS.map(({ key, label }) => {
            const isSelected = key === selectedDayType;
            return (
              <Pressable
                key={key}
                style={[
                  styles.tabPill,
                  isSelected && [styles.tabPillSelected, { backgroundColor: semantic.bgBase }],
                ]}
                onPress={() => handleSelectDayType(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={label}
                testID={testID ? `${testID}-tab-${key}` : undefined}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isSelected ? semantic.labelStrong : semantic.labelAlt },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading && schedules.length === 0 ? (
          <Text
            style={[styles.subText, { color: semantic.labelAlt }]}
            testID={testID ? `${testID}-loading` : undefined}
          >
            시간표를 불러오는 중...
          </Text>
        ) : error ? (
          <Text
            style={[styles.errorText, { color: semantic.labelAlt }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : firstLabel && lastLabel ? (
          <>
            <Text
              style={[styles.subText, { color: semantic.labelNeutral }]}
              accessibilityLabel={`첫차 ${firstLabel}, 막차 ${lastLabel}`}
            >
              {`${firstLabel} 첫차 · ${lastLabel} 막차`}
            </Text>
            <DestinationChipRow
              destinations={destinations}
              selected={selectedDestination}
              onSelect={handleSelectDestination}
              testID={testID ? `${testID}-destinations` : undefined}
            />
            <TimetableGrid
              schedules={filteredSchedules}
              isViewingToday={isViewingToday}
              maxHourGroups={maxHourGroups}
              currentTime={nowDate}
              testID={testID ? `${testID}-grid` : undefined}
            />
            {/* F3.C polish: 전체 시간표 toggle. 토글이 의미를 가지려면 총
                hour 개수가 COLLAPSED_HOUR_GROUPS를 초과해야 함 — 그렇지
                않으면 toggle 누르나 안 누르나 grid 동일이라 거짓 affordance.
                (Gemini #142 followup) */}
            {filteredSchedules.length > 0 && uniqueHourCount > COLLAPSED_HOUR_GROUPS && (
              <Pressable
                onPress={handleToggleExpand}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={isExpanded ? '시간표 접기' : '전체 시간표 보기'}
                testID={testID ? `${testID}-toggle` : undefined}
                style={({ pressed }) => [
                  styles.toggleRow,
                  pressed && styles.toggleRowPressed,
                ]}
              >
                <Text style={[styles.toggleLabel, { color: semantic.primaryNormal }]}>
                  {isExpanded ? '접기' : '전체 시간표 보기'}
                </Text>
                {isExpanded ? (
                  <ChevronUp size={14} color={semantic.primaryNormal} />
                ) : (
                  <ChevronDown size={14} color={semantic.primaryNormal} />
                )}
              </Pressable>
            )}
            {/* F3.B polish: grid chip 분류(파랑=다음 출발, strikethrough=지난
                열차)를 사용자에게 명시. browse mode(isViewingToday=false)는
                past/next 분류가 disable이라 legend도 무관 → 숨김. 빈 schedules
                는 grid 자체가 null이라 legend만 떠 있으면 어색 → 숨김. */}
            {isViewingToday && filteredSchedules.length > 0 && (
              <View
                style={styles.legendRow}
                accessibilityRole="text"
                accessibilityLabel="다음 출발은 파란색, 지난 열차는 취소선으로 표시"
                testID={testID ? `${testID}-legend` : undefined}
              >
                <View
                  style={[
                    styles.legendSwatchNext,
                    { backgroundColor: semantic.primaryNormal },
                  ]}
                />
                <Text style={[styles.legendLabel, { color: semantic.labelAlt }]}>
                  다음 출발
                </Text>
                <View
                  style={[styles.legendDot, { backgroundColor: semantic.labelAlt }]}
                />
                <Text
                  style={[
                    styles.legendStrike,
                    styles.legendLabel,
                    { color: semantic.labelAlt },
                  ]}
                >
                  00
                </Text>
                <Text style={[styles.legendLabel, { color: semantic.labelAlt }]}>
                  지난 열차
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text
            style={[styles.subText, { color: semantic.labelAlt }]}
            testID={testID ? `${testID}-empty` : undefined}
          >
            시간표 정보가 없습니다
          </Text>
        )}
      </View>
    );
  },
);

StationTimetableSection.displayName = 'StationTimetableSection';

const styles = StyleSheet.create({
  container: {
    paddingTop: WANTED_TOKENS.spacing.s6,
    paddingHorizontal: WANTED_TOKENS.spacing.s5,
    paddingBottom: WANTED_TOKENS.spacing.s3,
    gap: WANTED_TOKENS.spacing.s2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
  },
  title: {
    fontSize: WANTED_TOKENS.type.heading2.size,
    lineHeight: WANTED_TOKENS.type.heading2.lh,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  // F3.A: 헤더 행의 우측 끝으로 timestamp 밀어내기. marginLeft: 'auto'는
  // flex-row 안에서 남은 공간 모두 좌측 여백으로 흡수해 자기 자신을 right-align.
  nowLabel: {
    marginLeft: 'auto',
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  // F3.B: grid chip 분류 legend — 사용자가 파랑 chip / strikethrough chip의
  // 의미를 즉시 이해. 작은 swatch + 라벨 + dot separator + strikethrough 샘플.
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: WANTED_TOKENS.spacing.s1,
  },
  legendSwatchNext: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 4,
    opacity: 0.5,
  },
  legendLabel: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  legendStrike: {
    textDecorationLine: 'line-through',
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillSelected: {
    // 선택 상태는 인라인 backgroundColor + shadow로 강조 (이미지 디자인의 흰 카드 효과)
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  subText: {
    fontSize: WANTED_TOKENS.type.body2.size,
    lineHeight: WANTED_TOKENS.type.body2.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  errorText: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  // F3.C: 전체 시간표 토글 CTA — 색상은 primary로 강조 + chevron icon.
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: WANTED_TOKENS.spacing.s2,
    alignSelf: 'flex-start',
  },
  toggleRowPressed: {
    opacity: 0.7,
  },
  toggleLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});
