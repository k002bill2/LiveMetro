/**
 * Current-location map DATA CONTRACT (integration, no mocks).
 *
 * The unit tests mock the seams (SubwayMapView, resolveInternalStationId), so
 * they cannot prove the feature's one job actually wires up against real data.
 * This file checks the two joints that decide whether a highlight ever appears
 * and whether the map can render without dropping/crashing:
 *
 *   1. Referential integrity — every SUBWAY_MAP_LINES endpoint exists in the
 *      station id set (SubwayMapView drops segments whose endpoints miss, so a
 *      gap = silently missing lines).
 *   2. End-to-end id mapping — a real nearby-search station id
 *      (trainService.getStationsByLine → getLocalStationsByLine) must
 *      resolveInternalStationId() into the schematic map's id set, or the
 *      "you are here" highlight never lands.
 */
import { SUBWAY_MAP_STATIONS, SUBWAY_MAP_LINES } from '../subwayMapViewData';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import { getLocalStationsByLine } from '@services/data/stationsDataService';

const stationIdSet = new Set(SUBWAY_MAP_STATIONS.map((s) => s.id));

describe('current-location map data contract', () => {
  it('has every line segment endpoint present in the station id set', () => {
    const missing = SUBWAY_MAP_LINES.filter(
      (seg) => !stationIdSet.has(seg.fromStation) || !stationIdSet.has(seg.toStation),
    );
    expect(missing).toEqual([]);
  });

  it('resolves real nearby-search station ids into the schematic map id set', () => {
    const sample = ['1', '2', '3', '4', '5'].flatMap((lineId) =>
      getLocalStationsByLine(lineId),
    );
    expect(sample.length).toBeGreaterThan(0);

    const landed = sample.filter((st) => {
      const slug = resolveInternalStationId(st.id);
      return slug != null && stationIdSet.has(slug);
    });

    // The highlight requires this mapping. Allow a small tail of niche stations
    // that may legitimately be absent from the schematic data.
    expect(landed.length / sample.length).toBeGreaterThan(0.9);
  });
});
