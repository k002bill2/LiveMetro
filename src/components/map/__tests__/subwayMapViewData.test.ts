/**
 * subwayMapViewData tests — static adapter from subwayMapData (STATIONS /
 * LINE_STATIONS / LINE_COLORS) into the shape SubwayMapView expects. Pure
 * module constants, so we assert on the produced data.
 */
import { SUBWAY_MAP_STATIONS, SUBWAY_MAP_LINES } from '../subwayMapViewData';

describe('subwayMapViewData', () => {
  it('maps STATIONS into SubwayMapView station shape with schematic coords', () => {
    const s = SUBWAY_MAP_STATIONS.find((st) => st.id === 'seoul');
    expect(s).toBeDefined();
    expect(typeof s!.x).toBe('number');
    expect(typeof s!.y).toBe('number');
    expect(s!.name.length).toBeGreaterThan(0);
    expect(Array.isArray(s!.lineIds)).toBe(true);
  });

  it('flags multi-line stations as transfers and single-line as non-transfer', () => {
    const transfer = SUBWAY_MAP_STATIONS.find((st) => st.lineIds.length > 1);
    expect(transfer?.isTransfer).toBe(true);
    const single = SUBWAY_MAP_STATIONS.find((st) => st.lineIds.length === 1);
    expect(single?.isTransfer).toBe(false);
  });

  it('builds line segments from consecutive stations with the line color', () => {
    expect(SUBWAY_MAP_LINES.length).toBeGreaterThan(0);
    const seg = SUBWAY_MAP_LINES[0]!;
    expect(seg.fromStation).not.toBe(seg.toStation);
    expect(typeof seg.color).toBe('string');
    expect(seg.color.length).toBeGreaterThan(0);
    expect(seg.lineId.length).toBeGreaterThan(0);
  });

  it('produces a non-empty station set', () => {
    expect(SUBWAY_MAP_STATIONS.length).toBeGreaterThan(0);
  });
});
