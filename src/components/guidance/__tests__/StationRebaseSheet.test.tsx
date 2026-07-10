import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationRebaseSheet } from '../StationRebaseSheet';
import type { RideStep } from '@/models/guidance';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  MapPin: 'MapPin',
  X: 'X',
}));

const ride: RideStep = {
  kind: 'ride',
  id: 'ride-1',
  lineId: '2',
  lineName: '2호선',
  fromStationId: 's1',
  fromStationName: '을지로3가',
  toStationId: 's4',
  toStationName: '대림',
  hops: [
    { toStationId: 's2', toStationName: '시청', minutes: 2 },
    { toStationId: 's3', toStationName: '신도림', minutes: 3 },
    { toStationId: 's4', toStationName: '대림', minutes: 2 },
  ],
  direction: '잠실',
  durationMinutes: 7,
};

describe('StationRebaseSheet', () => {
  it('does not render the sheet when not visible', () => {
    const { queryByTestId } = render(
      <StationRebaseSheet
        visible={false}
        step={ride}
        currentStationId={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByTestId('station-rebase-sheet')).toBeNull();
  });

  it('renders the origin followed by every hop station in order', () => {
    const { getByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByTestId('station-rebase-item-s1')).toHaveTextContent('을지로3가');
    expect(getByTestId('station-rebase-item-s2')).toHaveTextContent('시청');
    expect(getByTestId('station-rebase-item-s3')).toHaveTextContent('신도림');
    // final 하차역 is selectable too (row also carries the 하차 badge)
    expect(getByTestId('station-rebase-item-s4')).toHaveTextContent(/대림/);
    expect(getByTestId('station-rebase-alight-s4')).toHaveTextContent('하차');
  });

  it('marks the current-position station with a "지금 여기" badge', () => {
    const { getByTestId, queryByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId="s2"
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByTestId('station-rebase-here-s2')).toHaveTextContent('지금 여기');
    expect(queryByTestId('station-rebase-here-s1')).toBeNull();
    expect(queryByTestId('station-rebase-here-s3')).toBeNull();
  });

  it('omits the marker entirely when currentStationId is null', () => {
    const { queryByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(queryByTestId('station-rebase-here-s1')).toBeNull();
    expect(queryByTestId('station-rebase-here-s2')).toBeNull();
  });

  it('calls onSelect with the station id when a row is tapped', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId={null}
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('station-rebase-item-s3'));
    expect(onSelect).toHaveBeenCalledWith('s3');
  });

  it('calls onSelect with the final station id when the 하차역 row is tapped', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId={null}
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('station-rebase-item-s4'));
    expect(onSelect).toHaveBeenCalledWith('s4');
  });

  it('calls onClose when the backdrop is tapped', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId={null}
        onSelect={jest.fn()}
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('station-rebase-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is tapped', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <StationRebaseSheet
        visible
        step={ride}
        currentStationId={null}
        onSelect={jest.fn()}
        onClose={onClose}
      />
    );
    fireEvent.press(getByTestId('station-rebase-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
