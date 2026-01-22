/**
 * Stations Data Service Tests
 */

import {
  getLocalStation,
  getLocalStationByName,
  searchLocalStations,
  getAllLocalStations,
  getLocalStationsByLine,
  getStationsWithLineInfo,
  searchStationsWithLineInfo,
  findStationCdByNameAndLine,
} from '../stationsDataService';

describe('stationsDataService', () => {
  describe('getLocalStation', () => {
    it('should return station by station_cd', () => {
      const station = getLocalStation('0222');
      expect(station).not.toBeNull();
      expect(station?.name).toBe('강남');
    });

    it('should return station by Korean name', () => {
      const station = getLocalStation('강남');
      expect(station).not.toBeNull();
      expect(station?.id).toBeTruthy();
    });

    it('should return station by English name (lowercase)', () => {
      const station = getLocalStation('gangnam');
      expect(station).not.toBeNull();
      expect(station?.name).toBe('강남');
    });

    it('should return null for non-existent station', () => {
      const station = getLocalStation('nonexistent_station_12345');
      expect(station).toBeNull();
    });
  });

  describe('getLocalStationByName', () => {
    it('should return station by name', () => {
      const station = getLocalStationByName('서울역');
      expect(station).not.toBeNull();
    });

    it('should return null for non-existent name', () => {
      const station = getLocalStationByName('없는역');
      expect(station).toBeNull();
    });
  });

  describe('searchLocalStations', () => {
    it('should return stations matching Korean query', () => {
      const results = searchLocalStations('강남');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(s => s.name.includes('강남'))).toBe(true);
    });

    it('should return stations matching English query', () => {
      const results = searchLocalStations('gangnam');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty query', () => {
      const results = searchLocalStations('');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace query', () => {
      const results = searchLocalStations('   ');
      expect(results).toEqual([]);
    });

    it('should return empty array for non-matching query', () => {
      const results = searchLocalStations('xyznonexistent123');
      expect(results).toEqual([]);
    });
  });

  describe('getAllLocalStations', () => {
    it('should return all stations', () => {
      const stations = getAllLocalStations();
      expect(stations.length).toBeGreaterThan(100); // Should have many stations
    });

    it('should return stations with required properties', () => {
      const stations = getAllLocalStations();
      expect(stations[0]).toHaveProperty('id');
      expect(stations[0]).toHaveProperty('name');
      expect(stations[0]).toHaveProperty('lineId');
    });
  });

  describe('getLocalStationsByLine', () => {
    it('should return stations for line 2', () => {
      const stations = getLocalStationsByLine('2');
      expect(stations.length).toBeGreaterThan(0);
      expect(stations.every(s => s.lineId === '2')).toBe(true);
    });

    it('should return stations for line 1', () => {
      const stations = getLocalStationsByLine('1');
      expect(stations.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent line', () => {
      const stations = getLocalStationsByLine('999');
      expect(stations).toEqual([]);
    });

    it('should return stations sorted by fr_code', () => {
      const stations = getLocalStationsByLine('2');
      // Stations should be in order
      expect(stations.length).toBeGreaterThan(2);
    });
  });

  describe('getStationsWithLineInfo', () => {
    it('should return stations with line info', () => {
      const stations = getStationsWithLineInfo();
      expect(stations.length).toBeGreaterThan(0);
    });

    it('should include lineName property', () => {
      const stations = getStationsWithLineInfo();
      expect(stations[0]).toHaveProperty('lineName');
      expect(stations[0]?.lineName).toMatch(/^\d호선$/);
    });

    it('should only include lines 1-9', () => {
      const stations = getStationsWithLineInfo();
      const lineIds = new Set(stations.map(s => s.lineId));

      lineIds.forEach(lineId => {
        expect(['1', '2', '3', '4', '5', '6', '7', '8', '9']).toContain(lineId);
      });
    });
  });

  describe('searchStationsWithLineInfo', () => {
    it('should return matching stations with line info', () => {
      const results = searchStationsWithLineInfo('강남');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('lineName');
    });

    it('should return empty array for empty query', () => {
      const results = searchStationsWithLineInfo('');
      expect(results).toEqual([]);
    });

    it('should search by English name', () => {
      const results = searchStationsWithLineInfo('seoul');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('findStationCdByNameAndLine', () => {
    it('should find station_cd by Korean name and line', () => {
      const stationCd = findStationCdByNameAndLine('강남', '2');
      expect(stationCd).toBe('0222');
    });

    it('should find station_cd by English name and line', () => {
      const stationCd = findStationCdByNameAndLine('Gangnam', '2');
      expect(stationCd).toBe('0222');
    });

    it('should return null for wrong line', () => {
      const stationCd = findStationCdByNameAndLine('강남', '1');
      expect(stationCd).toBeNull();
    });

    it('should return null for non-existent station', () => {
      const stationCd = findStationCdByNameAndLine('없는역', '2');
      expect(stationCd).toBeNull();
    });

    it('should return null for non-existent line', () => {
      const stationCd = findStationCdByNameAndLine('강남', '999');
      expect(stationCd).toBeNull();
    });
  });
});
