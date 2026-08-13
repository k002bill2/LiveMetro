/**
 * Commute Service Tests
 */

import {
  saveCommuteRoutes,
  loadCommuteRoutes,
  loadCommuteRoutesOrThrow,
  updateMorningRoute,
  updateEveningRoute,
  updateEveningEnabled,
  updateBoardingPreferences,
  deleteCommuteSettings,
} from '../commuteService';
import { doc } from 'firebase/firestore';
import { CommuteRoute } from '@/models/commute';

// Mock Firebase
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mockDocRef'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  // `new FieldPath(...segments)` — jest mock 함수는 생성자로 호출해도 impl의 반환
  // 객체가 그대로 인스턴스가 되므로 평범한 객체로 관측한다.
  FieldPath: jest.fn((...segments: string[]) => ({ _type: 'fieldPath', segments })),
  deleteField: jest.fn(() => ({ _type: 'deleteField' })),
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

  describe('loadCommuteRoutesOrThrow', () => {
    it('propagates a read failure instead of collapsing it into null', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore unavailable'));

      await expect(loadCommuteRoutesOrThrow('user-123')).rejects.toThrow(
        'firestore unavailable',
      );
    });

    it('returns null only when the document genuinely does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(loadCommuteRoutesOrThrow('user-123')).resolves.toBeNull();
    });

    it('returns the settings when the document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          morningRoute: mockCommuteRoute,
          eveningRoute: null,
          eveningEnabled: true,
          createdAt: null,
          updatedAt: null,
        }),
      });

      const result = await loadCommuteRoutesOrThrow('user-123');

      expect(result?.morningRoute).toBeDefined();
    });
  });

  describe('loadCommuteRoutes', () => {
    it('still returns null on a read failure (lenient wrapper contract)', async () => {
      mockGetDoc.mockRejectedValue(new Error('firestore unavailable'));

      await expect(loadCommuteRoutes('user-123')).resolves.toBeNull();
    });

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
      // 쓰기 전 leg 존재 게이트가 읽는 기본 문서 — 두 leg 모두 저장돼 있는 상태.
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ morningRoute: mockCommuteRoute, eveningRoute: mockEveningRoute }),
      });
    });

    it('leg별 FieldPath로 해당 탑승 구간 키 하나만 부분 업데이트한다', async () => {
      const result = await updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', ['마천']);

      expect(result.success).toBe(true);
      // 맵 전체가 아니라 키 하나만 — 같은 leg의 다른 구간 키는 인자에 등장조차 하지 않는다.
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        { _type: 'fieldPath', segments: ['morningRoute', 'boardingPreferences', 'gangnam|2'] },
        ['마천'],
        'updatedAt',
        { _type: 'serverTimestamp' }
      );
    });

    it('evening leg은 eveningRoute 경로를 쓴다', async () => {
      await updateBoardingPreferences('uid-1', 'evening', 'jamsil|8', ['암사']);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        { _type: 'fieldPath', segments: ['eveningRoute', 'boardingPreferences', 'jamsil|8'] },
        ['암사'],
        'updatedAt',
        { _type: 'serverTimestamp' }
      );
    });

    it('destinations가 null이면 해당 키를 deleteField로 제거한다', async () => {
      const result = await updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', null);

      expect(result.success).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        { _type: 'fieldPath', segments: ['morningRoute', 'boardingPreferences', 'gangnam|2'] },
        { _type: 'deleteField' },
        'updatedAt',
        { _type: 'serverTimestamp' }
      );
    });

    it('빈 배열도 선호 해제로 보고 deleteField로 제거한다', async () => {
      await updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', []);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'mockDocRef',
        expect.objectContaining({ _type: 'fieldPath' }),
        { _type: 'deleteField' },
        'updatedAt',
        { _type: 'serverTimestamp' }
      );
    });

    it('uid 없으면 실패 result를 반환하고 쓰지 않는다', async () => {
      const result = await updateBoardingPreferences('', 'morning', 'gangnam|2', ['마천']);

      expect(result.success).toBe(false);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    // 중첩 FieldPath 쓰기는 leg가 없어도 실패하지 않고 중간 맵을 만든다 →
    // 필수 필드 없는 팬텀 route가 남아 설정 화면이 이를 로드하게 된다.
    it('대상 leg가 문서에 없으면(null) 쓰지 않고 실패 result를 반환한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ morningRoute: null, eveningRoute: mockEveningRoute, eveningEnabled: true }),
      });

      const result = await updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', ['마천']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('해당 출퇴근 경로가 저장되어 있지 않습니다');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('문서 자체가 없으면 쓰지 않고 실패 result를 반환한다', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });

      const result = await updateBoardingPreferences('uid-1', 'evening', 'jamsil|8', ['암사']);

      expect(result.success).toBe(false);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('같은 키 연속 호출은 직렬 실행된다 (getDoc→updateDoc 인터리브 금지)', async () => {
      // 시트에서 같은 옵션을 빠르게 두 번 탭하면 두 호출의 존재 게이트(getDoc)와
      // 쓰기(updateDoc)가 겹쳐, 나중 의도가 먼저 착지하는 역전이 가능하다.
      const order: string[] = [];
      let releaseFirstGetDoc: (() => void) | null = null;
      const snapshot = {
        exists: () => true,
        data: () => ({ morningRoute: mockCommuteRoute, eveningRoute: mockEveningRoute }),
      };
      // ...Once 큐 누출을 피해 호출 횟수로 분기한다 (레포 관례).
      mockGetDoc.mockImplementation(() => {
        order.push('getDoc');
        if (releaseFirstGetDoc === null) {
          return new Promise(resolve => {
            releaseFirstGetDoc = () => resolve(snapshot);
          });
        }
        return Promise.resolve(snapshot);
      });
      mockUpdateDoc.mockImplementation(() => {
        order.push('updateDoc');
        return Promise.resolve(undefined);
      });

      const first = updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', ['마천']);
      const second = updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', null);
      // 1번째가 getDoc에서 멈춰 있는 동안 2번째는 아직 읽지도 못한다.
      await Promise.resolve();
      expect(order).toEqual(['getDoc']);

      (releaseFirstGetDoc as unknown as () => void)();
      await Promise.all([first, second]);
      // 완전 직렬 — 1번째 updateDoc이 끝난 뒤에야 2번째 getDoc이 시작한다.
      expect(order).toEqual(['getDoc', 'updateDoc', 'getDoc', 'updateDoc']);
      // 마지막 의도(해제=deleteField)가 마지막에 착지한다.
      expect(mockUpdateDoc).toHaveBeenLastCalledWith(
        'mockDocRef',
        { _type: 'fieldPath', segments: ['morningRoute', 'boardingPreferences', 'gangnam|2'] },
        { _type: 'deleteField' },
        'updatedAt',
        { _type: 'serverTimestamp' }
      );
    });

    it('다른 키의 호출은 서로 대기하지 않는다 (키별 큐)', async () => {
      let releaseFirst: (() => void) | null = null;
      const snapshot = {
        exists: () => true,
        data: () => ({ morningRoute: mockCommuteRoute, eveningRoute: mockEveningRoute }),
      };
      mockGetDoc.mockImplementation(() => {
        if (releaseFirst === null) {
          return new Promise(resolve => {
            releaseFirst = () => resolve(snapshot);
          });
        }
        return Promise.resolve(snapshot);
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const blocked = updateBoardingPreferences('uid-1', 'morning', 'gangnam|2', ['마천']);
      // 다른 구간 키 — 앞 호출이 멈춰 있어도 독립적으로 완주한다.
      const other = await updateBoardingPreferences('uid-1', 'morning', 'jamsil|8', ['암사']);
      expect(other.success).toBe(true);

      (releaseFirst as unknown as () => void)();
      await blocked;
    });
  });

  describe('deleteCommuteSettings', () => {
    it('uid 문서를 삭제한다', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      const result = await deleteCommuteSettings('user-123');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalledWith('mockDocRef');
      expect(doc).toHaveBeenCalledWith({}, 'commuteSettings', 'user-123');
    });

    it('uid가 없으면 삭제를 시도하지 않는다', async () => {
      const result = await deleteCommuteSettings('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('사용자 인증이 필요합니다');
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('삭제 실패는 throw 하지 않고 결과 객체로 돌려준다', async () => {
      mockDeleteDoc.mockRejectedValue(new Error('permission-denied'));

      const result = await deleteCommuteSettings('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('permission-denied');
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

    it('빈 맵({})도 그대로 실어 보낸다 — 경로 교체 시 명시적 무효화', async () => {
      // EditCommuteRoute는 교체된 leg에 {}를 실어 옛 종점행 선호를 지운다.
      // 조건부 spread는 `{} !== undefined`라 발화하고, prune({})는 {}를 돌려줘야
      // 한다 — 여기서 필드가 빠지면 merge가 옛 선호를 보존해 무효화가 무산된다.
      // (호출부 테스트는 saveCommuteRoutes를 mock하므로 이 구간을 증명하지 못한다.)
      await saveCommuteRoutes('user-123', withPrefs(mockCommuteRoute, {}), mockEveningRoute);

      const written = mockSetDoc.mock.calls[0][1];
      expect('boardingPreferences' in written.morningRoute).toBe(true);
      expect(written.morningRoute.boardingPreferences).toEqual({});
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
