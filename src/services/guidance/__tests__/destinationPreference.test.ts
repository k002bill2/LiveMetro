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

  // 예전 픽스처는 존재하지 않는 노선 'K4'로 "비숫자 노선은 필터 미적용"을 확인했다 —
  // fail-open이 사양이던 시절의 테스트다. 실재하는 확장 노선으로 교체해 "canonical
  // 일치 시 통과"를 확인하고, 미지의 노선은 아래 fail-closed 케이스가 따로 덮는다.
  it('비숫자 노선도 canonical line이 일치하면 통과한다', () => {
    const gy = train({ id: 'g1', finalDestination: '문산', lineId: '경의중앙선' });
    const { tracked } = partitionWaitingTrains({
      trains: [gy],
      lineId: '경의중앙선',
      directionName: '문산',
      preferredDestinations: [],
    });
    expect(tracked.map(t => t.id)).toEqual(['g1']);
  });

  it('미지의 노선 id는 전량 통과가 아니라 빈 결과를 낸다 (fail-closed)', () => {
    const gy = train({ id: 'g1', finalDestination: '문산', lineId: '경의중앙선' });
    const { display, tracked } = partitionWaitingTrains({
      trains: [gy],
      lineId: 'K4',
      directionName: '문산',
      preferredDestinations: [],
    });
    expect(display).toEqual([]);
    expect(tracked).toEqual([]);
  });

  it('빈 lineId는 빈 결과를 낸다 (대기 단계가 아닐 때의 빈 문자열 방어)', () => {
    const gy = train({ id: 'g1', finalDestination: '문산', lineId: '경의중앙선' });
    const { display, tracked } = partitionWaitingTrains({
      trains: [gy],
      lineId: '',
      directionName: null,
      preferredDestinations: [],
    });
    expect(display).toEqual([]);
    expect(tracked).toEqual([]);
  });

  // 실기기 QA(2026-08-29) APP_FAIL — 수인분당선 청량리 방면 대기 step에 2호선 성수행이
  // 섞여 나왔다. 확장 노선이 숫자 노선 필터를 건너뛰어 다노선 스냅샷이 통째로 통과했다.
  describe('확장 노선 다노선 혼입 (실기기 QA 회귀)', () => {
    const seongsu = train({ id: 's1', finalDestination: '성수', lineId: '2' });
    const cheongnyangni = train({ id: 'c1', finalDestination: '청량리', lineId: '수인분당선' });

    it('수인분당선 대기 step에 2호선 성수행은 display·tracked 모두 0건이다', () => {
      const { display, tracked } = partitionWaitingTrains({
        trains: [seongsu],
        lineId: '수인분당선',
        directionName: '청량리',
        preferredDestinations: [],
      });
      expect(display.map(t => t.id)).toEqual([]);
      expect(tracked.map(t => t.id)).toEqual([]);
    });

    it('같은 스냅샷에서 수인분당선 열차만 남긴다', () => {
      const { display, tracked } = partitionWaitingTrains({
        trains: [seongsu, cheongnyangni],
        lineId: '수인분당선',
        directionName: '청량리',
        preferredDestinations: [],
      });
      expect(display.map(t => t.id)).toEqual(['c1']);
      expect(tracked.map(t => t.id)).toEqual(['c1']);
    });

    // step의 lineId는 경로 그래프 슬러그('bundang'), Train.lineId는 Seoul subwayId 정규화
    // 결과('수인분당선') — 비교 전 양쪽을 canonical로 모아야 유효 열차가 살아남는다.
    it('그래프 슬러그 lineId와 정규화된 Train.lineId를 같은 도메인에서 비교한다', () => {
      const { tracked } = partitionWaitingTrains({
        trains: [seongsu, cheongnyangni],
        lineId: 'bundang',
        directionName: '청량리',
        preferredDestinations: [],
      });
      expect(tracked.map(t => t.id)).toEqual(['c1']);
    });

    it('확장 노선에서도 preferred destination 필터 계약을 지킨다', () => {
      const wangsimni = train({ id: 'w1', finalDestination: '왕십리', lineId: '수인분당선' });
      const pick = (prefs: readonly string[]): string[] =>
        partitionWaitingTrains({
          trains: [seongsu, cheongnyangni, wangsimni],
          lineId: '수인분당선',
          directionName: '청량리',
          preferredDestinations: prefs,
        }).tracked.map(t => t.id);
      expect(pick(['청량리'])).toEqual(['c1']);
      expect(pick(['왕십리'])).toEqual(['w1']);
      // 선호가 다른 노선 종착역이어도 노선 필터를 뚫고 들어오지 않는다.
      expect(pick(['성수'])).toEqual([]);
    });

    // 회귀: 도착 스냅샷 소속을 realtimePosition API 커버리지로 판정하던 시절엔
    // 인천2 대기 step 의 대기 풀이 통째로 비었다 — 타 노선 혼입이 아니라 화면 전멸.
    // 위치 API 미지원은 도착 스냅샷 유효성과 무관하므로 같은 노선 열차는 살아남고
    // 타 노선만 걸러져야 한다.
    it('위치 API 미지원 노선(인천2)의 열차는 남기고 타 노선만 걸러낸다', () => {
      const geomdan = train({ id: 'i2', finalDestination: '검단오류', lineId: '인천2' });
      const { display, tracked } = partitionWaitingTrains({
        trains: [seongsu, cheongnyangni, geomdan],
        lineId: 'incheon2',
        directionName: '검단오류',
        preferredDestinations: [],
      });
      expect(display.map(t => t.id)).toEqual(['i2']);
      expect(tracked.map(t => t.id)).toEqual(['i2']);
    });
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
