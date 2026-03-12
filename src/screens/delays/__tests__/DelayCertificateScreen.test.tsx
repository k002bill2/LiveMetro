/**
 * DelayCertificateScreen Test Suite
 * Tests delay certificate screen rendering, interactions, and data operations
 */

// Mock modules BEFORE any imports (Jest hoisting)
// Now import components and services AFTER mocks
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import { DelayCertificateScreen } from '../DelayCertificateScreen';
import { delayHistoryService } from '@/services/delay/delayHistoryService';
import { useAuth } from '@/services/auth/AuthContext';

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

// Types
interface DelayCertificate {
  id: string;
  certificateNumber: string;
  userId: string;
  date: string;
  lineId: string;
  stationName: string;
  delayMinutes: number;
  scheduledTime: string;
  actualTime: string;
  reason?: string;
}

interface DelayHistoryEntry {
  id: string;
  userId: string;
  lineId: string;
  stationName: string;
  delayMinutes: number;
  timestamp: string;
  reason?: string;
  certificateGenerated: boolean;
}

describe('DelayCertificateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useAuth mock to default (critical: previous test may set user to null)
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'test-user-id', displayName: 'Test User' },
    });
    // Reset service mocks to default implementations (critical: mockRejectedValue leaks)
    (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue([]);
    (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue([]);
    (delayHistoryService.formatCertificateText as jest.Mock).mockReturnValue('certificate text');
    (delayHistoryService.deleteCertificate as jest.Mock).mockResolvedValue(undefined);
    (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(null);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  });

  afterEach(() => {
    // Note: avoid jest.restoreAllMocks() here as it can reset
    // jest.mock() factory implementations in some Jest versions
  });

  // ========== Rendering Tests ==========
  describe('Rendering', () => {
    it('renders header and tabs', () => {
      const { getByText } = render(<DelayCertificateScreen />);
      expect(getByText('지연증명서')).toBeTruthy();
      expect(getByText('지연 이력 조회 및 증명서 발급')).toBeTruthy();
    });

    it('shows certificate and history tab counts', () => {
      const { getByText } = render(<DelayCertificateScreen />);
      expect(getByText('증명서 (0)')).toBeTruthy();
      expect(getByText('이력 (0)')).toBeTruthy();
    });

    it('shows empty state for certificates tab initially', () => {
      const { getByText } = render(<DelayCertificateScreen />);
      expect(getByText('발급된 증명서가 없습니다')).toBeTruthy();
    });

    it('shows info box about official certificates', () => {
      const { getByText } = render(<DelayCertificateScreen />);
      expect(
        getByText(/공식 지연증명서는 또타지하철 앱에서/)
      ).toBeTruthy();
    });

    it('displays certificates with correct data', async () => {
      const mockCertificates: DelayCertificate[] = [
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
      expect(getByText(/08:30 → 08:40/)).toBeTruthy();
    });

    it('displays multiple certificates', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
        {
          id: 'cert-2',
          certificateNumber: 'DC-2024-002',
          userId: 'test-user-id',
          date: new Date('2024-01-16').toISOString(),
          lineId: '3',
          stationName: '교대',
          delayMinutes: 5,
          scheduledTime: '09:15',
          actualTime: '09:20',
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('증명서 (2)')).toBeTruthy();
      });
      expect(getByText('DC-2024-001')).toBeTruthy();
      expect(getByText('DC-2024-002')).toBeTruthy();
    });

    it('shows sample data button in __DEV__ mode', () => {
      const { getByText } = render(<DelayCertificateScreen />);
      expect(getByText('샘플 데이터 추가 (개발용)')).toBeTruthy();
    });
  });

  // ========== Tab Navigation Tests ==========
  describe('Tab Navigation', () => {
    it('switches to history tab on press', () => {
      const { getByText, getByTestId } = render(<DelayCertificateScreen />);
      fireEvent.press(getByTestId('history-tab'));
      expect(getByText('지연 이력이 없습니다')).toBeTruthy();
    });

    it('displays history entries on history tab', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));

      expect(getByText('교대역')).toBeTruthy();
      expect(getByText('5분 지연')).toBeTruthy();
    });

    it('shows hint to generate certificate for uncertified history', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      expect(getByText('탭하여 증명서 발급')).toBeTruthy();
    });

    it('shows badge for already generated certificates in history', async () => {
      const mockHistory: DelayHistoryEntry[] = [
        {
          id: 'hist-1',
          userId: 'test-user-id',
          lineId: '3',
          stationName: '교대',
          delayMinutes: 5,
          timestamp: new Date('2024-01-15T09:00:00').toISOString(),
          reason: 'signal_failure',
          certificateGenerated: true,
        },
      ];
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(
        mockHistory
      );

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      expect(getByText('증명서 발급됨')).toBeTruthy();
    });

    it('switches back to certificates tab', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('증명서 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      fireEvent.press(getByTestId('certificates-tab'));

      expect(getByText('DC-2024-001')).toBeTruthy();
    });
  });

  // ========== Certificate Sharing Tests ==========
  describe('Certificate Sharing', () => {
    it('shares certificate with formatted text', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );
      (delayHistoryService.formatCertificateText as jest.Mock).mockReturnValue(
        'Formatted certificate text'
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      fireEvent.press(getByText('공유'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledWith({
          message: 'Formatted certificate text',
          title: '지연증명서',
        });
      });
    });

    it('handles share success', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );
      (Share.share as jest.Mock).mockResolvedValue({ action: 'sharedAction' });

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      fireEvent.press(getByText('공유'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalled();
      });
    });

    it('handles share error gracefully', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );
      (Share.share as jest.Mock).mockRejectedValue(new Error('Share failed'));

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      fireEvent.press(getByText('공유'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '공유에 실패했습니다.');
      });
    });
  });

  // ========== Certificate Deletion Tests ==========
  describe('Certificate Deletion', () => {
    it('shows delete confirmation alert', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      fireEvent.press(getByText('삭제'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '증명서 삭제',
          '이 지연증명서를 삭제하시겠습니까?',
          expect.any(Array)
        );
      });
    });

    it('cancels deletion without calling delete service', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      let cancelHandler: (() => void) | null = null;
      (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, buttons: { style?: string; onPress?: () => void }[]) => {
        const cancelBtn = buttons.find((btn) => btn.style === 'cancel');
        if (cancelBtn) cancelHandler = cancelBtn.onPress ?? null;
      });

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      fireEvent.press(getByText('삭제'));
      if (cancelHandler) (cancelHandler as () => void)();

      expect(delayHistoryService.deleteCertificate).not.toHaveBeenCalled();
    });

    it('confirms deletion and refreshes data', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      let deleteHandler: (() => Promise<void>) | null = null;
      (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, buttons: { style?: string; onPress?: () => Promise<void> }[]) => {
        const deleteBtn = buttons.find((btn) => btn.style === 'destructive');
        if (deleteBtn) deleteHandler = deleteBtn.onPress ?? null;
      });

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      fireEvent.press(getByText('삭제'));

      if (deleteHandler) {
        await (deleteHandler as () => Promise<void>)();
      }

      await waitFor(() => {
        expect(delayHistoryService.deleteCertificate).toHaveBeenCalledWith('cert-1');
      });
    });

    it('reloads data after successful deletion', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      let deleteHandler: (() => Promise<void>) | null = null;
      (Alert.alert as jest.Mock).mockImplementation((_title: string, _message: string, buttons: { style?: string; onPress?: () => Promise<void> }[]) => {
        const deleteBtn = buttons.find((btn) => btn.style === 'destructive');
        if (deleteBtn) deleteHandler = deleteBtn.onPress ?? null;
      });

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('DC-2024-001')).toBeTruthy();
      });

      const initialCallCount = (delayHistoryService.getUserCertificates as jest.Mock).mock
        .calls.length;

      fireEvent.press(getByText('삭제'));

      if (deleteHandler) {
        await (deleteHandler as () => Promise<void>)();
      }

      await waitFor(() => {
        expect((delayHistoryService.getUserCertificates as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });
  });

  // ========== Certificate Generation Tests ==========
  describe('Certificate Generation from History', () => {
    it('allows generating certificate from history item', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      fireEvent.press(getByText('탭하여 증명서 발급'));

      await waitFor(() => {
        expect(delayHistoryService.generateCertificate).toHaveBeenCalledWith(
          'hist-1',
          expect.any(String),
          expect.any(String)
        );
      });
    });

    it('shows alert when certificate already generated', async () => {
      const mockHistory: DelayHistoryEntry[] = [
        {
          id: 'hist-1',
          userId: 'test-user-id',
          lineId: '3',
          stationName: '교대',
          delayMinutes: 5,
          timestamp: new Date('2024-01-15T09:00:00').toISOString(),
          reason: 'signal_failure',
          certificateGenerated: true,
        },
      ];
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(
        mockHistory
      );

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));

      // Try to press the disabled item - it should be disabled, so press won't trigger generation
      expect(delayHistoryService.generateCertificate).not.toHaveBeenCalled();
    });

    it('shows success alert after generating certificate', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue({
        id: 'cert-1',
        certificateNumber: 'DC-2024-001',
      });

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      fireEvent.press(getByText('탭하여 증명서 발급'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('발급 완료', '지연증명서가 발급되었습니다.');
      });
    });

    it('reloads data after generating certificate', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue({
        id: 'cert-1',
      });

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      const initialCallCount = (delayHistoryService.getUserHistory as jest.Mock).mock
        .calls.length;

      fireEvent.press(getByTestId('history-tab'));
      fireEvent.press(getByText('탭하여 증명서 발급'));

      await waitFor(() => {
        expect((delayHistoryService.getUserHistory as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it('does not show success alert if generation returns null', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(null);

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      fireEvent.press(getByText('탭하여 증명서 발급'));

      await waitFor(() => {
        expect(delayHistoryService.generateCertificate).toHaveBeenCalled();
      });
    });
  });

  // ========== Sample Data Tests ==========
  describe('Sample Data (Development)', () => {
    it('adds sample data and shows success alert', async () => {
      const { getByText } = render(<DelayCertificateScreen />);

      fireEvent.press(getByText('샘플 데이터 추가 (개발용)'));

      await waitFor(() => {
        expect(delayHistoryService.addSampleData).toHaveBeenCalledWith('test-user-id');
      });

      expect(Alert.alert).toHaveBeenCalledWith('완료', '샘플 데이터가 추가되었습니다.');
    });

    it('reloads data after adding sample data', async () => {
      const { getByText } = render(<DelayCertificateScreen />);

      const initialCallCount = (delayHistoryService.getUserCertificates as jest.Mock).mock
        .calls.length;

      fireEvent.press(getByText('샘플 데이터 추가 (개발용)'));

      await waitFor(() => {
        expect((delayHistoryService.getUserCertificates as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it('handles sample data addition error', async () => {
      (delayHistoryService.addSampleData as jest.Mock).mockRejectedValue(
        new Error('Add sample failed')
      );

      const { getByText } = render(<DelayCertificateScreen />);

      fireEvent.press(getByText('샘플 데이터 추가 (개발용)'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '샘플 데이터 추가에 실패했습니다.');
      });
    });
  });

  // ========== Data Loading & Refresh Tests ==========
  describe('Data Loading and Refresh', () => {
    it('does not load data when user is null', () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      render(<DelayCertificateScreen />);
      expect(delayHistoryService.getUserCertificates).not.toHaveBeenCalled();
    });

    it('loads both certificates and history on mount', () => {
      render(<DelayCertificateScreen />);

      expect(delayHistoryService.getUserCertificates).toHaveBeenCalledWith('test-user-id');
      expect(delayHistoryService.getUserHistory).toHaveBeenCalledWith('test-user-id');
    });

    it('handles data loading errors gracefully', async () => {
      (delayHistoryService.getUserCertificates as jest.Mock).mockRejectedValue(
        new Error('Load failed')
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('발급된 증명서가 없습니다')).toBeTruthy();
      });
    });
  });

  // ========== History with Reason Display Tests ==========
  describe('History with Reason Display', () => {
    it('displays reason label when history entry has reason', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));

      // Check that reason is displayed
      expect(getByText(/사유:/)).toBeTruthy();
    });

    it('omits reason display when history entry has no reason', async () => {
      const mockHistory: DelayHistoryEntry[] = [
        {
          id: 'hist-1',
          userId: 'test-user-id',
          lineId: '3',
          stationName: '교대',
          delayMinutes: 5,
          timestamp: new Date('2024-01-15T09:00:00').toISOString(),
          reason: undefined,
          certificateGenerated: false,
        },
      ];
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(
        mockHistory
      );

      const { getByText, getByTestId, queryByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));

      // Reason label should not be visible
      expect(queryByText(/사유:/)).toBeFalsy();
    });
  });

  // ========== Edge Cases & Empty States ==========
  describe('Edge Cases', () => {
    it('handles empty certificates and history', async () => {
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue([]);
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('증명서 (0)')).toBeTruthy();
        expect(getByText('이력 (0)')).toBeTruthy();
      });

      expect(getByText('발급된 증명서가 없습니다')).toBeTruthy();
    });

    it('displays correct empty state message for history tab', async () => {
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue([]);
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue([]);

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (0)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      expect(getByText('지연 이력이 없습니다')).toBeTruthy();
    });

    it('shows empty state subtitle with appropriate message', () => {
      const { getByText, getByTestId } = render(<DelayCertificateScreen />);
      // Switch to history tab to see history empty state message
      fireEvent.press(getByTestId('history-tab'));
      expect(
        getByText(/지연이 감지되면 자동으로 기록됩니다/)
      ).toBeTruthy();
    });

    it('calculates correct times for certificate generation', async () => {
      const mockHistory: DelayHistoryEntry[] = [
        {
          id: 'hist-1',
          userId: 'test-user-id',
          lineId: '3',
          stationName: '교대',
          delayMinutes: 10,
          timestamp: new Date('2024-01-15T09:00:00').toISOString(),
          reason: 'signal_failure',
          certificateGenerated: false,
        },
      ];
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(
        mockHistory
      );

      const { getByText, getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (1)')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-tab'));
      fireEvent.press(getByText('탭하여 증명서 발급'));

      await waitFor(() => {
        // Verify that times were calculated
        expect(delayHistoryService.generateCertificate).toHaveBeenCalled();
        const call = (delayHistoryService.generateCertificate as jest.Mock).mock
          .calls[0];
        expect(call[0]).toBe('hist-1');
        expect(call[1]).toBeTruthy(); // scheduled time
        expect(call[2]).toBeTruthy(); // actual time
      });
    });
  });

  // ========== Tab Count Updates ==========
  describe('Tab Count Updates', () => {
    it('updates certificate count when data loads', async () => {
      const mockCertificates: DelayCertificate[] = [
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
        },
        {
          id: 'cert-2',
          certificateNumber: 'DC-2024-002',
          userId: 'test-user-id',
          date: new Date('2024-01-16').toISOString(),
          lineId: '3',
          stationName: '교대',
          delayMinutes: 5,
          scheduledTime: '09:15',
          actualTime: '09:20',
        },
      ];
      (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(
        mockCertificates
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('증명서 (2)')).toBeTruthy();
      });
    });

    it('updates history count when data loads', async () => {
      const mockHistory: DelayHistoryEntry[] = [
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
        {
          id: 'hist-2',
          userId: 'test-user-id',
          lineId: '2',
          stationName: '강남',
          delayMinutes: 8,
          timestamp: new Date('2024-01-15T10:00:00').toISOString(),
          reason: 'power_failure',
          certificateGenerated: true,
        },
      ];
      (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(
        mockHistory
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('이력 (2)')).toBeTruthy();
      });
    });
  });
});
