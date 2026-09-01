/**
 * departedTrainLog — 출발 열차 로그(관측/추정) 순수 함수 + heap 스토어 테스트.
 *
 * 대기(board/transfer) 단계 30초 폴링 스냅샷에서 사라진 "도착 중" 열차를
 * 출발로 기록(observed)하고, 탑승 확정 순간의 마지막 스냅샷은 추정(estimated)
 * 출발 시각으로 보관한다. dedup(관측 우선)·15분 prune·내림차순 정렬.
 */
import {
  collectDepartures,
  collectEstimates,
  mergeLog,
  appendDepartedTrains,
  getDepartedTrainLog,
  clearDepartedTrainLog,
  DEPARTED_LOG_RETENTION_MS,
  ESTIMATED_DWELL_MS,
  type DepartedTrainEntry,
} from '../departedTrainLog';
import { TrainStatus, type Train } from '@/models/train';

const NOW = 1_700_000_000_000;
const STATION = '을지로3가';

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

describe('collectDepartures', () => {
  it('records an arriving train (eta 20s) that vanished from next as observed', () => {
    const result = collectDepartures({
      prev: [arriving('A', 20)],
      next: [arriving('B', 180)],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([
      {
        trainId: 'A',
        finalDestination: '성수',
        lineId: '2',
        stationName: STATION,
        departedAtMs: NOW,
        confidence: 'observed',
      },
    ]);
  });

  it('records nothing when the arriving train still remains in next', () => {
    const result = collectDepartures({
      prev: [arriving('A', 20)],
      next: [arriving('A', 0)],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('ignores a vanished train beyond the arriving threshold (eta 60s)', () => {
    const result = collectDepartures({
      prev: [arriving('A', 60)],
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('ignores trains with null arrivalTime', () => {
    const result = collectDepartures({
      prev: [train({ id: 'A', arrivalTime: null })],
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('returns [] when prev is null (first snapshot)', () => {
    const result = collectDepartures({
      prev: null,
      next: [arriving('A', 10)],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('excludes a vanished other-line train on a numbered line', () => {
    const result = collectDepartures({
      prev: [arriving('L3', 10, { lineId: '3' })],
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  // 예전 사양은 "확장 노선은 전량 통과"였고, 픽스처도 존재하지 않는 'K2'를 썼다.
  // 환승역 스냅샷은 역 단위라 그 통과분이 타 노선 출발로 로그에 쌓였다 —
  // 이제 확장 노선도 숫자 노선과 같은 canonical 필터를 받는다.
  it('records a vanished train on an extended line when the canonical line matches', () => {
    const result = collectDepartures({
      prev: [arriving('K', 10, { lineId: '수인분당선', finalDestination: '청량리' })],
      next: [],
      lineId: '수인분당선',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([
      {
        trainId: 'K',
        finalDestination: '청량리',
        lineId: '수인분당선',
        stationName: STATION,
        departedAtMs: NOW,
        confidence: 'observed',
      },
    ]);
  });

  it('excludes a vanished other-line train on an extended line (환승역 다노선 혼입)', () => {
    const result = collectDepartures({
      prev: [
        arriving('L2', 10, { lineId: '2', finalDestination: '성수' }),
        arriving('SB', 10, { lineId: '수인분당선', finalDestination: '청량리' }),
      ],
      next: [],
      lineId: '수인분당선',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['SB']);
  });

  it('matches the graph slug lineId against the normalized Train.lineId domain', () => {
    const result = collectDepartures({
      prev: [arriving('SB', 10, { lineId: '수인분당선', finalDestination: '청량리' })],
      next: [],
      lineId: 'bundang',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['SB']);
  });

  it('returns [] for an unknown or empty lineId instead of passing everything (fail-closed)', () => {
    const prev = [arriving('SB', 10, { lineId: '수인분당선', finalDestination: '청량리' })];
    expect(
      collectDepartures({ prev, next: [], lineId: 'K2', stationName: STATION, nowMs: NOW })
    ).toEqual([]);
    expect(
      collectDepartures({ prev, next: [], lineId: '', stationName: STATION, nowMs: NOW })
    ).toEqual([]);
  });

  // 회귀: 위치 API 커버리지로 도착 소속을 판정하던 시절엔 인천2 대기 중 출발이 하나도
  // 기록되지 않아 "방금 출발한 열차" 선택 후보가 전멸했다. 도착 스냅샷엔 존재하는
  // 노선이므로 같은 노선 출발은 기록하고 타 노선만 걸러야 한다.
  it('위치 API 미지원 노선(인천2)의 출발은 기록하고 타 노선 출발은 제외한다', () => {
    const result = collectDepartures({
      prev: [
        arriving('L2', 10, { lineId: '2', finalDestination: '성수' }),
        arriving('I2', 10, { lineId: '인천2', finalDestination: '검단오류' }),
      ],
      next: [],
      lineId: 'incheon2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['I2']);
  });

  it('records every departed candidate when two vanish', () => {
    const result = collectDepartures({
      prev: [arriving('A', 10), arriving('B', 20)],
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['A', 'B']);
    expect(result.every(e => e.confidence === 'observed')).toBe(true);
  });

  // 30초 폴링에서 prev의 ETA≈0 열차는 nowMs 시점엔 ETA가 음수가 된다 —
  // lookback으로 후보를 살리고 출발 시각을 arrival+dwell로 정밀화한다.
  it('records a train that had already arrived (eta -40s) and refines departedAtMs to arrival + dwell', () => {
    const result = collectDepartures({
      prev: [arriving('A', -40)], // arrived 40s ago
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toHaveLength(1);
    // arrival(NOW-40s) + dwell(30s) = NOW-10s ≤ nowMs → used as-is
    expect(result[0]?.departedAtMs).toBe(NOW - 40_000 + ESTIMATED_DWELL_MS);
    expect(result[0]?.confidence).toBe('observed');
  });

  it('clamps departedAtMs to nowMs when arrival + dwell would land in the future', () => {
    const result = collectDepartures({
      prev: [arriving('A', -20)], // arrived 20s ago → arrival+dwell = NOW+10s
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.departedAtMs).toBe(NOW);
  });

  it('excludes a train whose arrival is older than the lookback window (eta -70s)', () => {
    const result = collectDepartures({
      prev: [arriving('A', -70)],
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('keeps departedAtMs = nowMs for a still-approaching train (eta 20s) that vanished', () => {
    const result = collectDepartures({
      prev: [arriving('A', 20)],
      next: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.departedAtMs).toBe(NOW);
  });
});

describe('collectEstimates', () => {
  it('records eta 90s train with departedAtMs = arrival + dwell', () => {
    const t = arriving('A', 90);
    const result = collectEstimates({
      trains: [t],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([
      {
        trainId: 'A',
        finalDestination: '성수',
        lineId: '2',
        stationName: STATION,
        departedAtMs: (t.arrivalTime as Date).getTime() + ESTIMATED_DWELL_MS,
        confidence: 'estimated',
      },
    ]);
  });

  it('excludes a train with negative eta', () => {
    const result = collectEstimates({
      trains: [arriving('A', -5)],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('excludes a train with null arrivalTime', () => {
    const result = collectEstimates({
      trains: [train({ id: 'A', arrivalTime: null })],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('returns [] for an empty snapshot', () => {
    const result = collectEstimates({
      trains: [],
      lineId: '2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result).toEqual([]);
  });

  it('keeps an extended-line train whose canonical line matches', () => {
    const t = arriving('SB', 90, { lineId: '수인분당선', finalDestination: '청량리' });
    const result = collectEstimates({
      trains: [t],
      lineId: 'bundang',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['SB']);
  });

  it('excludes an other-line train on an extended line (환승역 다노선 혼입)', () => {
    const result = collectEstimates({
      trains: [
        arriving('L2', 90, { lineId: '2', finalDestination: '성수' }),
        arriving('SB', 90, { lineId: '수인분당선', finalDestination: '청량리' }),
      ],
      lineId: '수인분당선',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['SB']);
  });

  it('keeps a same-line arrival train on a position-unsupported line (인천2)', () => {
    const result = collectEstimates({
      trains: [
        arriving('L2', 90, { lineId: '2', finalDestination: '성수' }),
        arriving('I2', 90, { lineId: '인천2', finalDestination: '검단오류' }),
      ],
      lineId: 'incheon2',
      stationName: STATION,
      nowMs: NOW,
    });
    expect(result.map(e => e.trainId)).toEqual(['I2']);
  });

  it('returns [] for an unknown or empty lineId instead of passing everything (fail-closed)', () => {
    const trains = [arriving('SB', 90, { lineId: '수인분당선', finalDestination: '청량리' })];
    expect(collectEstimates({ trains, lineId: 'K2', stationName: STATION, nowMs: NOW })).toEqual([]);
    expect(collectEstimates({ trains, lineId: '', stationName: STATION, nowMs: NOW })).toEqual([]);
    expect(
      collectEstimates({ trains, lineId: 'incheon2', stationName: STATION, nowMs: NOW })
    ).toEqual([]);
  });
});

describe('mergeLog', () => {
  const observed = (trainId: string, departedAtMs: number): DepartedTrainEntry => ({
    trainId,
    finalDestination: '성수',
    lineId: '2',
    stationName: STATION,
    departedAtMs,
    confidence: 'observed',
  });
  const estimated = (trainId: string, departedAtMs: number): DepartedTrainEntry => ({
    ...observed(trainId, departedAtMs),
    confidence: 'estimated',
  });

  it('lets observed win over estimated for the same trainId', () => {
    const log = [estimated('A', NOW - 1000)];
    const incoming = [observed('A', NOW - 2000)];
    const result = mergeLog(log, incoming, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.confidence).toBe('observed');
    expect(result[0]?.departedAtMs).toBe(NOW - 2000);
  });

  it('prunes entries older than the retention window (16 min)', () => {
    const log = [observed('OLD', NOW - 16 * 60 * 1000)];
    const incoming = [observed('NEW', NOW - 60 * 1000)];
    const result = mergeLog(log, incoming, NOW);
    expect(result.map(e => e.trainId)).toEqual(['NEW']);
  });

  it('sorts merged entries by departedAtMs descending', () => {
    const result = mergeLog(
      [observed('A', NOW - 5000)],
      [observed('B', NOW - 1000), observed('C', NOW - 9000)],
      NOW
    );
    expect(result.map(e => e.trainId)).toEqual(['B', 'A', 'C']);
  });

  it('does not mutate the input arrays', () => {
    const log = [observed('A', NOW - 5000)];
    const incoming = [observed('B', NOW - 1000)];
    const logSnapshot = [observed('A', NOW - 5000)];
    const incomingSnapshot = [observed('B', NOW - 1000)];
    mergeLog(log, incoming, NOW);
    expect(log).toEqual(logSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it('picks the larger departedAtMs when confidences are equal', () => {
    const result = mergeLog([observed('A', NOW - 5000)], [observed('A', NOW - 1000)], NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.departedAtMs).toBe(NOW - 1000);
  });

  it('keeps entries with the same trainId at different stations (station-scoped dedup)', () => {
    const atX: DepartedTrainEntry = { ...observed('T', NOW - 1000), stationName: '역X' };
    const atY: DepartedTrainEntry = { ...observed('T', NOW - 2000), stationName: '역Y' };
    const result = mergeLog([atX], [atY], NOW);
    expect(result).toHaveLength(2);
    expect(result.map(e => e.stationName).sort()).toEqual(['역X', '역Y']);
  });
});

describe('departedTrainLog heap store', () => {
  afterEach(() => {
    clearDepartedTrainLog();
  });

  const entry = (trainId: string, departedAtMs: number): DepartedTrainEntry => ({
    trainId,
    finalDestination: '성수',
    lineId: '2',
    stationName: STATION,
    departedAtMs,
    confidence: 'observed',
  });

  it('reflects appended entries in get', () => {
    appendDepartedTrains([entry('A', NOW - 1000)], NOW);
    expect(getDepartedTrainLog().map(e => e.trainId)).toEqual(['A']);
  });

  it('empties the log on clear', () => {
    appendDepartedTrains([entry('A', NOW - 1000)], NOW);
    clearDepartedTrainLog();
    expect(getDepartedTrainLog()).toEqual([]);
  });

  it('keeps the existing log when appending an empty batch', () => {
    appendDepartedTrains([entry('A', NOW - 1000)], NOW);
    appendDepartedTrains([], NOW);
    expect(getDepartedTrainLog().map(e => e.trainId)).toEqual(['A']);
  });

  it('prunes stale entries on append via the retention window', () => {
    appendDepartedTrains([entry('OLD', NOW - DEPARTED_LOG_RETENTION_MS - 1000)], NOW);
    appendDepartedTrains([entry('NEW', NOW - 1000)], NOW);
    expect(getDepartedTrainLog().map(e => e.trainId)).toEqual(['NEW']);
  });
});
