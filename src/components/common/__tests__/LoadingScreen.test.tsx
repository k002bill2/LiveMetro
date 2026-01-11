/**
 * LoadingScreen Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingScreen } from '../LoadingScreen';

// Mock useTheme hook
jest.mock('../../../services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      backgroundSecondary: '#F3F4F6',
      textSecondary: '#6B7280',
    },
  }),
}));

describe('LoadingScreen', () => {
  describe('Rendering', () => {
    it('should render with default message', () => {
      const { getByText } = render(<LoadingScreen />);
      expect(getByText('로딩중...')).toBeTruthy();
    });

    it('should render with custom message', () => {
      const { getByText } = render(<LoadingScreen message="데이터 불러오는 중..." />);
      expect(getByText('데이터 불러오는 중...')).toBeTruthy();
    });

    it('should render without message when message is empty', () => {
      const { queryByText } = render(<LoadingScreen message="" />);
      expect(queryByText('로딩중...')).toBeNull();
    });

    it('should render ActivityIndicator', () => {
      const { UNSAFE_getByType } = render(<LoadingScreen />);
      const ActivityIndicator = require('react-native').ActivityIndicator;
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });

  describe('Size prop', () => {
    it('should render with large size by default', () => {
      const { UNSAFE_getByType } = render(<LoadingScreen />);
      const ActivityIndicator = require('react-native').ActivityIndicator;
      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('large');
    });

    it('should render with small size when specified', () => {
      const { UNSAFE_getByType } = render(<LoadingScreen size="small" />);
      const ActivityIndicator = require('react-native').ActivityIndicator;
      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.size).toBe('small');
    });
  });

  describe('Styling', () => {
    it('should apply theme colors to indicator', () => {
      const { UNSAFE_getByType } = render(<LoadingScreen />);
      const ActivityIndicator = require('react-native').ActivityIndicator;
      const indicator = UNSAFE_getByType(ActivityIndicator);
      expect(indicator.props.color).toBe('#3B82F6');
    });
  });
});
