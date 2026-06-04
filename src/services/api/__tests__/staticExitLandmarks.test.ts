/**
 * staticExitLandmarks tests
 *
 * Issue #173: 출구 데이터는 국가철도공단_서울교통공사 출구별 주요 장소 CSV 를
 * 빌드타임에 정적 JSON 으로 베이크해 SoT 로 쓴다. 저장 구조는 번들 크기를 위해
 * 역명 → 출구번호 → 시설명[] 컴팩트 맵이며, 이 로더가 stationName·exitNumber 를
 * 채워 ExitLandmark[] 로 복원한다. 본 테스트는 그 복원/조회를 검증한다.
 */

describe('staticExitLandmarks', () => {
  afterEach(() => {
    jest.resetModules();
  });

  describe('shipped dataset (populated from CSV)', () => {
    it('returns the exit landmark list for a known station (서울역)', () => {
      // 실제 번들된 exitLandmarks.json 을 그대로 사용한다.
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      const result = getStaticExitLandmarks('서울역');
      expect(result.length).toBeGreaterThan(0);
      // 복원된 엔트리는 stationName·exitNumber·landmarkName 을 갖는다.
      expect(result[0]).toEqual(
        expect.objectContaining({
          stationName: '서울역',
          exitNumber: expect.any(String),
          landmarkName: expect.any(String),
        }),
      );
    });

    it('returns [] for a station not in the dataset', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('존재하지않는역명ABC')).toEqual([]);
    });
  });

  describe('compact table reconstruction', () => {
    // 컴팩트 저장 구조: 역명 → 출구번호 → 시설명[]
    const seoulExits = {
      '1': ['서울로7017'],
      '2': ['롯데마트 서울역점', '서울역우체국'],
    };

    beforeEach(() => {
      jest.resetModules();
      jest.doMock('@/data/exitLandmarks.json', () => ({
        generatedAt: '2026-06-03T00:00:00.000Z',
        source: 'TEST',
        stations: { 서울역: seoulExits },
      }));
    });

    it('reconstructs one ExitLandmark per facility, injecting stationName/exitNumber', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      const result = getStaticExitLandmarks('서울역');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ stationName: '서울역', exitNumber: '1', landmarkName: '서울로7017' });
      expect(result[1]).toEqual({ stationName: '서울역', exitNumber: '2', landmarkName: '롯데마트 서울역점' });
      expect(result[2]).toEqual({ stationName: '서울역', exitNumber: '2', landmarkName: '서울역우체국' });
    });

    it('returns [] for a station not in the table', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('없는역')).toEqual([]);
    });

    it('returns fresh objects — mutating the result does not corrupt the table', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      const first = getStaticExitLandmarks('서울역');
      first.push({ stationName: '서울역', exitNumber: '99', landmarkName: 'mutation' });
      const second = getStaticExitLandmarks('서울역');
      expect(second).toHaveLength(3);
    });
  });

  describe('역-suffix fallback (서울 → 서울역)', () => {
    // 좌표가 동일한 GTX-A "서울" 노드(stations.json s_9005)를 탭하면 stationName 이
    // "서울"(역 suffix 없음)로 들어온다. 실시간 API 는 부분매칭으로 살지만 출구는
    // exact 키 "서울역"과 어긋나 빈다 → 역-suffix fallback 으로 매칭한다.
    it('resolves a 역-less name to the "역" key in the real dataset', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      const canonical = getStaticExitLandmarks('서울역');
      const variant = getStaticExitLandmarks('서울');
      expect(canonical.length).toBeGreaterThan(0);
      expect(variant.length).toBe(canonical.length);
      expect(variant[0].stationName).toBe('서울역');
    });

    it('trims surrounding whitespace before lookup', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('  서울역  ').length).toBeGreaterThan(0);
    });

    it('does not falsely match when neither exact nor +역 key exists', () => {
      const { getStaticExitLandmarks } = require('../staticExitLandmarks');
      expect(getStaticExitLandmarks('존재하지않는역명')).toEqual([]);
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
