/**
 * StationTimetableSection
 *
 * 가이드(2026-05-16) #7 follow-up: 시간표 surface를 StationDetailScreen에
 * 다시 추가. Phase 7 Wanted rewrite에서 시간표 tab이 제거된 이후 첫차/
 * 막차 정보가 사용자에게 도달하지 않았음. 본 컴포넌트는 그 minimum-viable
 * 복원 — 헤더에 "오늘의 첫차 · 막차"를 노출해 사용자가 운행 가능성을
 * 빠르게 판단할 수 있게 한다.
 *
 * Scope:
 *   - 오늘(자동 감지) 기준 첫차/막차 시각만 표시
 *   - dayType(평일/토요일/일요일·공휴일) 라벨은 현재 자동 감지 결과
 *     batch — 사용자 전환 tab은 follow-up phase
 *   - 전체 시간표 그리드 + 다음 출발 highlight는 별도 화면(follow-up)
 *
 * 직접 부모(StationDetailScreen)에서 isFocused gating으로 hook을 가드해
 * 비활성 화면 폴링 회피 (memory: [비활성 화면 폴링 게이팅]).
 */

import { Clock } from 'lucide-react-native';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTrainSchedule, getFirstTrain, getLastTrain } from '@/hooks/useTrainSchedule';
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

const DAY_TYPE_LABEL: Record<'weekday' | 'saturday' | 'holiday', string> = {
  weekday: '평일',
  saturday: '토요일',
  holiday: '일요일·공휴일',
};

const directionToCode = (d: 'up' | 'down'): '1' | '2' => (d === 'up' ? '1' : '2');

// "HH:MM:SS" → "HH:MM" — sub-text에 초 정밀도는 noise
const trimSeconds = (time: string): string => {
  const parts = time.split(':');
  if (parts.length < 2) return time;
  return `${parts[0]}:${parts[1]}`;
};

export const StationTimetableSection: React.FC<StationTimetableSectionProps> = memo(
  ({ stationName, lineId, direction, enabled, testID }) => {
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

    const { schedules, loading, error } = useTrainSchedule({
      stationName,
      lineNumber: lineId,
      direction: directionToCode(direction),
      enabled,
    });

    const { firstLabel, lastLabel, dayTypeLabel } = useMemo(() => {
      const first = getFirstTrain(schedules);
      const last = getLastTrain(schedules);
      const dayType = first?.dayType ?? last?.dayType;
      return {
        firstLabel: first ? trimSeconds(first.arrivalTime) : null,
        lastLabel: last ? trimSeconds(last.arrivalTime) : null,
        dayTypeLabel: dayType ? DAY_TYPE_LABEL[dayType] : null,
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
          {dayTypeLabel && (
            <View
              style={[
                styles.dayTypePill,
                { backgroundColor: semantic.bgSubtle },
              ]}
            >
              <Text
                style={[styles.dayTypeText, { color: semantic.labelNeutral }]}
              >
                {dayTypeLabel}
              </Text>
            </View>
          )}
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
  dayTypePill: {
    paddingHorizontal: WANTED_TOKENS.spacing.s2,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dayTypeText: {
    fontSize: WANTED_TOKENS.type.caption1.size,
    lineHeight: WANTED_TOKENS.type.caption1.lh,
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
