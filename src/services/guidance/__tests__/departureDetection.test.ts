/**
 * departureDetection — 순수 출발 감지 단위 테스트.
 *
 * 도착(arvlCd '2') 열차는 상위 레이어에서 이미 필터링되므로, 출발은
 * "직전 스냅샷에서 ETA≈0이던 열차 id가 다음 스냅샷에서 사라짐"으로 추론한다.
 * 지배 원칙: false-positive(미출발인데 진행)가 비싼 오류 → 보수적 게이트.
 */
import { detectDeparture, ARRIVING_ETA_THRESHOLD_SEC } from '../departureDetection';
import { TrainStatus, type Train } from '@/models/train';

const NOW = 1_700_000_000_000;

const train = (over: Partial<Train> & { readonly id: string }): Train => ({
  lineId: '2',
  direction: 'up',
  currentStationId: 's1',
  nextStationId: null,
  finalDestination: '성수',
  status: TrainStatus.NORMAL,
  arrivalTime: null,
  delayMinutes: 0,
  lastUpdated: new Date(NOW),
  ...over,
});

/** Train whose ETA is `etaSec` seconds from NOW. */
const arriving = (id: string, etaSec: number, over: Partial<Train> = {}): Train =>
  train({ id, arrivalTime: new Date(NOW + etaSec * 1000), ...over });

describe('detectDeparture', () => {
  const awaitedLine2 = { lineId: '2', directionName: null };

  it('returns not-departed when prev is null (first snapshot)', () => {
    const result = detectDeparture({
      prev: null,
      next: [arriving('A', 10)],
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('returns not-departed for empty→empty snapshots', () => {
    const result = detectDeparture({
      prev: [],
      next: [],
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('detects departure: an arriving train (eta within threshold) vanishes', () => {
    const result = detectDeparture({
      prev: [arriving('A', 10)],
      next: [arriving('B', 180)], // a different, further-out train remains
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'A' });
  });

  it('detects departure when the qualifying train vanishes to an empty list', () => {
    const result = detectDeparture({
      prev: [arriving('A', 0)], // eta exactly 0 (도착) qualifies
      next: [],
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'A' });
  });

  it('does NOT detect departure when the vanished train was beyond the threshold', () => {
    const result = detectDeparture({
      prev: [arriving('A', ARRIVING_ETA_THRESHOLD_SEC + 90)], // far away, not "arriving"
      next: [],
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('does NOT detect departure when the arriving train is still present', () => {
    const result = detectDeparture({
      prev: [arriving('A', 5)],
      next: [arriving('A', 0)], // same id, now at the platform — not gone
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('ignores trains with null arrivalTime (never qualify)', () => {
    const result = detectDeparture({
      prev: [train({ id: 'A', arrivalTime: null })],
      next: [],
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('excludes trains with a negative ETA (already past)', () => {
    const result = detectDeparture({
      prev: [arriving('A', -5)],
      next: [],
      awaited: awaitedLine2,
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('filters by numbered line: a vanished other-line train is not a departure', () => {
    // Transfer station: line-2 and line-3 trains mixed. Awaiting line 2.
    const result = detectDeparture({
      prev: [arriving('L2', 5, { lineId: '2' }), arriving('L3', 5, { lineId: '3' })],
      next: [arriving('L2', 0, { lineId: '2' })], // line-3 train vanished, line-2 stays
      awaited: { lineId: '2', directionName: null },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  // 예전 픽스처는 존재하지 않는 노선 'K2'를 확장 노선 대역으로 썼다. 확장 노선이
  // 노선 필터를 통째로 건너뛰던 시절엔 그래도 통했지만, canonical 필터가 붙은 지금은
  // 실재하는 노선이어야 감지 경로를 실제로 지난다. 수인분당선(청량리/인천 분기)으로 교체.
  it('degrades to manual on an extended (non-numbered) line without a direction', () => {
    const result = detectDeparture({
      prev: [arriving('K', 5, { lineId: '수인분당선' })],
      next: [],
      awaited: { lineId: '수인분당선', directionName: null },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('detects departure on an extended line when the direction matches', () => {
    const result = detectDeparture({
      prev: [
        arriving('match', 5, { lineId: '수인분당선', finalDestination: '청량리' }),
        arriving('other', 5, { lineId: '수인분당선', finalDestination: '인천' }),
      ],
      next: [arriving('other', 0, { lineId: '수인분당선', finalDestination: '인천' })],
      awaited: { lineId: '수인분당선', directionName: '청량리' },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'match' });
  });

  it('does NOT detect departure on an extended line when the matching train remains', () => {
    const result = detectDeparture({
      prev: [arriving('match', 5, { lineId: '수인분당선', finalDestination: '청량리' })],
      next: [arriving('match', 0, { lineId: '수인분당선', finalDestination: '청량리' })],
      awaited: { lineId: '수인분당선', directionName: '청량리' },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  // 실기기 QA(2026-08-29) 회귀: 환승역 스냅샷은 역 단위라 타 노선 열차가 섞인다.
  // 확장 노선이 필터를 건너뛰면 방면명이 우연히 일치하는 타 노선 열차의 출발로
  // 여정이 자동 진행됐다 — 가장 비싼 false positive.
  it('ignores an other-line train that vanishes on an extended line', () => {
    const result = detectDeparture({
      prev: [arriving('L2', 5, { lineId: '2', finalDestination: '청량리' })],
      next: [],
      awaited: { lineId: '수인분당선', directionName: '청량리' },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('ignores an other-line train even when it is the preferred destination', () => {
    const result = detectDeparture({
      prev: [arriving('L2', 5, { lineId: '2', finalDestination: '청량리' })],
      next: [],
      awaited: {
        lineId: '수인분당선',
        directionName: null,
        preferredDestinations: ['청량리'],
      },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('matches the graph slug lineId against the normalized Train.lineId domain', () => {
    const result = detectDeparture({
      prev: [arriving('SB', 5, { lineId: '수인분당선', finalDestination: '청량리' })],
      next: [],
      awaited: { lineId: 'bundang', directionName: '청량리' },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'SB' });
  });

  it('returns not-departed for an unknown or empty awaited lineId (fail-closed)', () => {
    const prev = [arriving('X', 5, { lineId: 'K2', finalDestination: '청량리' })];
    expect(
      detectDeparture({ prev, next: [], awaited: { lineId: 'K2', directionName: '청량리' }, nowMs: NOW })
    ).toEqual({ departed: false, trainId: null });
    expect(
      detectDeparture({ prev, next: [], awaited: { lineId: '', directionName: '청량리' }, nowMs: NOW })
    ).toEqual({ departed: false, trainId: null });
    expect(
      detectDeparture({
        prev,
        next: [],
        awaited: { lineId: 'incheon2', directionName: '청량리' },
        nowMs: NOW,
      })
    ).toEqual({ departed: false, trainId: null });
  });
});

describe('preferredDestinations', () => {
  it('선호 종점행 열차의 소멸만 출발로 판정한다', () => {
    const macheon = arriving('m1', 10, { lineId: '5', finalDestination: '마천' });
    const hanam = arriving('h1', 15, { lineId: '5', finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [macheon, hanam],
      next: [hanam],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: ['마천'] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'm1' });
  });

  it('선호 밖 열차(방면 매칭 포함)가 사라져도 출발로 판정하지 않는다', () => {
    const macheon = arriving('m1', 10, { lineId: '5', finalDestination: '마천' });
    const hanam = arriving('h1', 15, { lineId: '5', finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [macheon, hanam],
      next: [macheon],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: ['마천'] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('선호 밖 후보만 남으면 방면 폴백 없이 미출발로 판정한다', () => {
    // 선호가 없었다면 방면 매칭(하남검단산)으로 preferred=[h1] → 출발 판정되었을 상황.
    // 선호가 지정되면 후보를 선호 밖으로 넓히지 않으므로 pool이 비어 미출발이어야 한다.
    const hanam = arriving('h1', 15, { lineId: '5', finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [hanam],
      next: [],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: ['마천'] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('선호가 빈 배열이면 기존 방면 동작과 동일하다', () => {
    const hanam = arriving('h1', 15, { lineId: '5', finalDestination: '하남검단산' });
    const result = detectDeparture({
      prev: [hanam],
      next: [],
      awaited: { lineId: '5', directionName: '하남검단산', preferredDestinations: [] },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'h1' });
  });
});
