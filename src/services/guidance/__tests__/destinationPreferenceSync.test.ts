/**
 * destinationPreferenceSync tests — the I/O bridge that attaches a commute
 * leg's saved boardingPreferences onto the freshly started guidance session.
 *
 * commuteService is mocked (the only remote seam); the guidance session store
 * is exercised for real so the attribution guard (`expectedStartedAt`) is
 * verified against actual store state rather than a mock's bookkeeping.
 *
 * 경로도 실제 형태로 픽스처를 짠다 — 세션 route와 로드된 CommuteRoute의 OD 지문
 * 대조가 이 모듈의 가드가 됐고, 빈 route(`{ segments: [] }`)로는 병합 테스트가
 * 지문을 한 번도 통과시키지 않은 채 초록으로 남는다(mocked-seam 함정).
 */
import { attachDestinationPreferences } from '@/services/guidance/destinationPreferenceSync';
import { loadCommuteRoutes } from '@/services/commute/commuteService';
import {
  clearGuidanceSession,
  getGuidanceSession,
  setGuidanceSession,
} from '@/services/guidance/guidanceSessionStore';
import type { Route, RouteSegment } from '@/models/route';
import type { CommuteRoute } from '@/models/commute';

jest.mock('@/services/commute/commuteService', () => ({
  loadCommuteRoutes: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const hop = (
  fromStationId: string,
  fromStationName: string,
  toStationId: string,
  toStationName: string
): RouteSegment => ({
  fromStationId,
  fromStationName,
  toStationId,
  toStationName,
  lineId: '2',
  lineName: '2호선',
  estimatedMinutes: 3,
  isTransfer: false,
});

const routeOf = (segments: readonly RouteSegment[]): Route => ({
  segments,
  totalMinutes: segments.reduce((acc, s) => acc + s.estimatedMinutes, 0),
  transferCount: 0,
  lineIds: ['2'],
});

/** 세션 경로: 강남(gangnam) 승차 → 홍대입구(hongdae) 하차 — 내부 슬러그 도메인. */
const SESSION_ROUTE = routeOf([
  hop('gangnam', '강남', 'seolleung', '선릉'),
  hop('seolleung', '선릉', 'hongdae', '홍대입구'),
]);

/**
 * 저장된 leg 경로: 온보딩이 쓰는 Seoul station_cd 도메인('0222'=강남, '0239'=홍대입구).
 * 즉 **실서비스의 기본 조합이 혼합 도메인**이라, 정규화 없는 대조는 상시 불일치가 된다.
 */
const COMMUTE_ROUTE: CommuteRoute = {
  departureTime: '08:00',
  departureStationId: '0222',
  departureStationName: '강남',
  departureLineId: '2',
  transferStations: [],
  arrivalStationId: '0239',
  arrivalStationName: '홍대입구',
  arrivalLineId: '2',
  notifications: {
    transferAlert: true,
    arrivalAlert: true,
    delayAlert: true,
    incidentAlert: true,
    alertMinutesBefore: 5,
  },
  bufferMinutes: 5,
};

const SESSION = {
  route: SESSION_ROUTE,
  fromStationName: '강남',
  toStationName: '홍대입구',
  startedAt: 1_000,
  sourceCommuteType: 'morning' as const,
  // 소유 귀속 — attach는 세션을 시작한 계정에서만 동작한다.
  ownerUid: 'uid-1',
};

/** loadCommuteRoutes 응답 픽스처 — morningRoute만 관심사. */
const settingsWith = (
  overrides: Partial<CommuteRoute>,
  boardingPreferences?: Readonly<Record<string, readonly string[]>>
): { readonly morningRoute: CommuteRoute } => ({
  morningRoute: {
    ...COMMUTE_ROUTE,
    ...overrides,
    ...(boardingPreferences !== undefined && { boardingPreferences }),
  },
});

afterEach(() => clearGuidanceSession());

it('로드된 leg의 boardingPreferences를 세션에 attach한다 (혼합 도메인 지문 일치)', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, { 'D1|5': ['마천'] }));
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['마천'] });
  // 지문이 확인됐으므로 원본 write-back이 열린다.
  expect(getGuidanceSession()?.sourceRouteVerified).toBe(true);
});

it('세션이 바뀌었으면(startedAt 불일치) attach하지 않는다', async () => {
  setGuidanceSession({ ...SESSION, startedAt: 2_000 });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, { 'D1|5': ['마천'] }));
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toBeUndefined();
});

it('로컬 우선 병합 — 사용자가 고친 키는 유지하고 원격 형제 키는 채운다', async () => {
  // 시트에서 사용자가 먼저 'D1|5'를 고른 상태에서 attach의 원격 읽기가 늦게 끝난다.
  // 그 키는 로컬 선점이 이기되, 원격에만 있는 환승 구간 키('D9|8')는 유실되면 안 된다
  // (전량 스킵하던 옛 TOCTOU 가드의 결함 — 형제 키가 이 세션 내내 미적용됐다).
  setGuidanceSession({ ...SESSION, destinationPreferences: { 'D1|5': ['상일동'] } });
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(
    settingsWith({}, { 'D1|5': ['마천'], 'D9|8': ['암사'] })
  );
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
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, { 'D1|5': ['마천'] }));
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
  // 경로를 확인할 수 없었으므로 write-back은 fail-closed (미검증).
  expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
});

it('로드가 null(오프라인 폴백)이어도 {}로 settle한다', async () => {
  // loadCommuteRoutes는 throw하지 않고 실패를 null로 반환한다 — 실제 오프라인은
  // catch가 아니라 이 경로로 도착하므로 여기서도 확정돼야 한다.
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(null);
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({});
  expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
});

it('저장된 선호가 비어 있어도 {}로 settle한다', async () => {
  setGuidanceSession(SESSION);
  (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, {}));
  await attachDestinationPreferences('uid-1', 'morning', 1_000);
  expect(getGuidanceSession()?.destinationPreferences).toEqual({});
  expect(getGuidanceSession()?.sourceRouteVerified).toBe(true);
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

describe('접촉 키 제외 (해제한 필터의 부활 방지)', () => {
  it('attach 전에 해제한 키는 원격 값으로 부활하지 않고, 미접촉 형제 키는 병합된다', async () => {
    // 사용자가 attach 진행 중 'D1|5'를 해제했다 — 로컬 맵에 키가 없으므로 스프레드
    // 병합만으로는 "삭제"와 "미접촉"이 같은 모양이고, in-flight 원격 값이 방금 지운
    // 필터를 되살린다. 접촉 이력이 그 구간만 원격 병합에서 빼야 한다.
    setGuidanceSession({
      ...SESSION,
      destinationPreferences: {},
      touchedBoardingKeys: ['D1|5'],
    });
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(
      settingsWith({}, { 'D1|5': ['마천'], 'D9|8': ['암사'] })
    );
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    // 해제한 키는 부활 없음, 손대지 않은 형제 키는 그대로 채워진다.
    expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D9|8': ['암사'] });
  });

  it('접촉했지만 값이 남아 있는 키는 로컬 값이 이긴다 (제외해도 결과 동일)', async () => {
    setGuidanceSession({
      ...SESSION,
      destinationPreferences: { 'D1|5': ['상일동'] },
      touchedBoardingKeys: ['D1|5'],
    });
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, { 'D1|5': ['마천'] }));
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['상일동'] });
  });

  it('접촉 이력은 attach 후에도 보존된다 (세션 수명 동안 유효)', async () => {
    setGuidanceSession({ ...SESSION, destinationPreferences: {}, touchedBoardingKeys: ['D1|5'] });
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, { 'D9|8': ['암사'] }));
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    expect(getGuidanceSession()?.touchedBoardingKeys).toEqual(['D1|5']);
  });
});

describe('경로 지문 대조 (이중 SSOT 발산 방어)', () => {
  it('OD가 다른 경로가 로드되면 선호를 붙이지 않고 빈 확정만 한다', async () => {
    // 세션 OD는 강남→홍대입구인데 저장된 leg는 사당→시청 — profile store와
    // commuteSettings가 발산한 상태. 무관한 경로의 선호가 이 세션에 적용되면 안 되고,
    // 토글이 그 경로에 영속돼서도 안 된다(sourceRouteVerified 미설정 = write-back 차단).
    setGuidanceSession(SESSION);
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(
      settingsWith(
        {
          departureStationId: 'sadang',
          departureStationName: '사당',
          arrivalStationId: 'cityhall',
          arrivalStationName: '시청',
        },
        { 'D1|5': ['마천'] }
      )
    );
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    // 알림 게이트는 열려야 하므로 확정은 하되(빈 맵), 원격 선호는 하나도 붙지 않는다.
    expect(getGuidanceSession()?.destinationPreferences).toEqual({});
    expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
  });

  it('불일치여도 사용자가 이미 고른 로컬 선택은 보존한다 (세션 한정 강등)', async () => {
    setGuidanceSession({ ...SESSION, destinationPreferences: { 'D1|5': ['마천'] } });
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(
      settingsWith(
        { departureStationId: 'sadang', arrivalStationId: 'cityhall' },
        { 'D9|8': ['암사'] }
      )
    );
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    expect(getGuidanceSession()?.destinationPreferences).toEqual({ 'D1|5': ['마천'] });
    expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
  });

  it('역방향(출발↔도착 뒤바뀜) 경로도 불일치로 판정한다', async () => {
    // 퇴근 leg가 출근 자리에 저장된 경우 — 역 집합은 같지만 다른 여정이다.
    setGuidanceSession(SESSION);
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(
      settingsWith({ departureStationId: '0239', arrivalStationId: '0222' }, { 'D1|5': ['마천'] })
    );
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    expect(getGuidanceSession()?.destinationPreferences).toEqual({});
    expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
  });

  it('필수 역 필드가 없는 팬텀 route는 불일치로 접는다 (throw 아님)', async () => {
    // commuteService의 leg 존재 게이트 주석이 기록한 실재 데이터 — 중첩 FieldPath
    // 쓰기가 만든 `morningRoute = { boardingPreferences }`. 예외가 아니라 미검증이어야 한다.
    setGuidanceSession(SESSION);
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce({
      morningRoute: { boardingPreferences: { 'D1|5': ['마천'] } },
    });
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    expect(getGuidanceSession()?.destinationPreferences).toEqual({});
    expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
  });

  it('스텝이 도출되지 않는 기형 세션 경로는 검증하지 않는다 (공집합 대조 금지)', async () => {
    setGuidanceSession({ ...SESSION, route: routeOf([]) });
    (loadCommuteRoutes as jest.Mock).mockResolvedValueOnce(settingsWith({}, { 'D1|5': ['마천'] }));
    await attachDestinationPreferences('uid-1', 'morning', 1_000);
    expect(getGuidanceSession()?.destinationPreferences).toEqual({});
    expect(getGuidanceSession()?.sourceRouteVerified).toBeUndefined();
  });
});
