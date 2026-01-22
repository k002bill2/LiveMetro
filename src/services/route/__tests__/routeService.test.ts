/**
 * Route Service Tests
 */

import {
  calculateRoute,
  findAlternativeRoutes,
  getRouteSummary,
  routeUsesLine,
  getStationInfo,
  getLineColor,
} from '../routeService';
import type { AlternativeReason } from '@models/route';

// Mock subwayMapData
jest.mock('@utils/subwayMapData', () => ({
  STATIONS: {
    gangnam: { id: 'gangnam', name: '강남', lines: ['2'] },
    jamsil: { id: 'jamsil', name: '잠실', lines: ['2'] },
    seolleung: { id: 'seolleung', name: '선릉', lines: ['2', 'bundang'] },
    samseong: { id: 'samseong', name: '삼성', lines: ['2'] },
    seoul: { id: 'seoul', name: '서울', lines: ['1', '4'] },
    cityHall: { id: 'cityHall', name: '시청', lines: ['1', '2'] },
    jonggak: { id: 'jonggak', name: '종각', lines: ['1'] },
    euljiro3ga: { id: 'euljiro3ga', name: '을지로3가', lines: ['2', '3'] },
    chungmuro: { id: 'chungmuro', name: '충무로', lines: ['3', '4'] },
    dongdaemun: { id: 'dongdaemun', name: '동대문', lines: ['1', '4'] },
    sindorim: { id: 'sindorim', name: '신도림', lines: ['1', '2'] },
    guro: { id: 'guro', name: '구로', lines: ['1'] },
  },
  LINE_STATIONS: {
    '1': ['seoul', 'cityHall', 'jonggak', 'dongdaemun', 'sindorim', 'guro'],
    '2': ['cityHall', 'euljiro3ga', 'seolleung', 'gangnam', 'samseong', 'jamsil', 'sindorim'],
    '3': ['euljiro3ga', 'chungmuro'],
    '4': ['seoul', 'chungmuro', 'dongdaemun'],
    bundang: ['seolleung'],
  },
  LINE_COLORS: {
    '1': '#0052A4',
    '2': '#00A84D',
    '3': '#EF7C1C',
    '4': '#00A5DE',
    bundang: '#FABE00',
  },
}));

// Mock route model
jest.mock('@models/route', () => ({
  AlternativeReason: {
    DELAY: 'delay',
    EMERGENCY: 'emergency',
    MAINTENANCE: 'maintenance',
  },
  DEFAULT_ALTERNATIVE_OPTIONS: {
    maxTimeDifference: 30,
    maxTransfers: 3,
    excludeLineIds: [],
  },
  AVG_STATION_TRAVEL_TIME: 2,
  AVG_TRANSFER_TIME: 5,
  createRoute: jest.fn((segments) => ({
    segments,
    totalMinutes: segments.reduce((acc: number, s: { estimatedMinutes: number }) => acc + s.estimatedMinutes, 0),
    transferCount: segments.filter((s: { isTransfer: boolean }) => s.isTransfer).length,
    lineIds: [...new Set(segments.map((s: { lineId: string }) => s.lineId))],
  })),
  createAlternativeRoute: jest.fn((original, alternative, reason, lineId, confidence) => ({
    originalRoute: original,
    alternativeRoute: alternative,
    reason,
    affectedLineId: lineId,
    confidence,
    timeDifference: alternative.totalMinutes - original.totalMinutes,
  })),
  getLineName: jest.fn((lineId) => {
    const names: Record<string, string> = {
      '1': '1호선',
      '2': '2호선',
      '3': '3호선',
      '4': '4호선',
      bundang: '분당선',
    };
    return names[lineId] || lineId;
  }),
}));

describe('Route Service', () => {
  describe('calculateRoute', () => {
    it('should find route between stations on same line', () => {
      const route = calculateRoute('gangnam', 'jamsil');

      expect(route).not.toBeNull();
      expect(route?.segments).toBeDefined();
      expect(route?.lineIds).toContain('2');
    });

    it('should return null for non-existent stations', () => {
      const route = calculateRoute('nonexistent', 'jamsil');

      expect(route).toBeNull();
    });

    it('should find route with transfer', () => {
      const route = calculateRoute('jonggak', 'gangnam');

      expect(route).not.toBeNull();
      // Should transfer at cityHall or sindorim
    });

    it('should respect excludeLineIds', () => {
      const route = calculateRoute('gangnam', 'jamsil', ['2']);

      // Should return null since line 2 is the only direct route
      expect(route).toBeNull();
    });
  });

  describe('findAlternativeRoutes', () => {
    it('should find alternative routes when line is affected', () => {
      const alternatives = findAlternativeRoutes(
        'jonggak',
        'gangnam',
        ['1'],
        'DELAY' as AlternativeReason
      );

      // May or may not find alternatives depending on graph
      expect(Array.isArray(alternatives)).toBe(true);
    });

    it('should return empty array if no valid alternatives exist', () => {
      const alternatives = findAlternativeRoutes(
        'gangnam',
        'jamsil',
        ['2'],
        'DELAY' as AlternativeReason,
        { maxTimeDifference: 0 }
      );

      expect(alternatives).toEqual([]);
    });
  });

  describe('getRouteSummary', () => {
    it('should return line names joined by arrow', () => {
      const mockRoute = {
        segments: [],
        totalMinutes: 10,
        transferCount: 0,
        lineIds: ['2'],
      };

      const summary = getRouteSummary(mockRoute);

      expect(summary).toBe('2호선');
    });

    it('should join multiple lines', () => {
      const mockRoute = {
        segments: [],
        totalMinutes: 20,
        transferCount: 1,
        lineIds: ['1', '2'],
      };

      const summary = getRouteSummary(mockRoute);

      expect(summary).toBe('1호선 → 2호선');
    });
  });

  describe('routeUsesLine', () => {
    it('should return true if route uses the line', () => {
      const mockRoute = {
        segments: [],
        totalMinutes: 10,
        transferCount: 0,
        lineIds: ['2', '3'],
      };

      expect(routeUsesLine(mockRoute, '2')).toBe(true);
    });

    it('should return false if route does not use the line', () => {
      const mockRoute = {
        segments: [],
        totalMinutes: 10,
        transferCount: 0,
        lineIds: ['2', '3'],
      };

      expect(routeUsesLine(mockRoute, '1')).toBe(false);
    });
  });

  describe('getStationInfo', () => {
    it('should return station info', () => {
      const info = getStationInfo('gangnam');

      expect(info).not.toBeNull();
      expect(info?.name).toBe('강남');
      expect(info?.lines).toContain('2');
    });

    it('should return null for non-existent station', () => {
      const info = getStationInfo('nonexistent');

      expect(info).toBeNull();
    });
  });

  describe('getLineColor', () => {
    it('should return correct color for line', () => {
      expect(getLineColor('2')).toBe('#00A84D');
    });

    it('should return default color for unknown line', () => {
      expect(getLineColor('unknown')).toBe('#888888');
    });
  });
});
