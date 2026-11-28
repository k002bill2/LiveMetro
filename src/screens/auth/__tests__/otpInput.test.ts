import { distributeOtpDigits, extractInsertedDigits, OtpCellSelection } from '@/screens/auth/otpInput';

const CELLS = ['1', '2', '3', '4', '5', '6'] as const;
const sel = (start: number, end: number, value = '3'): OtpCellSelection => ({ start, end, value });
const apply = (next: string, selection: OtpCellSelection | null): string =>
  distributeOtpDigits(CELLS, 2, extractInsertedDigits('3', next, selection)).cells.join('');

describe('otpInput (#379)', () => {
  it.each([
    ['98', '129856'],
    ['98765', '129876'],
    ['38', '123856'],
    ['83', '128356'],
    ['33', '123356'],
    ['5', '125456'],
  ])('selected (0,1) + %s → %s', (next, expected) => {
    expect(apply(next, sel(0, 1))).toBe(expected);
  });

  it.each([
    ['398', '129856'],
    ['35', '125456'],
  ])('cursor end (1,1) + %s → %s', (next, expected) => {
    expect(apply(next, sel(1, 1))).toBe(expected);
  });

  it('cursor front (0,0) + 53 → 125456', () => {
    expect(apply('53', sel(0, 0))).toBe('125456');
  });

  it.each([
    ['654321', sel(0, 1)],
    ['3654321', sel(1, 1)],
    ['3654321', null],
  ])('full code %s fills from the first cell', (next, selection) => {
    expect(apply(next, selection)).toBe('654321');
  });

  it('empty value clears only the current cell', () => {
    expect(distributeOtpDigits(CELLS, 2, extractInsertedDigits('3', '', sel(1, 1))).cells).toEqual([
      '1', '2', '', '4', '5', '6',
    ]);
  });

  it('falls back to cursor-end when the recorded selection is stale or post-change', () => {
    // 기록 시점 값이 다르면(다른 값일 때 기록된 선택) 버린다.
    expect(apply('398', sel(0, 1, '9'))).toBe('129856');
    // 변경 후 선택(이전 값 길이 밖)이 먼저 기록돼도 범위 가드로 버리고 커서 끝을 가정한다.
    expect(apply('398', sel(3, 3))).toBe('129856');
    expect(apply('39', null)).toBe('129456');
  });

  it.each([
    [sel(1, 1), '5', '125456'],
    [sel(2, 2), '98', '129856'],
    [sel(2, 2), '38', '123856'],
  ])('uses the earlier (0,1) selection when a post-change %j arrives first (%s → %s)', (latest, next, expected) => {
    expect(distributeOtpDigits(CELLS, 2, extractInsertedDigits('3', next, latest, sel(0, 1))).cells.join('')).toBe(expected);
  });

  it('infers from content when no selection is usable', () => {
    expect(apply('53', null)).toBe('125456');
    expect(apply('98', null)).toBe('129856');
  });

  it('does not mutate the input cells and reports the next focus cell', () => {
    const cells = [...CELLS];
    const single = distributeOtpDigits(cells, 2, '9');
    expect(cells).toEqual([...CELLS]);
    expect(single.focusIndex).toBe(3);
    expect(distributeOtpDigits(cells, 5, '9').focusIndex).toBeNull();
    expect(distributeOtpDigits(cells, 2, '98').focusIndex).toBe(4);
    expect(distributeOtpDigits(cells, 2, '98765').focusIndex).toBe(5);
  });
});
