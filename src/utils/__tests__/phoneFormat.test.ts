import { toE164KR } from '../phoneFormat';

describe('toE164KR', () => {
  it('converts a valid 11-digit mobile number to E.164 by stripping the leading 0', () => {
    expect(toE164KR('01012345678')).toBe('+821012345678');
  });

  it('throws when the input is shorter than 11 digits', () => {
    expect(() => toE164KR('010123456')).toThrow(/11자리/);
  });

  it('throws when the input is longer than 11 digits', () => {
    expect(() => toE164KR('010123456789')).toThrow(/11자리/);
  });

  it('throws when the input does not start with 010', () => {
    expect(() => toE164KR('02012345678')).toThrow(/010으로 시작/);
  });
});
