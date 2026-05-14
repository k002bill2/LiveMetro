/**
 * Commute Service Tests
 */

import {
  saveCommuteRoutes,
  loadCommuteRoutes,
  updateMorningRoute,
  updateEveningRoute,
  updateEveningEnabled,
} from '../commuteService';
import { CommuteRoute } from '@/models/commute';

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mockDocRef'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

describe('Commute Service', () => {
  const mockCommuteRoute: CommuteRoute = {
    departureTime: '08:00',
    departureStationId: 'gangnam',
    departureStationName: '강남',
    departureLineId: '2',
    arrivalStationId: 'jamsil',
    arrivalStationName: '잠실',
    arrivalLineId: '2',
    transferStations: [],
    notifications: {
      transferAlert: true,
      arrivalAlert: true,
      delayAlert: true,
      incidentAlert: true,
      alertMinutesBefore: 5,
    },
    bufferMinutes: 10,
  };

  const mockEveningRoute: CommuteRoute = {
    ...mockCommuteRoute,
    departureTime: '18:00',
    departureStationId: 'jamsil',
    departureStationName: '잠실',
    arrivalStationId: 'gangnam',
    arrivalStationName: '강남',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveCommuteRoutes', () => {
    it('should save commute routes successfully', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const result = await saveCommuteRoutes('user-123', mockCommuteRoute, mockEveningRoute);

      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should return error if no uid provided', async () => {
      const result = await saveCommuteRoutes('', mockCommuteRoute, mockEveningRoute);

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 인증이 필요합니다');
    });

    it('should handle save errors', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await saveCommuteRoutes('user-123', mockCommuteRoute, mockEveningRoute);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });

    it('should include transfer stations if provided', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const routeWithTransfers: CommuteRoute = {
        ...mockCommuteRoute,
        transferStations: [{ stationId: 'seolleung', stationName: '선릉', lineId: '2', lineName: '2호선', order: 1 }],
      };

      await saveCommuteRoutes('user-123', routeWithTransfers, mockEveningRoute);

      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe('loadCommuteRoutes', () => {
    it('should load commute routes successfully', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          morningRoute: mockCommuteRoute,
          eveningRoute: mockEveningRoute,
          eveningEnabled: false,
          createdAt: null,
          updatedAt: null,
        }),
      });

      const result = await loadCommuteRoutes('user-123');

      expect(result).not.toBeNull();
      expect(result?.morningRoute).toBeDefined();
      expect(result?.eveningRoute).toBeDefined();
      expect(result?.eveningEnabled).toBe(false);
    });

    it('should default eveningEnabled to true for legacy docs without the field', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          morningRoute: mockCommuteRoute,
          eveningRoute: mockEveningRoute,
          createdAt: null,
          updatedAt: null,
        }),
      });

      const result = await loadCommuteRoutes('user-123');

      expect(result?.eveningEnabled).toBe(true);
    });

    it('should return null if no uid provided', async () => {
      const result = await loadCommuteRoutes('');

      expect(result).toBeNull();
    });

    it('should return null if document does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await loadCommuteRoutes('user-123');

      expect(result).toBeNull();
    });

    it('should handle load errors', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await loadCommuteRoutes('user-123');

      expect(result).toBeNull();
    });
  });

  describe('updateMorningRoute', () => {
    it('should update morning route successfully', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await updateMorningRoute('user-123', mockCommuteRoute);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should return error if no uid provided', async () => {
      const result = await updateMorningRoute('', mockCommuteRoute);

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 인증이 필요합니다');
    });

    it('should handle update errors', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

      const result = await updateMorningRoute('user-123', mockCommuteRoute);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('updateEveningRoute', () => {
    it('should update evening route successfully', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await updateEveningRoute('user-123', mockEveningRoute);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should return error if no uid provided', async () => {
      const result = await updateEveningRoute('', mockEveningRoute);

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 인증이 필요합니다');
    });

    it('should handle update errors', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

      const result = await updateEveningRoute('user-123', mockEveningRoute);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('updateEveningEnabled', () => {
    it('should persist the enabled flag via a merge write', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const result = await updateEveningEnabled('user-123', false);

      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mockDocRef',
        expect.objectContaining({ eveningEnabled: false }),
        { merge: true },
      );
    });

    it('should persist enabled=true', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const result = await updateEveningEnabled('user-123', true);

      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mockDocRef',
        expect.objectContaining({ eveningEnabled: true }),
        { merge: true },
      );
    });

    it('should return error if no uid provided', async () => {
      const result = await updateEveningEnabled('', true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 인증이 필요합니다');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await updateEveningEnabled('user-123', true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firestore error');
    });
  });
});
