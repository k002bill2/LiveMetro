/**
 * DelayCertificateScreen Test Suite
 * Tests delay certificate screen rendering and tab switching
 */

// Mock modules BEFORE imports (Jest hoisting)
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
  FileText: 'FileText',
  Clock: 'Clock',
  Share2: 'Share2',
  Trash2: 'Trash2',
  AlertCircle: 'AlertCircle',
  ChevronRight: 'ChevronRight',
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  })),
  useRoute: jest.fn(() => ({ params: {} })),
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
  })),
  ThemeColors: {},
}));
jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id', displayName: 'Test User' },
  })),
}));
jest.mock('@/services/delay/delayHistoryService', () => ({
  delayHistoryService: {
    getUserCertificates: jest.fn(() => Promise.resolve([])),
    getUserHistory: jest.fn(() => Promise.resolve([])),
    formatCertificateText: jest.fn(() => 'certificate text'),
    deleteCertificate: jest.fn(() => Promise.resolve()),
    generateCertificate: jest.fn(() => Promise.resolve(null)),
    addSampleData: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@/utils/colorUtils', () => ({
  getSubwayLineColor: jest.fn(() => '#00A84D'),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DelayCertificateScreen } from '../DelayCertificateScreen';
import { delayHistoryService } from '@/services/delay/delayHistoryService';
import { useAuth } from '@/services/auth/AuthContext';

describe('DelayCertificateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders header and tabs', () => {
    const { getByText } = render(<DelayCertificateScreen />);
    expect(getByText('지연증명서')).toBeTruthy();
    expect(getByText('지연 이력 조회 및 증명서 발급')).toBeTruthy();
  });

  it('shows certificate tab with count', () => {
    const { getByText } = render(<DelayCertificateScreen />);
    expect(getByText('증명서 (0)')).toBeTruthy();
    expect(getByText('이력 (0)')).toBeTruthy();
  });

  it('shows empty state for certificates tab', () => {
    const { getByText } = render(<DelayCertificateScreen />);
    expect(getByText('발급된 증명서가 없습니다')).toBeTruthy();
  });

  it('switches to history tab on press', () => {
    const { getByText } = render(<DelayCertificateScreen />);
    fireEvent.press(getByText('이력 (0)'));
    expect(getByText('지연 이력이 없습니다')).toBeTruthy();
  });

  it('shows info box about official certificates', () => {
    const { getByText } = render(<DelayCertificateScreen />);
    expect(
      getByText(/공식 지연증명서는 또타지하철 앱에서/)
    ).toBeTruthy();
  });

  it('displays certificates when data is loaded', async () => {
    const mockCertificates = [
      {
        id: 'cert-1',
        certificateNumber: 'DC-2024-001',
        userId: 'test-user-id',
        date: new Date('2024-01-15').toISOString(),
        lineId: '2',
        stationName: '강남',
        delayMinutes: 10,
        scheduledTime: '08:30',
        actualTime: '08:40',
        reason: 'mechanical_failure',
      },
    ];
    (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
      mockCertificates
    );

    const { getByText } = render(<DelayCertificateScreen />);

    await waitFor(() => {
      expect(getByText('DC-2024-001')).toBeTruthy();
    });
    expect(getByText('강남역')).toBeTruthy();
    expect(getByText('10분 지연')).toBeTruthy();
  });

  it('displays history entries when data is loaded', async () => {
    const mockHistory = [
      {
        id: 'hist-1',
        userId: 'test-user-id',
        lineId: '3',
        stationName: '교대',
        delayMinutes: 5,
        timestamp: new Date('2024-01-15T09:00:00').toISOString(),
        reason: 'signal_failure',
        certificateGenerated: false,
      },
    ];
    (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(
      mockHistory
    );

    const { getByText } = render(<DelayCertificateScreen />);

    await waitFor(() => {
      expect(getByText('이력 (1)')).toBeTruthy();
    });

    fireEvent.press(getByText('이력 (1)'));

    expect(getByText('교대역')).toBeTruthy();
    expect(getByText('5분 지연')).toBeTruthy();
    expect(getByText('탭하여 증명서 발급')).toBeTruthy();
  });

  it('shows sample data button in __DEV__ mode', () => {
    const { getByText } = render(<DelayCertificateScreen />);
    expect(getByText('샘플 데이터 추가 (개발용)')).toBeTruthy();
  });

  it('does not load data when user is null', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<DelayCertificateScreen />);
    expect(delayHistoryService.getUserCertificates).not.toHaveBeenCalled();
  });
});
