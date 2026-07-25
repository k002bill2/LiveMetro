import {
  buildBoardingKey,
  destinationOptions,
  partitionWaitingTrains,
  pruneBoardingPreferences,
} from '@/services/guidance/destinationPreference';
import { TrainStatus, type Train } from '@/models/train';
import type { CommuteRoute } from '@/models/commute';

const NOW = 1_753_400_000_000;

const train = (overrides: Partial<Train> & Pick<Train, 'id' | 'finalDestination'>): Train => ({
  lineId: '5',
  direction: 'up',
  currentStationId: 'S1',
  nextStationId: null,
  status: TrainStatus.NORMAL,
  arrivalTime: new Date(NOW + 180_000),
  delayMinutes: 0,
  lastUpdated: new Date(NOW),
  ...overrides,
});

const ROUTE: CommuteRoute = {
  departureTime: '08:00',
  departureStationId: 'D1',
  departureStationName: '출발',
  departureLineId: '5',
  transferStations: [
    { stationId: 'T1', stationName: '환승', lineId: '2', lineName: '2호선', order: 1 },
  ],
  arrivalStationId: 'A1',
  arrivalStationName: '도착',
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

describe('buildBoardingKey', () => {
  it('stationId|lineId 형식을 만든다', () => {
    expect(buildBoardingKey('D1', '5')).toBe('D1|5');
  });
});

describe('partitionWaitingTrains', () => {
  const hanam = train({ id: 'h1', finalDestination: '하남검단산', arrivalTime: new Date(NOW + 300_000) });
  const macheon = train({ id: 'm1', finalDestination: '마천', arrivalTime: new Date(NOW + 120_000) });
  const opposite = train({ id: 'o1', finalDestination: '방화', direction: 'down' });
  const otherLine = train({ id: 'x1', finalDestination: '성수', lineId: '2' });

  it('선호 없음 → tracked는 기존 방면 필터와 동일 (방면 매칭만)', () => {
    const { tracked } = partitionWaitingTrains({
      trains: [hanam, macheon, opposite, otherLine],
      lineId: '5',
      directionName: '하남검단산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['h1']);
  });

  it('선호 없음 + 방면 매칭 전무 → 노선 필터 결과로 폴백 (기존 동작)', () => {
    const { tracked } = partitionWaitingTrains({
      trains: [macheon, opposite],
      lineId: '5',
      directionName: '하남검단산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['m1', 'o1']);
  });

  it('display는 방면 매칭 열차와 같은 물리 방향(up/down) 전체', () => {
    const { display } = partitionWaitingTrains({
      trains: [hanam, macheon, opposite],
      lineId: '5',
      directionName: '하남검단산',
      preferredDestinations: [],
    });
    expect(display.map(t => t.id).sort()).toEqual(['h1', 'm1']);
  });

  it('선호 선택 시 tracked는 display 중 선호 종점행만 (0대 허용)', () => {
    const pick = (prefs: readonly string[]): string[] =>
      partitionWaitingTrains({
        trains: [hanam, macheon, opposite],
        lineId: '5',
        directionName: '하남검단산',
        preferredDestinations: prefs,
      }).tracked.map(t => t.id);
    expect(pick(['마천'])).toEqual(['m1']);
    expect(pick(['마천', '하남검단산']).sort()).toEqual(['h1', 'm1']);
    expect(pick(['강동'])).toEqual([]);
  });

  it('비숫자 노선(lineId 필터 미적용)에서도 동작한다', () => {
    const gy = train({ id: 'g1', finalDestination: '문산', lineId: 'K4' });
    const { tracked } = partitionWaitingTrains({
      trains: [gy],
      lineId: 'K4',
      directionName: '문산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['g1']);
  });
});

describe('destinationOptions', () => {
  it('display의 distinct 종착역을 최초 도착 순으로, 저장-미도착 선호는 etaText null로 뒤에 붙인다', () => {
    const opts = destinationOptions(
      [
        train({ id: 'a', finalDestination: '하남검단산', arrivalTime: new Date(NOW + 300_000) }),
        train({ id: 'b', finalDestination: '마천', arrivalTime: new Date(NOW + 120_000) }),
        train({ id: 'c', finalDestination: '마천', arrivalTime: new Date(NOW + 500_000) }),
      ],
      ['강동'],
      NOW
    );
    expect(opts).toEqual([
      { name: '마천', etaText: '2분' },
      { name: '하남검단산', etaText: '5분' },
      { name: '강동', etaText: null },
    ]);
  });

  it('60초 미만은 "곧 도착", arrivalTime null·과거는 etaText null', () => {
    const opts = destinationOptions(
      [
        train({ id: 'a', finalDestination: '마천', arrivalTime: new Date(NOW + 30_000) }),
        train({ id: 'b', finalDestination: '강동', arrivalTime: null }),
      ],
      [],
      NOW
    );
    expect(opts).toEqual([
      { name: '마천', etaText: '곧 도착' },
      { name: '강동', etaText: null },
    ]);
  });

  it('미래 도착이 없는 종착역(지나간 열차뿐)은 etaText null + 맨 뒤로 밀린다', () => {
    const opts = destinationOptions(
      [
        train({ id: 'a', finalDestination: '마천', arrivalTime: new Date(NOW - 10_000) }),
        train({ id: 'b', finalDestination: '하남검단산', arrivalTime: new Date(NOW + 120_000) }),
      ],
      [],
      NOW
    );
    expect(opts).toEqual([
      { name: '하남검단산', etaText: '2분' },
      { name: '마천', etaText: null },
    ]);
  });

  it('같은 종착역에 과거+미래 열차 공존 → 미래 열차가 대표하고 순서도 밀리지 않는다', () => {
    const opts = destinationOptions(
      [
        train({ id: 'past', finalDestination: '마천', arrivalTime: new Date(NOW - 10_000) }),
        train({ id: 'future', finalDestination: '마천', arrivalTime: new Date(NOW + 120_000) }),
        train({ id: 'h', finalDestination: '하남검단산', arrivalTime: new Date(NOW + 300_000) }),
      ],
      [],
      NOW
    );
    expect(opts).toEqual([
      { name: '마천', etaText: '2분' },
      { name: '하남검단산', etaText: '5분' },
    ]);
  });
});

describe('pruneBoardingPreferences', () => {
  it('경로에 없는 역의 키를 제거한다 (역 단위 prune — lineId 불일치는 유지)', () => {
    const pruned = pruneBoardingPreferences(
      { 'D1|5': ['마천'], 'T1|2': ['성수'], 'GONE|7': ['도봉산'], 'D1|9': ['중앙보훈병원'] },
      ROUTE
    );
    expect(pruned).toEqual({ 'D1|5': ['마천'], 'T1|2': ['성수'], 'D1|9': ['중앙보훈병원'] });
  });

  it('빈 배열 값 키는 제거한다', () => {
    expect(pruneBoardingPreferences({ 'D1|5': [] }, ROUTE)).toEqual({});
  });

  // 온보딩은 Seoul station_cd('0222')를, 길안내 키는 내부 슬러그('gangnam')를 쓴다.
  // 두 도메인은 비교차라 정규화 없이는 유효 키까지 전량 드롭된다.
  it('route가 station_cd·키가 슬러그인 혼합 도메인에서도 유효 키가 살아남는다', () => {
    const cdRoute: CommuteRoute = {
      ...ROUTE,
      departureStationId: '0222', // 강남 → gangnam
      transferStations: [
        { stationId: '0239', stationName: '홍대입구', lineId: '2', lineName: '2호선', order: 1 },
      ],
    };

    const pruned = pruneBoardingPreferences(
      { 'gangnam|2': ['마천'], 'hongdae|2': ['성수'], 'seolleung|2': ['하남검단산'] },
      cdRoute
    );

    expect(pruned).toEqual({ 'gangnam|2': ['마천'], 'hongdae|2': ['성수'] });
  });

  it('반대 조합(route=슬러그·키=station_cd)도 정규화해 비교하고 키 원문을 보존한다', () => {
    const slugRoute: CommuteRoute = {
      ...ROUTE,
      departureStationId: 'gangnam',
      transferStations: [],
    };

    const pruned = pruneBoardingPreferences({ '0222|2': ['마천'], '0239|2': ['성수'] }, slugRoute);

    // 키는 정규화하지 않는다 — 조회가 정확 키 매칭이라 원문이 유지돼야 한다.
    expect(pruned).toEqual({ '0222|2': ['마천'] });
  });
});
