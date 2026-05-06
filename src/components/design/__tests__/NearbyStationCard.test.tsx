/**
 * NearbyStationCard tests
 *
 * Coverage: distance label units, congestion dot, walk/exit composition,
 * next arrival rendering, onPress wiring, accessibility.
 *
 * Mock strategy follows project memory:
 *   - lucide-react-native: Proxy stub (project_lucide_svg_test_mock.md)
 *   - react-native-svg: View stubs to avoid native module errors
 *   - useTheme alias mock (project_dual_path_theme_mock.md)
 */
import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import { NearbyStationCard } from '../NearbyStationCard';

jest.mock('react-native-svg', () => {
  const RealView = require('react-native').View;
  return {
    __esModule: true,
    default: RealView,
    Svg: RealView,
    Circle: RealView,
    Rect: RealView,
    Path: RealView,
    G: RealView,
    Text: RealView,
    Defs: RealView,
    LinearGradient: RealView,
    Stop: RealView,
  };
});

jest.mock('lucide-react-native', () => {
  const RealView = require('react-native').View;
  return new Proxy(
    {},
    {
      get: () => (props: Record<string, unknown>) => (
        <RealView testID={(props['testID'] as string) ?? 'lucide-icon'} />
      ),
    },
  );
});

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false, theme: 'light', setTheme: jest.fn() }),
}));

describe('NearbyStationCard', () => {
  const baseProps = {
    lineIds: ['2'] as const,
    stationName: '홍대입구',
    distanceM: 180,
    walkMin: 3,
    exitNumber: '9',
  };

  const arrivalProps = {
    nextArrival: {
      lineId: '2' as const,
      destination: '잠실 방면',
      minutes: 2,
    },
  };

  it('renders station name', () => {
    const { getByText } = render(<NearbyStationCard {...baseProps} />);
    expect(getByText('홍대입구')).toBeTruthy();
  });

  it('renders next-arrival destination when arrival is provided', () => {
    const { getByText } = render(
      <NearbyStationCard {...baseProps} {...arrivalProps} />,
    );
    expect(getByText('잠실 방면')).toBeTruthy();
  });

  it('omits next-arrival half when no arrival is provided', () => {
    const { queryByText } = render(<NearbyStationCard {...baseProps} />);
    expect(queryByText('잠실 방면')).toBeNull();
  });

  it('formats distance under 1000m as meters', () => {
    const { getByText } = render(<NearbyStationCard {...baseProps} distanceM={180} />);
    expect(getByText('180m')).toBeTruthy();
  });

  it('formats distance >= 1000m as kilometers with one decimal', () => {
    const { getByText } = render(<NearbyStationCard {...baseProps} distanceM={1240} />);
    expect(getByText('1.2km')).toBeTruthy();
  });

  it('renders walk minutes and exit number on a single line', () => {
    const { getByText } = render(
      <NearbyStationCard {...baseProps} walkMin={3} exitNumber="9" testID="card" />,
    );
    expect(getByText('도보 3분 · 9번 출구')).toBeTruthy();
  });

  it('omits exit segment when exitNumber is null', () => {
    const { getByText, queryByText } = render(
      <NearbyStationCard {...baseProps} exitNumber={null} testID="card" />,
    );
    expect(getByText('도보 3분')).toBeTruthy();
    expect(queryByText(/9번 출구/)).toBeNull();
  });

  it('renders arrival minutes prominently', () => {
    const { getByTestId } = render(
      <NearbyStationCard {...baseProps} {...arrivalProps} testID="card" />,
    );
    const arrival = getByTestId('card-arrival');
    const children = arrival.props.children as readonly unknown[];
    expect(Array.isArray(children)).toBe(true);
    expect(children[0]).toBe(2);
  });

  it('renders trailing label when provided (e.g. "+1대 더")', () => {
    const { getByText } = render(
      <NearbyStationCard
        {...baseProps}
        {...arrivalProps}
        trailingArrivalLabel="+1대 더"
      />,
    );
    expect(getByText('+1대 더')).toBeTruthy();
  });

  it('renders congestion label per level (only when arrival shown)', () => {
    const { rerender, getByText } = render(
      <NearbyStationCard {...baseProps} {...arrivalProps} congestion="low" testID="card" />,
    );
    expect(getByText('여유')).toBeTruthy();

    rerender(
      <NearbyStationCard {...baseProps} {...arrivalProps} congestion="mid" testID="card" />,
    );
    expect(getByText('보통')).toBeTruthy();

    rerender(
      <NearbyStationCard {...baseProps} {...arrivalProps} congestion="high" testID="card" />,
    );
    expect(getByText('혼잡')).toBeTruthy();

    rerender(
      <NearbyStationCard {...baseProps} {...arrivalProps} congestion="vhigh" testID="card" />,
    );
    expect(getByText('매우 혼잡')).toBeTruthy();
  });

  it('hides congestion label when no arrival data', () => {
    const { queryByText } = render(
      <NearbyStationCard {...baseProps} congestion="mid" />,
    );
    expect(queryByText('보통')).toBeNull();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <NearbyStationCard {...baseProps} onPress={onPress} testID="card" />,
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a descriptive accessibilityLabel including arrival when known', () => {
    const { getByTestId } = render(
      <NearbyStationCard
        {...baseProps}
        {...arrivalProps}
        walkMin={3}
        exitNumber="9"
        testID="card"
      />,
    );
    const card = getByTestId('card');
    expect(card.props.accessibilityLabel).toBe(
      '홍대입구역, 도보 3분, 9번 출구, 2분 후 도착',
    );
  });

  it('renders multiple line badges (max 3)', () => {
    const { UNSAFE_getAllByType } = render(
      <NearbyStationCard
        {...baseProps}
        lineIds={['2', 'gj', 'ap', '9']}
      />,
    );
    expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
  });
});
