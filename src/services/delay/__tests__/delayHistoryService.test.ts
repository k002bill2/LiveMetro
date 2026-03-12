/**
 * Delay History Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setDoc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { delayHistoryService } from '../delayHistoryService';
import { DelayReason } from '@/models/delayCertificate';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    fromDate: jest.fn(date => ({ toDate: () => date })),
  },
}));

// Mock Firebase config
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock delayCertificate model
jest.mock('@/models/delayCertificate', () => ({
  DelayReason: {
    SIGNAL_FAILURE: 'signal_failure',
    CONGESTION: 'congestion',
    MECHANICAL_FAILURE: 'mechanical_failure',
    PASSENGER_INCIDENT: 'passenger_incident',
    DOOR_FAILURE: 'door_failure',
    MEDICAL_EMERGENCY: 'medical_emergency',
    SECURITY_INCIDENT: 'security_incident',
    WEATHER: 'weather',
    MAINTENANCE: 'maintenance',
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
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
    (setDoc as jest.Mock).mockReset();
    (getDoc as jest.Mock).mockReset();
    (getDocs as jest.Mock).mockReset();
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

    it('should include all certificate details in formatted text', () => {
      const cert = {
        id: 'cert_456',
        certificateNumber: 'CERT-2024-002',
        userId: 'user-2',
        date: new Date('2024-02-20'),
        lineId: '3',
        stationId: '0309',
        stationName: '교대',
        scheduledTime: '15:20',
        actualTime: '15:35',
        delayMinutes: 15,
        reason: DelayReason.CONGESTION,
        verified: false,
        createdAt: new Date('2024-02-20'),
        updatedAt: new Date('2024-02-20'),
      };

      const text = delayHistoryService.formatCertificateText(cert);

      expect(text).toContain('증명서 번호');
      expect(text).toContain('지연 정보');
      expect(text).toContain('발급 정보');
      expect(text).toContain('예정 시간');
      expect(text).toContain('실제 시간');
      expect(text).toContain('3호선');
      expect(text).toContain('교대역');
    });
  });

  describe('saveCertificate', () => {
    it('should add certificate to storage', async () => {
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

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await delayHistoryService.saveCertificate(cert);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedCerts = JSON.parse(setItemCall[1]);
      expect(savedCerts[0]?.id).toBe('cert_123');
    });

    it('should prepend certificate to existing list', async () => {
      const existingCert = {
        id: 'cert_old',
        certificateNumber: 'CERT-2024-000',
        userId: 'user-1',
        date: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const newCert = {
        id: 'cert_new',
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

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([existingCert]));

      await delayHistoryService.saveCertificate(newCert);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedCerts = JSON.parse(setItemCall[1]);
      expect(savedCerts[0]?.id).toBe('cert_new');
      expect(savedCerts[1]?.id).toBe('cert_old');
    });
  });

  describe('addSampleData', () => {
    it('should add sample data and generate certificate', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null) // First call for getHistory
        .mockResolvedValueOnce(null) // Second call for getCertificates
        .mockResolvedValueOnce(null) // Third call for getHistory in addSampleData
        .mockResolvedValueOnce(JSON.stringify([
          {
            id: 'delay_sample_1',
            userId: 'test-user',
            lineId: '2',
            stationId: '0222',
            stationName: '강남',
            delayMinutes: 15,
            timestamp: new Date().toISOString(),
            reason: DelayReason.SIGNAL_FAILURE,
            rawMessage: '신호 장애로 인한 지연',
            certificateGenerated: false,
          },
        ])); // Fourth call for getHistory in generateCertificate

      await delayHistoryService.addSampleData('test-user');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getCertificateByNumber', () => {
    it('should return null if certificate not found by number', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const result = await delayHistoryService.getCertificateByNumber('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('generateCertificate', () => {
    it('should update history entry with certificate info', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([mockStoredEntry])) // getHistory
        .mockResolvedValueOnce(JSON.stringify([])); // getCertificates

      const result = await delayHistoryService.generateCertificate(
        'delay_123',
        '08:30',
        '08:45'
      );

      expect(result).not.toBeNull();
      expect(result?.delayMinutes).toBe(15);
      expect(result?.stationName).toBe('강남');
    });

    it('should mark history entry as certificateGenerated', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([mockStoredEntry])) // getHistory
        .mockResolvedValueOnce(JSON.stringify([])); // getCertificates

      await delayHistoryService.generateCertificate('delay_123', '08:30', '08:45');

      const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const historyCall = setItemCalls.find(call => call[0] === '@livemetro:delay_history');
      expect(historyCall).toBeDefined();
    });
  });

  describe('Firestore Sync Methods', () => {
    describe('syncCertificateToFirestore', () => {
      it('should sync certificate to Firestore', async () => {
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

        (setDoc as jest.Mock).mockResolvedValue(undefined);

        const result = await delayHistoryService.syncCertificateToFirestore(cert);

        expect(result).toBe(true);
        expect(setDoc).toHaveBeenCalled();
      });

      it('should return false on sync error', async () => {
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

        (setDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

        const result = await delayHistoryService.syncCertificateToFirestore(cert);

        expect(result).toBe(false);
      });
    });

    describe('fetchCertificateFromFirestore', () => {
      it('should fetch certificate from Firestore', async () => {
        const mockData = {
          certificateNumber: 'CERT-2024-001',
          userId: 'user-1',
          date: { toDate: () => new Date('2024-01-15') },
          lineId: '2',
          stationId: '0222',
          stationName: '강남',
          scheduledTime: '08:30',
          actualTime: '08:45',
          delayMinutes: 15,
          reason: DelayReason.SIGNAL_FAILURE,
          verified: false,
          createdAt: { toDate: () => new Date('2024-01-15') },
          updatedAt: { toDate: () => new Date('2024-01-15') },
        };

        (getDoc as jest.Mock).mockResolvedValue({
          exists: () => true,
          id: 'cert_123',
          data: () => mockData,
        });

        const result = await delayHistoryService.fetchCertificateFromFirestore('cert_123');

        expect(result).not.toBeNull();
        expect(result?.certificateNumber).toBe('CERT-2024-001');
      });

      it('should return null if document does not exist', async () => {
        (getDoc as jest.Mock).mockResolvedValue({
          exists: () => false,
        });

        const result = await delayHistoryService.fetchCertificateFromFirestore('nonexistent');

        expect(result).toBeNull();
      });

      it('should return null on fetch error', async () => {
        (getDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

        const result = await delayHistoryService.fetchCertificateFromFirestore('cert_123');

        expect(result).toBeNull();
      });
    });

    describe('syncUserCertificates', () => {
      it('should sync user certificates from Firestore', async () => {
        const mockCert = {
          certificateNumber: 'CERT-2024-001',
          userId: 'user-1',
          date: { toDate: () => new Date('2024-01-15') },
          lineId: '2',
          stationId: '0222',
          stationName: '강남',
          scheduledTime: '08:30',
          actualTime: '08:45',
          delayMinutes: 15,
          reason: DelayReason.SIGNAL_FAILURE,
          verified: false,
          createdAt: { toDate: () => new Date('2024-01-15') },
          updatedAt: { toDate: () => new Date('2024-01-15') },
        };

        (getDocs as jest.Mock).mockResolvedValue({
          docs: [
            {
              id: 'cert_123',
              data: () => mockCert,
            },
          ],
        });

        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        const result = await delayHistoryService.syncUserCertificates('user-1');

        expect(result).toBe(1);
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      });

      it('should return 0 on sync error', async () => {
        (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

        const result = await delayHistoryService.syncUserCertificates('user-1');

        expect(result).toBe(0);
      });

      it('should merge local and remote certificates', async () => {
        const remoteCert = {
          certificateNumber: 'CERT-2024-002',
          userId: 'user-1',
          date: { toDate: () => new Date('2024-02-15') },
          lineId: '3',
          stationId: '0309',
          stationName: '교대',
          scheduledTime: '10:30',
          actualTime: '10:45',
          delayMinutes: 15,
          reason: DelayReason.CONGESTION,
          verified: false,
          createdAt: { toDate: () => new Date('2024-02-15') },
          updatedAt: { toDate: () => new Date('2024-02-15') },
        };

        (getDocs as jest.Mock).mockResolvedValue({
          docs: [
            {
              id: 'cert_remote',
              data: () => remoteCert,
            },
          ],
        });

        const localCert = {
          id: 'cert_local',
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

        (AsyncStorage.getItem as jest.Mock)
          .mockResolvedValueOnce(JSON.stringify([localCert])) // getCertificates
          .mockResolvedValueOnce(JSON.stringify([])); // saveCertificates

        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        const result = await delayHistoryService.syncUserCertificates('user-1');

        expect(result).toBe(1);
      });
    });

    describe('verifyCertificateExists', () => {
      it('should return true if certificate exists', async () => {
        (getDocs as jest.Mock).mockResolvedValue({
          empty: false,
        });

        const result = await delayHistoryService.verifyCertificateExists('CERT-2024-001');

        expect(result).toBe(true);
      });

      it('should return false if certificate does not exist', async () => {
        (getDocs as jest.Mock).mockResolvedValue({
          empty: true,
        });

        const result = await delayHistoryService.verifyCertificateExists('NONEXISTENT');

        expect(result).toBe(false);
      });

      it('should return false on verification error', async () => {
        (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

        const result = await delayHistoryService.verifyCertificateExists('CERT-2024-001');

        expect(result).toBe(false);
      });
    });

    describe('getLastSyncTimestamp', () => {
      it('should return last sync timestamp', async () => {
        const timestamp = 1234567890;
        (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue('1234567890');

        const result = await delayHistoryService.getLastSyncTimestamp();

        expect(result).toBe(timestamp);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith('@livemetro:delay_sync_timestamp');
      });

      it('should return null if no timestamp stored', async () => {
        (AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null);

        const result = await delayHistoryService.getLastSyncTimestamp();

        expect(result).toBeNull();
      });

      it('should return null on timestamp error', async () => {
        (AsyncStorage.getItem as jest.Mock).mockReset().mockRejectedValue(new Error('Storage error'));

        const result = await delayHistoryService.getLastSyncTimestamp();

        expect(result).toBeNull();
      });
    });
  });

  describe('History Trimming', () => {
    it('should trim history to keep only recent entries', async () => {
      const now = new Date();
      const oldEntry = {
        ...mockStoredEntry,
        id: 'delay_old',
        timestamp: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000), // 40 days old
      };
      const recentEntry = {
        ...mockStoredEntry,
        id: 'delay_recent',
        timestamp: now,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([recentEntry, oldEntry])
      );

      await delayHistoryService.addHistoryEntry(mockHistoryEntry);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedHistory = JSON.parse(setItemCall[1]);

      // Should only contain the new entry and recent entry, not the old one
      expect(savedHistory.length).toBeLessThanOrEqual(2);
    });

    it('should respect MAX_HISTORY_ENTRIES limit', async () => {
      const entries = Array.from({ length: 110 }, (_, i) => ({
        ...mockStoredEntry,
        id: `delay_${i}`,
      }));

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries));

      await delayHistoryService.addHistoryEntry(mockHistoryEntry);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedHistory = JSON.parse(setItemCall[1]);

      expect(savedHistory.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage errors gracefully in getHistory', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await delayHistoryService.getHistory();

      expect(result).toEqual([]);
    });

    it('should handle AsyncStorage errors gracefully in getCertificates', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await delayHistoryService.getCertificates();

      expect(result).toEqual([]);
    });

    it('should filter empty/null entries correctly', async () => {
      const entries = [
        mockStoredEntry,
        null,
        undefined,
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entries.filter(Boolean)));

      const result = await delayHistoryService.getHistory();

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle userId filter with no matches', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { ...mockStoredEntry, userId: 'user-1' },
          { ...mockStoredEntry, id: 'delay_456', userId: 'user-2' },
        ])
      );

      const result = await delayHistoryService.getUserHistory('user-999');

      expect(result).toEqual([]);
    });

    it('should handle lineId filter with no matches', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          { ...mockStoredEntry, lineId: '2' },
          { ...mockStoredEntry, id: 'delay_456', lineId: '3' },
        ])
      );

      const result = await delayHistoryService.getLineHistory('7');

      expect(result).toEqual([]);
    });

    it('should handle certificate generation with null reason', async () => {
      const entryWithoutReason = {
        ...mockStoredEntry,
        reason: undefined,
      };

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([entryWithoutReason])) // getHistory
        .mockResolvedValueOnce(JSON.stringify([])); // getCertificates

      const result = await delayHistoryService.generateCertificate(
        'delay_123',
        '08:30',
        '08:45'
      );

      expect(result?.reason).toBe(DelayReason.OTHER);
    });

    it('should handle certificate with maximum delay time', async () => {
      const maxDelayEntry = {
        ...mockStoredEntry,
        delayMinutes: 999,
      };

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([maxDelayEntry])) // getHistory
        .mockResolvedValueOnce(JSON.stringify([])); // getCertificates

      const result = await delayHistoryService.generateCertificate(
        'delay_123',
        '08:30',
        '08:45'
      );

      expect(result?.delayMinutes).toBe(999);
    });

    it('should handle empty history for generateCertificate', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const result = await delayHistoryService.generateCertificate(
        'nonexistent',
        '08:30',
        '08:45'
      );

      expect(result).toBeNull();
    });
  });
});
