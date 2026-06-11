/**
 * TrainPositionScreen test suite — branch chips, direction labels,
 * station-timeline join, and state panels.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TrainPositionScreen from '../TrainPositionScreen';
import { useTrainPositions } from '@/hooks/useTrainPositions';
import type { TrainPosition } from '@/models/trainPosition';

const mockUseRoute = jest.fn(
  (): { params: { lineId: string; focusStationId?: string } } => ({
    params: { lineId: '2', focusStationId: 'city_hall_1' },
  })
);

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
}));

jest.mock('@/hooks/useTrainPositions', () => ({
  useTrainPositions: jest.fn(),
}));

const mockedUseTrainPositions = useTrainPositions as jest.Mock;

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

const okState = (positions: TrainPosition[]) => ({
  positions,
  loading: false,
  error: null,
  lastUpdated: new Date('2026-06-11T12:00:00+09:00'),
  isStale: false,
  refetch: jest.fn(),
});

describe('TrainPositionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { lineId: '2', focusStationId: 'city_hall_1' } });
    mockedUseTrainPositions.mockReturnValue(okState([]));
  });

  it('renders 3 branch chips for Line 2 (순환선/성수–신설동/신도림–까치산)', () => {
    mockedUseTrainPositions.mockReturnValue(okState([buildPosition()]));
    const { getByTestId, getByText } = render(<TrainPositionScreen />);
    expect(getByTestId('train-position-branch-chips')).toBeTruthy();
    expect(getByText('순환선')).toBeTruthy();
    expect(getByText('성수–신설동')).toBeTruthy();
    expect(getByText('신도림–까치산')).toBeTruthy();
  });

  it('shows 내선순환/외선순환 direction labels on the Line 2 loop', () => {
    mockedUseTrainPositions.mockReturnValue(okState([buildPosition()]));
    const { getByText } = render(<TrainPositionScreen />);
    expect(getByText('내선순환')).toBeTruthy();
    expect(getByText('외선순환')).toBeTruthy();
  });

  it('switches to 상행/하행 labels and branch stations when a 지선 chip is selected', () => {
    mockedUseTrainPositions.mockReturnValue(okState([buildPosition()]));
    const { getByTestId, getByText, queryByTestId } = render(<TrainPositionScreen />);

    fireEvent.press(getByTestId('train-position-chip-2-2')); // 신도림–까치산

    expect(getByText('상행')).toBeTruthy();
    expect(getByText('하행')).toBeTruthy();
    expect(getByTestId('train-position-row-kkachisan')).toBeTruthy();
    expect(queryByTestId('train-position-row-city_hall_1')).toBeNull();
  });

  it('joins trains onto their station row by normalized name', () => {
    mockedUseTrainPositions.mockReturnValue(
      okState([buildPosition({ trainNo: '2438', stationName: '시청' })])
    );
    const { getByTestId } = render(<TrainPositionScreen />);
    expect(getByTestId('train-position-row-city_hall_1-marker-2438')).toBeTruthy();
  });

  it('filters markers by the selected direction (down train hidden on up)', () => {
    mockedUseTrainPositions.mockReturnValue(
      okState([buildPosition({ trainNo: '2445', direction: 'down' })])
    );
    const { queryByTestId, getByTestId } = render(<TrainPositionScreen />);
    expect(queryByTestId('train-position-row-city_hall_1-marker-2445')).toBeNull();

    fireEvent.press(getByTestId('train-position-direction-down'));
    expect(getByTestId('train-position-row-city_hall_1-marker-2445')).toBeTruthy();
  });

  it('skips trains whose station name fails the join (no crash, no marker)', () => {
    mockedUseTrainPositions.mockReturnValue(
      okState([buildPosition({ trainNo: '9999', stationName: '존재하지않는역' })])
    );
    const { queryByTestId, getByTestId } = render(<TrainPositionScreen />);
    expect(getByTestId('train-position-list')).toBeTruthy();
    expect(queryByTestId('train-position-row-city_hall_1-marker-9999')).toBeNull();
  });

  it('hides the chip row for single-trunk lines and shows 상행/하행', () => {
    mockUseRoute.mockReturnValue({ params: { lineId: '9', focusStationId: undefined } });
    mockedUseTrainPositions.mockReturnValue(okState([buildPosition()]));
    const { queryByTestId, getByText } = render(<TrainPositionScreen />);
    expect(queryByTestId('train-position-branch-chips')).toBeNull();
    expect(getByText('상행')).toBeTruthy();
    expect(getByText('하행')).toBeTruthy();
  });

  it('shows the loading panel while the first fetch is in flight', () => {
    mockedUseTrainPositions.mockReturnValue({
      positions: [],
      loading: true,
      error: null,
      lastUpdated: null,
      isStale: false,
      refetch: jest.fn(),
    });
    const { getByTestId } = render(<TrainPositionScreen />);
    expect(getByTestId('train-position-loading')).toBeTruthy();
  });

  it('shows the error panel with a retry affordance that calls refetch', () => {
    const refetch = jest.fn();
    mockedUseTrainPositions.mockReturnValue({
      positions: [],
      loading: false,
      error: '열차 위치를 불러오지 못했습니다',
      lastUpdated: null,
      isStale: false,
      refetch,
    });
    const { getByTestId } = render(<TrainPositionScreen />);
    fireEvent.press(getByTestId('train-position-error-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the empty panel when no trains are running', () => {
    mockedUseTrainPositions.mockReturnValue(okState([]));
    const { getByTestId } = render(<TrainPositionScreen />);
    expect(getByTestId('train-position-empty')).toBeTruthy();
  });

  it('marks stale data in the status row', () => {
    mockedUseTrainPositions.mockReturnValue({
      ...okState([buildPosition()]),
      isStale: true,
      error: '열차 위치를 불러오지 못했습니다',
    });
    const { getByText } = render(<TrainPositionScreen />);
    expect(getByText(/이전 데이터/)).toBeTruthy();
  });
});
