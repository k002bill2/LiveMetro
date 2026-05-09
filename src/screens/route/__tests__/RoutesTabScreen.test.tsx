import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RoutesTabScreen } from '../RoutesTabScreen';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('@/hooks/useNearbyStations', () => ({
  useNearbyStations: () => ({
    closestStation: { id: 'gangnam', name: '강남' },
  }),
}));

const mockUseRouteSearch = jest.fn();
jest.mock('@/hooks/useRouteSearch', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useRouteSearch: (input: any) => mockUseRouteSearch(input),
}));

jest.mock('@/components/route/RouteCard', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RouteCard: ({ route, onToggleExpand }: any) => (
      <Text testID={`route-${route.id}`} onPress={onToggleExpand}>
        {`${route.etaMinutes}분`}
      </Text>
    ),
  };
});

jest.mock('@/components/route/StationSearchBar', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    StationSearchBar: ({ fromStation, toStation, onPressFrom, onPressTo }: any) => (
      <>
        <Text testID="from-row" onPress={onPressFrom}>
          {fromStation?.name ?? '없음'}
        </Text>
        <Text testID="to-row" onPress={onPressTo}>
          {toStation?.name ?? '없음'}
        </Text>
      </>
    ),
  };
});

jest.mock('@/components/route/TimeChipRow', () => {
  const { Text } = jest.requireActual('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { TimeChipRow: ({ mode }: any) => <Text testID="time-mode">{mode}</Text> };
});

jest.mock('@/components/route/StationPickerModal', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    StationPickerModal: ({ visible, onSelect }: any) =>
      visible ? (
        <Text testID="picker" onPress={() => onSelect({ id: 'jamsil', name: '잠실' })}>
          picker
        </Text>
      ) : null,
  };
});

describe('RoutesTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouteSearch.mockReturnValue({
      routes: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('seeds closestStation as fromStation on mount', () => {
    const { getByTestId } = render(<RoutesTabScreen />);
    expect(getByTestId('from-row').props.children).toBe('강남');
  });

  it('shows hint when toStation missing', () => {
    const { queryByTestId } = render(<RoutesTabScreen />);
    expect(queryByTestId('routes-empty-hint')).not.toBeNull();
  });

  it('opens picker when from row tapped', () => {
    const { getByTestId } = render(<RoutesTabScreen />);
    fireEvent.press(getByTestId('from-row'));
    expect(getByTestId('picker')).toBeTruthy();
  });

  it('calls useRouteSearch with both ids after selecting destination', async () => {
    const { getByTestId } = render(<RoutesTabScreen />);
    fireEvent.press(getByTestId('to-row'));
    fireEvent.press(getByTestId('picker'));
    await waitFor(() =>
      expect(mockUseRouteSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fromId: 'gangnam',
          toId: 'jamsil',
          departureMode: 'now',
        })
      )
    );
  });

  it('renders one card per route returned', async () => {
    mockUseRouteSearch.mockReturnValue({
      routes: [
        {
          id: 'r1',
          etaMinutes: 25,
          etaConfidenceMinutes: 3,
          delayRiskLineIds: [],
          transferCount: 0,
          segments: [],
          lineIds: ['2'],
          totalMinutes: 25,
        },
        {
          id: 'r2',
          etaMinutes: 30,
          etaConfidenceMinutes: 4,
          delayRiskLineIds: ['3'],
          transferCount: 1,
          segments: [],
          lineIds: ['3', '4'],
          totalMinutes: 30,
        },
      ],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<RoutesTabScreen />);
    // Select destination so the screen leaves the empty-hint branch.
    fireEvent.press(getByTestId('to-row'));
    fireEvent.press(getByTestId('picker'));
    await waitFor(() => expect(getByTestId('route-r1')).toBeTruthy());
    expect(getByTestId('route-r2')).toBeTruthy();
  });

  it('shows error when useRouteSearch returns error', async () => {
    mockUseRouteSearch.mockReturnValue({
      routes: [],
      loading: false,
      error: '경로를 계산할 수 없습니다',
      refetch: jest.fn(),
    });
    const { getByTestId, getByText } = render(<RoutesTabScreen />);
    fireEvent.press(getByTestId('to-row'));
    fireEvent.press(getByTestId('picker'));
    await waitFor(() => expect(getByText('경로를 계산할 수 없습니다')).toBeTruthy());
  });
});
