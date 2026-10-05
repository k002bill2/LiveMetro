/**
 * HomeFavoriteRow — which train's ETA reaches the FavoriteRow.
 *
 * Regression (2026-10-05, SM-N971N): 4 of 5 home favorites showed "0분" while
 * the API was healthy. trains[0] often has arrivalTime === null (#358 leaves
 * unknown ETAs as null), and the row turned that null into 0 seconds.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { HomeFavoriteRow } from '../HomeFavoriteRow';
import type { Station } from '@models/train';

jest.mock('@hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: jest.fn(() => ({ trains: [] })),
}));

// FavoriteRow stub surfaces the props this row computes.
jest.mock('@components/design', () => {
  const ReactModule = require('react');
  const { Text, View } = require('react-native');
  return {
    FavoriteRow: ({
      nextMinutes,
      imminent,
      destinationLabel,
    }: {
      nextMinutes: number | null;
      imminent?: boolean;
      destinationLabel?: string;
    }) =>
      ReactModule.createElement(
        View,
        null,
        ReactModule.createElement(
          Text,
          { testID: 'minutes' },
          nextMinutes === null ? 'null' : String(nextMinutes),
        ),
        ReactModule.createElement(Text, { testID: 'imminent' }, String(Boolean(imminent))),
        ReactModule.createElement(Text, { testID: 'dest' }, destinationLabel ?? ''),
      ),
  };
});

const { useRealtimeTrains } = jest.requireMock('@hooks/useRealtimeTrains') as {
  useRealtimeTrains: jest.Mock;
};

const station: Station = {
  id: '1023',
  name: '선릉',
  nameEn: 'Seolleung',
  lineId: '2',
  coordinates: { latitude: 0, longitude: 0 },
  transfers: [],
};

const renderRow = (isFirst = false) =>
  render(
    <HomeFavoriteRow station={station} isFocused isFirst={isFirst} onPress={jest.fn()} />,
  );

describe('HomeFavoriteRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes null (not 0) when there are no trains', () => {
    useRealtimeTrains.mockReturnValue({ trains: [] });
    const { getByTestId } = renderRow();
    expect(getByTestId('minutes')).toHaveTextContent('null');
  });

  it('passes null (not 0) when no train has a known arrival time', () => {
    useRealtimeTrains.mockReturnValue({
      trains: [{ arrivalTime: null, finalDestination: '왕십리' }],
    });
    const { getByTestId } = renderRow(true);
    expect(getByTestId('minutes')).toHaveTextContent('null');
    expect(getByTestId('imminent')).toHaveTextContent('false');
  });

  it('skips a leading null-ETA train and uses the next known arrival', () => {
    useRealtimeTrains.mockReturnValue({
      trains: [
        { arrivalTime: null, finalDestination: '왕십리' },
        { arrivalTime: new Date(Date.now() + 4 * 60_000 + 10_000), finalDestination: '인천' },
      ],
    });
    const { getByTestId } = renderRow();
    expect(getByTestId('minutes')).toHaveTextContent('4');
    expect(getByTestId('dest')).toHaveTextContent('인천 방면');
  });

  it('still reports 0 minutes for a train that is genuinely arriving', () => {
    useRealtimeTrains.mockReturnValue({
      trains: [{ arrivalTime: new Date(Date.now() + 20_000), finalDestination: '도봉산' }],
    });
    const { getByTestId } = renderRow(true);
    expect(getByTestId('minutes')).toHaveTextContent('0');
    expect(getByTestId('imminent')).toHaveTextContent('true');
  });
});
