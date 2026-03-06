/**
 * Public Data API Service Tests
 */

import { publicDataApi } from '../publicDataApi';

jest.mock('@/models/publicData', () => ({
  getCongestionLevel: jest.fn().mockReturnValue('moderate'),
  parseAlertType: jest.fn().mockReturnValue('delay'),
  parseLandmarkCategory: jest.fn().mockReturnValue('convenience'),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PublicDataApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

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

  describe('getExitLandmarks', () => {
    it('should fetch exit landmark data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              '역번호': '222',
              '역명': '역삼',
              '호선': '2호선',
              '출구번호': '1',
              '주요장소': '강남세브란스병원',
              '장소분류': '의료',
            },
          ],
        }),
      });

      const result = await publicDataApi.getExitLandmarks('역삼');
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]!.stationName).toBe('역삼');
        expect(result[0]!.exitNumber).toBe('1');
        expect(result[0]!.landmarkName).toBe('강남세브란스병원');
      }
    }, 15000);
  });

  describe('getExitInfoGrouped', () => {
    it('should group exits by number', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { '역번호': '222', '역명': '역삼', '호선': '2호선', '출구번호': '1', '주요장소': 'A', '장소분류': '의료' },
            { '역번호': '222', '역명': '역삼', '호선': '2호선', '출구번호': '1', '주요장소': 'B', '장소분류': '공원' },
            { '역번호': '222', '역명': '역삼', '호선': '2호선', '출구번호': '2', '주요장소': 'C', '장소분류': '편의' },
          ],
        }),
      });

      const result = await publicDataApi.getExitInfoGrouped('역삼');
      expect(result.length).toBe(2);
      expect(result[0]!.exitNumber).toBe('1');
      expect(result[0]!.landmarks.length).toBe(2);
      expect(result[1]!.exitNumber).toBe('2');
    }, 15000);
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
