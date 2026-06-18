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

  it('degrades to manual on an extended (non-numbered) line without a direction', () => {
    const result = detectDeparture({
      prev: [arriving('K', 5, { lineId: 'K2' })],
      next: [],
      awaited: { lineId: 'K2', directionName: null },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });

  it('detects departure on an extended line when the direction matches', () => {
    const result = detectDeparture({
      prev: [
        arriving('match', 5, { lineId: 'K2', finalDestination: '청량리' }),
        arriving('other', 5, { lineId: 'K2', finalDestination: '인천' }),
      ],
      next: [arriving('other', 0, { lineId: 'K2', finalDestination: '인천' })],
      awaited: { lineId: 'K2', directionName: '청량리' },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: true, trainId: 'match' });
  });

  it('does NOT detect departure on an extended line when the matching train remains', () => {
    const result = detectDeparture({
      prev: [arriving('match', 5, { lineId: 'K2', finalDestination: '청량리' })],
      next: [arriving('match', 0, { lineId: 'K2', finalDestination: '청량리' })],
      awaited: { lineId: 'K2', directionName: '청량리' },
      nowMs: NOW,
    });
    expect(result).toEqual({ departed: false, trainId: null });
  });
});
