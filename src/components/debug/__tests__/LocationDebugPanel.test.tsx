import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { LayoutAnimation } from 'react-native';
import { LocationDebugPanel } from '../LocationDebugPanel';

jest.mock('lucide-react-native', () => ({
  ChevronUp: 'ChevronUp',
  ChevronDown: 'ChevronDown',
  MapPin: 'MapPin',
  Navigation: 'Navigation',
  Train: 'Train',
  Clock: 'Clock',
  Crosshair: 'Crosshair',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
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
  }),
  ThemeColors: {},
}));

const mockStartTracking = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('@/hooks/useLocation', () => ({
  useLocation: (...args: unknown[]) => mockUseLocation(...args),
}));

jest.mock('@/hooks/useNearbyStations', () => ({
  useNearbyStations: jest.fn(() => ({
    closestStation: {
      name: '시청',
      lineId: '1',
      coordinates: { latitude: 37.566, longitude: 126.977 },
      distance: 150,
    },
    lastUpdated: new Date('2026-01-15T10:30:00'),
    loading: false,
  })),
}));

// Mock LayoutAnimation to prevent animation-related re-render loops
jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});

describe('LocationDebugPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockReturnValue({
      location: { latitude: 37.5665, longitude: 126.978 },
      accuracy: 10,
      isTracking: true,
      hasPermission: true,
      error: null,
      startTracking: mockStartTracking,
    });
    jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
  });

  it('renders collapsed view with coordinates', () => {
    const { getByText } = render(<LocationDebugPanel />);
    expect(getByText(/37\.566500, 126\.978000/)).toBeTruthy();
  });

  it('shows "Location Debug" title when expanded', () => {
    const { getByText, getByLabelText } = render(<LocationDebugPanel />);
    act(() => {
      fireEvent.press(getByLabelText('디버그 패널 펼치기'));
    });
    expect(getByText('Location Debug')).toBeTruthy();
  });

  it('shows GPS section when expanded', () => {
    const { getByText, getByLabelText } = render(<LocationDebugPanel />);
    act(() => {
      fireEvent.press(getByLabelText('디버그 패널 펼치기'));
    });
    expect(getByText('GPS 좌표')).toBeTruthy();
  });

  it('shows nearest station info when expanded', () => {
    const { getByText, getByLabelText } = render(<LocationDebugPanel />);
    act(() => {
      fireEvent.press(getByLabelText('디버그 패널 펼치기'));
    });
    expect(getByText('가장 가까운 역')).toBeTruthy();
    expect(getByText('시청 (1호선)')).toBeTruthy();
  });

  it('shows tracking status as active', () => {
    const { getByText, getByLabelText } = render(<LocationDebugPanel />);
    act(() => {
      fireEvent.press(getByLabelText('디버그 패널 펼치기'));
    });
    expect(getByText('추적 중')).toBeTruthy();
  });

  it('collapses back when pressing the header again', () => {
    const { getByText, getByLabelText, queryByText } = render(
      <LocationDebugPanel />,
    );
    act(() => {
      fireEvent.press(getByLabelText('디버그 패널 펼치기'));
    });
    expect(getByText('Location Debug')).toBeTruthy();
    act(() => {
      fireEvent.press(getByLabelText('디버그 패널 접기'));
    });
    expect(queryByText('GPS 좌표')).toBeNull();
  });

  it('shows "위치 없음" when location is null', () => {
    mockUseLocation.mockReturnValue({
      location: null,
      accuracy: null,
      isTracking: false,
      hasPermission: true,
      error: null,
      startTracking: mockStartTracking,
    });
    const { getByText } = render(<LocationDebugPanel />);
    expect(getByText('위치 없음')).toBeTruthy();
  });
});
