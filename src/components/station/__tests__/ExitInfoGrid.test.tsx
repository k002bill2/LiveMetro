/**
 * ExitInfoGrid Tests — Wanted Design System full-width exit blocks.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ExitInfoGrid } from '../ExitInfoGrid';
import type { ExitInfo } from '@/models/publicData';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

const exits: ExitInfo[] = [
  {
    exitNumber: '1',
    landmarks: [
      { stationCode: 'X', stationName: '강남', lineNum: '2', exitNumber: '1', landmarkName: '강남역사거리', category: 'transport' },
      { stationCode: 'X', stationName: '강남', lineNum: '2', exitNumber: '1', landmarkName: 'GFC', category: 'shopping' },
    ],
  },
  {
    exitNumber: '6',
    landmarks: [
      { stationCode: 'X', stationName: '강남', lineNum: '2', exitNumber: '6', landmarkName: '뉴욕제과', category: 'food' },
    ],
  },
];

describe('ExitInfoGrid', () => {
  it('renders one entry per exit', () => {
    const { getByText } = render(<ExitInfoGrid exits={exits} testID="exit-grid" />);
    expect(getByText('1')).toBeTruthy();
    expect(getByText('6')).toBeTruthy();
  });

  it('joins landmarks with comma + space for each exit', () => {
    const { getByText } = render(<ExitInfoGrid exits={exits} />);
    expect(getByText('강남역사거리, GFC')).toBeTruthy();
    expect(getByText('뉴욕제과')).toBeTruthy();
  });

  it('renders each exit as a full-width row block', () => {
    const { getByTestId } = render(<ExitInfoGrid exits={exits} testID="exit-grid" />);
    const firstExitStyle = StyleSheet.flatten(getByTestId('exit-grid-exit-1').props.style);
    const secondExitStyle = StyleSheet.flatten(getByTestId('exit-grid-exit-6').props.style);

    expect(firstExitStyle.width).toBe('100%');
    expect(firstExitStyle.flexDirection).toBe('row');
    expect(secondExitStyle.width).toBe('100%');
  });

  it('renders empty state when no exits provided', () => {
    const { getByTestId } = render(<ExitInfoGrid exits={[]} testID="exit-grid" />);
    expect(getByTestId('exit-grid-empty')).toBeTruthy();
  });

  it('respects an optional max prop, truncating remaining', () => {
    const many: ExitInfo[] = Array.from({ length: 8 }, (_, i) => ({
      exitNumber: String(i + 1),
      landmarks: [
        { stationCode: 'X', stationName: '강남', lineNum: '2', exitNumber: String(i + 1), landmarkName: `LM${i + 1}`, category: 'other' },
      ],
    }));
    const { queryByText } = render(<ExitInfoGrid exits={many} max={4} />);
    expect(queryByText('1')).toBeTruthy();
    expect(queryByText('4')).toBeTruthy();
    expect(queryByText('5')).toBeNull();
  });
});
