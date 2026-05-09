import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationSearchBar } from '../StationSearchBar';

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

const mockStation = (id: string, name: string) => ({ id, name });

describe('StationSearchBar', () => {
  const defaultProps = {
    fromStation: null,
    toStation: null,
    onPressFrom: jest.fn(),
    onPressTo: jest.fn(),
    onSwap: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders empty placeholders when no stations selected', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    expect(getByTestId('search-bar-from-row')).toHaveTextContent(/출발역/);
    expect(getByTestId('search-bar-to-row')).toHaveTextContent(/도착역/);
  });

  it('renders station names when provided', () => {
    const { getByTestId } = render(
      <StationSearchBar
        {...defaultProps}
        fromStation={mockStation('a', '강남')}
        toStation={mockStation('b', '잠실')}
      />
    );
    expect(getByTestId('search-bar-from-row')).toHaveTextContent('강남');
    expect(getByTestId('search-bar-to-row')).toHaveTextContent('잠실');
  });

  it('calls onPressFrom when from row tapped', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    fireEvent.press(getByTestId('search-bar-from-row'));
    expect(defaultProps.onPressFrom).toHaveBeenCalledTimes(1);
  });

  it('calls onPressTo when to row tapped', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    fireEvent.press(getByTestId('search-bar-to-row'));
    expect(defaultProps.onPressTo).toHaveBeenCalledTimes(1);
  });

  it('calls onSwap when swap button tapped', () => {
    const { getByTestId } = render(<StationSearchBar {...defaultProps} />);
    fireEvent.press(getByTestId('search-bar-swap'));
    expect(defaultProps.onSwap).toHaveBeenCalledTimes(1);
  });
});
