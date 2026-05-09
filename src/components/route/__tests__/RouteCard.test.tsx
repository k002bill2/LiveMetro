import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteCard } from '../RouteCard';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Memory: feedback_pill_atom_mock_text_wrap.md — Pill mock requires Text wrap
jest.mock('@/components/design/Pill', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { Pill: ({ children }: { children: React.ReactNode }) => <RNText>{children}</RNText> };
});

jest.mock('@/components/design/JourneyStrip', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    JourneyStrip: ({ legs }: { legs: ReadonlyArray<unknown> }) => (
      <RNText testID="journey-strip">{`legs:${legs.length}`}</RNText>
    ),
  };
});

const baseRoute: RouteWithMLMeta = {
  id: 'r1',
  segments: [
    {
      fromStationId: 'a',
      toStationId: 'b',
      lineId: '2',
      isTransfer: false,
      fromStationName: '강남',
      toStationName: '잠실',
      estimatedMinutes: 25,
      stationCount: 9,
    },
  ] as never,
  totalMinutes: 25,
  transferCount: 0,
  lineIds: ['2'],
  etaMinutes: 25,
  etaConfidenceMinutes: 3,
  delayRiskLineIds: [],
};

describe('RouteCard', () => {
  it('renders ETA with confidence interval', () => {
    const { getByText } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('25분 ±3분')).toBeTruthy();
  });

  it('renders journey strip', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('journey-strip')).toBeTruthy();
  });

  it('shows delay risk pill when delayRiskLineIds non-empty', () => {
    const route = { ...baseRoute, delayRiskLineIds: ['2'] };
    const { getByText } = render(
      <RouteCard route={route} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('2호선 지연 위험')).toBeTruthy();
  });

  it('shows positive pill when no delay risk', () => {
    const { getByText } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('정시 운행')).toBeTruthy();
  });

  it('calls onToggleExpand when tapped', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={onToggle} />
    );
    fireEvent.press(getByTestId('route-card'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders detail steps when expanded', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={true} onToggleExpand={() => {}} />
    );
    expect(getByTestId('route-card-details')).toBeTruthy();
  });
});
