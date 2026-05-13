/**
 * lines.json schema invariants
 *
 * 분기 노선 schema (string[][]) 도입 후 데이터 자기 일관성 검증.
 * 각 PR마다 자동 실행되어 schema normal form을 강제함.
 */

import linesData from '../lines.json';
import stationsData from '../stations.json';

interface StationData {
  id: string;
  name: string;
  lines: string[];
}

const stations = stationsData as Record<string, StationData>;

type LineStations = string[] | string[][];
const linesStations = linesData.stations as Record<string, LineStations>;

describe('lines.json schema invariants', () => {
  it('각 lineId의 stations는 string[] 또는 string[][] (mixed 금지)', () => {
    Object.entries(linesStations).forEach(([lineId, raw]) => {
      if (!Array.isArray(raw)) {
        throw new Error(`${lineId}: not an array`);
      }
      if (raw.length === 0) return; // 빈 노선 (uisinseol 등) 허용

      const isFlat = raw.every(x => typeof x === 'string');
      const isNested = raw.every(x => Array.isArray(x));

      if (!isFlat && !isNested) {
        throw new Error(`${lineId}: mixed string/array elements`);
      }
    });
  });

  it('nested 노선의 각 subarray는 비어있지 않음', () => {
    Object.entries(linesStations).forEach(([lineId, raw]) => {
      if (!Array.isArray(raw) || raw.length === 0) return;
      if (typeof raw[0] === 'string') return; // flat은 skip

      (raw as string[][]).forEach((seg, idx) => {
        expect(seg.length).toBeGreaterThan(0);
        if (seg.length === 0) {
          throw new Error(`${lineId}[${idx}]: empty subarray`);
        }
      });
    });
  });

  it('각 line 안의 모든 station id는 stations.json에 존재', () => {
    Object.entries(linesStations).forEach(([lineId, raw]) => {
      if (!Array.isArray(raw)) return;
      const flat: string[] =
        raw.length === 0 || typeof raw[0] === 'string'
          ? (raw as string[])
          : (raw as string[][]).flat();

      flat.forEach(stationId => {
        expect(stations[stationId]).toBeDefined();
        if (!stations[stationId]) {
          throw new Error(`${lineId}: station ${stationId} not in stations.json`);
        }
      });
    });
  });

  it('각 line 안의 station은 stations.json[id].lines에 해당 lineId 포함', () => {
    Object.entries(linesStations).forEach(([lineId, raw]) => {
      if (!Array.isArray(raw)) return;
      const flat: string[] =
        raw.length === 0 || typeof raw[0] === 'string'
          ? (raw as string[])
          : (raw as string[][]).flat();

      flat.forEach(stationId => {
        const station = stations[stationId];
        if (!station) return; // 이전 invariant에서 catch
        if (!station.lines.includes(lineId)) {
          throw new Error(
            `${lineId}: station ${stationId} (${station.name}) lacks lineId in stations.json`
          );
        }
      });
    });
  });
});
