/**
 * directionOptions 단위 테스트 — 실데이터(lines.json/stations.json) 기반.
 * 시안 #2 방면 세그먼트의 인접역 도출 로직 검증.
 */

import { getDirectionOptions } from '../directionOptions';

describe('getDirectionOptions', () => {
  it('returns both neighbor directions for a mid-line station (강남/2호선)', () => {
    const options = getDirectionOptions('2', '강남');
    expect(options).toEqual(['역삼 방면', '교대 방면']);
  });

  it('wraps around the loop for line 2 endpoints (시청)', () => {
    const options = getDirectionOptions('2', '시청');
    // 배열상 첫 역이지만 순환선이므로 이전 방면은 마지막 역(충정로)으로 wrap.
    expect(options).toHaveLength(2);
    expect(options[0]).toBe('충정로 방면');
  });

  it('returns a single direction for a true terminus (non-loop line)', () => {
    // 9호선 등 비순환 노선의 종착역은 한 방향만 존재한다.
    const options = getDirectionOptions('9', '개화');
    expect(options).toHaveLength(1);
    expect(options[0]).toMatch(/방면$/);
  });

  it('accepts station names with 역 suffix', () => {
    expect(getDirectionOptions('2', '강남역')).toEqual(['역삼 방면', '교대 방면']);
  });

  it('returns empty array for unknown station', () => {
    expect(getDirectionOptions('2', '없는역이름')).toEqual([]);
  });

  it('returns empty array for unknown line', () => {
    expect(getDirectionOptions('99', '강남')).toEqual([]);
  });

  it('returns empty array for empty station name', () => {
    expect(getDirectionOptions('2', '')).toEqual([]);
  });
});
