/**
 * NotificationTimeline test — pure band math + conditional hatch overlay.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NotificationTimeline, {
  parseTime,
  computeQuietBands,
} from '../NotificationTimeline';

/** Fire onLayout so the measured-width hatch overlay can render. */
const layoutTrack = (getByTestId: (id: string) => unknown): void => {
  fireEvent(getByTestId('timeline-track') as never, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } },
  });
};

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light
  ),
}));

// SVG passthrough — forward testID so the hatch overlay is queryable.
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  const passthrough = ({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) => <View testID={testID}>{children}</View>;
  return {
    __esModule: true,
    default: passthrough,
    Svg: passthrough,
    Defs: passthrough,
    Pattern: passthrough,
    Line: passthrough,
    Rect: passthrough,
  };
});

describe('parseTime', () => {
  it('parses HH:MM to decimal hours', () => {
    expect(parseTime('08:30')).toBe(8.5);
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('24:00')).toBe(24);
    expect(parseTime('23:15')).toBe(23.25);
  });

  it('returns 0 on parse failure', () => {
    expect(parseTime('not-a-time')).toBe(0);
    expect(parseTime('')).toBe(0);
  });
});

describe('computeQuietBands', () => {
  it('returns empty when disabled', () => {
    expect(computeQuietBands(23, 7, false)).toEqual([]);
  });

  it('returns a single band for a same-day range', () => {
    expect(computeQuietBands(13, 15, true)).toEqual([{ left: 13, width: 2 }]);
  });

  it('splits into two bands when the range wraps past midnight', () => {
    expect(computeQuietBands(23, 7, true)).toEqual([
      { left: 23, width: 1 },
      { left: 0, width: 7 },
    ]);
  });

  it('returns empty for a zero-width range', () => {
    expect(computeQuietBands(10, 10, true)).toEqual([]);
  });
});

describe('NotificationTimeline rendering', () => {
  const baseProps = {
    morningTime: '08:00',
    eveningTime: '18:00',
    quietStart: '23:00',
    quietEnd: '07:00',
  };

  it('renders the card, commute labels and hour ticks', () => {
    const { getByTestId, getByText } = render(
      <NotificationTimeline {...baseProps} quietEnabled={false} />
    );
    expect(getByTestId('notification-timeline')).toBeTruthy();
    expect(getByText('출근')).toBeTruthy();
    expect(getByText('퇴근')).toBeTruthy();
    expect(getByText('00')).toBeTruthy();
    expect(getByText('24')).toBeTruthy();
  });

  it('draws the hatch overlay (after layout) and quiet legend when enabled', () => {
    const { getByTestId, getByText } = render(
      <NotificationTimeline {...baseProps} quietEnabled />
    );
    // Before layout, the measured-width overlay is not yet rendered.
    layoutTrack(getByTestId);
    expect(getByTestId('timeline-hatch')).toBeTruthy();
    expect(getByTestId('legend-hatch')).toBeTruthy();
    expect(getByText('방해 금지')).toBeTruthy();
  });

  it('omits the hatch overlay and quiet legend when disabled', () => {
    const { getByTestId, queryByTestId, queryByText } = render(
      <NotificationTimeline {...baseProps} quietEnabled={false} />
    );
    layoutTrack(getByTestId);
    expect(queryByTestId('timeline-hatch')).toBeNull();
    expect(queryByTestId('legend-hatch')).toBeNull();
    expect(queryByText('방해 금지')).toBeNull();
  });

  it('omits a commute block/label when that commute is not active', () => {
    const { queryByText } = render(
      <NotificationTimeline
        {...baseProps}
        quietEnabled={false}
        morningActive={false}
        eveningActive
      />
    );
    expect(queryByText('출근')).toBeNull();
    expect(queryByText('퇴근')).toBeTruthy();
  });
});
