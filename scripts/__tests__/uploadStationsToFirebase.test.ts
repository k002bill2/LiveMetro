/**
 * Unit tests for the station uploader's pure document builders and batch loop.
 *
 * jest's testMatch is scoped to src/, plugins/ and e2e/, so (like
 * fetchStationCoordinates.test.ts) this runs standalone via ts-node and exits
 * non-zero on the first failed assertion:
 *
 *   npx ts-node scripts/__tests__/uploadStationsToFirebase.test.ts
 *
 * firebase-admin is replaced in require.cache BEFORE the script is loaded, so
 * no real SDK code, Firestore, emulator or credential is ever touched. The
 * app-module stubs throw, proving that importing the script does not
 * initialize Firebase (main() sits behind the require.main guard).
 */

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { Module } from 'module';
import type * as UploaderModule from '../uploadStationsToFirebase';

const SENTINEL = Object.freeze({ __serverTimestamp: true });

const stubModule = (request: string, exports: Record<string, unknown>): void => {
  const resolved = require.resolve(request);
  const stub = new Module(resolved);
  stub.filename = resolved;
  stub.loaded = true;
  stub.exports = exports;
  require.cache[resolved] = stub;
};

const forbidden = (name: string) => (): never => {
  throw new Error(`${name} must not be called by tests`);
};

stubModule('firebase-admin/app', {
  initializeApp: forbidden('initializeApp'),
  cert: forbidden('cert'),
  applicationDefault: forbidden('applicationDefault'),
  getApps: forbidden('getApps'),
});
stubModule('firebase-admin/firestore', {
  getFirestore: forbidden('getFirestore'),
  FieldValue: { serverTimestamp: (): unknown => SENTINEL },
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const uploader = require('../uploadStationsToFirebase') as typeof UploaderModule;
type Station = UploaderModule.SeoulStationData;
type Ts = Parameters<typeof uploader.buildStationDoc>[1];
const ts = SENTINEL as unknown as Ts;

const realStations: Station[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'data', 'seoulStations.json'), 'utf-8'),
).DATA;

// ---- fake Firestore (records sets / commits only) ----
interface SetCall { collection: string; id: string; data: unknown; options: unknown }
const createFakeDb = (): { db: never; commits: SetCall[][] } => {
  const commits: SetCall[][] = [];
  const db = {
    collection: (collection: string) => ({ doc: (id: string) => ({ collection, id }) }),
    batch: () => {
      const sets: SetCall[] = [];
      return {
        set: (ref: { collection: string; id: string }, data: unknown, options: unknown) => {
          sets.push({ collection: ref.collection, id: ref.id, data, options });
        },
        commit: async (): Promise<void> => {
          commits.push(sets);
        },
      };
    },
  };
  return { db: db as never, commits };
};

const makeStations = (n: number): Station[] =>
  Array.from({ length: n }, (_, i) => ({
    ...(realStations[i % realStations.length] as Station),
    station_cd: `T${String(i).padStart(4, '0')}`,
  }));

let passed = 0;
const cases: { name: string; fn: () => void | Promise<void> }[] = [];
const test = (name: string, fn: () => void | Promise<void>): void => {
  cases.push({ name, fn });
};

const silenced = async <T>(fn: () => Promise<T>): Promise<T> => {
  const original = console.log;
  console.log = (): void => undefined;
  try {
    return await fn();
  } finally {
    console.log = original;
  }
};

// ---- convertLineNumToLineId ----
test('convertLineNumToLineId strips leading zero and 호선', () => {
  assert.equal(uploader.convertLineNumToLineId('01호선'), '1');
  assert.equal(uploader.convertLineNumToLineId('09호선'), '9');
  assert.equal(uploader.convertLineNumToLineId('10호선'), '10');
  assert.equal(uploader.convertLineNumToLineId('인천2호선'), '인천2');
  assert.equal(uploader.convertLineNumToLineId('수인분당선'), '수인분당선');
  assert.equal(uploader.convertLineNumToLineId('GTX-A'), 'GTX-A');
});

// ---- buildStationDoc ----
test('buildStationDoc maps real seoulStations.json row field-for-field', () => {
  const row = realStations.find((s) => s.station_cd === '1723') as Station;
  assert.ok(row, 'fixture row 1723 (평택지제) must exist');
  assert.deepEqual(uploader.buildStationDoc(row, ts), {
    name: '평택지제',
    nameEn: 'PyeongtaekJije',
    nameCn: '平泽芝制',
    nameJp: 'ピョンテクチジェ',
    lineId: '1',
    lineName: '01호선',
    stationCode: '1723',
    externalCode: 'P164',
    coordinates: { latitude: 37.5665, longitude: 126.978 },
    transfers: [],
    createdAt: SENTINEL,
    updatedAt: SENTINEL,
  });
});

// ---- buildLineIndexDocs ----
test('buildLineIndexDocs groups real data by lineId in first-seen order', () => {
  const docs = uploader.buildLineIndexDocs(realStations, ts);
  const total = docs.reduce((sum, d) => sum + d.doc.stationCount, 0);
  assert.equal(total, realStations.length);
  assert.equal(new Set(docs.map((d) => d.lineId)).size, docs.length);
  const line1 = docs.find((d) => d.lineId === '1');
  assert.ok(line1);
  assert.equal(line1.doc.name, '1호선');
  assert.equal(line1.doc.color, '#0052A4');
  assert.equal(line1.doc.stationCount, realStations.filter((s) => s.line_num === '01호선').length);
  assert.equal(line1.doc.stationIds[0], realStations.find((s) => s.line_num === '01호선')?.station_cd);
  assert.equal(line1.doc.updatedAt, SENTINEL);
  const firstSeen = [...new Set(realStations.map((s) => uploader.convertLineNumToLineId(s.line_num)))];
  assert.deepEqual(docs.map((d) => d.lineId), firstSeen);
});

test('buildLineIndexDocs falls back to #888888 for lines without a color', () => {
  const docs = uploader.buildLineIndexDocs(realStations, ts);
  const sb = docs.find((d) => d.lineId === '수인분당선');
  assert.ok(sb);
  assert.equal(sb.doc.color, '#888888');
  assert.equal(sb.doc.name, '수인분당선호선');
});

// ---- chunkIntoBatches boundaries ----
test('chunkIntoBatches 449/450/451/900/0 boundaries at BATCH_SIZE=450', () => {
  assert.equal(uploader.BATCH_SIZE, 450);
  const sizes = (n: number): number[] =>
    uploader.chunkIntoBatches(Array.from({ length: n }, (_, i) => i)).map((c) => c.length);
  assert.deepEqual(sizes(449), [449]);
  assert.deepEqual(sizes(450), [450]);
  assert.deepEqual(sizes(451), [450, 1]);
  assert.deepEqual(sizes(900), [450, 450]);
  assert.deepEqual(sizes(0), []);
  const items = [1, 2, 3];
  assert.deepEqual(uploader.chunkIntoBatches(items, 2), [[1, 2], [3]]);
  assert.deepEqual(items, [1, 2, 3], 'input not mutated');
});

// ---- uploadStations batch loop (fake db) ----
for (const [n, expected] of [[449, [449]], [450, [450]], [451, [450, 1]]] as const) {
  test(`uploadStations commits ${JSON.stringify(expected)} for ${n} stations`, async () => {
    const { db, commits } = createFakeDb();
    await silenced(() => uploader.uploadStations(db, makeStations(n)));
    assert.deepEqual(commits.map((c) => c.length), expected);
    const all = commits.flat();
    assert.ok(all.every((c) => c.collection === 'stations'));
    assert.ok(all.every((c) => JSON.stringify(c.options) === JSON.stringify({ merge: true })));
    assert.equal(all[0]?.id, 'T0000');
    assert.equal(all[n - 1]?.id, `T${String(n - 1).padStart(4, '0')}`);
  });
}

test('uploadStations with real data uses station_cd as doc ID and full docs', async () => {
  const { db, commits } = createFakeDb();
  await silenced(() => uploader.uploadStations(db, realStations));
  assert.deepEqual(
    commits.map((c) => c.length),
    uploader.chunkIntoBatches(realStations).map((c) => c.length),
  );
  const all = commits.flat();
  assert.deepEqual(all.map((c) => c.id), realStations.map((s) => s.station_cd));
  assert.deepEqual(all[0]?.data, uploader.buildStationDoc(realStations[0] as Station, ts));
});

// ---- createLineIndex (fake db) ----
test('createLineIndex writes one merged subwayLines doc per line in a single batch', async () => {
  const { db, commits } = createFakeDb();
  await silenced(() => uploader.createLineIndex(db, realStations));
  assert.equal(commits.length, 1);
  const expected = uploader.buildLineIndexDocs(realStations, ts);
  const sets = commits[0] ?? [];
  assert.deepEqual(sets.map((s) => s.id), expected.map((d) => d.lineId));
  assert.ok(sets.every((s) => s.collection === 'subwayLines'));
  assert.ok(sets.every((s) => JSON.stringify(s.options) === JSON.stringify({ merge: true })));
  assert.deepEqual(sets.map((s) => s.data), expected.map((d) => d.doc));
});

const run = async (): Promise<void> => {
  // Sequential on purpose: `silenced` swaps console.log, so overlapping cases
  // would restore the wrong function.
  for (const { name, fn } of cases) {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  }
  console.log(`\n${passed} passed`);
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
