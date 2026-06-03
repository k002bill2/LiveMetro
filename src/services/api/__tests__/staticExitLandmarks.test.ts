/**
 * staticExitLandmarks tests
 *
 * Issue #173: odcloud 출구별주요장소 API(15073460)는 키 등록이 필요하고 web 에선
 * CORS 로 막힌다. stationAccessibility 와 동일하게 빌드타임에 정적 JSON 으로 베이크한
 * 테이블을 fallback SoT 로 사용한다. 이 로더는 그 테이블의 graceful 조회를 책임진다.
 */

import type { ExitLandmark } from '@/models/publicData';

describe('staticExitLandmarks', () => {
  afterEach(() => {
    jest.resetModules();
  });

  describe('empty seed (shipped default)', () => {
    it('returns [] for any station when stations table is empty', () => {
      // 실제 번들된 빈 seed(src/data/exitLandmarks.json)를 그대로 사용.
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('서울역')).toEqual([]);
      expect(getStaticExitLandmarks('강남')).toEqual([]);
    });
  });

  describe('populated table', () => {
    const seoulExits: ExitLandmark[] = [
      {
        stationCode: '1251',
        stationName: '서울역',
        lineNum: '경의선',
        exitNumber: '1',
        landmarkName: '서울로7017',
        category: 'culture',
      },
      {
        stationCode: '1251',
        stationName: '서울역',
        lineNum: '경의선',
        exitNumber: '2',
        landmarkName: '롯데마트 서울역점',
        category: 'shopping',
      },
    ];

    beforeEach(() => {
      jest.resetModules();
      jest.doMock('@/data/exitLandmarks.json', () => ({
        generatedAt: '2026-06-03T00:00:00.000Z',
        source: 'TEST',
        stations: { 서울역: seoulExits },
      }));
    });

    it('returns the landmark list for a known station', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      const result = getStaticExitLandmarks('서울역');
      expect(result).toHaveLength(2);
      expect(result[0].landmarkName).toBe('서울로7017');
      expect(result[1].exitNumber).toBe('2');
    });

    it('returns [] for a station not in the table', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('없는역')).toEqual([]);
    });

    it('returns a defensive copy — mutating the result does not corrupt the table', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      const first = getStaticExitLandmarks('서울역');
      first.push({
        stationCode: 'X', stationName: '서울역', lineNum: '경의선',
        exitNumber: '99', landmarkName: 'mutation', category: 'shopping',
      });
      const second = getStaticExitLandmarks('서울역');
      expect(second).toHaveLength(2);
    });
  });

  describe('malformed table', () => {
    it('returns [] when the stations key is missing entirely', () => {
      jest.resetModules();
      jest.doMock('@/data/exitLandmarks.json', () => ({
        generatedAt: '2026-06-03T00:00:00.000Z',
        source: 'TEST',
        // stations 키 없음 — graceful 하게 빈 테이블로 처리해야 함
      }));
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('서울역')).toEqual([]);
    });
  });
});
