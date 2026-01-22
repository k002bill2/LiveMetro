/**
 * Delay History Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { delayHistoryService } from '../delayHistoryService';
import { DelayReason } from '@/models/delayCertificate';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock delayCertificate model
jest.mock('@/models/delayCertificate', () => ({
  DelayReason: {
    SIGNAL_FAILURE: 'signal_failure',
    CONGESTION: 'congestion',
    MECHANICAL_FAILURE: 'mechanical_failure',
    OTHER: 'other',
  },
  generateCertificateNumber: jest.fn(() => 'CERT-2024-001'),
}));

describe('DelayHistoryService', () => {
  const mockHistoryEntry = {
    userId: 'user-123',
    lineId: '2',
    stationId: '0222',
    stationName: '강남',
    delayMinutes: 15,
    timestamp: new Date('2024-01-15T08:30:00'),
    reason: DelayReason.SIGNAL_FAILURE,
    rawMessage: '신호 장애로 인한 지연',
  };

  const mockStoredEntry = {
    ...mockHistoryEntry,
    id: 'delay_123',
    certificateGenerated: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('addHistoryEntry', () => {
    it('should add a new history entry', async () => {
      const result = await delayHistoryService.addHistoryEntry(mockHistoryEntry);

      expect(result.id).toBeDefined();
      expect(result.stationName).toBe('강남');
      expect(result.delayMinutes).toBe(15);
      expect(result.certificateGenerated).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should prepend new entry to existing history', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockStoredEntry])
      );

      const result = await delayHistoryService.addHistoryEntry(mockHistoryEntry);

      expect(result.id).toBeDefined();
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history exists', async () => {
      const result = await delayHistoryService.getHistory();
      expect(result).toEqual([]);
    });

    it('should return stored history entries', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockStoredEntry])
      );

      const result = await delayHistoryService.getHistory();

      expect(result).toHaveLength(1);
      expect(result[0]?.stationName).toBe('강남');
    });

    it('should convert date strings to Date objects', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockStoredEntry])
      );

      const result = await delayHistoryService.getHistory();

      expect(result[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('should return empty array on parse error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const result = await delayHistoryService.getHistory();
      expect(result).toEqual([]);
    });
  });

  describe('getUserHistory', () => {
    it('should filter history by userId', async () => {
      const entries = [
        { ...mockStoredEntry, userId: 'user-1' },
        { ...mockStoredEntry, id: 'delay_456', userId: 'user-2' },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries));

      const result = await delayHistoryService.getUserHistory('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe('user-1');
    });
  });

  describe('getLineHistory', () => {
    it('should filter history by lineId', async () => {
      const entries = [
        { ...mockStoredEntry, lineId: '2' },
        { ...mockStoredEntry, id: 'delay_456', lineId: '3' },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries));

      const result = await delayHistoryService.getLineHistory('2');

      expect(result).toHaveLength(1);
      expect(result[0]?.lineId).toBe('2');
    });
  });

  describe('generateCertificate', () => {
    it('should generate certificate from history entry', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([mockStoredEntry])) // getHistory
        .mockResolvedValueOnce(JSON.stringify([])); // getCertificates

      const result = await delayHistoryService.generateCertificate(
        'delay_123',
        '08:30',
        '08:45'
      );

      expect(result).not.toBeNull();
      expect(result?.certificateNumber).toBe('CERT-2024-001');
      expect(result?.scheduledTime).toBe('08:30');
      expect(result?.actualTime).toBe('08:45');
    });

    it('should return null if entry not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockStoredEntry])
      );

      const result = await delayHistoryService.generateCertificate(
        'nonexistent',
        '08:30',
        '08:45'
      );

      expect(result).toBeNull();
    });
  });

  describe('getCertificates', () => {
    it('should return empty array when no certificates exist', async () => {
      const result = await delayHistoryService.getCertificates();
      expect(result).toEqual([]);
    });

    it('should convert date strings to Date objects', async () => {
      const mockCert = {
        id: 'cert_123',
        certificateNumber: 'CERT-2024-001',
        date: '2024-01-15T08:30:00.000Z',
        createdAt: '2024-01-15T09:00:00.000Z',
        updatedAt: '2024-01-15T09:00:00.000Z',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([mockCert]));

      const result = await delayHistoryService.getCertificates();

      expect(result[0]?.date).toBeInstanceOf(Date);
      expect(result[0]?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getUserCertificates', () => {
    it('should filter certificates by userId', async () => {
      const certs = [
        { id: 'cert_1', userId: 'user-1', date: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: 'cert_2', userId: 'user-2', date: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(certs));

      const result = await delayHistoryService.getUserCertificates('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe('user-1');
    });
  });

  describe('getCertificateById', () => {
    it('should return certificate by id', async () => {
      const cert = { id: 'cert_123', date: new Date(), createdAt: new Date(), updatedAt: new Date() };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cert]));

      const result = await delayHistoryService.getCertificateById('cert_123');

      expect(result?.id).toBe('cert_123');
    });

    it('should return null if not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const result = await delayHistoryService.getCertificateById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getCertificateByNumber', () => {
    it('should return certificate by certificate number', async () => {
      const cert = {
        id: 'cert_123',
        certificateNumber: 'CERT-2024-001',
        date: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([cert]));

      const result = await delayHistoryService.getCertificateByNumber('CERT-2024-001');

      expect(result?.certificateNumber).toBe('CERT-2024-001');
    });
  });

  describe('deleteCertificate', () => {
    it('should delete certificate by id', async () => {
      const certs = [
        { id: 'cert_1', date: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: 'cert_2', date: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(certs));

      const result = await delayHistoryService.deleteCertificate('cert_1');

      expect(result).toBe(true);
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedCerts = JSON.parse(setItemCall[1]);
      expect(savedCerts).toHaveLength(1);
    });

    it('should return false if certificate not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const result = await delayHistoryService.deleteCertificate('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should remove history from storage', async () => {
      await delayHistoryService.clearHistory();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@livemetro:delay_history');
    });
  });

  describe('clearCertificates', () => {
    it('should remove certificates from storage', async () => {
      await delayHistoryService.clearCertificates();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@livemetro:delay_certificates');
    });
  });

  describe('formatCertificateText', () => {
    it('should format certificate for display', () => {
      const cert = {
        id: 'cert_123',
        certificateNumber: 'CERT-2024-001',
        userId: 'user-1',
        date: new Date('2024-01-15'),
        lineId: '2',
        stationId: '0222',
        stationName: '강남',
        scheduledTime: '08:30',
        actualTime: '08:45',
        delayMinutes: 15,
        reason: DelayReason.SIGNAL_FAILURE,
        verified: false,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      };

      const text = delayHistoryService.formatCertificateText(cert);

      expect(text).toContain('지하철 지연 증명서');
      expect(text).toContain('CERT-2024-001');
      expect(text).toContain('강남');
      expect(text).toContain('15분');
    });
  });
});
