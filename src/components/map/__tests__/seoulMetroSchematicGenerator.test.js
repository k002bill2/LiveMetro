const {
  buildInternalStationMappings,
  buildSeoulMetroSchematicMap,
  normalizeStationName,
} = require('../../../../scripts/seoulMetroSchematicGenerator.cjs');

const rawFixture = `
var lines = {
  "2-1": {
    "attr": { "data-label": "1호선" },
    "stations": [{
      "station-cd": "0150",
      "data-uid": "0150",
      "data-coords": "131,82",
      "station-nm": "서울역"
    }, {
      "station-cd": "1217",
      "data-uid": "1217",
      "data-coords": "266,76",
      "station-nm": "양평"
    }]
  },
  "6-5": {
    "attr": { "data-label": "5호선" },
    "stations": [{
      "station-cd": "2523",
      "data-uid": "2523",
      "data-coords": "79,92",
      "station-nm": "양평"
    }]
  },
  "KP": {
    "attr": { "data-label": "김포" },
    "stations": [{
      "station-cd": "4925",
      "data-uid": "4925",
      "data-coords": "63,74",
      "station-nm": "사우 \\n(김포시청)"
    }]
  }
}`;

describe('seoulMetroSchematicGenerator', () => {
  it('normalizes Seoul Metro display names without losing identity', () => {
    expect(normalizeStationName('사우 \n(김포시청)')).toBe('사우김포시청');
    expect(normalizeStationName('시청·용인대')).toBe('시청용인대');
    expect(normalizeStationName('서울역')).toBe('서울');
  });

  it('parses line rows into schematic SVG coordinates', () => {
    const schematic = buildSeoulMetroSchematicMap(rawFixture);

    expect(schematic.map.width).toBe(1525);
    expect(schematic.map.height).toBe(1000);
    expect(schematic.stations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lineId: '2-1',
          stationCd: '0150',
          uid: '0150',
          stationName: '서울역',
          x: 131,
          y: 82,
          svgX: 655,
          svgY: 410,
        }),
      ]),
    );
  });

  it('uses station_cd mappings to disambiguate same-name physical stations', () => {
    const schematic = buildSeoulMetroSchematicMap(rawFixture);
    const mappings = buildInternalStationMappings({
      schematic,
      stations: {
        yangpyeong_gyeongui: { id: 'yangpyeong_gyeongui', name: '양평' },
        yangpyeong_5: { id: 'yangpyeong_5', name: '양평' },
        sau: { id: 'sau', name: '사우' },
      },
      seoulStations: [
        { station_cd: '1217', station_nm: '양평' },
        { station_cd: '2523', station_nm: '양평' },
        { station_cd: '4925', station_nm: '사우' },
      ],
      overrides: {
        yangpyeong_gyeongui: { stationCd: '1217' },
        yangpyeong_5: { stationCd: '2523' },
      },
    });

    expect(mappings.byInternalId.yangpyeong_gyeongui).toEqual(
      expect.objectContaining({ uid: '1217', svgX: 1330, svgY: 380 }),
    );
    expect(mappings.byInternalId.yangpyeong_5).toEqual(
      expect.objectContaining({ uid: '2523', svgX: 395, svgY: 460 }),
    );
    expect(mappings.byInternalId.sau).toEqual(
      expect.objectContaining({ uid: '4925', svgX: 315, svgY: 370 }),
    );
  });
});
