const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SVG_MAP_WIDTH = 1525;
const SVG_MAP_HEIGHT = 1000;
const SEOUL_METRO_CELL_SIZE = 5;

const DEFAULT_INTERNAL_STATION_OVERRIDES = {
  seoul: { stationCd: '0150' },
  s_9005: { stationCd: '9005' },
  sinchon: { stationCd: '0240' },
  s_2523: { stationCd: '2523' },
  yangpyeong_gyeongui: { stationCd: '1217' },
};

const normalizeStationName = (name) =>
  String(name ?? '')
    .replace(/\s/g, '')
    .replace(/[()（）]/g, '')
    .replace(/[·.]/g, '')
    .replace(/역$/, '')
    .trim();

const parseRawLines = (rawSource) => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${rawSource}\n;this.lines = lines;`, context, {
    timeout: 1000,
  });
  if (!context.lines || typeof context.lines !== 'object') {
    throw new Error('Unable to parse Seoul Metro lines object');
  }
  return context.lines;
};

const buildSeoulMetroSchematicMap = (rawSource) => {
  const lines = parseRawLines(rawSource);
  const stations = [];

  for (const [lineId, line] of Object.entries(lines)) {
    for (const station of line.stations ?? []) {
      const stationName = station['station-nm'];
      const coords = station['data-coords'];
      if (!stationName || !coords || !String(coords).includes(',')) {
        continue;
      }
      const [x, y] = String(coords).split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }

      stations.push({
        lineId,
        stationCd: String(station['station-cd'] ?? ''),
        uid: String(station['data-uid'] ?? ''),
        stationName: String(stationName),
        normalizedName: normalizeStationName(stationName),
        x,
        y,
        svgX: x * SEOUL_METRO_CELL_SIZE,
        svgY: y * SEOUL_METRO_CELL_SIZE,
      });
    }
  }

  return {
    source: {
      endpoint: 'http://www.seoulmetro.co.kr/kr/getLineData.do',
      cellSize: SEOUL_METRO_CELL_SIZE,
      generatedFrom: 'data/raw/seoulmetro_station_coordinates_2026-06-28.js',
    },
    map: {
      width: SVG_MAP_WIDTH,
      height: SVG_MAP_HEIGHT,
    },
    stations,
  };
};

const pushMap = (map, key, value) => {
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
};

const unique = (values) => [...new Set(values.filter(Boolean))];

const buildInternalStationMappings = ({
  schematic,
  stations,
  seoulStations,
  overrides = DEFAULT_INTERNAL_STATION_OVERRIDES,
}) => {
  const rawByStationCd = new Map();
  const rawByUid = new Map();
  const rawByNormalizedName = new Map();

  for (const row of schematic.stations) {
    pushMap(rawByStationCd, row.stationCd, row);
    pushMap(rawByUid, row.uid, row);
    pushMap(rawByNormalizedName, row.normalizedName, row);
  }

  const codesByExactName = new Map();
  const codesByNormalizedName = new Map();
  for (const station of seoulStations) {
    const stationCd = String(station.station_cd ?? '');
    pushMap(codesByExactName, station.station_nm, stationCd);
    pushMap(codesByNormalizedName, normalizeStationName(station.station_nm), stationCd);
  }

  const byInternalId = {};
  const missing = [];

  for (const station of Object.values(stations)) {
    const override = overrides[station.id];
    const stationCodes = unique([
      override?.stationCd,
      ...(codesByExactName.get(station.name) ?? []),
      ...(codesByNormalizedName.get(normalizeStationName(station.name)) ?? []),
    ]);

    const candidates = [];
    if (override?.uid) {
      candidates.push(...(rawByUid.get(override.uid) ?? []));
    }
    for (const stationCd of stationCodes) {
      candidates.push(...(rawByStationCd.get(stationCd) ?? []));
    }
    candidates.push(...(rawByNormalizedName.get(normalizeStationName(station.name)) ?? []));

    const selected = unique(candidates.map((row) => `${row.lineId}|${row.stationCd}|${row.uid}`))
      .map((key) => {
        const [lineId, stationCd, uid] = key.split('|');
        return candidates.find(
          (row) => row.lineId === lineId && row.stationCd === stationCd && row.uid === uid,
        );
      })
      .find((row) => {
        if (override?.stationCd) return row.stationCd === override.stationCd;
        if (override?.uid) return row.uid === override.uid;
        return true;
      });

    if (!selected) {
      missing.push({
        id: station.id,
        name: station.name,
      });
      continue;
    }

    const uidRows = rawByUid.get(selected.uid) ?? [selected];
    byInternalId[station.id] = {
      id: station.id,
      name: station.name,
      uid: selected.uid,
      stationCd: selected.stationCd,
      stationCodes: unique([...stationCodes, ...uidRows.map((row) => row.stationCd)]).sort(),
      sourceLineId: selected.lineId,
      sourceStationName: selected.stationName,
      x: selected.x,
      y: selected.y,
      svgX: selected.svgX,
      svgY: selected.svgY,
    };
  }

  return {
    source: {
      schematic: 'src/data/seoulMetroSchematicMap.json',
      stationCodeSource: 'src/data/seoulStations.json',
      overrides: Object.keys(overrides).sort(),
    },
    byInternalId,
    missing,
  };
};

const readExistingAnchors = (anchorTablePath) => {
  if (!fs.existsSync(anchorTablePath)) return {};
  const text = fs.readFileSync(anchorTablePath, 'utf8');
  const anchors = {};
  const regex = /^  "([^"]+)": \{ x: ([^,]+), y: ([^ }]+) \}/gm;
  let match;
  while ((match = regex.exec(text))) {
    anchors[match[1]] = { x: Number(match[2]), y: Number(match[3]) };
  }
  return anchors;
};

const formatNumber = (value) => {
  const fixed = Number(value).toFixed(2);
  return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatAnchorTable = ({ mappings, fallbackAnchors }) => {
  const entries = [];
  for (const [id, mapping] of Object.entries(mappings.byInternalId).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    entries.push(
      `  ${JSON.stringify(id)}: { x: ${formatNumber(mapping.svgX)}, y: ${formatNumber(
        mapping.svgY,
      )} }, // ${mapping.name}`,
    );
  }

  for (const missing of mappings.missing) {
    const fallback = fallbackAnchors[missing.id];
    if (!fallback) continue;
    entries.push(
      `  ${JSON.stringify(missing.id)}: { x: ${formatNumber(fallback.x)}, y: ${formatNumber(
        fallback.y,
      )} }, // ${missing.name} (fallback)`,
    );
  }

  entries.sort();

  return `/**\n * Generated by scripts/seoulMetroSchematicGenerator.cjs.\n * Official Seoul Metro schematic coordinates use data-coords * 5 on a 1525 x 1000 SVG.\n * Do not edit by hand; update the generator or raw source and rerun it.\n */\n\nexport const SUBWAY_LINE_SVG_ANCHORS_BY_ID = {\n${entries.join('\n')}\n} as const;\n`;
};

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeGeneratedFiles = (rootDir) => {
  const rawPath = path.join(rootDir, 'data/raw/seoulmetro_station_coordinates_2026-06-28.js');
  const stationsPath = path.join(rootDir, 'src/data/stations.json');
  const seoulStationsPath = path.join(rootDir, 'src/data/seoulStations.json');
  const schematicPath = path.join(rootDir, 'src/data/seoulMetroSchematicMap.json');
  const mappingPath = path.join(rootDir, 'src/data/seoulMetroStationMappings.json');
  const anchorTablePath = path.join(rootDir, 'src/components/map/subwayLineSvgAnchorTable.ts');

  const rawSource = fs.readFileSync(rawPath, 'utf8');
  const stations = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
  const seoulStations = JSON.parse(fs.readFileSync(seoulStationsPath, 'utf8')).DATA;
  const fallbackAnchors = readExistingAnchors(anchorTablePath);

  const schematic = buildSeoulMetroSchematicMap(rawSource);
  const mappings = buildInternalStationMappings({ schematic, stations, seoulStations });

  writeJson(schematicPath, schematic);
  writeJson(mappingPath, mappings);
  fs.writeFileSync(anchorTablePath, formatAnchorTable({ mappings, fallbackAnchors }), 'utf8');

  return {
    schematicPath,
    mappingPath,
    anchorTablePath,
    schematicStations: schematic.stations.length,
    mappedStations: Object.keys(mappings.byInternalId).length,
    missingStations: mappings.missing,
  };
};

module.exports = {
  DEFAULT_INTERNAL_STATION_OVERRIDES,
  SVG_MAP_HEIGHT,
  SVG_MAP_WIDTH,
  buildInternalStationMappings,
  buildSeoulMetroSchematicMap,
  formatAnchorTable,
  normalizeStationName,
  writeGeneratedFiles,
};

if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  const result = writeGeneratedFiles(rootDir);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}
