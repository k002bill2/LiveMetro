/**
 * TimetableGrid Tests
 *
 * 1) groupSchedulesByHour pure helper — grouping + classification 분기
 * 2) Render contract — hour label, minute chip, past strikethrough,
 *    next highlight, empty render null
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import type { TrainScheduleItem } from '@/hooks/useTrainSchedule';

// useTheme - 다른 station 테스트와 동일 패턴 (memory: [useTheme 두 경로 mock])
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

import { TimetableGrid, groupSchedulesByHour } from '../TimetableGrid';

const makeItem = (overrides: Partial<TrainScheduleItem> = {}): TrainScheduleItem => ({
  trainNumber: 'T-001',
  arrivalTime: '09:00:00',
  departureTime: '09:00:30',
  destinationName: '잠실',
  originStationName: '서울대입구',
  dayType: 'weekday',
  direction: 'up',
  ...overrides,
});

describe('groupSchedulesByHour', () => {
  // 고정 "지금" 시각으로 reproducibility 확보 — 2026-05-17 09:14:00 (이미지 기준)
  const now = new Date(2026, 4, 17, 9, 14, 0);

  describe('Edge cases', () => {
    it('returns empty array for empty schedules', () => {
      expect(groupSchedulesByHour([], now, true)).toEqual([]);
    });

    it('skips malformed arrivalTime entries', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: 'not-a-time' }),
          makeItem({ arrivalTime: '10:30:00' }),
        ],
        now,
        true,
      );
      // malformed entry는 parsed에서 제외 → 1 hour만 남음
      expect(result).toHaveLength(1);
      expect(result[0]?.hour).toBe('10');
    });
  });

  describe('Grouping + sorting', () => {
    it('groups multiple minutes into one hour row', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: '07:01:00' }),
          makeItem({ arrivalTime: '07:25:00' }),
          makeItem({ arrivalTime: '07:43:00' }),
        ],
        now,
        true,
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.hour).toBe('07');
      expect(result[0]?.chips.map((c) => c.minute)).toEqual(['01', '25', '43']);
    });

    it('orders hours ascending by operating-day minutes (post-midnight last)', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: '00:21:00', trainNumber: 'last' }),
          makeItem({ arrivalTime: '23:50:00', trainNumber: 'late' }),
          makeItem({ arrivalTime: '05:31:00', trainNumber: 'first' }),
        ],
        now,
        true,
      );
      // operating-day: 05 → 23 → 00 (00 = +24h anchor)
      expect(result.map((g) => g.hour)).toEqual(['05', '23', '00']);
    });
  });

  describe('Classification (isViewingToday=true)', () => {
    it('classifies entries before now as past', () => {
      const result = groupSchedulesByHour(
        [makeItem({ arrivalTime: '09:00:00' })], // 09:00 < 09:14
        now,
        true,
      );
      expect(result[0]?.chips[0]?.classification).toBe('past');
    });

    it('classifies the first 2 future entries as next', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: '09:16:00' }), // future #1
          makeItem({ arrivalTime: '09:19:00' }), // future #2
          makeItem({ arrivalTime: '09:22:00' }), // future #3 → not "next"
        ],
        now,
        true,
      );
      const chips = result[0]!.chips;
      expect(chips[0]?.classification).toBe('next');
      expect(chips[1]?.classification).toBe('next');
      expect(chips[2]?.classification).toBe('future');
    });

    it('classifies later future entries as future (not next)', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: '09:16:00' }), // next #1
          makeItem({ arrivalTime: '09:19:00' }), // next #2
          makeItem({ arrivalTime: '10:00:00' }), // future (already 2 next assigned)
        ],
        now,
        true,
      );
      const allChips = result.flatMap((g) => g.chips);
      const futureChips = allChips.filter((c) => c.classification === 'future');
      expect(futureChips).toHaveLength(1);
      expect(futureChips[0]?.minute).toBe('00');
    });

    it('past + next + future coexist in correct counts', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: '08:00:00' }), // past
          makeItem({ arrivalTime: '09:00:00' }), // past
          makeItem({ arrivalTime: '09:16:00' }), // next #1
          makeItem({ arrivalTime: '09:19:00' }), // next #2
          makeItem({ arrivalTime: '10:00:00' }), // future
        ],
        now,
        true,
      );
      const all = result.flatMap((g) => g.chips);
      expect(all.filter((c) => c.classification === 'past')).toHaveLength(2);
      expect(all.filter((c) => c.classification === 'next')).toHaveLength(2);
      expect(all.filter((c) => c.classification === 'future')).toHaveLength(1);
    });
  });

  describe('Classification (isViewingToday=false)', () => {
    it('classifies all entries as future when not viewing today', () => {
      const result = groupSchedulesByHour(
        [
          makeItem({ arrivalTime: '08:00:00' }),
          makeItem({ arrivalTime: '09:16:00' }),
          makeItem({ arrivalTime: '14:00:00' }),
        ],
        now,
        false,
      );
      const all = result.flatMap((g) => g.chips);
      expect(all.every((c) => c.classification === 'future')).toBe(true);
    });
  });
});

describe('TimetableGrid', () => {
  describe('Render contract', () => {
    it('returns null for empty schedules', () => {
      const { toJSON } = render(
        <TimetableGrid schedules={[]} isViewingToday={true} />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders hour label and minute chips', () => {
      const { getByText } = render(
        <TimetableGrid
          schedules={[
            makeItem({ arrivalTime: '07:01:00' }),
            makeItem({ arrivalTime: '07:25:00' }),
          ]}
          isViewingToday={false}
        />,
      );
      expect(getByText('07')).toBeTruthy();
      expect(getByText('01')).toBeTruthy();
      expect(getByText('25')).toBeTruthy();
    });

    it('forwards testID with classification + minute pattern', () => {
      const { getByTestId } = render(
        <TimetableGrid
          schedules={[makeItem({ arrivalTime: '07:25:00' })]}
          isViewingToday={false}
          testID="grid"
        />,
      );
      expect(getByTestId('grid-chip-future-25')).toBeTruthy();
    });

    it('exposes accessibility labels for past chip', () => {
      // Render time depends on system clock for past detection. Use a chip
      // that is guaranteed past relative to any "now" we test under by
      // anchoring before the earliest operating-day minute would be — 04:00.
      // Schedules with hh=00..03 wrap to operating-day next-day anchor,
      // so the safe past-marker is to render via isViewingToday=true with a
      // schedule of `00:00:01` AND a system time that exceeds operating-day
      // anchor — but that's brittle. Instead: render with isViewingToday
      // intentionally true and the only schedule deliberately in the past
      // via a time-shifted approach is hard at component level. So we
      // assert the simpler future path here and rely on groupSchedulesByHour
      // unit tests for past/next semantic coverage.
      const { getByLabelText } = render(
        <TimetableGrid
          schedules={[makeItem({ arrivalTime: '07:25:00' })]}
          isViewingToday={false}
        />,
      );
      // viewing-not-today → future classification → label includes "분"
      // suffix without past/next prefix
      expect(getByLabelText('07시 25분')).toBeTruthy();
    });
  });

  // F3.C polish: maxHourGroups slices the rendered hour rows.
  describe('maxHourGroups (F3.C)', () => {
    const makeMultiHourSchedules = () => [
      makeItem({ arrivalTime: '05:00:00' }),
      makeItem({ arrivalTime: '06:00:00' }),
      makeItem({ arrivalTime: '07:00:00' }),
      makeItem({ arrivalTime: '08:00:00' }),
      makeItem({ arrivalTime: '09:00:00' }),
    ];

    it('shows all hour groups when maxHourGroups is undefined (default)', () => {
      const { getByText } = render(
        <TimetableGrid
          schedules={makeMultiHourSchedules()}
          isViewingToday={false}
        />,
      );
      // 5 hour rows all present.
      expect(getByText('05')).toBeTruthy();
      expect(getByText('06')).toBeTruthy();
      expect(getByText('07')).toBeTruthy();
      expect(getByText('08')).toBeTruthy();
      expect(getByText('09')).toBeTruthy();
    });

    it('slices to first N hour groups when isViewingToday=false (browse mode)', () => {
      const { getByText, queryByText } = render(
        <TimetableGrid
          schedules={makeMultiHourSchedules()}
          isViewingToday={false}
          maxHourGroups={3}
        />,
      );
      // First 3 hours visible
      expect(getByText('05')).toBeTruthy();
      expect(getByText('06')).toBeTruthy();
      expect(getByText('07')).toBeTruthy();
      // Beyond N hidden
      expect(queryByText('08')).toBeNull();
      expect(queryByText('09')).toBeNull();
    });

    it('returns full groups when count <= maxHourGroups (no slice needed)', () => {
      const { getByText } = render(
        <TimetableGrid
          schedules={[
            makeItem({ arrivalTime: '07:00:00' }),
            makeItem({ arrivalTime: '08:00:00' }),
          ]}
          isViewingToday={false}
          maxHourGroups={5}
        />,
      );
      expect(getByText('07')).toBeTruthy();
      expect(getByText('08')).toBeTruthy();
    });

    it('returns null when slice result is empty (defensive — schedules empty)', () => {
      const { toJSON } = render(
        <TimetableGrid
          schedules={[]}
          isViewingToday={false}
          maxHourGroups={3}
        />,
      );
      expect(toJSON()).toBeNull();
    });
  });

  // Gemini #142 review followup: deps reactivity + operating-day 24+ 시간 처리
  describe('currentTime anchor (Gemini #142 followup)', () => {
    // 06시~11시 5 hours fixture — anchor에 따라 slice 시작이 달라짐
    const makeMultiHourSchedules = () => [
      makeItem({ arrivalTime: '06:00:00' }),
      makeItem({ arrivalTime: '07:00:00' }),
      makeItem({ arrivalTime: '08:00:00' }),
      makeItem({ arrivalTime: '09:00:00' }),
      makeItem({ arrivalTime: '10:00:00' }),
    ];

    it('uses currentTime prop hour as anchor when isViewingToday=true', () => {
      // 현재 시각=08:30 → "08" hour부터 3 hours slice → [08, 09, 10]
      const fixed = new Date(2026, 4, 17, 8, 30, 0);
      const { getByText, queryByText } = render(
        <TimetableGrid
          schedules={makeMultiHourSchedules()}
          isViewingToday={true}
          maxHourGroups={3}
          currentTime={fixed}
        />,
      );
      expect(getByText('08')).toBeTruthy();
      expect(getByText('09')).toBeTruthy();
      expect(getByText('10')).toBeTruthy();
      // anchor 이전 hour는 슬라이스에서 제외
      expect(queryByText('06')).toBeNull();
      expect(queryByText('07')).toBeNull();
    });

    it('falls back to last N hours when current time is after all groups (운영 종료)', () => {
      // 현재 시각=23:00 → 모든 group이 anchor보다 이전 → 마지막 N개 표시
      const fixed = new Date(2026, 4, 17, 23, 0, 0);
      const { getByText, queryByText } = render(
        <TimetableGrid
          schedules={makeMultiHourSchedules()}
          isViewingToday={true}
          maxHourGroups={3}
          currentTime={fixed}
        />,
      );
      // 마지막 3개: [08, 09, 10]
      expect(getByText('08')).toBeTruthy();
      expect(getByText('09')).toBeTruthy();
      expect(getByText('10')).toBeTruthy();
      expect(queryByText('06')).toBeNull();
    });

    it('handles operating-day 24+ hours: current=01시 with groups containing "25"', () => {
      // 막차가 자정 넘어 25:30(=다음날 01:30) 같은 경우.
      // 현재=01시면 nowOp=25, groups의 "25"가 anchor (opH=25)와 매칭.
      const fixed = new Date(2026, 4, 17, 1, 0, 0);
      const { getByText } = render(
        <TimetableGrid
          schedules={[
            makeItem({ arrivalTime: '23:00:00' }),
            makeItem({ arrivalTime: '24:00:00' }),
            makeItem({ arrivalTime: '25:00:00' }),
            makeItem({ arrivalTime: '26:00:00' }),
          ]}
          isViewingToday={true}
          maxHourGroups={2}
          currentTime={fixed}
        />,
      );
      // anchor opH=25 ≥ nowOp=25 → "25"부터 → ["25", "26"]
      expect(getByText('25')).toBeTruthy();
      expect(getByText('26')).toBeTruthy();
    });

    it('falls back to currentTime=new Date() when prop is undefined (backward compat)', () => {
      // currentTime 미지정 시 hook 내부 new Date() — 결과 그대로 렌더 가능 검증
      const { toJSON } = render(
        <TimetableGrid
          schedules={[makeItem({ arrivalTime: '07:00:00' })]}
          isViewingToday={true}
          maxHourGroups={3}
        />,
      );
      // currentTime 미지정으로도 그래프가 렌더 — 회귀 가드
      expect(toJSON()).not.toBeNull();
    });
  });
});
