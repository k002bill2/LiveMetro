/**
 * Unit tests for the station-coordinate generator's pure functions.
 *
 * jest's testMatch is scoped to <rootDir>/src/**, so this build-time script is
 * not covered by `npm test`. Per the TDD skill's "one-off test script if no
 * framework" allowance, this runs standalone via ts-node and exits non-zero on
 * the first failed assertion:
 *
 *   npx ts-node scripts/__tests__/fetchStationCoordinates.test.ts
 */

import assert from 'node:assert/strict';
import { buildApiCoordMap, mergeCoordinates, serializeCoordinateMap } from '../fetchStationCoordinates';

let passed = 0;
const test = (name: string, fn: () => void): void => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

console.log('buildApiCoordMap');

test('maps rows by BLDN_ID (= station_cd) with numeric coords', () => {
  const map = buildApiCoordMap([
    { BLDN_ID: '0150', BLDN_NM: '서울역', ROUTE: '1호선', LAT: '37.556228', LOT: '126.972135' },
    { BLDN_ID: '0426', BLDN_NM: '서울역', ROUTE: '4호선', LAT: '37.55281', LOT: '126.972556' },
  ]);
  assert.deepEqual(map['0150'], { latitude: 37.556228, longitude: 126.972135 });
  // 서울역 4호선 keyed independently by its own station_cd — no name collision.
  assert.deepEqual(map['0426'], { latitude: 37.55281, longitude: 126.972556 });
});

test('excludes rows with zero, NaN, or empty coordinates', () => {
  const map = buildApiCoordMap([
    { BLDN_ID: 'A', BLDN_NM: 'a', ROUTE: '1호선', LAT: '0', LOT: '126.9' },
    { BLDN_ID: 'B', BLDN_NM: 'b', ROUTE: '1호선', LAT: '37.5', LOT: '0' },
    { BLDN_ID: 'C', BLDN_NM: 'c', ROUTE: '1호선', LAT: '', LOT: '126.9' },
    { BLDN_ID: 'D', BLDN_NM: 'd', ROUTE: '1호선', LAT: 'abc', LOT: '126.9' },
    { BLDN_ID: 'E', BLDN_NM: 'e', ROUTE: '1호선', LAT: '37.5', LOT: '126.9' },
  ]);
  assert.equal(map['A'], undefined);
  assert.equal(map['B'], undefined);
  assert.equal(map['C'], undefined);
  assert.equal(map['D'], undefined);
  assert.deepEqual(map['E'], { latitude: 37.5, longitude: 126.9 });
});

test('returns an empty object for no rows', () => {
  assert.deepEqual(buildApiCoordMap([]), {});
});

console.log('mergeCoordinates');

test('API value overrides existing for a shared station_cd (corruption fix)', () => {
  // 0426 서울역 4호선: existing is the ~12km-south corrupt value; API is correct.
  const existing = { '0426': { latitude: 37.44961, longitude: 126.9329 } };
  const api = { '0426': { latitude: 37.55281, longitude: 126.972556 } };
  const merged = mergeCoordinates(existing, api);
  assert.deepEqual(merged['0426'], { latitude: 37.55281, longitude: 126.972556 });
});

test('preserves an existing station_cd absent from the API (Korail coverage)', () => {
  // 1305 광운대/경춘선 is not in subwayStationMaster — must not be dropped.
  const existing = { '1305': { latitude: 37.6233, longitude: 127.0613 } };
  const api = { '0150': { latitude: 37.556228, longitude: 126.972135 } };
  const merged = mergeCoordinates(existing, api);
  assert.deepEqual(merged['1305'], { latitude: 37.6233, longitude: 127.0613 });
  assert.deepEqual(merged['0150'], { latitude: 37.556228, longitude: 126.972135 });
});

test('adds an API-only station_cd not present in existing', () => {
  const existing = {};
  const api = { '9999': { latitude: 37.5, longitude: 127.0 } };
  const merged = mergeCoordinates(existing, api);
  assert.deepEqual(merged['9999'], { latitude: 37.5, longitude: 127.0 });
});

test('does not mutate the inputs', () => {
  const existing = { '0426': { latitude: 37.44961, longitude: 126.9329 } };
  const api = { '0426': { latitude: 37.55281, longitude: 126.972556 } };
  mergeCoordinates(existing, api);
  assert.deepEqual(existing['0426'], { latitude: 37.44961, longitude: 126.9329 });
});

console.log('serializeCoordinateMap');

test('orders keys as strings (deterministic, leading-zero codes first)', () => {
  const out = serializeCoordinateMap({
    '0426': { latitude: 1, longitude: 2 },
    '0008': { latitude: 3, longitude: 4 },
    '1001': { latitude: 5, longitude: 6 },
  });
  assert.ok(out.indexOf('"0008"') < out.indexOf('"0426"'));
  assert.ok(out.indexOf('"0426"') < out.indexOf('"1001"'));
});

test('round-trips to an equivalent object', () => {
  const map = {
    '0150': { latitude: 37.556228, longitude: 126.972135 },
    '9999': { latitude: 37.5, longitude: 127 },
  };
  assert.deepEqual(JSON.parse(serializeCoordinateMap(map)), map);
});

test('matches JSON.stringify 2-space format per entry', () => {
  const out = serializeCoordinateMap({ '0150': { latitude: 37.5, longitude: 127 } });
  assert.equal(out, '{\n  "0150": {\n    "latitude": 37.5,\n    "longitude": 127\n  }\n}');
});

console.log(`\n${passed} assertions passed`);
