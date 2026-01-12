/**
 * Test Stations Data
 *
 * 개발 모드에서 사용할 고정 역 데이터입니다.
 * 실제 API 호출 없이 빠르게 테스트할 수 있습니다.
 *
 * 나중에 전체 역 데이터로 확장할 때:
 * 1. seoulStations.json을 TypeScript 배열로 변환
 * 2. USE_TEST_STATIONS 플래그를 false로 변경
 */

import { Station } from '@models/train';

/**
 * 개발 모드에서 테스트용 고정역 사용 여부
 * true: 아래 TEST_STATIONS만 사용 (API 호출 없음)
 * false: 실제 API/Firebase에서 데이터 로드
 */
// 실제 역 데이터를 사용하려면 false로 설정
// true: 테스트용 3개 역만 사용 (강남, 홍대입구, 서울역)
// false: Firebase/API에서 전체 역 데이터 로드
export const USE_TEST_STATIONS = false;

/**
 * 테스트용 고정 역 데이터 (3개역)
 * - 강남역: 2호선 대표역
 * - 홍대입구역: 2호선 + 경의중앙선 환승역
 * - 서울역: 1호선 + 4호선 + 경의중앙선 환승역
 */
export const TEST_STATIONS: Station[] = [
  {
    id: '0222',
    name: '강남',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: {
      latitude: 37.4979,
      longitude: 127.0276,
    },
    transfers: [],
    stationCode: '222',
  },
  {
    id: '0239',
    name: '홍대입구',
    nameEn: 'Hongik Univ.',
    lineId: '2',
    coordinates: {
      latitude: 37.5571,
      longitude: 126.9245,
    },
    transfers: ['K314'], // 경의중앙선
    stationCode: '239',
  },
  {
    id: '0150',
    name: '서울역',
    nameEn: 'Seoul Station',
    lineId: '1',
    coordinates: {
      latitude: 37.5547,
      longitude: 126.9706,
    },
    transfers: ['0426', 'K110'], // 4호선, 경의중앙선
    stationCode: '150',
  },
];

/**
 * ID로 역 조회를 위한 Map
 */
export const TEST_STATION_MAP = new Map<string, Station>(
  TEST_STATIONS.map(station => [station.id, station])
);

/**
 * 이름으로 역 조회를 위한 Map
 */
export const TEST_STATION_BY_NAME = new Map<string, Station>(
  TEST_STATIONS.map(station => [station.name, station])
);

/**
 * 노선별 역 조회를 위한 Map
 */
export const TEST_STATIONS_BY_LINE = TEST_STATIONS.reduce((acc, station) => {
  const existing = acc.get(station.lineId) || [];
  acc.set(station.lineId, [...existing, station]);
  return acc;
}, new Map<string, Station[]>());

/**
 * 테스트 역 데이터에서 역 검색
 */
export function searchTestStations(query: string): Station[] {
  const normalizedQuery = query.toLowerCase().trim();
  return TEST_STATIONS.filter(
    station =>
      station.name.toLowerCase().includes(normalizedQuery) ||
      station.nameEn.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * 테스트 역 데이터에서 ID로 역 조회
 */
export function getTestStationById(id: string): Station | null {
  return TEST_STATION_MAP.get(id) || null;
}

/**
 * 테스트 역 데이터에서 이름으로 역 조회
 */
export function getTestStationByName(name: string): Station | null {
  return TEST_STATION_BY_NAME.get(name) || null;
}

/**
 * 테스트 역 데이터에서 노선별 역 조회
 */
export function getTestStationsByLine(lineId: string): Station[] {
  return TEST_STATIONS_BY_LINE.get(lineId) || [];
}
