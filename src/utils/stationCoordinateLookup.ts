/**
 * stationCoordinateLookup — Phase B: stationId → LatLng | null
 *
 * 3-tier data join:
 *   stations.json (named id)  → name (한글)
 *   seoulStations.json (name) → station_cd (Seoul Metro 4자리 코드)
 *   stationCoordinates.json   → {latitude, longitude}
 *
 * 모듈 로드 시 lookup map을 한 번 빌드하고 캐싱. 누락 시 null 반환.
 */

import stationsJson from '@/data/stations.json';
import seoulStationsJson from '@/data/seoulStations.json';
import stationCoordinatesJson from '@/data/stationCoordinates.json';
import type { LatLng } from './haversine';

interface SeoulStationRecord {
  readonly station_cd: string;
  readonly station_nm: string;
}

interface SeoulStationsJsonShape {
  readonly DATA: readonly SeoulStationRecord[];
}

interface StationsRecord {
  readonly id: string;
  readonly name: string;
}

const buildNameToStationCd = (): Map<string, string> => {
  const map = new Map<string, string>();
  for (const record of (seoulStationsJson as unknown as SeoulStationsJsonShape).DATA) {
    // Multi-line stations share the same physical location; first cd is sufficient.
    if (!map.has(record.station_nm)) {
      map.set(record.station_nm, record.station_cd);
    }
  }
  return map;
};

const buildStationIdToCoords = (): Map<string, LatLng> => {
  const nameToCd = buildNameToStationCd();
  const coordsData = stationCoordinatesJson as Record<string, LatLng>;
  const result = new Map<string, LatLng>();

  for (const record of Object.values(stationsJson as Record<string, StationsRecord>)) {
    const cd = nameToCd.get(record.name);
    if (!cd) continue;
    const coords = coordsData[cd];
    if (!coords) continue;
    result.set(record.id, coords);
  }
  return result;
};

const STATION_ID_TO_COORDS = buildStationIdToCoords();

export function getStationCoordinates(stationId: string): LatLng | null {
  return STATION_ID_TO_COORDS.get(stationId) ?? null;
}
