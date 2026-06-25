import { resolveActiveCommuteType } from '@utils/commuteSchedule';

/** 로컬 wall-clock 시각으로 Date 생성 — getHours()가 hour를 그대로 반환(TZ-safe). */
const at = (hour: number, minute = 0): Date =>
  new Date(2026, 5, 26, hour, minute, 0, 0);

describe('resolveActiveCommuteType', () => {
  it('05:59 → morning (새벽, 다음 이동=출근)', () => {
    expect(resolveActiveCommuteType(at(5, 59))).toBe('morning');
  });
  it('06:00 → morning (출근 active 시작)', () => {
    expect(resolveActiveCommuteType(at(6, 0))).toBe('morning');
  });
  it('10:59 → morning (출근 구간 내)', () => {
    expect(resolveActiveCommuteType(at(10, 59))).toBe('morning');
  });
  it('11:00 → evening (다음 이동=퇴근으로 전환)', () => {
    expect(resolveActiveCommuteType(at(11, 0))).toBe('evening');
  });
  it('16:59 → evening (오후, 퇴근 다가옴)', () => {
    expect(resolveActiveCommuteType(at(16, 59))).toBe('evening');
  });
  it('17:00 → evening (퇴근 active 시작)', () => {
    expect(resolveActiveCommuteType(at(17, 0))).toBe('evening');
  });
  it('22:59 → evening (퇴근 구간 내)', () => {
    expect(resolveActiveCommuteType(at(22, 59))).toBe('evening');
  });
  it('23:00 → morning (다음 이동=출근으로 복귀)', () => {
    expect(resolveActiveCommuteType(at(23, 0))).toBe('morning');
  });
  it('00:00 → morning (자정, 출근 다가옴)', () => {
    expect(resolveActiveCommuteType(at(0, 0))).toBe('morning');
  });
  it('03:00 → morning (심야, 출근 다가옴)', () => {
    expect(resolveActiveCommuteType(at(3, 0))).toBe('morning');
  });
});
