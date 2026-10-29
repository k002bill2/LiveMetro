/**
 * F-03: congestionReports create and congestionSummary writes must carry only
 * the shapes congestionService.ts produces, with bounded values. The time
 * fields are the main poisoning lever: a far-future expiresAt keeps a fake
 * report inside the `expiresAt >= now` aggregation query forever, and a
 * far-future lastUpdated pins a fake summary to the top of the line list.
 */
import { after, beforeEach, describe, it } from 'node:test';
import { addDoc, collection, deleteDoc, doc, setDoc, Timestamp } from 'firebase/firestore';
import { assertDenied, assertSucceeds, cleanup, clearData, dbAs, seed } from './helpers.mjs';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** Mirrors congestionService.submitReport() reportData. */
const legitReport = (reporterId, overrides = {}, at = new Date()) => ({
  trainId: '2041',
  lineId: '2',
  stationId: '0222',
  direction: 'up',
  carNumber: 3,
  congestionLevel: 'high',
  reporterId,
  timestamp: Timestamp.fromDate(at),
  expiresAt: Timestamp.fromDate(new Date(at.getTime() + 10 * MIN)),
  ...overrides,
});

const car = (carNumber, overrides = {}) => ({
  carNumber, congestionLevel: 'moderate', reportCount: 1,
  lastUpdated: Timestamp.fromDate(new Date()), ...overrides,
});

/**
 * Mirrors aggregateCarCongestion(): always TRAIN_CAR_COUNT (10) cars from
 * createEmptyCarCongestions(); unreported cars stay level 'low', reportCount 0.
 */
const realCars = (reported = { 3: { congestionLevel: 'high', reportCount: 1 } }) =>
  Array.from({ length: 10 }, (_, i) => car(i + 1, { congestionLevel: 'low', reportCount: 0, ...(reported[i + 1] || {}) }));

/** Mirrors congestionService.updateSummaryFromReport() summaryData. */
const legitSummary = (overrides = {}) => ({
  trainId: '2041',
  lineId: '2',
  direction: 'up',
  cars: realCars(),
  overallLevel: 'high',
  reportCount: 1,
  lastUpdated: Timestamp.fromDate(new Date()),
  ...overrides,
});
const SUMMARY_ID = '2_up_2041';

describe('congestionReports create (F-03)', () => {
  beforeEach(clearData);
  after(cleanup);
  const reports = (uid) => collection(dbAs(uid), 'congestionReports');

  it('allows the legit submitReport shape', async () => {
    await assertSucceeds(addDoc(reports('alice'), legitReport('alice')));
    await assertSucceeds(addDoc(reports('alice'), legitReport('alice', { carNumber: 10, congestionLevel: 'crowded', direction: 'down' })));
  });

  it('denies a report for another reporter', async () => {
    await assertDenied(addDoc(reports('mallory'), legitReport('alice')));
  });

  it('denies extra and missing fields', async () => {
    await assertDenied(addDoc(reports('mallory'), legitReport('mallory', { weight: 100 })));
    const { stationId: _omit, ...missing } = legitReport('mallory');
    await assertDenied(addDoc(reports('mallory'), missing));
  });

  it('denies out-of-range car numbers and non-integers', async () => {
    for (const carNumber of [0, 11, 1.5, '3']) {
      await assertDenied(addDoc(reports('mallory'), legitReport('mallory', { carNumber })));
    }
  });

  it('denies unknown congestion level and direction', async () => {
    await assertDenied(addDoc(reports('mallory'), legitReport('mallory', { congestionLevel: 'extreme' })));
    await assertDenied(addDoc(reports('mallory'), legitReport('mallory', { direction: 'left' })));
  });

  it('denies a long-lived report (expiresAt not timestamp + 10m)', async () => {
    const at = new Date();
    await assertDenied(addDoc(reports('mallory'), legitReport('mallory', {
      expiresAt: Timestamp.fromDate(new Date(at.getTime() + 365 * DAY)),
    }, at)));
  });

  it('denies a far-future timestamp even with a consistent expiresAt', async () => {
    await assertDenied(addDoc(reports('mallory'), legitReport('mallory', {}, new Date(Date.now() + 7 * DAY))));
  });

  it('denies oversized id strings', async () => {
    await assertDenied(addDoc(reports('mallory'), legitReport('mallory', { trainId: 'x'.repeat(200) })));
  });
});

describe('congestionSummary writes (F-03)', () => {
  beforeEach(clearData);
  after(cleanup);
  const ref = (uid, id = SUMMARY_ID) => doc(dbAs(uid), 'congestionSummary', id);

  it('allows the legit create and full-overwrite update (10 cars, unreported = 0)', async () => {
    await assertSucceeds(setDoc(ref('alice'), legitSummary()));
    await assertSucceeds(setDoc(ref('bob'), legitSummary({
      cars: realCars({ 3: { congestionLevel: 'high', reportCount: 2 }, 10: { congestionLevel: 'moderate', reportCount: 1 } }),
      reportCount: 3,
    })));
  });

  it('allows an empty cars list (no live reports yet)', async () => {
    await assertSucceeds(setDoc(ref('alice'), legitSummary({ cars: [], reportCount: 0, overallLevel: 'low' })));
  });

  it('allows a full 10-car summary on create and update (1000-expression budget)', async () => {
    const cars = Array.from({ length: 10 }, (_, i) => car(i + 1));
    await assertSucceeds(setDoc(ref('alice'), legitSummary({ cars, reportCount: 10 })));
    await assertSucceeds(setDoc(ref('bob'), legitSummary({ cars, reportCount: 10 })));
  });

  it('denies a doc id that does not match line/direction/train', async () => {
    await assertDenied(setDoc(ref('mallory', '9_down_1111'), legitSummary()));
  });

  it('denies extra fields and unknown enums', async () => {
    await assertDenied(setDoc(ref('mallory'), legitSummary({ pinned: true })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ overallLevel: 'extreme' })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ direction: 'left' })));
  });

  it('denies out-of-range reportCount', async () => {
    await assertDenied(setDoc(ref('mallory'), legitSummary({ reportCount: 99999 })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ reportCount: -1 })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ cars: realCars({ 3: { reportCount: -1 } }) })));
  });

  it('denies more than 10 cars', async () => {
    const cars = Array.from({ length: 11 }, (_, i) => car((i % 10) + 1));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ cars, reportCount: 11 })));
  });

  it('denies malformed car entries', async () => {
    await assertDenied(setDoc(ref('mallory'), legitSummary({ cars: [car(99)] })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ cars: [car(3), car(4, { congestionLevel: 'extreme' })] })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ cars: [car(3, { reportCount: 5000 })] })));
    await assertDenied(setDoc(ref('mallory'), legitSummary({ cars: [car(3, { note: 'x' })] })));
  });

  it('denies a far-future lastUpdated (pins the summary to the top)', async () => {
    await assertDenied(setDoc(ref('mallory'), legitSummary({
      lastUpdated: Timestamp.fromDate(new Date(Date.now() + 365 * DAY)),
    })));
  });

  it('denies overwriting an existing summary with poisoned values', async () => {
    await seed(`congestionSummary/${SUMMARY_ID}`, {
      trainId: '2041', lineId: '2', direction: 'up', cars: [], overallLevel: 'low',
      reportCount: 0, lastUpdated: new Date(),
    });
    await assertDenied(setDoc(ref('mallory'), legitSummary({ reportCount: 100000, overallLevel: 'crowded' })));
    await assertDenied(deleteDoc(ref('mallory')));
  });
});
