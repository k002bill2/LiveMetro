/**
 * Stations Data Service Tests
 */

import {
  getLocalStation,
  getLocalStationByName,
  searchLocalStations,
  getAllLocalStations,
  getLocalStationsByLine,
  getAvailableLocalLineIds,
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

  describe('getAvailableLocalLineIds', () => {
    it('returns data-backed line ids including non-numeric subway lines', () => {
      const lineIds = getAvailableLocalLineIds();

      expect(lineIds.slice(0, 9)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      expect(lineIds).toContain('신분당선');
      expect(lineIds).toContain('공항철도');
      expect(lineIds).toContain('GTX-A');
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

    it('should include non-numeric lines from the local station dataset', () => {
      const stations = getStationsWithLineInfo();
      const lineIds = new Set(stations.map(s => s.lineId));

      expect(lineIds).toContain('2');
      expect(lineIds).toContain('신분당선');
      expect(lineIds).toContain('공항철도');
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

  // seoulStations.json은 노선별로 행이 분리돼 있다(강남 = 02호선 행 + 신분당선 행).
  // 같은 역명의 다른 line_num을 모으면 환승 노선을 로컬만으로 도출할 수 있다.
  // 이전에는 항상 `transfers: []`였고, Firestore 조회가 실패하는 오프라인
  // 상황에서 StationCard의 환승 배지가 통째로 사라졌다.
  describe('transfers (환승 노선 로컬 도출)', () => {
    it('환승역은 자기 노선을 뺀 나머지 노선을 transfers로 갖는다', () => {
      const gangnam = getLocalStation('강남');
      expect(gangnam).not.toBeNull();
      // 어느 노선 행이 캐시에 남든 (lineId + transfers) 합집합은 동일하다.
      const allLines = new Set([gangnam!.lineId, ...gangnam!.transfers]);
      expect(allLines).toEqual(new Set(['2', '신분당선']));
      expect(gangnam!.transfers).not.toContain(gangnam!.lineId);
    });

    it('3개 이상 노선이 만나는 역도 전부 담는다', () => {
      const jongno3ga = getLocalStation('종로3가');
      expect(jongno3ga).not.toBeNull();
      const allLines = new Set([jongno3ga!.lineId, ...jongno3ga!.transfers]);
      expect(allLines).toEqual(new Set(['1', '3', '5']));
      expect(jongno3ga!.transfers).toHaveLength(2);
    });

    it('단일 노선 역의 transfers는 빈 배열이다', () => {
      const bangbae = getLocalStation('방배');
      expect(bangbae).not.toBeNull();
      expect(bangbae!.transfers).toEqual([]);
    });

    it('노선별 목록으로 얻은 역도 transfers를 갖는다', () => {
      const line2 = getLocalStationsByLine('2');
      const gangnam = line2.find((s) => s.name === '강남');
      expect(gangnam).toBeDefined();
      expect(gangnam!.transfers).toContain('신분당선');
    });

    it('중복 노선을 넣지 않는다 (같은 노선 복수 행 방어)', () => {
      const wangsimni = getLocalStation('왕십리');
      expect(wangsimni).not.toBeNull();
      const unique = new Set(wangsimni!.transfers);
      expect(unique.size).toBe(wangsimni!.transfers.length);
    });
  });
});
