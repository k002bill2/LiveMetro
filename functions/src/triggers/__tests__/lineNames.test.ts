/**
 * lineNames Tests — server-side lineId → display name allowlist.
 */
import { getLineDisplayName, LINE_DISPLAY_NAMES } from '../lineNames';

describe('getLineDisplayName', () => {
  it.each([
    ['1', '1호선'],
    ['9', '9호선'],
    ['수인분당선', '수인분당선'],
    ['신분당선', '신분당선'],
    ['공항철도', '공항철도'],
    ['인천2', '인천2호선'],
    ['인천선', '인천선'],
    ['GTX-A', 'GTX-A'],
  ])('maps %p to %p', (lineId, name) => {
    expect(getLineDisplayName(lineId)).toBe(name);
  });

  it.each([
    ['constructor'],
    ['__proto__'],
    ['toString'],
    ['hasOwnProperty'],
    ['valueOf'],
    ['evil'],
    [''],
    ['10'],
    ['02'],
  ])('returns null for unknown/prototype key %p', (lineId) => {
    expect(getLineDisplayName(lineId)).toBeNull();
  });

  it.each([[2], [null], [undefined], [{}], [['1']]])(
    'returns null for non-string input %p',
    (lineId) => {
      expect(getLineDisplayName(lineId)).toBeNull();
    },
  );

  it('covers the 24 client lineIds produced by stationsDataService', () => {
    expect(LINE_DISPLAY_NAMES.size).toBe(24);
  });
});
