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

import { Clock } from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  useTrainSchedule,
  getFirstTrain,
  getLastTrain,
  type DayTypeOverride,
} from '@/hooks/useTrainSchedule';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

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
    }, []);

    const { schedules, loading, error } = useTrainSchedule({
      stationName,
      lineNumber: lineId,
      direction: directionToCode(direction),
      enabled,
      dayType: selectedDayType,
    });

    const { firstLabel, lastLabel } = useMemo(() => {
      const first = getFirstTrain(schedules);
      const last = getLastTrain(schedules);
      return {
        firstLabel: first ? trimSeconds(first.arrivalTime) : null,
        lastLabel: last ? trimSeconds(last.arrivalTime) : null,
      };
    }, [schedules]);

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
          <Text
            style={[styles.subText, { color: semantic.labelNeutral }]}
            accessibilityLabel={`첫차 ${firstLabel}, 막차 ${lastLabel}`}
          >
            {`${firstLabel} 첫차 · ${lastLabel} 막차`}
          </Text>
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
});
