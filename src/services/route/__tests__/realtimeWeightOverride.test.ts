/**
 * realtimeWeightOverride — Phase C: 출발역 실시간 도착 정보로 대기시간 계산
 *
 * Pure function:
 *   getNextTrainWaitMinutes(arrivals, lineId) → minutes | null
 *
 * Returns:
 *   - null: 해당 lineId에 대한 도착 정보 없음 (호출자가 static schedule fallback)
 *   - 0: 도착 임박 (≤ 60s) 또는 이미 지난 시간 (방금 떠남, 다음 곧 도착)
 *   - N: ceil(seconds / 60), 다음 열차까지 분
 */

import { getNextTrainWaitMinutes } from '../realtimeWeightOverride';

describe('getNextTrainWaitMinutes', () => {
  it('empty arrivals → null', () => {
    expect(getNextTrainWaitMinutes([], '2')).toBeNull();
  });

  it('lineId not present → null (caller falls back to static schedule)', () => {
    const arrivals = [{ lineId: '1', secondsUntilArrival: 120 }];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBeNull();
  });

  it('seconds = 60 → 1 minute', () => {
    const arrivals = [{ lineId: '2', secondsUntilArrival: 60 }];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(1);
  });

  it('seconds = 90 → 2 minutes (ceil)', () => {
    const arrivals = [{ lineId: '2', secondsUntilArrival: 90 }];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(2);
  });

  it('seconds = 0 → 0 (arriving now)', () => {
    const arrivals = [{ lineId: '2', secondsUntilArrival: 0 }];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(0);
  });

  it('seconds = -10 → 0 (just departed, clamp to 0)', () => {
    const arrivals = [{ lineId: '2', secondsUntilArrival: -10 }];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(0);
  });

  it('multiple entries for same line → earliest (min secondsUntilArrival)', () => {
    const arrivals = [
      { lineId: '2', secondsUntilArrival: 300 },
      { lineId: '2', secondsUntilArrival: 45 },
      { lineId: '2', secondsUntilArrival: 600 },
    ];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(1); // ceil(45/60) = 1
  });

  it('multiple lines, returns only matching lineId', () => {
    const arrivals = [
      { lineId: '1', secondsUntilArrival: 30 },
      { lineId: '2', secondsUntilArrival: 180 },
    ];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(3);
    expect(getNextTrainWaitMinutes(arrivals, '1')).toBe(1);
  });

  it('seconds = 3600 → 60 minutes (large value)', () => {
    const arrivals = [{ lineId: '2', secondsUntilArrival: 3600 }];
    expect(getNextTrainWaitMinutes(arrivals, '2')).toBe(60);
  });
});
