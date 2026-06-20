import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteCard } from '../RouteCard';
import type { RouteWithMLMeta } from '@/hooks/useRouteSearch';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
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
    JourneyStrip: ({ legs }: { legs: readonly { type: string; minutes?: number }[] }) => (
      <RNText testID="journey-strip">
        {legs.map((l) => (l.type === 'train' ? `t${l.minutes}` : l.type)).join(',')}
      </RNText>
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

  it('truncates a float ETA to a whole number (no 76.56 tail)', () => {
    const floatRoute: RouteWithMLMeta = { ...baseRoute, etaMinutes: 76.56 };
    const { getByTestId } = render(
      <RouteCard route={floatRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByTestId('route-card-eta').props.children).toBe(76);
  });

  it('renders the meta sub-line with transfer / walk / fare', () => {
    const { getByText } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText(/환승 0.*도보.*분.*원/)).toBeTruthy();
  });

  it('prefers an attached route.fare over the deriveFare fallback', () => {
    // baseRoute (1 hop) derives 1,400원; an explicit fare must win.
    const farePinned: RouteWithMLMeta = { ...baseRoute, fare: 1500 };
    const { getByText } = render(
      <RouteCard route={farePinned} expanded={false} onToggleExpand={() => {}} />
    );
    expect(getByText(/1,500원/)).toBeTruthy();
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

  it('shows the active sort-tab badge on the recommended card (min-fare → 최소요금)', () => {
    const { getByText, queryByText } = render(
      <RouteCard
        route={{ ...baseRoute, category: 'fastest' }}
        expanded={false}
        onToggleExpand={() => {}}
        recommended
        activeSortTab="min-fare"
      />
    );
    expect(getByText('최소요금')).toBeTruthy();
    // sort-tab badge replaces the static category tags on the top card
    expect(queryByText('최단')).toBeNull();
  });

  it('keeps category tags on the optimal tab (no override)', () => {
    const { getByText } = render(
      <RouteCard
        route={{ ...baseRoute, category: 'fastest' }}
        expanded={false}
        onToggleExpand={() => {}}
        recommended
        activeSortTab="optimal"
      />
    );
    expect(getByText('추천')).toBeTruthy();
    expect(getByText('최단')).toBeTruthy();
  });

  it('does not show a sort-tab badge on non-recommended cards', () => {
    const { queryByText } = render(
      <RouteCard
        route={{ ...baseRoute, category: 'via-station', viaTags: ['강남구청 경유'] }}
        expanded={false}
        onToggleExpand={() => {}}
        recommended={false}
        activeSortTab="min-fare"
      />
    );
    expect(queryByText('최소요금')).toBeNull();
    expect(queryByText('강남구청 경유')).toBeTruthy();
  });

  it('elevator-priority 경로 → "엘리베이터 우선" 태그 렌더', () => {
    const route = {
      segments: [],
      totalMinutes: 30,
      transferCount: 1,
      lineIds: ['2'],
      category: 'elevator-priority' as const,
      etaMinutes: 30,
    };
    const { getByText } = render(
      <RouteCard route={route as never} expanded={false} onToggleExpand={() => {}} />,
    );
    expect(getByText('엘리베이터 우선')).toBeTruthy();
  });

  it('shows the "다음 열차 N분" boarding-wait label when boardingWaitMinutes > 0', () => {
    const route: RouteWithMLMeta = { ...baseRoute, boardingWaitMinutes: 4 };
    const { getByTestId } = render(
      <RouteCard route={route} expanded={false} onToggleExpand={() => {}} />,
    );
    expect(getByTestId('route-card-boarding-wait')).toHaveTextContent('다음 열차 4분');
  });

  it('shows ride time only in the first leg — boarding wait lives in the pill, not double-counted', () => {
    // 불변: applyRealtimeBoardingWait가 첫 segment estimatedMinutes에 wait를 합산
    // (25 ride + 4 wait = 29)하고 boardingWaitMinutes=4를 세팅한다. 카드는 첫 leg에서
    // 그 4분을 빼 ride(25)만 보여야 한다(대기는 pill로 별도). 총시간 29는 불변.
    const route: RouteWithMLMeta = {
      ...baseRoute,
      segments: [{ ...baseRoute.segments[0], estimatedMinutes: 29 }] as never,
      totalMinutes: 29,
      boardingWaitMinutes: 4,
    };
    const { getByTestId } = render(
      <RouteCard route={route} expanded={false} onToggleExpand={() => {}} />,
    );
    // 첫 train leg = 25(ride), not 29(ride+wait) — 이중계산 방지
    expect(getByTestId('journey-strip')).toHaveTextContent('t25');
    // 대기는 pill로만 표시
    expect(getByTestId('route-card-boarding-wait')).toHaveTextContent('다음 열차 4분');
  });

  it('hides the boarding-wait label when boardingWaitMinutes is absent', () => {
    const { queryByTestId } = render(
      <RouteCard route={baseRoute} expanded={false} onToggleExpand={() => {}} />,
    );
    expect(queryByTestId('route-card-boarding-wait')).toBeNull();
  });

  it('hides the boarding-wait label when boardingWaitMinutes is 0', () => {
    const route: RouteWithMLMeta = { ...baseRoute, boardingWaitMinutes: 0 };
    const { queryByTestId } = render(
      <RouteCard route={route} expanded={false} onToggleExpand={() => {}} />,
    );
    expect(queryByTestId('route-card-boarding-wait')).toBeNull();
  });
});
