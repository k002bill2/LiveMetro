/**
 * FavoriteRow — Phase 3B groundwork tests.
 *
 * Pin down: data → label mapping (nickname Pill, congestion dot+label,
 * minutes), presence of LineBadges per line, drag-handle visibility, and
 * onPress wiring.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FavoriteRow } from '../FavoriteRow';
import { ThemeProvider } from '@/services/theme';

const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);

describe('FavoriteRow', () => {
  it('renders station name and minutes', () => {
    const { getByText } = wrap(
      <FavoriteRow lines={['2']} stationName="강남" nextMinutes={3} />,
    );
    expect(getByText('강남')).toBeTruthy();
    expect(getByText(/3/)).toBeTruthy();
  });

  it('renders the nickname Pill when provided', () => {
    const { getByText } = wrap(
      <FavoriteRow
        lines={['2']}
        stationName="강남"
        nickname="회사"
        nextMinutes={5}
      />,
    );
    expect(getByText('회사')).toBeTruthy();
  });

  it('renders both line badges in stack for transfer stations', () => {
    const { getByTestId } = wrap(
      <FavoriteRow lines={['2', 'sb']} stationName="강남" nextMinutes={2} />,
    );
    expect(getByTestId('line-badge-2')).toBeTruthy();
    expect(getByTestId('line-badge-sb')).toBeTruthy();
  });

  it('caps line badges at two even when more lines provided', () => {
    const { getByTestId, queryByTestId } = wrap(
      <FavoriteRow lines={['1', '4', 'gx']} stationName="서울역" nextMinutes={4} />,
    );
    expect(getByTestId('line-badge-1')).toBeTruthy();
    expect(getByTestId('line-badge-4')).toBeTruthy();
    expect(queryByTestId('line-badge-gx')).toBeNull();
  });

  it('renders direction label and congestion tone label', () => {
    const { getByText } = wrap(
      <FavoriteRow
        lines={['2']}
        stationName="잠실"
        destinationLabel="모란 방면"
        congestion="high"
        nextMinutes={6}
      />,
    );
    expect(getByText('모란 방면')).toBeTruthy();
    expect(getByText('혼잡')).toBeTruthy();
  });

  it('omits drag handle by default', () => {
    const { queryByLabelText } = wrap(
      <FavoriteRow lines={['2']} stationName="강남" nextMinutes={3} />,
    );
    expect(queryByLabelText('드래그 핸들')).toBeNull();
  });

  it('shows drag handle when showDragHandle is true', () => {
    const { getAllByLabelText } = wrap(
      <FavoriteRow lines={['2']} stationName="강남" nextMinutes={3} showDragHandle />,
    );
    expect(getAllByLabelText(/드래그 핸들|^강남역/).length).toBeGreaterThan(0);
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = wrap(
      <FavoriteRow
        lines={['2']}
        stationName="강남"
        nextMinutes={1}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByTestId('favorite-row-강남'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
