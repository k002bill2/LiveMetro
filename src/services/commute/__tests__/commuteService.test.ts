/**
 * Commute Service Tests
 */

import {
  saveCommuteRoutes,
  loadCommuteRoutes,
  updateMorningRoute,
  updateEveningRoute,
  updateEveningEnabled,
  updateBoardingPreferences,
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

  describe('updateBoardingPreferences', () => {
    beforeEach(() => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockSetDoc.mockResolvedValue(undefined);
    });

    it('leg별 dot-path로 boardingPreferences만 부분 업데이트한다', async () => {
      const result = await updateBoardingPreferences('uid-1', 'morning', {
        'gangnam|2': ['마천'],
      });

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith('mockDocRef', {
        'morningRoute.boardingPreferences': { 'gangnam|2': ['마천'] },
        updatedAt: { _type: 'serverTimestamp' },
      });
    });

    it('evening leg은 eveningRoute 경로를 쓴다', async () => {
      await updateBoardingPreferences('uid-1', 'evening', {});

      expect(mockUpdateDoc).toHaveBeenCalledWith('mockDocRef', {
        'eveningRoute.boardingPreferences': {},
        updatedAt: { _type: 'serverTimestamp' },
      });
    });

    it('uid 없으면 실패 result를 반환하고 쓰지 않는다', async () => {
      const result = await updateBoardingPreferences('', 'morning', {});

      expect(result.success).toBe(false);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('저장 경로의 boardingPreferences 보존', () => {
    const withPrefs = (
      route: CommuteRoute,
      prefs: Readonly<Record<string, readonly string[]>>
    ): CommuteRoute => ({ ...route, boardingPreferences: prefs });

    beforeEach(() => {
      mockSetDoc.mockResolvedValue(undefined);
      mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('saveCommuteRoutes는 존재하는 boardingPreferences를 prune해 함께 저장한다', async () => {
      await saveCommuteRoutes(
        'user-123',
        withPrefs(mockCommuteRoute, { 'gangnam|2': ['마천'], 'GONE|7': ['x'] }),
        mockEveningRoute
      );

      const written = mockSetDoc.mock.calls[0][1];
      expect(written.morningRoute.boardingPreferences).toEqual({ 'gangnam|2': ['마천'] });
      // 없는 leg에는 필드 자체가 없어야 한다 (undefined 필드 금지)
      expect('boardingPreferences' in written.eveningRoute).toBe(false);
    });

    it('updateMorningRoute / updateEveningRoute도 동일하게 보존한다', async () => {
      await updateMorningRoute('user-123', withPrefs(mockCommuteRoute, { 'gangnam|2': ['마천'] }));
      const morning = mockUpdateDoc.mock.calls[0][1].morningRoute;
      expect(morning.boardingPreferences).toEqual({ 'gangnam|2': ['마천'] });

      await updateEveningRoute('user-123', mockEveningRoute);
      const evening = mockUpdateDoc.mock.calls[1][1].eveningRoute;
      expect('boardingPreferences' in evening).toBe(false);
    });
  });
});
