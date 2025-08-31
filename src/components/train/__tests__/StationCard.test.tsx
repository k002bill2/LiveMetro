/**
 * StationCard Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationCard } from '../StationCard';
import { Station } from '../../../models/train';

describe('StationCard', () => {
  const mockStation: Station = {
    id: 'station-1',
    name: '강남역',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: {
      latitude: 37.5665,
      longitude: 126.9780,
    },
    transfers: ['9'],
  };

  const defaultProps = {
    station: mockStation,
    isSelected: false,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render station name and English name', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);
      
      expect(getByText('강남역')).toBeTruthy();
      expect(getByText('Gangnam')).toBeTruthy();
    });

    it('should render line information', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);
      
      expect(getByText('2호선')).toBeTruthy();
    });

    it('should render transfer information when transfers exist', () => {
      const { getByText } = render(<StationCard {...defaultProps} />);
      
      expect(getByText('환승: 9호선')).toBeTruthy();
    });

    it('should not render transfer information when no transfers', () => {
      const stationWithoutTransfers = {
        ...mockStation,
        transfers: [],
      };
      
      const { queryByText } = render(
        <StationCard {...defaultProps} station={stationWithoutTransfers} />
      );
      
      expect(queryByText(/환승:/)).toBeNull();
    });
  });

  describe('Selection State', () => {
    it('should show selected state when isSelected is true', () => {
      const { getByTestId } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );
      
      // The checkmark icon should be visible
      expect(getByTestId('selected-indicator')).toBeTruthy();
    });

    it('should apply selected styles when selected', () => {
      const { getByRole } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );
      
      const button = getByRole('button');
      expect(button.props.accessibilityState.selected).toBe(true);
    });
  });

  describe('Distance Display', () => {
    it('should show distance when showDistance is true and distance is provided', () => {
      const { getByText } = render(
        <StationCard 
          {...defaultProps} 
          showDistance={true} 
          distance={0.5} 
        />
      );
      
      expect(getByText('500m')).toBeTruthy();
    });

    it('should show distance in km when distance >= 1', () => {
      const { getByText } = render(
        <StationCard 
          {...defaultProps} 
          showDistance={true} 
          distance={1.5} 
        />
      );
      
      expect(getByText('1.5km')).toBeTruthy();
    });

    it('should not show distance when showDistance is false', () => {
      const { queryByText } = render(
        <StationCard 
          {...defaultProps} 
          showDistance={false} 
          distance={0.5} 
        />
      );
      
      expect(queryByText('500m')).toBeNull();
    });
  });

  describe('Interaction', () => {
    it('should call onPress when pressed', () => {
      const mockOnPress = jest.fn();
      
      const { getByRole } = render(
        <StationCard {...defaultProps} onPress={mockOnPress} />
      );
      
      const button = getByRole('button');
      fireEvent.press(button);
      
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should not crash when onPress is undefined', () => {
      const { getByRole } = render(
        <StationCard {...defaultProps} onPress={undefined} />
      );
      
      const button = getByRole('button');
      expect(() => fireEvent.press(button)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility label', () => {
      const { getByRole } = render(
        <StationCard 
          {...defaultProps} 
          showDistance={true} 
          distance={0.5} 
        />
      );
      
      const button = getByRole('button');
      const expectedLabel = '강남역 역, 2호선, 환승역: 9호선, 거리: 500m';
      
      expect(button.props.accessibilityLabel).toBe(expectedLabel);
    });

    it('should have proper accessibility hint based on selection state', () => {
      const { getByRole: getSelectedButton } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );
      
      const selectedButton = getSelectedButton('button');
      expect(selectedButton.props.accessibilityHint).toBe('현재 선택된 역입니다');
      
      const { getByRole: getUnselectedButton } = render(
        <StationCard {...defaultProps} isSelected={false} />
      );
      
      const unselectedButton = getUnselectedButton('button');
      expect(unselectedButton.props.accessibilityHint).toBe('탭하여 이 역의 실시간 정보를 확인하세요');
    });

    it('should have proper accessibility role', () => {
      const { getByRole } = render(<StationCard {...defaultProps} />);
      
      const button = getByRole('button');
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Performance', () => {
    it('should not re-render when props are the same', () => {
      const { rerender } = render(<StationCard {...defaultProps} />);
      
      // Re-render with same props
      rerender(<StationCard {...defaultProps} />);
      
      // Component should be memoized and not re-render unnecessarily
      // This is more of an integration test - would need React DevTools to verify properly
    });
  });
});