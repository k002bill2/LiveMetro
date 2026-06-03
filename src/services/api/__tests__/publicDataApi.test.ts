/**
 * Public Data API Service Tests
 */

import { publicDataApi } from '../publicDataApi';
import { getStaticExitLandmarks } from '../staticExitLandmarks';
import type { ExitLandmark } from '@/models/publicData';

jest.mock('@/models/publicData', () => ({
  getCongestionLevel: jest.fn().mockReturnValue('moderate'),
  parseAlertType: jest.fn().mockReturnValue('delay'),
  parseLandmarkCategory: jest.fn().mockReturnValue('convenience'),
}));

// Issue #173: 출구 라이브 API(odcloud 15073460)는 키 등록 필요 + web CORS 차단.
// publicDataApi 는 정적 fallback 테이블을 통해 빈 화면을 막는다. 테스트에서는
// 정적 로더를 mock 해 fallback 경로를 결정적으로 검증한다.
jest.mock('../staticExitLandmarks', () => ({
  getStaticExitLandmarks: jest.fn((): ExitLandmark[] => []),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PublicDataApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // TODO(혼잡도): 실시간 혼잡도 소스 비활성 — getCongestionInfo / getCurrentCongestion
  //   메서드가 주석 처리되어 아래 두 describe 블록도 함께 비활성. 서울시 AI 실시간
  //   혼잡도 소스 공개 후 메서드 복원 시 이 블록 주석(/* */)도 해제.
  /*
  describe('getCongestionInfo', () => {
    it('should fetch and convert congestion data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          currentCount: 1,
          data: [
            {
              '역명': '역삼',
              '호선': '2호선',
              '상하구분': '상선',
              '요일구분': '평일',
              '6시00분': '30',
              '7시00분': '50',
              '8시00분': '80',
            },
          ],
        }),
      });

      const result = await publicDataApi.getCongestionInfo('역삼');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]!.stationName).toBe('역삼');
        expect(result[0]!.lineNum).toBe('2호선');
        expect(result[0]!.direction).toBe('up');
        // dayType is parsed from '평일' string
        expect(['weekday', 'saturday', 'holiday']).toContain(result[0]!.dayType);
      }
    }, 15000);

    it('should handle HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(publicDataApi.getCongestionInfo('역삼')).rejects.toThrow();
    }, 15000);

    it('should parse saturday day type', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { '역명': '역삼', '호선': '2호선', '상하구분': '하선', '요일구분': '토요일' },
          ],
        }),
      });

      const result = await publicDataApi.getCongestionInfo('역삼');
      if (result.length > 0) {
        expect(result[0]!.dayType).toBe('saturday');
        expect(result[0]!.direction).toBe('down');
      }
    }, 15000);

    it('should parse holiday day type', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { '역명': '역삼', '호선': '2호선', '상하구분': '상선', '요일구분': '일요일/공휴일' },
          ],
        }),
      });

      const result = await publicDataApi.getCongestionInfo('역삼');
      if (result.length > 0) {
        expect(result[0]!.dayType).toBe('holiday');
      }
    }, 15000);
  });

  describe('getCurrentCongestion', () => {
    it('should return current congestion data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              '역명': '강남',
              '호선': '2호선',
              '상하구분': '상선',
              '요일구분': '평일',
              '8시00분': '75',
            },
          ],
        }),
      });

      await publicDataApi.getCurrentCongestion('강남', 'up');
      // Result depends on current time/day matching
    }, 15000);

    it('should return null on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValue(new Error('Network fail'));

      const result = await publicDataApi.getCurrentCongestion('강남', 'up');
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    }, 15000);
  });
  */

  // Issue #173: jsdom 테스트 환경은 isWebPlatform()=true 라 라이브 fetch 경로가
  // 아니라 정적 fallback 경로를 탄다(실제 web 사용자와 동일). 따라서 정적 로더를
  // mock 해 fallback 동작을 검증한다.
  const exitLandmark = (
    exitNumber: string,
    landmarkName: string,
  ): ExitLandmark => ({
    stationCode: '1251',
    stationName: '서울역',
    lineNum: '경의선',
    exitNumber,
    landmarkName,
    category: 'shopping',
  });

  describe('getExitLandmarks', () => {
    it('returns the static fallback dataset (web/jsdom path) instead of an empty array', async () => {
      (getStaticExitLandmarks as jest.Mock).mockReturnValue([
        exitLandmark('1', '서울로7017'),
        exitLandmark('2', '롯데마트 서울역점'),
      ]);

      const result = await publicDataApi.getExitLandmarks('서울역');

      expect(getStaticExitLandmarks).toHaveBeenCalledWith('서울역');
      expect(result).toHaveLength(2);
      expect(result[0]!.landmarkName).toBe('서울로7017');
      expect(result[1]!.exitNumber).toBe('2');
    });

    it('returns [] when the static table has no entry for the station', async () => {
      (getStaticExitLandmarks as jest.Mock).mockReturnValue([]);

      const result = await publicDataApi.getExitLandmarks('데이터없는역');

      expect(result).toEqual([]);
    });
  });

  describe('getExitInfoGrouped', () => {
    it('groups static fallback landmarks by exit number, sorted ascending', async () => {
      (getStaticExitLandmarks as jest.Mock).mockReturnValue([
        exitLandmark('1', 'A'),
        exitLandmark('1', 'B'),
        exitLandmark('2', 'C'),
      ]);

      const result = await publicDataApi.getExitInfoGrouped('서울역');

      expect(result.length).toBe(2);
      expect(result[0]!.exitNumber).toBe('1');
      expect(result[0]!.landmarks.length).toBe(2);
      expect(result[1]!.exitNumber).toBe('2');
      expect(result[1]!.landmarks.length).toBe(1);
    });

    it('returns [] when the static fallback is empty', async () => {
      (getStaticExitLandmarks as jest.Mock).mockReturnValue([]);

      const result = await publicDataApi.getExitInfoGrouped('데이터없는역');

      expect(result).toEqual([]);
    });
  });

  describe('deprecated schedule methods', () => {
    it('getTrainSchedule should return empty array with warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await publicDataApi.getTrainSchedule('역삼', '2');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      warnSpy.mockRestore();
    });

    it('getTodaySchedule should return empty array with warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await publicDataApi.getTodaySchedule('역삼', '2');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      warnSpy.mockRestore();
    });

    it('getUpcomingTrains should return empty array with warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await publicDataApi.getUpcomingTrains('역삼', '2', '1');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      warnSpy.mockRestore();
    });
  });

  describe('getActiveAlerts', () => {
    it('should filter only active alerts', async () => {
      // In jsdom, isWebPlatform() may be true, but getAlerts uses withRetry
      // Provide a valid mock response for the alerts endpoint
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: {
            body: {
              items: [
                {
                  ntceId: 'a1',
                  ntceTtl: 'Test',
                  ntceCn: 'Content',
                  routNm: '2호선',
                  ntceTp: 'delay',
                  ntceSdt: '2020-01-01',
                  ntceEdt: '2030-01-01',
                },
              ],
            },
          },
        }),
      });

      const result = await publicDataApi.getActiveAlerts();
      expect(Array.isArray(result)).toBe(true);
    }, 15000);
  });

  describe('getAlertsByLine', () => {
    it('should return alerts for specific line', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: {
            body: {
              items: [
                {
                  ntceId: 'a1',
                  ntceTtl: 'Test',
                  ntceCn: 'Content',
                  routNm: '2호선',
                  ntceTp: 'delay',
                  ntceSdt: '2020-01-01',
                  ntceEdt: '2030-01-01',
                },
              ],
            },
          },
        }),
      });

      const result = await publicDataApi.getAlertsByLine('2호선');
      expect(Array.isArray(result)).toBe(true);
    }, 15000);
  });
});
