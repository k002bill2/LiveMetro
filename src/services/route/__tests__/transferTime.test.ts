/**
 * transferTime — Phase D: 환승 시간 역별 테이블 lookup
 *
 * API:
 *   getTransferTime(stationId: string): number
 *
 * 테이블에 정의된 역은 그 값을, 없으면 DEFAULT_TRANSFER_TIME (4분) 반환.
 * 양방향 환승은 대칭으로 간주 (Phase D 초기 cut).
 */

import { getTransferTime, DEFAULT_TRANSFER_TIME } from '../transferTime';

describe('getTransferTime', () => {
  it('DEFAULT_TRANSFER_TIME exported as 4 (기존 AVG_TRANSFER_TIME 유지)', () => {
    expect(DEFAULT_TRANSFER_TIME).toBe(4);
  });

  it('시청 (1↔2, city_hall_1) → 5분', () => {
    expect(getTransferTime('city_hall_1')).toBe(5);
  });

  it('충무로 (3↔4, chungmuro) → 2분 (같은 플랫폼, notably short)', () => {
    expect(getTransferTime('chungmuro')).toBe(2);
  });

  it('동대문역사문화공원 (2↔4↔5) → 7분 (notably long)', () => {
    expect(getTransferTime('dongdaemun_hist')).toBe(7);
  });

  it('신도림 (1↔2) → 3분', () => {
    expect(getTransferTime('sindorim')).toBe(3);
  });

  it('unknown station → DEFAULT_TRANSFER_TIME (4)', () => {
    expect(getTransferTime('nonexistent_station_xyz')).toBe(4);
  });

  it('table value differs from default — proves table lookup is active', () => {
    // If lookup were broken and always returned default, this would fail
    expect(getTransferTime('chungmuro')).not.toBe(DEFAULT_TRANSFER_TIME);
    expect(getTransferTime('dongdaemun_hist')).not.toBe(DEFAULT_TRANSFER_TIME);
  });

  it('consistent across calls', () => {
    const a = getTransferTime('city_hall_1');
    const b = getTransferTime('city_hall_1');
    expect(a).toBe(b);
  });
});
