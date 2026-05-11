import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteCard } from '../RouteCard';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/components/design/LineBadge', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    LineBadge: ({ line }: { line: string }) => <RNView testID={`line-badge-${line}`} />,
    getLineShortLabel: (line: string) => line,
  };
});

jest.mock('@/components/design/JourneyStrip', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    JourneyStrip: ({ legs }: { legs: readonly unknown[] }) => (
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
  it('renders ETA minutes as the big number', () => {
    const { getByText } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('25')).toBeTruthy();
  });

  it('renders the meta sub-line with transfer / walk / fare', () => {
    const { getByText } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText(/환승 0.*도보.*분.*원/)).toBeTruthy();
  });

  it('renders journey strip', () => {
    const { getByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('journey-strip')).toBeTruthy();
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

  it('shows "추천" + "최단" tags when route.category is "fastest"', () => {
    const fastestRoute: RouteWithMLMeta = { ...baseRoute, category: 'fastest' };
    const { getByText } = render(
      <RouteCard route={fastestRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('추천')).toBeTruthy();
    expect(getByText('최단')).toBeTruthy();
  });

  it('shows "환승최소" + "빠른길" tags when route.category is "min-transfer"', () => {
    const minTransferRoute: RouteWithMLMeta = { ...baseRoute, category: 'min-transfer' };
    const { getByText } = render(
      <RouteCard route={minTransferRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('환승최소')).toBeTruthy();
    expect(getByText('빠른길')).toBeTruthy();
  });

  it('renders via-station tags when route.category is "via-station"', () => {
    const viaStationRoute: RouteWithMLMeta = {
      ...baseRoute,
      category: 'via-station',
      viaTags: ['강남구청 경유'],
    };
    const { getByText } = render(
      <RouteCard route={viaStationRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText('강남구청 경유')).toBeTruthy();
  });
});
