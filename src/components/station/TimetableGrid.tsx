/**
 * TimetableGrid
 *
 * F3.2 (image 본문) — 시간대(HH) row + 분(mm) chip 그리드. 사용자 제공
 * 디자인의 핵심 컨텐츠 영역.
 *
 * 시각 분류 (isViewingToday === true 시):
 *   - past: arrivalTime < 현재 시각 → strikethrough + 회색 (이미 떠난 열차)
 *   - next: 가장 가까운 미래 출발 2개 → 파란 highlight (사용자에게 즉시
 *     액션 가능한 정보)
 *   - future: 그 이후 출발 → 보통 색상
 * isViewingToday === false 시: 모두 future로 분류 (browsing 모드 — 다른
 * 요일 시간표 둘러보는 중이라 "현재 시각" 분류는 의미 없음).
 *
 * 빈 schedules → null 반환 (호출자의 빈 상태 처리에 위임).
 */

import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TrainScheduleItem } from '@/hooks/useTrainSchedule';
import { useTheme } from '@/services/theme/themeContext';
import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

export interface TimetableGridProps {
  /** 시간표 항목 — useTrainSchedule().schedules 그대로 전달 */
  readonly schedules: readonly TrainScheduleItem[];
  /** 오늘 요일 시간표인지 (hook의 isViewingToday). false면 past/next 분류 disable */
  readonly isViewingToday: boolean;
  /**
   * F3.C polish: 화면에 표시할 hour group 최대 개수. undefined면 전체 표시
   * (기본 동작 보존). 사용자 expand/collapse 토글 시 collapsed=number,
   * expanded=undefined로 전환. isViewingToday=true이면 현재 시각이 포함된
   * hour group을 anchor로 잡아 거기서부터 N개. false(browse)이면 첫 N개.
   */
  readonly maxHourGroups?: number;
  /** 외부 셀렉터 / 테스트용 */
  readonly testID?: string;
}

type Classification = 'past' | 'next' | 'future';

interface ChipItem {
  readonly minute: string; // 2-digit "00".."59"
  readonly classification: Classification;
  readonly key: string;
}

interface HourGroup {
  readonly hour: string; // 2-digit "05".."25"
  readonly chips: readonly ChipItem[];
}

const NEXT_DEPARTURE_HIGHLIGHT_COUNT = 2;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

const parseHHMM = (arrivalTime: string): { h: number; m: number } | null => {
  const parts = arrivalTime.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 28 || m < 0 || m > 59) return null;
  return { h, m };
};

/**
 * Schedule items를 시간대별로 group + 분류. memo 입력은 schedules + 현재
 * 시각 + isViewingToday → 결과는 hour row 배열.
 *
 * Operating-day arithmetic: 자정 넘긴 행(00:xx)은 24+h 정렬 anchor로 늦은
 * 시각 취급 (useTrainSchedule의 `arrivalTimeToOperatingMinutes`와 동일 정신).
 * 단순 hour sort보다 막차가 그리드 끝에 위치하는 사용자 기대치에 일치.
 */
export const groupSchedulesByHour = (
  schedules: readonly TrainScheduleItem[],
  now: Date,
  isViewingToday: boolean,
): readonly HourGroup[] => {
  if (schedules.length === 0) return [];

  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  // Parse + sort by operating-day minutes
  type Parsed = { h: number; m: number; opMin: number };
  const parsed: Parsed[] = [];
  for (const item of schedules) {
    const hm = parseHHMM(item.arrivalTime);
    if (!hm) continue;
    const opMin = hm.h < 4 ? (hm.h + 24) * 60 + hm.m : hm.h * 60 + hm.m;
    parsed.push({ h: hm.h, m: hm.m, opMin });
  }
  parsed.sort((a, b) => a.opMin - b.opMin);

  // 첫 N개 future (현재 시각 이상) chips를 'next'로 highlight — viewing-today에만
  const nextSet = new Set<number>();
  if (isViewingToday) {
    let assigned = 0;
    for (let i = 0; i < parsed.length && assigned < NEXT_DEPARTURE_HIGHLIGHT_COUNT; i++) {
      const itemSec = parsed[i]!.h * 3600 + parsed[i]!.m * 60;
      if (itemSec >= currentSec) {
        nextSet.add(i);
        assigned++;
      }
    }
  }

  // Group by hour, preserving sort order
  const byHour = new Map<string, ChipItem[]>();
  parsed.forEach((p, idx) => {
    const classification: Classification = !isViewingToday
      ? 'future'
      : nextSet.has(idx)
        ? 'next'
        : (p.h * 3600 + p.m * 60) < currentSec
          ? 'past'
          : 'future';
    const hourKey = pad2(p.h);
    const chip: ChipItem = {
      minute: pad2(p.m),
      classification,
      key: `${hourKey}-${pad2(p.m)}-${idx}`,
    };
    const existing = byHour.get(hourKey);
    if (existing) existing.push(chip);
    else byHour.set(hourKey, [chip]);
  });

  // Map.entries 보존 순서 = 삽입 순서 = parsed 정렬 순서 → 시간대 오름차순
  return Array.from(byHour.entries()).map(([hour, chips]) => ({ hour, chips }));
};

export const TimetableGrid: React.FC<TimetableGridProps> = memo(
  ({ schedules, isViewingToday, maxHourGroups, testID }) => {
    const { isDark } = useTheme();
    const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

    const groups = useMemo(
      () => groupSchedulesByHour(schedules, new Date(), isViewingToday),
      [schedules, isViewingToday],
    );

    // F3.C: collapsed 시 N개 hour groups만 표시. isViewingToday=true는 현재
    // 시각이 포함된 hour group을 anchor로 슬라이스 시작 — 사용자가 "지금부터"
    // 보고 싶어할 때 새벽부터 시작하는 슬라이스는 의미 약함. browse 모드는
    // 첫 N개로 단순 슬라이스.
    const visibleGroups = useMemo(() => {
      if (maxHourGroups === undefined || groups.length <= maxHourGroups) {
        return groups;
      }
      if (isViewingToday) {
        const currentHour = pad2(new Date().getHours());
        const anchorIdx = groups.findIndex((g) => g.hour === currentHour);
        const start = anchorIdx >= 0 ? anchorIdx : 0;
        return groups.slice(start, start + maxHourGroups);
      }
      return groups.slice(0, maxHourGroups);
    }, [groups, maxHourGroups, isViewingToday]);

    if (visibleGroups.length === 0) return null;

    return (
      <View style={styles.container} testID={testID}>
        {visibleGroups.map(({ hour, chips }) => (
          <View key={hour} style={styles.row}>
            <Text
              style={[styles.hourLabel, { color: semantic.labelStrong }]}
              accessibilityLabel={`${hour}시`}
            >
              {hour}
            </Text>
            <View style={styles.chipWrap}>
              {chips.map((chip) => {
                const isPast = chip.classification === 'past';
                const isNext = chip.classification === 'next';
                const chipBg = isNext
                  ? semantic.primaryNormal
                  : 'transparent';
                const chipColor = isNext
                  ? '#FFFFFF'
                  : isPast
                    ? semantic.labelAlt
                    : semantic.labelNeutral;
                return (
                  <View
                    key={chip.key}
                    style={[
                      styles.chip,
                      isNext && [styles.chipNext, { backgroundColor: chipBg }],
                    ]}
                    testID={
                      testID
                        ? `${testID}-chip-${chip.classification}-${chip.minute}`
                        : undefined
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: chipColor },
                        isPast && styles.chipTextPast,
                      ]}
                      accessibilityLabel={
                        isNext
                          ? `${hour}시 ${chip.minute}분 다음 출발`
                          : isPast
                            ? `${hour}시 ${chip.minute}분 지난 열차`
                            : `${hour}시 ${chip.minute}분`
                      }
                    >
                      {chip.minute}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    );
  },
);

TimetableGrid.displayName = 'TimetableGrid';

const styles = StyleSheet.create({
  container: {
    paddingVertical: WANTED_TOKENS.spacing.s2,
    gap: WANTED_TOKENS.spacing.s3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: WANTED_TOKENS.spacing.s3,
  },
  hourLabel: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    width: 24,
    textAlign: 'left',
  },
  chipWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: WANTED_TOKENS.spacing.s2,
  },
  chip: {
    minWidth: 28,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipNext: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  chipText: {
    fontSize: WANTED_TOKENS.type.label1.size,
    lineHeight: WANTED_TOKENS.type.label1.lh,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  chipTextPast: {
    textDecorationLine: 'line-through',
  },
});
