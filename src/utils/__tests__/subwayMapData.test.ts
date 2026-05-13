/**
 * Subway Map Data Tests
 */

import {
  STATIONS,
  LINE_COLORS,
  LINE_STATIONS,
  MAP_WIDTH,
  MAP_HEIGHT,
  generateLinePathData,
  getStationByName,
  isTransferStation,
  getTransferStations,
  getStationById,
  getLineColor,
  getStationsForLine,
  lineStationSet,
} from '../subwayMapData';

describe('subwayMapData', () => {
  describe('Constants', () => {
    it('should have map dimensions', () => {
      expect(MAP_WIDTH).toBe(4900);
      expect(MAP_HEIGHT).toBe(4400);
    });

    it('should have stations data', () => {
      expect(typeof STATIONS).toBe('object');
      expect(Object.keys(STATIONS).length).toBeGreaterThan(0);
    });

    it('should have line colors', () => {
      expect(typeof LINE_COLORS).toBe('object');
      expect(LINE_COLORS['1']).toBeDefined();
      expect(LINE_COLORS['2']).toBeDefined();
    });

    it('should have line stations', () => {
      expect(typeof LINE_STATIONS).toBe('object');
      expect(LINE_STATIONS['1']).toBeDefined();
      expect(Array.isArray(LINE_STATIONS['1'])).toBe(true);
    });
  });

  describe('Station data structure', () => {
    it('should have valid station objects', () => {
      const stationIds = Object.keys(STATIONS);
      expect(stationIds.length).toBeGreaterThan(0);

      const firstStation = STATIONS[stationIds[0]!];
      expect(firstStation).toBeDefined();
      expect(firstStation!.id).toBeDefined();
      expect(firstStation!.name).toBeDefined();
      expect(typeof firstStation!.x).toBe('number');
      expect(typeof firstStation!.y).toBe('number');
      expect(Array.isArray(firstStation!.lines)).toBe(true);
    });

    it('should have Seoul Station', () => {
      const seoul = STATIONS['seoul'];
      expect(seoul).toBeDefined();
      expect(seoul!.name).toBe('서울역');
    });
  });

  describe('generateLinePathData', () => {
    it('should return array of line path data', () => {
      const paths = generateLinePathData();
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should have valid path structure', () => {
      const paths = generateLinePathData();
      const path = paths[0]!;
      expect(path.lineId).toBeDefined();
      expect(path.color).toBeDefined();
      expect(Array.isArray(path.segments)).toBe(true);
      expect(Array.isArray(path.stations)).toBe(true);
    });

    it('should start each line path with M segment', () => {
      const paths = generateLinePathData();
      paths.forEach(path => {
        if (path.segments.length > 0) {
          expect(path.segments[0]!.type).toBe('M');
        }
      });
    });

    it('should have L segments after first M', () => {
      const paths = generateLinePathData();
      const pathWithMultiple = paths.find(p => p.segments.length > 1);
      expect(pathWithMultiple).toBeDefined();
      if (pathWithMultiple && pathWithMultiple.segments.length > 1) {
        expect(pathWithMultiple.segments[1]!.type).toBe('L');
      }
    });

    it('should close loop for Line 2', () => {
      const paths = generateLinePathData();
      const line2 = paths.find(p => p.lineId === '2');
      if (line2 && line2.segments.length > 2) {
        const lastSegment = line2.segments[line2.segments.length - 1]!;
        const firstSegment = line2.segments[0]!;
        // Last segment should return to first station
        expect(lastSegment.points[0]).toBe(firstSegment.points[0]);
        expect(lastSegment.points[1]).toBe(firstSegment.points[1]);
      }
    });
  });

  describe('getStationByName', () => {
    it('should find station by Korean name', () => {
      const station = getStationByName('서울역');
      expect(station).toBeDefined();
      expect(station!.id).toBe('seoul');
    });

    it('should find station by English name', () => {
      const station = getStationByName('Seoul Station');
      if (station) {
        expect(station.name).toBe('서울역');
      }
    });

    it('should return undefined for unknown name', () => {
      const station = getStationByName('존재하지않는역');
      expect(station).toBeUndefined();
    });
  });

  describe('isTransferStation', () => {
    it('should return true for transfer stations', () => {
      // Find a known transfer station
      const transferStations = Object.values(STATIONS).filter(s => s.lines.length > 1);
      if (transferStations.length > 0) {
        expect(isTransferStation(transferStations[0]!.id)).toBe(true);
      }
    });

    it('should return false for non-transfer stations', () => {
      const nonTransfer = Object.values(STATIONS).find(s => s.lines.length === 1);
      if (nonTransfer) {
        expect(isTransferStation(nonTransfer.id)).toBe(false);
      }
    });

    it('should return false for unknown station', () => {
      expect(isTransferStation('unknown_station')).toBe(false);
    });
  });

  describe('getTransferStations', () => {
    it('should return array of transfer stations', () => {
      const transfers = getTransferStations();
      expect(Array.isArray(transfers)).toBe(true);
    });

    it('should only include multi-line stations', () => {
      const transfers = getTransferStations();
      transfers.forEach(station => {
        expect(station.lines.length).toBeGreaterThan(1);
      });
    });
  });

  describe('getStationById', () => {
    it('should return station for valid ID', () => {
      const station = getStationById('seoul');
      expect(station).toBeDefined();
      expect(station!.name).toBe('서울역');
    });

    it('should return undefined for invalid ID', () => {
      const station = getStationById('invalid_id');
      expect(station).toBeUndefined();
    });
  });

  describe('getLineColor', () => {
    it('should return color for valid line', () => {
      const color = getLineColor('1');
      expect(typeof color).toBe('string');
      expect(color).not.toBe('#888888');
    });

    it('should return fallback color for unknown line', () => {
      const color = getLineColor('unknown');
      expect(color).toBe('#888888');
    });
  });

  describe('getStationsForLine', () => {
    it('should return stations for valid line', () => {
      const stations = getStationsForLine('1');
      expect(Array.isArray(stations)).toBe(true);
      expect(stations.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown line', () => {
      const stations = getStationsForLine('unknown');
      expect(stations).toEqual([]);
    });

    it('should return valid station objects', () => {
      const stations = getStationsForLine('1');
      if (stations.length > 0) {
        expect(stations[0]!.id).toBeDefined();
        expect(stations[0]!.name).toBeDefined();
        expect(typeof stations[0]!.x).toBe('number');
      }
    });
  });

  describe('LINE_STATIONS nested shape', () => {
    it('LINE_STATIONS[lineId] is an array of subarrays (string[][])', () => {
      const line1 = LINE_STATIONS['1']!;
      expect(Array.isArray(line1)).toBe(true);
      expect(line1.length).toBeGreaterThan(0);
      // Each element is a subarray of station ids
      expect(Array.isArray(line1[0])).toBe(true);
      expect(typeof line1[0]![0]).toBe('string');
    });

    it('lineStationSet returns membership Set for existing line', () => {
      const set1 = lineStationSet('1');
      expect(set1).toBeInstanceOf(Set);
      expect(set1.size).toBeGreaterThan(0);
      // Each member is a station id from line 1's flat union
      const flatLine1 = LINE_STATIONS['1']!.flat();
      flatLine1.forEach(id => expect(set1.has(id)).toBe(true));
    });

    it('lineStationSet returns empty Set for non-existent line', () => {
      const setNone = lineStationSet('nonexistent_line_id_xyz');
      expect(setNone).toBeInstanceOf(Set);
      expect(setNone.size).toBe(0);
    });

    it('getStationsForLine dedupes stations across subarrays', () => {
      // Current data has all single-segment lines, so dedupe is a no-op
      // for now. This test asserts the contract — when branched lines
      // arrive (Task 9 gyeongui), the same test will catch dedupe regressions.
      const stations1 = getStationsForLine('1');
      const ids = stations1.map(s => s.id);
      const uniqIds = new Set(ids);
      expect(ids.length).toBe(uniqIds.size); // no duplicates
    });
  });
});
