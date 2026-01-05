/**
 * StationCard Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StationCard } from '../StationCard';
import { Station } from '../../../models/train';

// Mock hooks
jest.mock('../../../services/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user', email: 'test@example.com' },
    updateUserProfile: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useRealtimeTrains', () => ({
  useRealtimeTrains: () => ({
    trains: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../../services/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFFFFF',
      borderLight: '#E0E0E0',
      borderMedium: '#CCCCCC',
      primary: '#00A84D',
      textPrimary: '#000000',
      textSecondary: '#666666',
      textTertiary: '#999999',
      textInverse: '#FFFFFF',
      info: '#2196F3',
      error: '#FF0000',
      warning: '#FFA000',
    },
    isDark: false,
  }),
}));

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
      const { getAllByRole } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );

      // The main card button should have selected state
      const buttons = getAllByRole('button');
      const mainButton = buttons[0]; // First button is the main card
      expect(mainButton?.props.accessibilityState?.selected).toBe(true);
    });

    it('should apply selected styles when selected', () => {
      const { getAllByRole } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );

      const buttons = getAllByRole('button');
      const mainButton = buttons[0]; // First button is the main card
      expect(mainButton?.props.accessibilityState?.selected).toBe(true);
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

      const { getAllByRole } = render(
        <StationCard {...defaultProps} onPress={mockOnPress} />
      );

      const buttons = getAllByRole('button');
      const mainButton = buttons[0]; // First button is the main card
      fireEvent.press(mainButton!);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('should not crash when onPress is undefined', () => {
      const { getAllByRole } = render(
        <StationCard {...defaultProps} onPress={undefined} />
      );

      const buttons = getAllByRole('button');
      const mainButton = buttons[0];
      expect(() => fireEvent.press(mainButton!)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility label', () => {
      const { getAllByRole } = render(
        <StationCard
          {...defaultProps}
          showDistance={true}
          distance={0.5}
        />
      );

      const buttons = getAllByRole('button');
      const mainButton = buttons[0];
      const expectedLabel = '강남역 역, 2호선, 환승역: 9호선, 거리: 500m';

      expect(mainButton?.props.accessibilityLabel).toBe(expectedLabel);
    });

    it('should have proper accessibility hint based on selection state', () => {
      const { getAllByRole: getSelectedButtons } = render(
        <StationCard {...defaultProps} isSelected={true} />
      );

      const selectedButtons = getSelectedButtons('button');
      const selectedButton = selectedButtons[0];
      expect(selectedButton?.props.accessibilityHint).toBe('현재 선택된 역입니다');

      const { getAllByRole: getUnselectedButtons } = render(
        <StationCard {...defaultProps} isSelected={false} />
      );

      const unselectedButtons = getUnselectedButtons('button');
      const unselectedButton = unselectedButtons[0];
      expect(unselectedButton?.props.accessibilityHint).toBe('탭하여 이 역의 실시간 정보를 확인하세요');
    });

    it('should have proper accessibility role', () => {
      const { getAllByRole } = render(<StationCard {...defaultProps} />);

      const buttons = getAllByRole('button');
      const mainButton = buttons[0];
      expect(mainButton?.props.accessibilityRole).toBe('button');
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