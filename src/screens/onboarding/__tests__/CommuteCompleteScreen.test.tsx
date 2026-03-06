/**
 * CommuteCompleteScreen Test Suite
 * Tests commute complete screen rendering, route summaries, and save action
 */

// Mock modules BEFORE imports (Jest hoisting)
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CommuteCompleteScreen } from '../CommuteCompleteScreen';
import { saveCommuteRoutes } from '@/services/commute/commuteService';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  CheckCircle: 'CheckCircle',
  Sun: 'Sun',
  Moon: 'Moon',
  Pencil: 'Pencil',
  Bell: 'Bell',
  Clock: 'Clock',
  AlertCircle: 'AlertCircle',
  ArrowRight: 'ArrowRight',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
}));
jest.mock('@/navigation/OnboardingNavigator', () => ({
  useOnboardingCallbacks: jest.fn(() => ({
    onComplete: jest.fn(),
  })),
}));
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', displayName: 'Test User' },
  })),
}));
jest.mock('@/services/commute/commuteService', () => ({
  saveCommuteRoutes: jest.fn(() => Promise.resolve({ success: true })),
}));
jest.mock('@/components/commute/RoutePreview', () => ({
  RoutePreview: () => 'RoutePreview',
}));
jest.mock('@/models/commute', () => ({
  createCommuteRoute: jest.fn((params: Record<string, unknown>) => ({
    ...params,
    id: 'route-id',
    isActive: true,
  })),
  DEFAULT_COMMUTE_NOTIFICATIONS: {
    transferAlert: true,
    arrivalAlert: true,
    delayAlert: true,
    incidentAlert: false,
  },
  DEFAULT_BUFFER_MINUTES: 5,
}));

const mockNavigate = jest.fn();

const mockRoute = {
  params: {
    morningRoute: {
      departureTime: '08:30',
      departureStation: {
        stationId: 'stn-1',
        stationName: '강남',
        lineId: '2',
        lineName: '2호선',
      },
      arrivalStation: {
        stationId: 'stn-2',
        stationName: '시청',
        lineId: '1',
        lineName: '1호선',
      },
      transferStations: [],
      notifications: {
        transferAlert: true,
        arrivalAlert: true,
        delayAlert: true,
        incidentAlert: false,
      },
    },
    eveningRoute: {
      departureTime: '18:00',
      departureStation: {
        stationId: 'stn-2',
        stationName: '시청',
        lineId: '1',
        lineName: '1호선',
      },
      arrivalStation: {
        stationId: 'stn-1',
        stationName: '강남',
        lineId: '2',
        lineName: '2호선',
      },
      transferStations: [],
      notifications: {
        transferAlert: true,
        arrivalAlert: false,
        delayAlert: true,
        incidentAlert: false,
      },
    },
  },
};

const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
} as unknown;

describe('CommuteCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders header with completion message', () => {
    const { getByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );
    expect(getByText('설정 완료!')).toBeTruthy();
    expect(getByText(/출퇴근 경로가 모두 설정되었습니다/)).toBeTruthy();
  });

  it('shows morning route section with time', () => {
    const { getByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );
    expect(getByText('출근')).toBeTruthy();
    expect(getByText('오전 8:30')).toBeTruthy();
  });

  it('shows evening route section with time', () => {
    const { getByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );
    expect(getByText('퇴근')).toBeTruthy();
    expect(getByText('오후 6:00')).toBeTruthy();
  });

  it('shows notification counts', () => {
    const { getAllByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );
    // Morning has 3 active notifications, evening has 2
    expect(getAllByText(/개 알림 활성화/).length).toBe(2);
  });

  it('shows feature info section', () => {
    const { getByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );
    expect(getByText('이런 기능을 이용할 수 있어요')).toBeTruthy();
    expect(getByText('출발 시간에 맞춘 실시간 도착 정보')).toBeTruthy();
  });

  it('shows loading state when params are missing', () => {
    const emptyRoute = { params: {} };
    const { queryByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={emptyRoute as never}
      />
    );
    expect(queryByText('설정 완료!')).toBeNull();
  });

  it('shows start button', () => {
    const { getByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );
    expect(getByText('시작하기')).toBeTruthy();
  });

  it('calls saveCommuteRoutes on complete button press', async () => {
    (saveCommuteRoutes as jest.Mock).mockResolvedValue({ success: true });

    const { getByText } = render(
      <CommuteCompleteScreen
        navigation={mockNavigation as never}
        route={mockRoute as never}
      />
    );

    fireEvent.press(getByText('시작하기'));

    await waitFor(() => {
      expect(saveCommuteRoutes).toHaveBeenCalledWith(
        'test-user-id',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
