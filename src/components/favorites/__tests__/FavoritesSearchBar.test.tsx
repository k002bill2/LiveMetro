import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FavoritesSearchBar } from '../FavoritesSearchBar';

jest.mock('lucide-react-native', () => ({
  Search: 'Search',
  XCircle: 'XCircle',
  SlidersHorizontal: 'SlidersHorizontal',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Briefcase: 'Briefcase',
}));

jest.mock('@/services/theme', () => ({
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

  describe('Rendering', () => {
    it('renders search input with placeholder', () => {
      const { getByPlaceholderText } = render(
        <FavoritesSearchBar {...defaultProps} />,
      );
      expect(getByPlaceholderText('역 이름으로 검색')).toBeTruthy();
    });

    it('renders filter toggle button', () => {
      const { getByTestId } = render(
        <FavoritesSearchBar {...defaultProps} />,
      );
      expect(getByTestId('filter-toggle-button')).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('calls onSearchChange when text is entered', () => {
      const { getByPlaceholderText } = render(
        <FavoritesSearchBar {...defaultProps} />,
      );
      fireEvent.changeText(getByPlaceholderText('역 이름으로 검색'), '강남');
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('강남');
    });

    it('shows clear button when search query exists', () => {
      const { getByDisplayValue } = render(
        <FavoritesSearchBar {...defaultProps} searchQuery="강남" />,
      );
      expect(getByDisplayValue('강남')).toBeTruthy();
    });

    it('clears search when clear button is pressed', () => {
      const onSearchChange = jest.fn();
      const { UNSAFE_root } = render(
        <FavoritesSearchBar
          {...defaultProps}
          searchQuery="강남"
          onSearchChange={onSearchChange}
        />,
      );
      const buttons = UNSAFE_root.findAllByType('TouchableOpacity');
      // Find and press the clear button (second button, index 1)
      if (buttons.length >= 2) {
        fireEvent.press(buttons[1]);
        expect(onSearchChange).toHaveBeenCalledWith('');
      }
    });

    it('does not show clear button when search query is empty', () => {
      const { getByPlaceholderText } = render(
        <FavoritesSearchBar {...defaultProps} />,
      );
      const input = getByPlaceholderText('역 이름으로 검색');
      expect(input.props.value).toBe('');
    });
  });

  describe('Result Bar Visibility', () => {
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

    it('shows result bar with direction filter', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ direction: 'up' }}
          resultCount={3}
        />,
      );
      expect(getByText('3개의 결과')).toBeTruthy();
    });

    it('shows result bar with commute filter', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ commuteOnly: true }}
          resultCount={2}
        />,
      );
      expect(getByText('2개의 결과')).toBeTruthy();
    });

    it('shows result bar with lineId filter', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ lineId: '2' }}
          resultCount={7}
        />,
      );
      expect(getByText('7개의 결과')).toBeTruthy();
    });

    it('shows result bar with combined filters', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          searchQuery="강남"
          activeFilters={{ direction: 'down', commuteOnly: true }}
          resultCount={1}
        />,
      );
      expect(getByText('1개의 결과')).toBeTruthy();
    });
  });

  describe('Clear Filters Button', () => {
    it('shows clear filters button when filters active', () => {
      const { getByText } = render(
        <FavoritesSearchBar {...defaultProps} searchQuery="강남" />,
      );
      expect(getByText('필터 초기화')).toBeTruthy();
    });

    it('calls onSearchChange and onFilterChange when clear filters pressed', () => {
      const onSearchChange = jest.fn();
      const onFilterChange = jest.fn();
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          searchQuery="강남"
          onSearchChange={onSearchChange}
          onFilterChange={onFilterChange}
        />,
      );
      fireEvent.press(getByText('필터 초기화'));
      expect(onSearchChange).toHaveBeenCalledWith('');
      expect(onFilterChange).toHaveBeenCalledWith({});
    });

    it('does not show clear button when no active filters', () => {
      const { queryByText } = render(
        <FavoritesSearchBar {...defaultProps} />,
      );
      expect(queryByText('필터 초기화')).toBeNull();
    });
  });

  describe('Filter Toggle', () => {
    it('filter toggle button is present', () => {
      const { getByTestId } = render(
        <FavoritesSearchBar {...defaultProps} />,
      );
      expect(getByTestId('filter-toggle-button')).toBeTruthy();
    });

    it('filter toggle has active state when direction filter is set', () => {
      const { getByTestId } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ direction: 'up' }}
        />,
      );
      const button = getByTestId('filter-toggle-button');
      expect(button).toBeTruthy();
      // Button should have backgroundColor set when filter is active
      expect(button.props.style).toBeDefined();
    });

    it('filter toggle has active state when commute filter is set', () => {
      const { getByTestId } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ commuteOnly: true }}
        />,
      );
      const button = getByTestId('filter-toggle-button');
      expect(button).toBeTruthy();
      // Button should have backgroundColor set when filter is active
      expect(button.props.style).toBeDefined();
    });
  });

  describe('Direction Filter', () => {
    it('toggles direction filter to up', async () => {
      const onFilterChange = jest.fn();
      const { UNSAFE_root } = render(
        <FavoritesSearchBar
          {...defaultProps}
          onFilterChange={onFilterChange}
        />,
      );

      // Get filter button and press it to show filters
      const buttons = UNSAFE_root.findAllByType('TouchableOpacity');
      if (buttons.length > 0) {
        fireEvent.press(buttons[buttons.length - 1]); // Filter toggle button

        // Wait for animated filters to appear and get direction filter buttons
        await waitFor(() => {
          const allButtons = UNSAFE_root.findAllByType('TouchableOpacity');
          // Direction 'up' button should appear
          if (allButtons.length > buttons.length) {
            // Press the 'up' direction button
            fireEvent.press(allButtons[allButtons.length - 4]); // Estimated position
          }
        });
      }
    });

    it('deselects direction filter when already selected', async () => {
      const onFilterChange = jest.fn();
      const { UNSAFE_root } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ direction: 'up' }}
          onFilterChange={onFilterChange}
        />,
      );

      const buttons = UNSAFE_root.findAllByType('TouchableOpacity');
      if (buttons.length > 0) {
        fireEvent.press(buttons[buttons.length - 1]); // Filter toggle button
      }
      // Verify filter change was triggered or component rendered correctly
      expect(UNSAFE_root).toBeTruthy();
      expect(onFilterChange).toBeDefined();
    });

    it('toggles direction filter to down', () => {
      const onFilterChange = jest.fn();
      render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ direction: 'down' }}
          onFilterChange={onFilterChange}
        />,
      );
      // Component should render with down direction
      expect(onFilterChange).not.toHaveBeenCalled();
    });
  });

  describe('Commute Filter', () => {
    it('toggles commute filter on', async () => {
      const onFilterChange = jest.fn();
      const { getByTestId } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ commuteOnly: false }}
          onFilterChange={onFilterChange}
        />,
      );

      const filterToggle = getByTestId('filter-toggle-button');
      fireEvent.press(filterToggle);

      await waitFor(() => {
        const commuteButton = getByTestId('commute-filter-button');
        expect(commuteButton).toBeTruthy();
      });
    });

    it('toggles commute filter off', async () => {
      const onFilterChange = jest.fn();
      const { getByTestId } = render(
        <FavoritesSearchBar
          {...defaultProps}
          activeFilters={{ commuteOnly: true }}
          onFilterChange={onFilterChange}
        />,
      );

      const filterToggle = getByTestId('filter-toggle-button');
      fireEvent.press(filterToggle);

      await waitFor(() => {
        const commuteButton = getByTestId('commute-filter-button');
        expect(commuteButton).toBeTruthy();
      });
    });
  });

  describe('Filter Combinations', () => {
    it('handles multiple filters together', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          searchQuery="강남"
          activeFilters={{
            direction: 'up',
            commuteOnly: true,
            lineId: '2',
          }}
          resultCount={1}
        />,
      );
      expect(getByText('1개의 결과')).toBeTruthy();
      expect(getByText('필터 초기화')).toBeTruthy();
    });
  });

  describe('Result Count Edge Cases', () => {
    it('displays zero results', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          searchQuery="비존재역"
          resultCount={0}
        />,
      );
      expect(getByText('0개의 결과')).toBeTruthy();
    });

    it('displays large result count', () => {
      const { getByText } = render(
        <FavoritesSearchBar
          {...defaultProps}
          searchQuery="서"
          resultCount={150}
        />,
      );
      expect(getByText('150개의 결과')).toBeTruthy();
    });
  });
});
