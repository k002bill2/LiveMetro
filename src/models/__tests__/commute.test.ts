/**
 * commute model — reverseCommuteRoute unit tests.
 *
 * Verifies the return-leg construction used to materialise the evening (퇴근)
 * leg from the morning (출근) leg: OD swap, reversed transfer chain with the
 * one-hop lineId shift, field preservation, and input immutability.
 */
import {
  reverseCommuteRoute,
  DEFAULT_MORNING_DEPARTURE_TIME,
  DEFAULT_EVENING_DEPARTURE_TIME,
  type CommuteRoute,
  type CommuteNotifications,
  type TransferStation,
} from '@/models/commute';

const notifications: CommuteNotifications = {
  transferAlert: true,
  arrivalAlert: false,
  delayAlert: true,
  incidentAlert: false,
  alertMinutesBefore: 7,
  departureTimeAlert: true,
  communityAlert: false,
};

const makeRoute = (transferStations: readonly TransferStation[]): CommuteRoute => ({
  departureTime: '08:00',
  departureStationId: 'dep-id',
  departureStationName: '서울역',
  departureLineId: '1',
  transferStations,
  arrivalStationId: 'arr-id',
  arrivalStationName: '강남',
  arrivalLineId: '2',
  notifications,
  bufferMinutes: 5,
});

describe('reverseCommuteRoute', () => {
  it('(a) swaps the departure/arrival id, name, and lineId fields', () => {
    const forward = makeRoute([]);
    const reversed = reverseCommuteRoute(forward, DEFAULT_EVENING_DEPARTURE_TIME);

    expect(reversed.departureStationId).toBe('arr-id');
    expect(reversed.departureStationName).toBe('강남');
    expect(reversed.departureLineId).toBe('2');
    expect(reversed.arrivalStationId).toBe('dep-id');
    expect(reversed.arrivalStationName).toBe('서울역');
    expect(reversed.arrivalLineId).toBe('1');
  });

  it('(b) keeps an empty transfer list empty', () => {
    const reversed = reverseCommuteRoute(makeRoute([]), DEFAULT_EVENING_DEPARTURE_TIME);
    expect(reversed.transferStations).toEqual([]);
  });

  it('(c) single transfer takes the original arrivalLineId with order 1', () => {
    const forward = makeRoute([
      { stationId: 't1-id', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
    ]);
    const reversed = reverseCommuteRoute(forward, DEFAULT_EVENING_DEPARTURE_TIME);

    expect(reversed.transferStations).toEqual([
      { stationId: 't1-id', stationName: '신도림', lineId: '2', lineName: '', order: 1 },
    ]);
  });

  it('(d) two transfers reverse order with a one-hop lineId shift and 1-based order', () => {
    // Forward: 서울역 --(1)--> T1 --(3)--> T2 --(2)--> 강남
    // T1.lineId = '1' (line ridden INTO T1), T2.lineId = '3', arrivalLineId = '2'.
    const forward = makeRoute([
      { stationId: 't1-id', stationName: 'T1', lineId: '1', lineName: '1호선', order: 1 },
      { stationId: 't2-id', stationName: 'T2', lineId: '3', lineName: '3호선', order: 2 },
    ]);
    const reversed = reverseCommuteRoute(forward, DEFAULT_MORNING_DEPARTURE_TIME);

    // Reversed: 강남 --(2)--> T2 --(3)--> T1 --(1)--> 서울역
    //  - T2 (pos 0): entered from arrival → lineId = arrivalLineId '2', lineName ''.
    //  - T1 (pos 1): inherits the original "next" transfer's line → T2's '3'/'3호선'.
    expect(reversed.transferStations).toEqual([
      { stationId: 't2-id', stationName: 'T2', lineId: '2', lineName: '', order: 1 },
      { stationId: 't1-id', stationName: 'T1', lineId: '3', lineName: '3호선', order: 2 },
    ]);
  });

  it('(e) preserves notifications and bufferMinutes from the source route', () => {
    const forward = makeRoute([
      { stationId: 't1-id', stationName: '신도림', lineId: '1', lineName: '1호선', order: 1 },
    ]);
    const reversed = reverseCommuteRoute(forward, DEFAULT_EVENING_DEPARTURE_TIME);

    expect(reversed.notifications).toEqual(notifications);
    expect(reversed.bufferMinutes).toBe(5);
  });

  it('(f) applies the departureTime argument to the reversed leg', () => {
    const reversed = reverseCommuteRoute(makeRoute([]), '19:15');
    expect(reversed.departureTime).toBe('19:15');
  });

  it('(g) does not mutate the input route (deep equal before/after)', () => {
    const forward = makeRoute([
      { stationId: 't1-id', stationName: 'T1', lineId: '1', lineName: '1호선', order: 1 },
      { stationId: 't2-id', stationName: 'T2', lineId: '3', lineName: '3호선', order: 2 },
    ]);
    const snapshot = JSON.parse(JSON.stringify(forward));

    reverseCommuteRoute(forward, DEFAULT_EVENING_DEPARTURE_TIME);

    expect(forward).toEqual(snapshot);
    // The transfer array order must be untouched (guards against an in-place
    // .reverse() on route.transferStations rather than a copy).
    expect(forward.transferStations.map((t) => t.stationName)).toEqual(['T1', 'T2']);
  });
});
