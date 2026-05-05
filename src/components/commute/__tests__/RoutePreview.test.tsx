/**
 * RoutePreview Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { RoutePreview } from '../RoutePreview';
import type { CommuteRoute } from '@/models/commute';

jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_, name) => name })
);

// Phase 49 — Wanted DS migration: useTheme().isDark drives semantic theme.
jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('RoutePreview', () => {
  it('renders empty state when no route data', () => {
    const { getByText } = render(<RoutePreview route={{}} />);
    expect(getByText('경로를 설정해주세요')).toBeTruthy();
  });

  it('renders empty state with departure only (less than 2 steps)', () => {
    const route: Partial<CommuteRoute> = {
      departureStationId: 's1',
      departureStationName: '강남',
      departureLineId: '2',
    };
    const { getByText } = render(<RoutePreview route={route} />);
    expect(getByText('경로를 설정해주세요')).toBeTruthy();
  });

  it('renders route with departure and arrival', () => {
    const route: Partial<CommuteRoute> = {
      departureTime: '08:30',
      departureStationId: 's1',
      departureStationName: '강남',
      departureLineId: '2',
      arrivalStationId: 's2',
      arrivalStationName: '시청',
      arrivalLineId: '1',
      transferStations: [],
    };
    const { getByText } = render(<RoutePreview route={route} />);
    expect(getByText('강남')).toBeTruthy();
    expect(getByText('시청')).toBeTruthy();
    expect(getByText('오전 8:30')).toBeTruthy();
  });

  it('renders route with transfer stations', () => {
    const route: Partial<CommuteRoute> = {
      departureStationId: 's1',
      departureStationName: '잠실',
      departureLineId: '2',
      arrivalStationId: 's3',
      arrivalStationName: '홍대입구',
      arrivalLineId: '2',
      transferStations: [
        { stationId: 's2', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
      ],
    };
    const { getByText } = render(<RoutePreview route={route} />);
    expect(getByText('잠실')).toBeTruthy();
    expect(getByText('신도림')).toBeTruthy();
    expect(getByText('홍대입구')).toBeTruthy();
  });

  it('hides time when showTime is false', () => {
    const route: Partial<CommuteRoute> = {
      departureTime: '14:00',
      departureStationId: 's1',
      departureStationName: '강남',
      departureLineId: '2',
      arrivalStationId: 's2',
      arrivalStationName: '시청',
      arrivalLineId: '1',
      transferStations: [],
    };
    const { queryByText } = render(
      <RoutePreview route={route} showTime={false} />
    );
    expect(queryByText('오후 2:00')).toBeNull();
  });

  it('renders in compact mode', () => {
    const route: Partial<CommuteRoute> = {
      departureStationId: 's1',
      departureStationName: '강남',
      departureLineId: '2',
      arrivalStationId: 's2',
      arrivalStationName: '시청',
      arrivalLineId: '1',
      transferStations: [],
    };
    const { getByText, queryByText } = render(
      <RoutePreview route={route} compact={true} />
    );
    expect(getByText('강남')).toBeTruthy();
    // Compact mode hides line tags and step labels
    expect(queryByText('출발')).toBeNull();
  });
});
