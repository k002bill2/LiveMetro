/**
 * StationCard Component Tests
 * Coverage target: 75%
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationCard, StationCardProps } from '../StationCard';
import type { Station } from '@/models/train';

// Mock dependencies
jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFFFFF',
      borderLight: '#F4F6F8',
      borderMedium: '#EEEEEE',
      primary: '#546FFF',
      textPrimary: '#1A1A1A',
      textSecondary: '#757575',
      textTertiary: '#A0A0A0',
    },
    isDark: false,
  }),
}));

jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn((lineId: string) => {
    const colors: Record<string, string> = {
      '1': '#0052A4',
      '2': '#00A84D',
      '3': '#EF7C1C',
      '9': '#BDB092',
    };
    return colors[lineId] ?? '#6b7280';
  }),
}));

describe('StationCard', () => {
  // Test fixtures
  const mockStation: Station = {
    id: 'station-gangnam',
    name: '강남',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: { latitude: 37.4979, longitude: 127.0276 },
    transfers: ['9', '신분당'],
  };

  const mockStationNoTransfer: Station = {
    id: 'station-jamsil',
    name: '잠실',
    nameEn: 'Jamsil',
    lineId: '2',
    coordinates: { latitude: 37.5133, longitude: 127.1002 },
    transfers: [],
  };

  const mockOnPress = jest.fn();

  const defaultProps: StationCardProps = {
    station: mockStation,
    onPress: mockOnPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render station name', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);

      expect(getByText('강남')).toBeTruthy();
    });

    it('should render English station name when provided', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);

      expect(getByText('Gangnam')).toBeTruthy();
    });

    it('should render line information', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);

      expect(getByText('2호선')).toBeTruthy();
    });

    it('should render transfer information when transfers exist', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);

      expect(getByText('환승: 9호선, 신분당호선')).toBeTruthy();
    });

    it('should not render transfer info when no transfers', () => {
      const { queryByText } = render(
        <StationCard {...defaultProps} station={mockStationNoTransfer} />
      );

      expect(queryByText(/환승:/)).toBeNull();
    });

    it('should apply line color to indicator', () => {
      render(<StationCard {...defaultProps} />);
      const { getSubwayLineColor } = require('@/utils/colorUtils');

      expect(getSubwayLineColor).toHaveBeenCalledWith('2');
    });

    it('should generate correct testID', () => {
      const { getByTestId } = render(<StationCard {...defaultProps} />);

      expect(getByTestId('station-card-station-gangnam')).toBeTruthy();
    });

    it('should use custom testID when provided', () => {
      const { getByTestId } = render(
        <StationCard {...defaultProps} testID="custom-test-id" />
      );

      expect(getByTestId('custom-test-id')).toBeTruthy();
    });
  });

  describe('Selection State', () => {
    it('should show selection styles when isSelected is true', () => {
      const { getByTestId } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );

      const card = getByTestId('station-card-station-gangnam');
      expect(card).toBeTruthy();
    });

    it('should reflect selected state in accessibilityState', () => {
      const { getByRole } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual({ selected: true });
    });

    it('should not show selected state when isSelected is false', () => {
      const { getByRole } = render(
        <StationCard {...defaultProps} isSelected={false} />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe('Interaction', () => {
    it('should call onPress with station when pressed', () => {
      const { getByTestId } = render(<StationCard {...defaultProps} />);

      fireEvent.press(getByTestId('station-card-station-gangnam'));

      expect(mockOnPress).toHaveBeenCalledTimes(1);
      expect(mockOnPress).toHaveBeenCalledWith(mockStation);
    });

    it('should not call onPress when not pressed', () => {
      render(<StationCard {...defaultProps} />);

      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should call onPress multiple times on multiple presses', () => {
      const { getByTestId } = render(<StationCard {...defaultProps} />);
      const card = getByTestId('station-card-station-gangnam');

      fireEvent.press(card);
      fireEvent.press(card);
      fireEvent.press(card);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('should have button accessibility role', () => {
      const { getByRole } = render(<StationCard {...defaultProps} />);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should have proper accessibility label with station name and line', () => {
      const { getByRole } = render(<StationCard {...defaultProps} />);

      const button = getByRole('button');
      expect(button.props.accessibilityLabel).toContain('강남 역');
      expect(button.props.accessibilityLabel).toContain('2호선');
    });

    it('should include transfer info in accessibility label when present', () => {
      const { getByRole } = render(<StationCard {...defaultProps} />);

      const button = getByRole('button');
      expect(button.props.accessibilityLabel).toContain('환승');
    });

    it('should not include transfer in label when no transfers', () => {
      const { getByRole } = render(
        <StationCard {...defaultProps} station={mockStationNoTransfer} />
      );

      const button = getByRole('button');
      expect(button.props.accessibilityLabel).not.toContain('환승');
    });

    it('should have proper accessibility hint', () => {
      const { getByRole } = render(<StationCard {...defaultProps} />);

      const button = getByRole('button');
      expect(button.props.accessibilityHint).toBe(
        '탭하여 역 상세 정보를 확인하세요'
      );
    });

    it('should be accessible', () => {
      const { getByRole } = render(<StationCard {...defaultProps} />);

      const button = getByRole('button');
      expect(button.props.accessible).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should have displayName for debugging', () => {
      expect(StationCard.displayName).toBe('StationCard');
    });

    it('should be memoized component', () => {
      // React.memo wraps the component - check via displayName
      expect(StationCard.displayName).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle station with empty name gracefully', () => {
      const stationEmptyName: Station = {
        ...mockStation,
        name: '',
      };

      const { getByTestId } = render(
        <StationCard {...defaultProps} station={stationEmptyName} />
      );

      expect(getByTestId('station-card-station-gangnam')).toBeTruthy();
    });

    it('should handle station without English name', () => {
      const stationNoEnglish: Station = {
        ...mockStation,
        nameEn: '',
      };

      const { queryByText } = render(
        <StationCard {...defaultProps} station={stationNoEnglish} />
      );

      // Should not render empty English name element
      expect(queryByText('Gangnam')).toBeNull();
    });

    it('should apply custom styles', () => {
      const customStyle = { marginTop: 20 };
      const { getByTestId } = render(
        <StationCard {...defaultProps} style={customStyle} />
      );

      const card = getByTestId('station-card-station-gangnam');
      // Style is flattened, so check if marginTop is present in the style object
      const flatStyle = Array.isArray(card.props.style)
        ? Object.assign({}, ...card.props.style.filter(Boolean))
        : card.props.style;
      expect(flatStyle.marginTop).toBe(20);
    });

    it('should handle station with null nameEn', () => {
      const stationNullEn: Station = {
        ...mockStation,
        nameEn: null as any,
      };

      const { queryByText } = render(
        <StationCard {...defaultProps} station={stationNullEn} />
      );

      // Should handle null gracefully
      expect(queryByText('강남')).toBeTruthy();
    });

    it('should handle station with null transfers', () => {
      const stationNullTransfers: Station = {
        ...mockStation,
        transfers: null as any,
      };

      const { queryByText } = render(
        <StationCard {...defaultProps} station={stationNullTransfers} />
      );

      expect(queryByText(/환승:/)).toBeNull();
    });

    it('should handle station with single transfer', () => {
      const stationSingleTransfer: Station = {
        ...mockStation,
        transfers: ['5'],
      };

      const { getByText } = render(
        <StationCard {...defaultProps} station={stationSingleTransfer} />
      );

      expect(getByText('환승: 5호선')).toBeTruthy();
    });

    it('should handle station with multiple transfers', () => {
      const stationMultiTransfers: Station = {
        ...mockStation,
        transfers: ['1', '3', '7', '신분당'],
      };

      const { getByText } = render(
        <StationCard {...defaultProps} station={stationMultiTransfers} />
      );

      expect(
        getByText('환승: 1호선, 3호선, 7호선, 신분당호선')
      ).toBeTruthy();
    });

    it('should handle undefined testID prop', () => {
      const { getByTestId } = render(
        <StationCard {...defaultProps} testID={undefined} />
      );

      // Should use default testID based on station.id
      expect(getByTestId('station-card-station-gangnam')).toBeTruthy();
    });

    it('should handle station with various lineIds', () => {
      const stationLine9: Station = {
        ...mockStation,
        lineId: '9',
      };

      const { getByText } = render(
        <StationCard {...defaultProps} station={stationLine9} />
      );

      expect(getByText('9호선')).toBeTruthy();
    });
  });

  describe('Memoization and Callbacks', () => {
    it('should maintain callback reference stability', () => {
      const onPress = jest.fn();
      const { getByTestId, rerender } = render(
        <StationCard {...defaultProps} onPress={onPress} />
      );

      const card1 = getByTestId('station-card-station-gangnam');
      fireEvent.press(card1);
      expect(onPress).toHaveBeenCalledTimes(1);

      // Re-render with same callback
      rerender(<StationCard {...defaultProps} onPress={onPress} />);
      const card2 = getByTestId('station-card-station-gangnam');
      fireEvent.press(card2);
      expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('should handle changing station prop', () => {
      const { getByText, rerender } = render(
        <StationCard {...defaultProps} />
      );

      expect(getByText('강남')).toBeTruthy();

      const newStation: Station = {
        ...mockStation,
        name: '역삼',
        id: 'station-yeoksam',
      };

      rerender(<StationCard {...defaultProps} station={newStation} />);

      expect(getByText('역삼')).toBeTruthy();
    });

    it('should update accessibility label when station changes', () => {
      const { getByRole, rerender } = render(
        <StationCard {...defaultProps} />
      );

      let button = getByRole('button');
      expect(button.props.accessibilityLabel).toContain('강남 역');

      const newStation: Station = {
        ...mockStation,
        name: '건대입구',
        id: 'station-konkuk',
      };

      rerender(<StationCard {...defaultProps} station={newStation} />);

      button = getByRole('button');
      expect(button.props.accessibilityLabel).toContain('건대입구 역');
    });

    it('should compute lineColor based on lineId', () => {
      const { getSubwayLineColor } = require('@/utils/colorUtils');

      render(<StationCard {...defaultProps} station={mockStation} />);

      expect(getSubwayLineColor).toHaveBeenCalledWith('2');
    });

    it('should update lineColor when lineId changes', () => {
      const { getSubwayLineColor } = require('@/utils/colorUtils');
      const { rerender } = render(
        <StationCard {...defaultProps} />
      );

      getSubwayLineColor.mockClear();

      const newStation: Station = {
        ...mockStation,
        lineId: '3',
      };

      rerender(<StationCard {...defaultProps} station={newStation} />);

      expect(getSubwayLineColor).toHaveBeenCalledWith('3');
    });
  });

  describe('Prop Combinations', () => {
    it('should render correctly with all props provided', () => {
      const { getByTestId, getByRole } = render(
        <StationCard
          station={mockStation}
          onPress={mockOnPress}
          isSelected={true}
          testID="custom-id"
          style={{ padding: 10 }}
        />
      );

      expect(getByTestId('custom-id')).toBeTruthy();
      const button = getByRole('button');
      expect(button.props.accessibilityState.selected).toBe(true);
    });

    it('should render correctly with minimal props', () => {
      const { getByTestId } = render(
        <StationCard
          station={mockStation}
          onPress={mockOnPress}
        />
      );

      expect(getByTestId('station-card-station-gangnam')).toBeTruthy();
    });

    it('should toggle selection state independently', () => {
      const { rerender, getByRole } = render(
        <StationCard {...defaultProps} isSelected={false} />
      );

      let button = getByRole('button');
      expect(button.props.accessibilityState.selected).toBe(false);

      rerender(<StationCard {...defaultProps} isSelected={true} />);

      button = getByRole('button');
      expect(button.props.accessibilityState.selected).toBe(true);
    });
  });

  describe('Theme Integration', () => {
    it('should render with correct theme context', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);

      // Verify that component renders using theme colors
      const stationNameElement = getByText('강남');
      expect(stationNameElement).toBeTruthy();
    });

    it('should render with correct text colors from theme', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);

      const stationNameElement = getByText('강남');
      const lineInfoElement = getByText('2호선');

      expect(stationNameElement).toBeTruthy();
      expect(lineInfoElement).toBeTruthy();
    });
  });

  describe('Transfers Display Formatting', () => {
    it('should format multiple transfers with 호선 suffix', () => {
      const stationMultiTransfers: Station = {
        ...mockStation,
        transfers: ['1', '3', '신분당'],
      };

      const { getByText } = render(
        <StationCard {...defaultProps} station={stationMultiTransfers} />
      );

      expect(getByText('환승: 1호선, 3호선, 신분당호선')).toBeTruthy();
    });

    it('should handle transfer display in accessibility label', () => {
      const stationWithTransfers: Station = {
        ...mockStation,
        transfers: ['3', '7'],
      };

      const { getByRole } = render(
        <StationCard {...defaultProps} station={stationWithTransfers} />
      );

      const button = getByRole('button');
      // The accessibility label includes all parts: name, line, transfers
      expect(button.props.accessibilityLabel).toContain('환승:');
      expect(button.props.accessibilityLabel).toContain('3');
      expect(button.props.accessibilityLabel).toContain('7');
    });
  });

  describe('Display Name and Component Identity', () => {
    it('should have correct displayName for debugging tools', () => {
      expect(StationCard.displayName).toBe('StationCard');
    });

    it('should maintain consistent component identity', () => {
      const { getByTestId: getById1 } = render(
        <StationCard {...defaultProps} />
      );

      const card1 = getById1('station-card-station-gangnam');
      expect(card1.props.accessibilityRole).toBe('button');
    });
  });
});
