/**
 * StationTimetableSection Tests
 *
 * Covers: header render, dayType 3-segment tab(평일/토요일/일요일·공휴일),
 * tab 선택 시 hook 재호출, loading/error/empty 상태, first/last train surfacing.
 *
 * dayType tab은 이미지 디자인(2026-05-17)을 따름 — 사용자가 요일을
 * 직접 전환하면 useTrainSchedule이 새 weekTag로 재요청.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import type { TrainScheduleItem, UseTrainScheduleResult } from '@/hooks/useTrainSchedule';

// useTheme - 다른 station 테스트와 동일 패턴 (memory: [useTheme 두 경로 mock])
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// useTrainSchedule mock — 기본은 빈 결과. 각 it에서 mockReturnValue로 override.
const mockUseTrainSchedule = jest.fn();
jest.mock('@/hooks/useTrainSchedule', () => ({
  __esModule: true,
  useTrainSchedule: (...args: unknown[]) => mockUseTrainSchedule(...args),
  // 진짜 helper를 그대로 import — 첫차/막차 계산은 hook 결과 처리에 필요
  getFirstTrain: jest.requireActual('@/hooks/useTrainSchedule').getFirstTrain,
  getLastTrain: jest.requireActual('@/hooks/useTrainSchedule').getLastTrain,
}));

// react-native-svg mock — lucide Clock 아이콘 렌더용
// (memory: [lucide+svg 테스트 mock])
jest.mock('react-native-svg', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
    Svg: View,
    G: View,
    Path: View,
    Circle: View,
    Rect: View,
    Line: View,
    Polyline: View,
    Polygon: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
  };
});

import { StationTimetableSection } from '../StationTimetableSection';

const makeScheduleItem = (overrides: Partial<TrainScheduleItem> = {}): TrainScheduleItem => ({
  trainNumber: 'T-001',
  arrivalTime: '05:31:00',
  departureTime: '05:31:30',
  destinationName: '잠실',
  originStationName: '서울대입구',
  dayType: 'weekday',
  direction: 'up',
  ...overrides,
});

const makeHookResult = (
  overrides: Partial<UseTrainScheduleResult> = {}
): UseTrainScheduleResult => ({
  schedules: [],
  upcomingTrains: [],
  loading: false,
  error: null,
  refresh: jest.fn(),
  isViewingToday: true,
  ...overrides,
});

describe('StationTimetableSection', () => {
  const defaultProps = {
    stationName: '강남',
    lineId: '2',
    direction: 'up' as const,
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTrainSchedule.mockReturnValue(makeHookResult());
  });

  describe('Header', () => {
    it('renders the 시간표 title', () => {
      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('시간표')).toBeTruthy();
    });

    it('exposes 시간표 as header role', () => {
      const { getByRole } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByRole('header')).toBeTruthy();
    });

    // F3.A polish: 헤더에 "현재 HH:MM" timestamp — isViewingToday 분기 검증.
    it('renders 현재 HH:MM timestamp when isViewingToday=true', () => {
      mockUseTrainSchedule.mockReturnValue(makeHookResult({ isViewingToday: true }));
      const { getByText } = render(
        <StationTimetableSection {...defaultProps} testID="tt" />,
      );
      // 정확한 시각 값은 매 실행마다 달라지므로 prefix만 매칭.
      // TZ=Asia/Seoul pin(jest.config) 덕에 HH:MM 포맷은 결정적.
      expect(getByText(/^현재 \d{2}:\d{2}$/)).toBeTruthy();
    });

    it('hides 현재 timestamp when isViewingToday=false (browsing another dayType)', () => {
      mockUseTrainSchedule.mockReturnValue(makeHookResult({ isViewingToday: false }));
      const { queryByText } = render(
        <StationTimetableSection {...defaultProps} testID="tt" />,
      );
      expect(queryByText(/^현재 \d{2}:\d{2}$/)).toBeNull();
    });

    it('exposes 현재 시각 accessibilityLabel for screen readers', () => {
      mockUseTrainSchedule.mockReturnValue(makeHookResult({ isViewingToday: true }));
      const { getByLabelText } = render(
        <StationTimetableSection {...defaultProps} testID="tt" />,
      );
      expect(getByLabelText(/^현재 시각 \d{2}:\d{2}$/)).toBeTruthy();
    });
  });

  describe('dayType tab segments', () => {
    it('renders all three tab labels regardless of data', () => {
      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('평일')).toBeTruthy();
      expect(getByText('토요일')).toBeTruthy();
      expect(getByText('일요일·공휴일')).toBeTruthy();
    });

    it('exposes tablist role with 3 tabs', () => {
      const { getAllByRole } = render(<StationTimetableSection {...defaultProps} />);
      const tabs = getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('renders all tab testIDs when testID prop given', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />
      );
      expect(getByTestId('t-tab-weekday')).toBeTruthy();
      expect(getByTestId('t-tab-saturday')).toBeTruthy();
      expect(getByTestId('t-tab-holiday')).toBeTruthy();
    });

    it('marks exactly one tab as selected via accessibilityState', () => {
      const { getAllByRole } = render(<StationTimetableSection {...defaultProps} />);
      const tabs = getAllByRole('tab');
      const selectedCount = tabs.filter(
        (tab) => tab.props.accessibilityState?.selected === true
      ).length;
      expect(selectedCount).toBe(1);
    });

    it('switches selection when user presses 토요일 tab', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />
      );
      const saturdayTab = getByTestId('t-tab-saturday');
      fireEvent.press(saturdayTab);
      expect(saturdayTab.props.accessibilityState?.selected).toBe(true);
    });

    it('re-invokes useTrainSchedule with new dayType after tab press', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />
      );

      fireEvent.press(getByTestId('t-tab-holiday'));

      // 마지막 호출은 사용자 선택 dayType='holiday'로 들어가야 함
      const lastCall = mockUseTrainSchedule.mock.calls.at(-1)?.[0];
      expect(lastCall?.dayType).toBe('holiday');
    });

    it('switches between all three tabs preserving last selection', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />
      );
      fireEvent.press(getByTestId('t-tab-saturday'));
      fireEvent.press(getByTestId('t-tab-holiday'));
      fireEvent.press(getByTestId('t-tab-weekday'));

      const lastCall = mockUseTrainSchedule.mock.calls.at(-1)?.[0];
      expect(lastCall?.dayType).toBe('weekday');
      // 다른 두 tab은 unselected 상태
      expect(getByTestId('t-tab-saturday').props.accessibilityState?.selected).toBe(false);
      expect(getByTestId('t-tab-holiday').props.accessibilityState?.selected).toBe(false);
      expect(getByTestId('t-tab-weekday').props.accessibilityState?.selected).toBe(true);
    });
  });

  describe('Data states', () => {
    it('surfaces first and last train (trimmed seconds)', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({
          schedules: [
            // 막차는 자정 넘긴 00:21 - operating-day arithmetic이 last로 처리해야 함
            makeScheduleItem({ trainNumber: 'last', arrivalTime: '00:21:00' }),
            makeScheduleItem({ trainNumber: 'mid', arrivalTime: '14:00:00' }),
            makeScheduleItem({ trainNumber: 'first', arrivalTime: '05:31:00' }),
          ],
        })
      );

      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      // "HH:MM:SS" → "HH:MM" trimSeconds 변환 검증
      expect(getByText('05:31 첫차 · 00:21 막차')).toBeTruthy();
    });

    it('shows loading message while initial fetch in progress (no cached data)', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({ loading: true, schedules: [] })
      );

      const { getByText } = render(
        <StationTimetableSection {...defaultProps} testID="t" />
      );
      expect(getByText('시간표를 불러오는 중...')).toBeTruthy();
    });

    it('shows error message when hook returns error', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({ error: '시간표는 모바일 앱에서 확인할 수 있습니다.' })
      );

      const { getByText, getByRole } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('시간표는 모바일 앱에서 확인할 수 있습니다.')).toBeTruthy();
      expect(getByRole('alert')).toBeTruthy();
    });

    it('shows empty message when schedule loaded but list is empty', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({ schedules: [], loading: false, error: null })
      );

      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('시간표 정보가 없습니다')).toBeTruthy();
    });
  });

  describe('Hook integration', () => {
    it('passes stationName, lineNumber, direction code, enabled, and dayType to useTrainSchedule', () => {
      render(
        <StationTimetableSection
          stationName="서울대입구"
          lineId="2"
          direction="down"
          enabled={true}
        />
      );

      expect(mockUseTrainSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          stationName: '서울대입구',
          lineNumber: '2',
          direction: '2', // 'down' → '2' (하행/외선)
          enabled: true,
          // dayType은 today(TZ 의존)에 따라 weekday/saturday/holiday — 정확 값
          // 대신 union membership 검증으로 CI flakiness 회피
          dayType: expect.stringMatching(/^(weekday|saturday|holiday)$/),
        })
      );
    });

    it('disables hook when parent screen is unfocused (enabled=false)', () => {
      render(
        <StationTimetableSection
          stationName="강남"
          lineId="2"
          direction="up"
          enabled={false}
        />
      );

      expect(mockUseTrainSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('maps direction="up" to direction code "1"', () => {
      render(<StationTimetableSection {...defaultProps} direction="up" />);
      expect(mockUseTrainSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ direction: '1' })
      );
    });
  });

  describe('Accessibility', () => {
    it('forwards testID to root container', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="my-tt" />
      );
      expect(getByTestId('my-tt')).toBeTruthy();
    });

    it('combines first/last into accessibilityLabel for screen readers', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({
          schedules: [
            makeScheduleItem({ trainNumber: 'first', arrivalTime: '05:31:00' }),
            makeScheduleItem({ trainNumber: 'last', arrivalTime: '00:21:00' }),
          ],
        })
      );

      const { getByLabelText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByLabelText('첫차 05:31, 막차 00:21')).toBeTruthy();
    });

    it('exposes each tab with accessibilityLabel matching its display text', () => {
      const { getByLabelText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByLabelText('평일')).toBeTruthy();
      expect(getByLabelText('토요일')).toBeTruthy();
      expect(getByLabelText('일요일·공휴일')).toBeTruthy();
    });
  });

  // F3.3 — DestinationChipRow integration. schedules에서 unique destinations
  // 추출 + 사용자가 chip 선택 시 schedules 필터링.
  describe('Destination chip filter', () => {
    const multiDestSchedules = [
      makeScheduleItem({ trainNumber: 'A1', arrivalTime: '05:31:00', destinationName: '잠실' }),
      makeScheduleItem({ trainNumber: 'A2', arrivalTime: '06:00:00', destinationName: '잠실' }),
      makeScheduleItem({ trainNumber: 'B1', arrivalTime: '05:45:00', destinationName: '서울대입구' }),
      makeScheduleItem({ trainNumber: 'B2', arrivalTime: '07:00:00', destinationName: '서울대입구' }),
    ];

    beforeEach(() => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({ schedules: multiDestSchedules }),
      );
    });

    it('renders destination chips when schedules have multiple destinations', () => {
      const { getByText } = render(
        <StationTimetableSection {...defaultProps} testID="t" />,
      );
      expect(getByText('잠실')).toBeTruthy();
      expect(getByText('서울대입구')).toBeTruthy();
      expect(getByText('전체')).toBeTruthy();
    });

    it('starts with "전체" selected (no filter applied)', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />,
      );
      const allChip = getByTestId('t-destinations-chip-__all__');
      expect(allChip.props.accessibilityState?.selected).toBe(true);
    });

    it('filters schedules when a destination chip is pressed', () => {
      const { getByTestId, queryByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />,
      );

      // 누르기 전: 둘 다 grid에 노출되는지 chip testID로 간접 확인
      // (grid chip은 testID 패턴 `t-grid-chip-<class>-<minute>` — 05:31 잠실 + 05:45 서울대입구)
      expect(queryByTestId(/t-grid-chip-.*-31/)).toBeTruthy();
      expect(queryByTestId(/t-grid-chip-.*-45/)).toBeTruthy();

      // 잠실 선택 → 서울대입구 출발(05:45, 07:00) 사라져야 함
      fireEvent.press(getByTestId('t-destinations-chip-잠실'));
      expect(queryByTestId(/t-grid-chip-.*-31/)).toBeTruthy(); // 잠실 05:31
      expect(queryByTestId(/t-grid-chip-.*-45/)).toBeNull(); // 서울대 05:45 사라짐
    });

    it('restores all schedules when "전체" pressed after filter', () => {
      const { getByTestId, queryByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />,
      );

      fireEvent.press(getByTestId('t-destinations-chip-잠실'));
      expect(queryByTestId(/t-grid-chip-.*-45/)).toBeNull();

      fireEvent.press(getByTestId('t-destinations-chip-__all__'));
      // 서울대 05:45 다시 표시
      expect(queryByTestId(/t-grid-chip-.*-45/)).toBeTruthy();
    });

    it('resets destination filter when user switches dayType tab', () => {
      const { getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />,
      );

      fireEvent.press(getByTestId('t-destinations-chip-잠실'));
      expect(getByTestId('t-destinations-chip-잠실').props.accessibilityState?.selected).toBe(true);

      // dayType 전환 → destination filter는 자동 리셋 (다른 요일 destination set이 다를 수 있음)
      fireEvent.press(getByTestId('t-tab-saturday'));
      expect(
        getByTestId('t-destinations-chip-__all__').props.accessibilityState?.selected,
      ).toBe(true);
    });

    it('does not render chips when schedules have only one destination', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({
          schedules: [
            makeScheduleItem({ arrivalTime: '05:31:00', destinationName: '잠실' }),
            makeScheduleItem({ arrivalTime: '06:00:00', destinationName: '잠실' }),
          ],
        }),
      );

      const { queryByText } = render(<StationTimetableSection {...defaultProps} />);
      // chip row 자체가 null → 잠실 chip text 없음 (헤더만)
      expect(queryByText('전체')).toBeNull();
    });

    it('updates first/last subtitle to reflect filtered schedules', () => {
      const { getByText, getByTestId } = render(
        <StationTimetableSection {...defaultProps} testID="t" />,
      );

      // 전체: 첫차 05:31(잠실 A1), 막차 07:00(서울대 B2)
      expect(getByText('05:31 첫차 · 07:00 막차')).toBeTruthy();

      // 잠실만: 첫차 05:31, 막차 06:00
      fireEvent.press(getByTestId('t-destinations-chip-잠실'));
      expect(getByText('05:31 첫차 · 06:00 막차')).toBeTruthy();
    });
  });
});
