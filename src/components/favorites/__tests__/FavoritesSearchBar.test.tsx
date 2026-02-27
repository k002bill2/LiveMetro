jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  XCircle: 'XCircle',
  SlidersHorizontal: 'SlidersHorizontal',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Briefcase: 'Briefcase',
}));

jest.mock('../../../services/theme', () => ({
  useTheme: () => ({
    colors: {
      textTertiary: '#C7C7CC',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textInverse: '#FFFFFF',
      surface: '#FFFFFF',
      backgroundSecondary: '#F2F2F7',
      borderMedium: '#D1D1D6',
      borderLight: '#E5E5EA',
    },
  }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FavoritesSearchBar } from '../FavoritesSearchBar';

describe('FavoritesSearchBar', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: jest.fn(),
    activeFilters: {},
    onFilterChange: jest.fn(),
    resultCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with placeholder', () => {
    const { getByPlaceholderText } = render(
      <FavoritesSearchBar {...defaultProps} />,
    );
    expect(getByPlaceholderText('역 이름으로 검색')).toBeTruthy();
  });

  it('calls onSearchChange when text is entered', () => {
    const { getByPlaceholderText } = render(
      <FavoritesSearchBar {...defaultProps} />,
    );
    fireEvent.changeText(getByPlaceholderText('역 이름으로 검색'), '강남');
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('강남');
  });

  it('does not show result bar when no active filters', () => {
    const { queryByText } = render(
      <FavoritesSearchBar {...defaultProps} />,
    );
    expect(queryByText('5개의 결과')).toBeNull();
  });

  it('shows result bar when search query exists', () => {
    const { getByText } = render(
      <FavoritesSearchBar {...defaultProps} searchQuery="강남" />,
    );
    expect(getByText('5개의 결과')).toBeTruthy();
  });

  it('shows clear filters button when filters active', () => {
    const { getByText } = render(
      <FavoritesSearchBar {...defaultProps} searchQuery="강남" />,
    );
    expect(getByText('필터 초기화')).toBeTruthy();
  });

  it('calls clearFilters when 필터 초기화 pressed', () => {
    const { getByText } = render(
      <FavoritesSearchBar {...defaultProps} searchQuery="강남" />,
    );
    fireEvent.press(getByText('필터 초기화'));
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('');
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith({});
  });

  it('shows result count with direction filter', () => {
    const { getByText } = render(
      <FavoritesSearchBar
        {...defaultProps}
        activeFilters={{ direction: 'up' }}
        resultCount={3}
      />,
    );
    expect(getByText('3개의 결과')).toBeTruthy();
  });
});
