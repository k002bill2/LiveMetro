/**
 * AlternativeRoutesScreen Test Suite
 * Tests alternative routes screen rendering, loading, error, and no-delay states
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlternativeRoutesScreen } from '../AlternativeRoutesScreen';
import { useAlternativeRoutes } from '@/hooks/useAlternativeRoutes';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  AlertTriangle: 'AlertTriangle',
  RefreshCw: 'RefreshCw',
  Map: 'Map',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {
      fromStationId: 'stn-gangnam',
      toStationId: 'stn-jamsil',
      fromStationName: '강남',
      toStationName: '잠실',
    },
  })),
  RouteProp: {},
}));
jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
    isDark: false,
  })),
  ThemeColors: {},
}));

const mockCalculate = jest.fn(() => Promise.resolve());

jest.mock('@/hooks/useAlternativeRoutes', () => ({
  useAlternativeRoutes: jest.fn(() => ({
    originalRoute: null,
    alternatives: [],
    loading: false,
    error: null,
    calculate: mockCalculate,
    hasAffectedRoute: false,
    affectedLineIds: [],
  })),
}));
jest.mock('@/hooks/useDelayDetection', () => ({
  useDelayDetection: jest.fn(() => ({
    delays: [],
  })),
}));
jest.mock('@/components/route/AlternativeRouteCard', () => ({
  AlternativeRouteCard: () => 'AlternativeRouteCard',
}));
jest.mock('@/components/route/RouteComparisonView', () => ({
  RouteComparisonView: () => 'RouteComparisonView',
}));
jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(() => '#00A84D'),
}));

describe('AlternativeRoutesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAlternativeRoutes as jest.Mock).mockReturnValue({
      originalRoute: null,
      alternatives: [],
      loading: false,
      error: null,
      calculate: mockCalculate,
      hasAffectedRoute: false,
      affectedLineIds: [],
    });
  });

  it('renders header with title', () => {
    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('대체 경로')).toBeTruthy();
  });

  it('shows station names in header subtitle', () => {
    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('강남 → 잠실')).toBeTruthy();
  });

  it('shows no-delay state when route is unaffected', () => {
    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('현재 경로에 지연이 없습니다')).toBeTruthy();
  });

  it('shows loading state while calculating', () => {
    (useAlternativeRoutes as jest.Mock).mockReturnValue({
      originalRoute: null,
      alternatives: [],
      loading: true,
      error: null,
      calculate: mockCalculate,
      hasAffectedRoute: false,
      affectedLineIds: [],
    });

    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('대체 경로를 계산하고 있습니다...')).toBeTruthy();
  });

  it('shows error state with retry button', () => {
    (useAlternativeRoutes as jest.Mock).mockReturnValue({
      originalRoute: null,
      alternatives: [],
      loading: false,
      error: '경로 계산에 실패했습니다',
      calculate: mockCalculate,
      hasAffectedRoute: false,
      affectedLineIds: [],
    });

    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('경로 계산에 실패했습니다')).toBeTruthy();
    expect(getByText('다시 시도')).toBeTruthy();
  });

  it('shows no alternatives message when affected but no routes found', () => {
    (useAlternativeRoutes as jest.Mock).mockReturnValue({
      originalRoute: { totalMinutes: 30 },
      alternatives: [],
      loading: false,
      error: null,
      calculate: mockCalculate,
      hasAffectedRoute: true,
      affectedLineIds: ['2'],
    });

    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('대체 경로를 찾을 수 없습니다')).toBeTruthy();
  });

  it('calls calculate on mount with station IDs', () => {
    render(<AlternativeRoutesScreen />);
    expect(mockCalculate).toHaveBeenCalledWith('stn-gangnam', 'stn-jamsil');
  });

  it('shows original route time when no delay', () => {
    (useAlternativeRoutes as jest.Mock).mockReturnValue({
      originalRoute: { totalMinutes: 25 },
      alternatives: [],
      loading: false,
      error: null,
      calculate: mockCalculate,
      hasAffectedRoute: false,
      affectedLineIds: [],
    });

    const { getByText } = render(<AlternativeRoutesScreen />);
    expect(getByText('예상 소요 시간')).toBeTruthy();
    expect(getByText('25분')).toBeTruthy();
  });
});
