/**
 * HomeFavoriteRow — which train's ETA reaches the FavoriteRow.
 *
 * Regression 1 (2026-10-05, SM-N971N): 4 of 5 home favorites showed "0분" while
 * the API was healthy. trains[0] often has arrivalTime === null (#358 leaves
 * unknown ETAs as null), and the row turned that null into 0 seconds.
 *
 * Regression 2 (same day, raw API at 선릉): the snapshot is per station, so a
 * 수인분당 favorite also received 2호선 trains and both directions. Picking the
 * earliest of all of them pinned transfer stations to "0분" almost constantly.
 * The row now follows the favorite's own line and saved direction, matching
 * the Favorites tab.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
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
      connectionLost,
    }: {
      nextMinutes: number | null;
      imminent?: boolean;
      destinationLabel?: string;
      connectionLost?: boolean;
    }) =>
      ReactModule.createElement(
        View,
        null,
        ReactModule.createElement(Text, { testID: 'conn' }, String(Boolean(connectionLost))),
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

const inSec = (sec: number): Date => new Date(Date.now() + sec * 1000 + 500);

type RowOverrides = Partial<React.ComponentProps<typeof HomeFavoriteRow>>;

const renderRow = (overrides: RowOverrides = {}) =>
  render(
    <HomeFavoriteRow station={station} isFocused onPress={jest.fn()} {...overrides} />,
  );

describe('HomeFavoriteRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unknown ETA (null) is not "0분"', () => {
    it('passes null when there are no trains', () => {
      useRealtimeTrains.mockReturnValue({ trains: [] });
      const { getByTestId } = renderRow();
      expect(getByTestId('minutes')).toHaveTextContent('null');
    });

    it('passes null when no train has a known arrival time', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [{ lineId: '2', direction: 'up', arrivalTime: null, finalDestination: '성수' }],
      });
      const { getByTestId } = renderRow({ isFirst: true });
      expect(getByTestId('minutes')).toHaveTextContent('null');
      expect(getByTestId('imminent')).toHaveTextContent('false');
    });

    it('skips a leading null-ETA train and uses the next known arrival', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [
          { lineId: '2', direction: 'up', arrivalTime: null, finalDestination: '성수' },
          { lineId: '2', direction: 'up', arrivalTime: inSec(250), finalDestination: '홍대입구' },
        ],
      });
      const { getByTestId } = renderRow();
      expect(getByTestId('minutes')).toHaveTextContent('4');
      expect(getByTestId('dest')).toHaveTextContent('홍대입구 방면');
    });

    it('still reports 0 minutes for a train that is genuinely arriving', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [{ lineId: '2', direction: 'up', arrivalTime: inSec(20), finalDestination: '성수' }],
      });
      const { getByTestId } = renderRow({ isFirst: true });
      expect(getByTestId('minutes')).toHaveTextContent('0');
      expect(getByTestId('imminent')).toHaveTextContent('true');
    });
  });

  describe('connection lost', () => {
    it('flags connectionLost when the realtime hook reports an error', () => {
      useRealtimeTrains.mockReturnValue({ trains: [], error: '최대 재시도 횟수(3)에 도달했습니다.' });
      const { getByTestId } = renderRow();
      expect(getByTestId('conn')).toHaveTextContent('true');
    });

    it('does not flag connectionLost when there is no error', () => {
      useRealtimeTrains.mockReturnValue({ trains: [], error: null });
      const { getByTestId } = renderRow();
      expect(getByTestId('conn')).toHaveTextContent('false');
    });
  });

  describe('stale cached ETA (#360)', () => {
    it('passes null when the only ETA is long past (API failing, cache stale)', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [{ lineId: '2', direction: 'up', arrivalTime: inSec(-300), finalDestination: '성수' }],
      });
      const { getByTestId } = renderRow();
      expect(getByTestId('minutes')).toHaveTextContent('null');
    });

    it('skips a stale ETA and uses the next fresh one', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [
          { lineId: '2', direction: 'up', arrivalTime: inSec(-300), finalDestination: '성수' },
          { lineId: '2', direction: 'up', arrivalTime: inSec(130), finalDestination: '홍대입구' },
        ],
      });
      const { getByTestId } = renderRow();
      expect(getByTestId('minutes')).toHaveTextContent('2');
      expect(getByTestId('dest')).toHaveTextContent('홍대입구 방면');
    });

    it('re-judges a non-first row on a clock tick, with no new data (quota exhausted)', () => {
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-10-05T07:00:00.000Z'));
        const cached = [
          { lineId: '2', direction: 'up', arrivalTime: new Date(Date.now() + 30_000), finalDestination: '성수' },
        ];
        useRealtimeTrains.mockReturnValue({ trains: cached });
        const { getByTestId } = renderRow({ isFirst: false });
        expect(getByTestId('minutes')).toHaveTextContent('0');

        // 5 minutes pass, no callback, no parent re-render.
        act(() => {
          jest.advanceTimersByTime(5 * 60_000);
        });
        expect(getByTestId('minutes')).toHaveTextContent('null');
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps "0분" for a train that arrived moments ago (within grace)', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [{ lineId: '2', direction: 'up', arrivalTime: inSec(-20), finalDestination: '성수' }],
      });
      const { getByTestId } = renderRow();
      expect(getByTestId('minutes')).toHaveTextContent('0');
    });
  });

  describe("follows the favorite's line and saved direction", () => {
    // 선릉 snapshot shape from the 2026-10-05 raw API: 수인분당(1075) + 2호선(1002).
    const seolleungSnapshot = [
      { lineId: '1075', direction: 'down', arrivalTime: inSec(0), finalDestination: '죽전' },
      { lineId: '1002', direction: 'up', arrivalTime: inSec(30), finalDestination: '성수' },
      { lineId: '1075', direction: 'up', arrivalTime: inSec(150), finalDestination: '왕십리' },
      { lineId: '1002', direction: 'down', arrivalTime: inSec(270), finalDestination: '성수' },
    ];

    it('ignores other lines at a transfer station (bundang slug vs 1075 subwayId)', () => {
      useRealtimeTrains.mockReturnValue({ trains: seolleungSnapshot });
      const { getByTestId } = renderRow({ lineId: 'bundang', direction: 'up' });
      expect(getByTestId('minutes')).toHaveTextContent('2');
      expect(getByTestId('dest')).toHaveTextContent('왕십리 방면');
    });

    it('ignores the opposite direction when a direction is saved', () => {
      useRealtimeTrains.mockReturnValue({ trains: seolleungSnapshot });
      const { getByTestId } = renderRow({ lineId: '2', direction: 'down' });
      expect(getByTestId('minutes')).toHaveTextContent('4');
    });

    it("considers both directions of the favorite's line when direction is 'both'", () => {
      useRealtimeTrains.mockReturnValue({ trains: seolleungSnapshot });
      const { getByTestId } = renderRow({ lineId: 'bundang', direction: 'both' });
      expect(getByTestId('minutes')).toHaveTextContent('0');
      expect(getByTestId('dest')).toHaveTextContent('죽전 방면');
    });

    it("falls back to the station's line when the favorite has no lineId", () => {
      useRealtimeTrains.mockReturnValue({ trains: seolleungSnapshot });
      const { getByTestId } = renderRow({ direction: 'up' });
      expect(getByTestId('minutes')).toHaveTextContent('0');
      expect(getByTestId('dest')).toHaveTextContent('성수 방면');
    });

    it('passes null when only other lines have trains', () => {
      useRealtimeTrains.mockReturnValue({
        trains: [{ lineId: '1002', direction: 'up', arrivalTime: inSec(30), finalDestination: '성수' }],
      });
      const { getByTestId } = renderRow({ lineId: 'bundang', direction: 'both' });
      expect(getByTestId('minutes')).toHaveTextContent('null');
    });
  });
});
