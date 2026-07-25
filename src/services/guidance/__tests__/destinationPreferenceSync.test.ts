/**
 * destinationPreferenceSync tests — the I/O bridge that attaches a commute
 * leg's saved boardingPreferences onto the freshly started guidance session.
 *
 * commuteService is mocked (the only remote seam); the guidance session store
 * is exercised for real so the attribution guard (`expectedStartedAt`) is
 * verified against actual store state rather than a mock's bookkeeping.
 */
import { attachDestinationPreferences } from '@/services/guidance/destinationPreferenceSync';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import {
  clearGuidanceSession,
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';

jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const SESSION = {
  route: { segments: [] } as never,
  fromStationName: 'A',
  toStationName: 'B',
  startedAt: 1_000,
  sourceCommuteType: 'morning' as const,
  // 소유 귀속 — attach는 세션을 시작한 계정에서만 동작한다.
  ownerUid: 'uid-1',
};

afterEach(() => clearGuidanceSession());

it('로드된 leg의 boardingPreferences를 세션에 attach한다', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['마천'] });
});

it('세션이 바뀌었으면(startedAt 불일치) attach하지 않는다', async () => {
  setGuidanceSession({ ...SESSION, startedAt: 2_000 });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});

it('로컬 우선 병합 — 사용자가 고친 키는 유지하고 원격 형제 키는 채운다', async () => {
  // 시트에서 사용자가 먼저 'D1|5'를 고른 상태에서 attach의 원격 읽기가 늦게 끝난다.
  // 그 키는 로컬 선점이 이기되, 원격에만 있는 환승 구간 키('D9|8')는 유실되면 안 된다
  // (전량 스킵하던 옛 TOCTOU 가드의 결함 — 형제 키가 이 세션 내내 미적용됐다).
  setGuidanceSession({ ...SESSION, destinationPreferences: { 'D1|5': ['상일동'] } });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'], 'D9|8': ['암사'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({
    'D1|5': ['상일동'],
    'D9|8': ['암사'],
  });
});

it('세션 소유자가 다르면(ownerUid 불일치) attach하지 않는다', async () => {
  // 영속 세션이 로그아웃/계정 전환을 넘겨 살아남은 상태 — 새 계정의 선호를
  // 이전 탑승자의 세션에 붙이면 안 된다.
  setGuidanceSession({ ...SESSION, ownerUid: 'other-uid' });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});

// settled 마커 계약: undefined=미확정(원격 읽기 진행 중), {}=확정·선호 없음.
// 소비자(탑승 알림 예약)가 미확정 창을 건너뛰려면 attach가 **모든** 종료 경로에서
// 필드를 확정해야 한다 — 아니면 실패 한 번에 알림이 영영 막힌다.
it('로드가 throw해도 {}로 settle한다 (미확정 상태로 남기지 않는다)', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(attachDestinationPreferences('uid-1', 'morning', 1_000)).resolves.toBeUndefined();
  expect(getGuidanceSession()?.destinationPreferences).toEqual({});
});

it('로드가 null(오프라인 폴백)이어도 {}로 settle한다', async () => {
  // loadCommuteRoutes는 throw하지 않고 실패를 null로 반환한다 — 실제 오프라인은
  // catch가 아니라 이 경로로 도착하므로 여기서도 확정돼야 한다.
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(null);
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({});
});

it('저장된 선호가 비어 있어도 {}로 settle한다', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: {} },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({});
});

it('settle 실패 경로에서도 로컬 선택은 보존한다', async () => {
  // 확정이 곧 초기화여선 안 된다 — attach 전에 시트에서 고른 키는 살아남는다.
  setGuidanceSession({ ...SESSION, destinationPreferences: { 'D1|5': ['마천'] } });
  (loadCommuteRoutes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['마천'] });
});

it('가드 불통과(세션 스왑)면 실패 경로에서도 settle하지 않는다', async () => {
  // 확정은 "이 세션의 attach"에만 유효하다 — 남의 세션에 마커를 찍으면 그 세션의
  // 미확정 창이 거짓으로 닫힌다.
  setGuidanceSession({ ...SESSION, startedAt: 2_000 });
  (loadCommuteRoutes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});
