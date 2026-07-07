import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TrainSelectSheet } from '../TrainSelectSheet';
import type { DepartedTrainEntry } from '@/services/guidance/departedTrainLog';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('lucide-react-native', () => ({
  TrainFront: 'TrainFront',
  X: 'X',
}));

const NOW = Date.now();

const entry = (over: Partial<DepartedTrainEntry> & { readonly trainId: string }): DepartedTrainEntry => ({
  finalDestination: '성수',
  lineId: '2',
  stationName: '을지로3가',
  departedAtMs: NOW - 20_000,
  confidence: 'observed',
  ...over,
});

describe('TrainSelectSheet', () => {
  it('does not render the sheet when not visible', () => {
    const { queryByTestId } = render(
      <TrainSelectSheet visible={false} entries={[]} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(queryByTestId('train-select-sheet')).toBeNull();
  });

  it('renders each entry with its destination and relative departure time', () => {
    const entries = [
      entry({ trainId: 'A', finalDestination: '성수', departedAtMs: NOW - 20_000 }),
      entry({ trainId: 'B', finalDestination: '신도림', departedAtMs: NOW - 310_000 }),
    ];
    const { getByText } = render(
      <TrainSelectSheet visible entries={entries} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText('성수행')).toBeTruthy();
    expect(getByText('방금 출발')).toBeTruthy();
    expect(getByText('신도림행')).toBeTruthy();
    expect(getByText('5분 전 출발')).toBeTruthy();
  });

  it('shows the 추정 badge only for estimated entries', () => {
    const entries = [
      entry({ trainId: 'OBS', confidence: 'observed' }),
      entry({ trainId: 'EST', confidence: 'estimated' }),
    ];
    const { getByTestId, queryByTestId } = render(
      <TrainSelectSheet visible entries={entries} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByTestId('train-select-badge-EST')).toHaveTextContent('추정');
    expect(queryByTestId('train-select-badge-OBS')).toBeNull();
  });

  it('calls onSelect with the entry departure time when an item is tapped', () => {
    const onSelect = jest.fn();
    const departedAtMs = NOW - 120_000;
    const { getByTestId } = render(
      <TrainSelectSheet
        visible
        entries={[entry({ trainId: 'A', departedAtMs })]}
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('train-select-item-A'));
    expect(onSelect).toHaveBeenCalledWith(departedAtMs);
  });

  it('calls onSelect with a now-ish timestamp when the fallback is tapped', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <TrainSelectSheet visible entries={[]} onSelect={onSelect} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('train-select-now'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(typeof onSelect.mock.calls[0]?.[0]).toBe('number');
  });

  it('always renders the fallback even when there are no entries', () => {
    const { getByTestId } = render(
      <TrainSelectSheet visible entries={[]} onSelect={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByTestId('train-select-now')).toBeTruthy();
  });

  it('calls onClose when the backdrop is tapped', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <TrainSelectSheet visible entries={[]} onSelect={jest.fn()} onClose={onClose} />
    );
    fireEvent.press(getByTestId('train-select-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is tapped', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <TrainSelectSheet visible entries={[]} onSelect={jest.fn()} onClose={onClose} />
    );
    fireEvent.press(getByTestId('train-select-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
