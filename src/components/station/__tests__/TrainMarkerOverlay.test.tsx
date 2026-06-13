/**
 * TrainMarkerOverlay test suite — placement math, card rendering,
 * marker identity across position updates, and accessibility hiding.
 */
import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  TrainMarkerOverlay,
  computeMarkerTop,
  TRAIN_MARKER_HEIGHT,
  type OverlayTrain,
} from '../TrainMarkerOverlay';
import { TIMELINE_ROW_HEIGHT } from '../StationTimelineRow';
import type { TrainPosition } from '@/models/trainPosition';
import { useShouldReduceMotion } from '@/contexts/AccessibilityContext';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));
jest.mock('@/contexts/AccessibilityContext', () => ({
  useShouldReduceMotion: jest.fn(),
}));

const mockReduceMotion = useShouldReduceMotion as jest.Mock;

// Animated.timing ticks via setTimeout in the jest env; fake timers keep the
// frames from firing outside act() after each test finishes.
jest.useFakeTimers();

const buildPosition = (overrides: Partial<TrainPosition> = {}): TrainPosition => ({
  trainNo: '2438',
  subwayId: '1002',
  stationId: '0201',
  stationName: '시청',
  direction: 'up',
  terminalName: '성수',
  status: 'arrived',
  isExpress: false,
  isLastTrain: false,
  receivedAt: 1700000000000,
  ...overrides,
});

const overlayTrain = (
  stationIndex: number,
  overrides: Partial<TrainPosition> = {}
): OverlayTrain => ({ train: buildPosition(overrides), stationIndex });

describe('computeMarkerTop', () => {
  it('centers an at-station marker vertically in its row', () => {
    expect(computeMarkerTop(2, false, 0)).toBe(
      2 * TIMELINE_ROW_HEIGHT + (TIMELINE_ROW_HEIGHT - TRAIN_MARKER_HEIGHT) / 2
    );
  });

  it('places a between marker at the top of its row (toward the previous station)', () => {
    expect(computeMarkerTop(3, true, 0)).toBe(3 * TIMELINE_ROW_HEIGHT);
  });

  it('stacks same-slot markers downward so they do not overlap', () => {
    const first = computeMarkerTop(1, false, 0);
    const second = computeMarkerTop(1, false, 1);
    expect(second).toBeGreaterThan(first + TRAIN_MARKER_HEIGHT - 1);
  });
});

describe('TrainMarkerOverlay', () => {
  beforeEach(() => {
    mockReduceMotion.mockReturnValue(false);
  });

  it('renders one card per train with train number and destination/status', () => {
    const { getByText, getByTestId } = render(
      <TrainMarkerOverlay
        trains={[overlayTrain(1), overlayTrain(4, { trainNo: '2440', status: 'departed' })]}
        lineColor="#00A84D"
        testID="overlay"
      />
    );
    expect(getByTestId('overlay-marker-2438', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('overlay-marker-2440', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('2438', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('성수행 도착', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('성수행 출발', { includeHiddenElements: true })).toBeTruthy();
  });

  it('renders 급행/막차 flags in the train number label', () => {
    const { getByText } = render(
      <TrainMarkerOverlay
        trains={[overlayTrain(0, { isExpress: true, isLastTrain: true })]}
        lineColor="#00A84D"
      />
    );
    expect(getByText('2438 급행·막차', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps a single marker per trainNo when the train moves to another station', () => {
    const { rerender, getAllByTestId } = render(
      <TrainMarkerOverlay trains={[overlayTrain(1)]} lineColor="#00A84D" testID="overlay" />
    );
    rerender(
      <TrainMarkerOverlay trains={[overlayTrain(2)]} lineColor="#00A84D" testID="overlay" />
    );
    expect(getAllByTestId('overlay-marker-2438', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('hides markers from the accessibility tree (station rows announce trains)', () => {
    const { getByTestId } = render(
      <TrainMarkerOverlay trains={[overlayTrain(1)]} lineColor="#00A84D" testID="overlay" />
    );
    const overlay = getByTestId('overlay', { includeHiddenElements: true });
    expect(overlay.props.accessibilityElementsHidden).toBe(true);
    expect(overlay.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('shows a moving arrow for in-motion trains (출발/진입/전역출발)', () => {
    const { getByTestId } = render(
      <TrainMarkerOverlay
        trains={[
          overlayTrain(1, { trainNo: '7001', status: 'departed' }),
          overlayTrain(2, { trainNo: '7002', status: 'entering' }),
          overlayTrain(3, { trainNo: '7003', status: 'departed_prev' }),
        ]}
        lineColor="#00A84D"
        testID="overlay"
      />
    );
    expect(getByTestId('overlay-marker-7001-moving', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('overlay-marker-7002-moving', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('overlay-marker-7003-moving', { includeHiddenElements: true })).toBeTruthy();
  });

  it('hides the moving arrow for trains stopped at a station (도착)', () => {
    const { queryByTestId } = render(
      <TrainMarkerOverlay
        trains={[overlayTrain(1, { trainNo: '7004', status: 'arrived' })]}
        lineColor="#00A84D"
        testID="overlay"
      />
    );
    expect(
      queryByTestId('overlay-marker-7004-moving', { includeHiddenElements: true })
    ).toBeNull();
  });

  it('renders nothing visible when there are no trains (no crash)', () => {
    const { getByTestId } = render(
      <TrainMarkerOverlay trains={[]} lineColor="#00A84D" testID="overlay" />
    );
    expect(getByTestId('overlay', { includeHiddenElements: true }).props.children).toEqual([]);
  });

  it('animates the moving arrow with a loop when motion is allowed', () => {
    mockReduceMotion.mockReturnValue(false);
    const loopSpy = jest.spyOn(Animated, 'loop');
    const { getByTestId } = render(
      <TrainMarkerOverlay
        trains={[overlayTrain(2, { trainNo: '7002', status: 'entering' })]}
        lineColor="#00A84D"
        testID="overlay"
      />
    );
    expect(loopSpy).toHaveBeenCalled();
    expect(
      getByTestId('overlay-marker-7002-moving', { includeHiddenElements: true })
    ).toBeTruthy();
    loopSpy.mockRestore();
  });

  it('renders a static visible chevron with no loop when reduce-motion is enabled', () => {
    mockReduceMotion.mockReturnValue(true);
    const loopSpy = jest.spyOn(Animated, 'loop');
    const { getByTestId } = render(
      <TrainMarkerOverlay
        trains={[overlayTrain(2, { trainNo: '7002', status: 'entering' })]}
        lineColor="#00A84D"
        testID="overlay"
      />
    );
    // No drifting loop is started…
    expect(loopSpy).not.toHaveBeenCalled();
    // …but the direction cue is preserved: the chevron still renders, held at a
    // fixed visible opacity (the animated opacity rests at 0 = invisible).
    const arrow = getByTestId('overlay-marker-7002-moving', {
      includeHiddenElements: true,
    });
    // RN flattens the style array into one merged object; the static path pins
    // opacity to a fixed visible 0.5 (vs the animated interpolation that rests at 0).
    expect(arrow.props.style.opacity).toBe(0.5);
    loopSpy.mockRestore();
  });
});
