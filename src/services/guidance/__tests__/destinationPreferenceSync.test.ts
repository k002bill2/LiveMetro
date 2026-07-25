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

it('세션에 이미 선호가 있으면 늦게 도착한 원격 사본이 덮어쓰지 않는다 (TOCTOU)', async () => {
  // 시트에서 사용자가 먼저 고른 상태 — attach의 원격 읽기가 나중에 끝나도 선점이 이긴다.
  setGuidanceSession({ ...SESSION, destinationPreferences: { 'D1|5': ['상일동'] } });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
    morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    eveningRoute: null,
    eveningEnabled: true,
  });
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['상일동'] });
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

it('선호 없음·로드 실패는 조용히 no-op (안내를 막지 않는다)', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(attachDestinationPreferences('uid-1', 'morning', 1_000)).resolves.toBeUndefined();
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});
