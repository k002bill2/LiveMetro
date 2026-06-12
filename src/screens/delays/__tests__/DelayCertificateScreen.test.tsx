/**
 * DelayCertificateScreen Test Suite — Wanted handoff redesign
 *
 * 히어로(발급 가능한 최근 지연), 탭 세그먼트(발급 가능/발급 내역),
 * 이력 리스트(만료/발급됨/발급 pill), PDF 발급·공유, 빈 상태/스켈레톤 검증.
 */

import React from 'react';
import { render, fireEvent, waitFor, within, screen } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import { DelayCertificateScreen } from '../DelayCertificateScreen';
import { delayHistoryService } from '@/services/delay/delayHistoryService';
import { pdfService } from '@/services/certificate/pdfService';
import { useAuth } from '@/services/auth/AuthContext';

jest.mock('expo-linear-gradient', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) => ReactLib.createElement(View, { style, testID }, children),
  };
});

jest.mock('lucide-react-native', () => ({
  BadgeCheck: 'BadgeCheck',
  Download: 'Download',
  FileCheck2: 'FileCheck2',
  FileText: 'FileText',
  History: 'History',
  Share2: 'Share2',
  Trash2: 'Trash2',
}));

jest.mock('@/services/theme', () => ({
  useTheme: jest.fn(() => ({ isDark: false })),
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
    deleteCertificate: jest.fn(() => Promise.resolve(true)),
    generateCertificate: jest.fn(() => Promise.resolve(null)),
    addSampleData: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/certificate/pdfService', () => ({
  pdfService: {
    generateAndSharePdf: jest.fn(() => Promise.resolve(true)),
  },
}));

// ============================================================================
// Fixtures
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number): string =>
  new Date(Date.now() - days * DAY_MS).toISOString();

interface HistoryFixture {
  id: string;
  userId: string;
  lineId: string;
  stationId: string;
  stationName: string;
  delayMinutes: number;
  timestamp: string;
  reason?: string;
  certificateGenerated: boolean;
}

interface CertFixture {
  id: string;
  certificateNumber: string;
  userId: string;
  date: string;
  lineId: string;
  stationId: string;
  stationName: string;
  scheduledTime: string;
  actualTime: string;
  delayMinutes: number;
  reason: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

const makeEntry = (overrides: Partial<HistoryFixture> = {}): HistoryFixture => ({
  id: 'hist-1',
  userId: 'test-user-id',
  lineId: '2',
  stationId: 's_1',
  stationName: '홍대입구',
  delayMinutes: 18,
  timestamp: daysAgo(2),
  reason: 'signal_failure',
  certificateGenerated: false,
  ...overrides,
});

const makeCert = (overrides: Partial<CertFixture> = {}): CertFixture => ({
  id: 'cert-1',
  certificateNumber: 'LM-20260601-ABC123',
  userId: 'test-user-id',
  date: daysAgo(3),
  lineId: '2',
  stationId: 's_1',
  stationName: '홍대입구',
  scheduledTime: '08:32',
  actualTime: '08:50',
  delayMinutes: 18,
  reason: 'signal_failure',
  verified: false,
  createdAt: daysAgo(3),
  updatedAt: daysAgo(3),
  ...overrides,
});

const mockHistory = (entries: HistoryFixture[]): void => {
  (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue(entries);
};
const mockCerts = (certs: CertFixture[]): void => {
  (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue(certs);
};

describe('DelayCertificateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'test-user-id', displayName: 'Test User' },
    });
    (delayHistoryService.getUserCertificates as jest.Mock).mockResolvedValue([]);
    (delayHistoryService.getUserHistory as jest.Mock).mockResolvedValue([]);
    (delayHistoryService.formatCertificateText as jest.Mock).mockReturnValue(
      'certificate text'
    );
    (delayHistoryService.deleteCertificate as jest.Mock).mockResolvedValue(true);
    (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(null);
    (delayHistoryService.addSampleData as jest.Mock).mockResolvedValue(undefined);
    (pdfService.generateAndSharePdf as jest.Mock).mockResolvedValue(true);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  });

  // ========== Rendering ==========
  describe('Rendering', () => {
    it('does not render an in-screen header (native header owns the title)', async () => {
      const { queryByText } = render(<DelayCertificateScreen />);
      // 시안: 네이티브 헤더 "지연증명서" 하나만 — 화면 내 중복 제목/부제 금지
      expect(queryByText('지연증명서')).toBeNull();
      expect(queryByText('지연 이력 조회 및 증명서 발급')).toBeNull();
      await waitFor(() => {
        expect(delayHistoryService.getUserHistory).toHaveBeenCalledWith(
          'test-user-id'
        );
      });
    });

    it('renders operator data source note under the info card', async () => {
      const { getByTestId } = render(<DelayCertificateScreen />);
      await waitFor(() => {
        expect(getByTestId('data-source-note')).toHaveTextContent(
          '지연 기록은 서울교통공사 · 코레일 등 운영기관 실시간 데이터를 기반으로 자동 감지돼요.'
        );
      });
    });

    it('shows loading skeleton while data is pending', () => {
      (delayHistoryService.getUserHistory as jest.Mock).mockReturnValue(
        new Promise(() => {})
      );
      (delayHistoryService.getUserCertificates as jest.Mock).mockReturnValue(
        new Promise(() => {})
      );

      render(<DelayCertificateScreen />);
      expect(screen.queryByTestId('delay-cert-skeleton')).not.toBeNull();
    });

    it('renders hero card with the most recent eligible delay (real data)', async () => {
      mockHistory([
        makeEntry({ id: 'hist-old', delayMinutes: 9, timestamp: daysAgo(10) }),
        makeEntry({ id: 'hist-new', delayMinutes: 18, timestamp: daysAgo(2) }),
      ]);

      const { getByTestId, getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-card')).not.toBeNull();
      });
      expect(getByTestId('hero-delay-minutes')).toHaveTextContent('18');
      expect(getByText('발급 가능한 최근 지연')).toHaveTextContent('발급 가능한 최근 지연');
      const hero = within(getByTestId('hero-card'));
      expect(hero.getByText('홍대입구')).toHaveTextContent('홍대입구');
      expect(hero.getByText(/탑승$/)).toHaveTextContent(/탑승$/);
    });

    it('truncates fractional delay minutes in hero (no float tails)', async () => {
      mockHistory([makeEntry({ delayMinutes: 12.79999 })]);

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByTestId('hero-delay-minutes')).toHaveTextContent('12');
      });
    });

    it('shows hero empty card when no eligible delay within 30 days', async () => {
      mockHistory([makeEntry({ id: 'hist-exp', timestamp: daysAgo(40) })]);

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-empty')).not.toBeNull();
      });
      expect(
        getByText('최근 30일 내 발급 가능한 지연이 없어요')
      ).toHaveTextContent('최근 30일 내 발급 가능한 지연이 없어요');
    });

    it('shows empty list card when there is no history at all', async () => {
      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('list-empty')).not.toBeNull();
      });
      expect(getByText('지연 이력이 없어요')).toHaveTextContent('지연 이력이 없어요');
    });
  });

  // ========== Tabs ==========
  describe('Tab segment', () => {
    it('shows eligible count (in-window, not generated) and issued count', async () => {
      mockHistory([
        makeEntry({ id: 'h1', timestamp: daysAgo(1) }),
        makeEntry({ id: 'h2', timestamp: daysAgo(5) }),
        makeEntry({ id: 'h3', timestamp: daysAgo(40) }), // expired
        makeEntry({ id: 'h4', timestamp: daysAgo(3), certificateGenerated: true }),
      ]);
      mockCerts([makeCert()]);

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByTestId('eligible-count')).toHaveTextContent('2');
      });
      expect(getByTestId('issued-count')).toHaveTextContent('1');
    });

    it('switches to issued tab and shows issued empty state', async () => {
      mockHistory([makeEntry()]);

      const { getByTestId, getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });

      fireEvent.press(getByTestId('issued-tab'));

      expect(getByText('발급 내역이 없어요')).toHaveTextContent('발급 내역이 없어요');
    });

    it('switches back to eligible tab and shows history rows again', async () => {
      mockHistory([makeEntry({ id: 'hist-1' })]);

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('history-row-hist-1')).not.toBeNull();
      });

      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('eligible-tab'));

      expect(screen.queryByTestId('history-row-hist-1')).not.toBeNull();
    });
  });

  // ========== Issuance ==========
  describe('Certificate issuance', () => {
    it('issues a certificate from the hero CTA with computed times', async () => {
      mockHistory([makeEntry({ id: 'hist-1' })]);
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(
        makeCert()
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-issue-cta')).not.toBeNull();
      });

      fireEvent.press(getByTestId('hero-issue-cta'));

      await waitFor(() => {
        expect(delayHistoryService.generateCertificate).toHaveBeenCalledWith(
          'hist-1',
          expect.stringMatching(/^\d{2}:\d{2}$/),
          expect.stringMatching(/^\d{2}:\d{2}$/)
        );
      });
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '발급 완료',
          '지연증명서가 발급되었습니다.'
        );
      });
    });

    it('issues a certificate from a list row 발급 pill', async () => {
      mockHistory([
        makeEntry({ id: 'hist-1', timestamp: daysAgo(1) }),
        makeEntry({ id: 'hist-2', timestamp: daysAgo(5) }),
      ]);
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(
        makeCert()
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issue-pill-hist-2')).not.toBeNull();
      });

      fireEvent.press(getByTestId('issue-pill-hist-2'));

      await waitFor(() => {
        expect(delayHistoryService.generateCertificate).toHaveBeenCalledWith(
          'hist-2',
          expect.any(String),
          expect.any(String)
        );
      });
    });

    it('reloads data after successful issuance', async () => {
      mockHistory([makeEntry({ id: 'hist-1' })]);
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(
        makeCert()
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-issue-cta')).not.toBeNull();
      });

      const initialCalls = (delayHistoryService.getUserHistory as jest.Mock).mock
        .calls.length;

      fireEvent.press(getByTestId('hero-issue-cta'));

      await waitFor(() => {
        expect(
          (delayHistoryService.getUserHistory as jest.Mock).mock.calls.length
        ).toBeGreaterThan(initialCalls);
      });
    });

    it('does not show success alert when issuance returns null', async () => {
      mockHistory([makeEntry({ id: 'hist-1' })]);
      (delayHistoryService.generateCertificate as jest.Mock).mockResolvedValue(
        null
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-issue-cta')).not.toBeNull();
      });

      fireEvent.press(getByTestId('hero-issue-cta'));

      await waitFor(() => {
        expect(delayHistoryService.generateCertificate).toHaveBeenCalled();
      });
      expect(Alert.alert).not.toHaveBeenCalledWith(
        '발급 완료',
        expect.any(String)
      );
    });

    it('shows error alert when issuance throws', async () => {
      mockHistory([makeEntry({ id: 'hist-1' })]);
      (delayHistoryService.generateCertificate as jest.Mock).mockRejectedValue(
        new Error('issue failed')
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-issue-cta')).not.toBeNull();
      });

      fireEvent.press(getByTestId('hero-issue-cta'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '오류',
          '증명서 발급에 실패했습니다.'
        );
      });
    });
  });

  // ========== Expired & generated row states ==========
  describe('Row states', () => {
    it('marks rows older than 30 days as 발급 기한 만료 without issue pill', async () => {
      mockHistory([
        makeEntry({ id: 'hist-ok', timestamp: daysAgo(2) }),
        makeEntry({ id: 'hist-exp', timestamp: daysAgo(40) }),
      ]);

      const { getByText, queryByTestId } = render(
        <DelayCertificateScreen />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('history-row-hist-exp')).not.toBeNull();
      });
      expect(getByText('발급 기한 만료')).toHaveTextContent('발급 기한 만료');
      expect(queryByTestId('issue-pill-hist-exp')).toBeNull();
      expect(screen.queryByTestId('issue-pill-hist-ok')).not.toBeNull();
    });

    it('marks already-generated rows as 발급됨 without issue pill', async () => {
      mockHistory([
        makeEntry({ id: 'hist-gen', certificateGenerated: true }),
      ]);

      const { getByText, queryByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText('발급됨')).toHaveTextContent('발급됨');
      });
      expect(queryByTestId('issue-pill-hist-gen')).toBeNull();
    });

    it('shows reason label in row subtitle when present', async () => {
      mockHistory([makeEntry({ id: 'hist-1', reason: 'signal_failure' })]);

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(getByText(/탑승 · 신호 장애/)).toHaveTextContent(/탑승 · 신호 장애/);
      });
    });

    it('omits reason from row subtitle when missing', async () => {
      mockHistory([makeEntry({ id: 'hist-1', reason: undefined })]);

      const { getByTestId, queryByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('history-row-hist-1')).not.toBeNull();
      });
      const row = within(getByTestId('history-row-hist-1'));
      expect(row.getByText(/탑승$/)).toHaveTextContent(/탑승$/);
      expect(queryByText(/탑승 · /)).toBeNull();
    });
  });

  // ========== Issued tab ==========
  describe('Issued certificates', () => {
    it('renders issued certificate row with number and delay title', async () => {
      mockCerts([makeCert({ id: 'cert-1', delayMinutes: 18 })]);

      const { getByTestId, getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });

      fireEvent.press(getByTestId('issued-tab'));

      expect(screen.queryByTestId('cert-row-cert-1')).not.toBeNull();
      expect(getByText(/18분 지연 증명서/)).toHaveTextContent(/18분 지연 증명서/);
      expect(getByText(/LM-20260601-ABC123/)).toHaveTextContent(/LM-20260601-ABC123/);
    });

    it('shares certificate as PDF via pdfService', async () => {
      mockCerts([makeCert({ id: 'cert-1' })]);

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });
      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('pdf-share-cert-1'));

      await waitFor(() => {
        expect(pdfService.generateAndSharePdf).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'cert-1' })
        );
      });
      expect(Share.share).not.toHaveBeenCalled();
    });

    it('falls back to text share when PDF generation is unavailable', async () => {
      mockCerts([makeCert({ id: 'cert-1' })]);
      (pdfService.generateAndSharePdf as jest.Mock).mockResolvedValue(false);

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });
      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('pdf-share-cert-1'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledWith({
          message: 'certificate text',
          title: '지연증명서',
        });
      });
    });

    it('shares certificate as text via Share button', async () => {
      mockCerts([makeCert({ id: 'cert-1' })]);
      (delayHistoryService.formatCertificateText as jest.Mock).mockReturnValue(
        'Formatted certificate text'
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });
      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('text-share-cert-1'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalledWith({
          message: 'Formatted certificate text',
          title: '지연증명서',
        });
      });
    });

    it('shows error alert when text share fails', async () => {
      mockCerts([makeCert({ id: 'cert-1' })]);
      (Share.share as jest.Mock).mockRejectedValue(new Error('Share failed'));

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });
      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('text-share-cert-1'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('오류', '공유에 실패했습니다.');
      });
    });

    it('confirms deletion and calls deleteCertificate', async () => {
      mockCerts([makeCert({ id: 'cert-1' })]);

      let deleteHandler: (() => Promise<void>) | null = null;
      (Alert.alert as jest.Mock).mockImplementation(
        (
          _title: string,
          _message: string,
          buttons?: { style?: string; onPress?: () => Promise<void> }[]
        ) => {
          const destructive = buttons?.find((b) => b.style === 'destructive');
          if (destructive) deleteHandler = destructive.onPress ?? null;
        }
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });
      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('delete-cert-cert-1'));

      expect(Alert.alert).toHaveBeenCalledWith(
        '증명서 삭제',
        '이 지연증명서를 삭제하시겠습니까?',
        expect.any(Array)
      );

      if (deleteHandler) {
        await (deleteHandler as () => Promise<void>)();
      }

      await waitFor(() => {
        expect(delayHistoryService.deleteCertificate).toHaveBeenCalledWith(
          'cert-1'
        );
      });
    });

    it('cancel button does not delete the certificate', async () => {
      mockCerts([makeCert({ id: 'cert-1' })]);

      let cancelHandler: (() => void) | null = null;
      (Alert.alert as jest.Mock).mockImplementation(
        (
          _title: string,
          _message: string,
          buttons?: { style?: string; onPress?: () => void }[]
        ) => {
          const cancel = buttons?.find((b) => b.style === 'cancel');
          if (cancel) cancelHandler = cancel.onPress ?? null;
        }
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('issued-tab')).not.toBeNull();
      });
      fireEvent.press(getByTestId('issued-tab'));
      fireEvent.press(getByTestId('delete-cert-cert-1'));

      if (cancelHandler) (cancelHandler as () => void)();

      expect(delayHistoryService.deleteCertificate).not.toHaveBeenCalled();
    });
  });

  // ========== Data loading edge cases ==========
  describe('Data loading', () => {
    it('does not call services when user is null', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-empty')).not.toBeNull();
      });
      expect(delayHistoryService.getUserCertificates).not.toHaveBeenCalled();
      expect(delayHistoryService.getUserHistory).not.toHaveBeenCalled();
    });

    it('renders empty states gracefully when loading fails', async () => {
      (delayHistoryService.getUserHistory as jest.Mock).mockRejectedValue(
        new Error('Load failed')
      );
      (delayHistoryService.getUserCertificates as jest.Mock).mockRejectedValue(
        new Error('Load failed')
      );

      const { getByText } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('hero-empty')).not.toBeNull();
      });
      expect(getByText('지연 이력이 없어요')).toHaveTextContent('지연 이력이 없어요');
    });

    it('adds sample data in dev mode and reloads', async () => {
      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('add-sample-data')).not.toBeNull();
      });

      fireEvent.press(getByTestId('add-sample-data'));

      await waitFor(() => {
        expect(delayHistoryService.addSampleData).toHaveBeenCalledWith(
          'test-user-id'
        );
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        '완료',
        '샘플 데이터가 추가되었습니다.'
      );
    });

    it('shows error alert when adding sample data fails', async () => {
      (delayHistoryService.addSampleData as jest.Mock).mockRejectedValue(
        new Error('Add sample failed')
      );

      const { getByTestId } = render(<DelayCertificateScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('add-sample-data')).not.toBeNull();
      });

      fireEvent.press(getByTestId('add-sample-data'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '오류',
          '샘플 데이터 추가에 실패했습니다.'
        );
      });
    });
  });
});
