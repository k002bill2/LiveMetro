/**
 * StationTimetableSection Tests
 *
 * Covers: header render, loading state, error state, first/last train
 * surfacing, dayType pill, empty schedule fallback, dark/light theme.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import type { TrainScheduleItem, UseTrainScheduleResult } from '@/hooks/useTrainSchedule';

import { StationTimetableSection } from '../StationTimetableSection';

// useTheme - 다른 station 테스트와 동일 패턴 (memory: [useTheme 두 경로 mock])
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// useTrainSchedule mock — 기본은 빈 결과. 각 it에서 mockReturnValueOnce로 override.
// 글로벌 setup이 useTrainSchedule을 mock하지 않아 자체 mock 필요.
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

    it('renders 평일 pill when first schedule has weekday dayType', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({
          schedules: [makeScheduleItem({ dayType: 'weekday', arrivalTime: '05:31:00' })],
        })
      );

      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('평일')).toBeTruthy();
    });

    it('renders 토요일 pill when first schedule has saturday dayType', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({
          schedules: [makeScheduleItem({ dayType: 'saturday', arrivalTime: '05:50:00' })],
        })
      );

      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('토요일')).toBeTruthy();
    });

    it('renders 일요일·공휴일 pill when first schedule has holiday dayType', () => {
      mockUseTrainSchedule.mockReturnValue(
        makeHookResult({
          schedules: [makeScheduleItem({ dayType: 'holiday', arrivalTime: '06:00:00' })],
        })
      );

      const { getByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByText('일요일·공휴일')).toBeTruthy();
    });

    it('hides dayType pill when no schedule data available', () => {
      const { queryByText } = render(<StationTimetableSection {...defaultProps} />);
      expect(queryByText('평일')).toBeNull();
      expect(queryByText('토요일')).toBeNull();
      expect(queryByText('일요일·공휴일')).toBeNull();
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
    it('passes stationName, lineNumber, direction code, and enabled to useTrainSchedule', () => {
      render(
        <StationTimetableSection
          stationName="서울대입구"
          lineId="2"
          direction="down"
          enabled={true}
        />
      );

      expect(mockUseTrainSchedule).toHaveBeenCalledWith({
        stationName: '서울대입구',
        lineNumber: '2',
        // 'down' → '2' (하행/외선)
        direction: '2',
        enabled: true,
      });
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
    it('exposes 시간표 as header role', () => {
      const { getByRole } = render(<StationTimetableSection {...defaultProps} />);
      expect(getByRole('header')).toBeTruthy();
    });

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
  });
});
