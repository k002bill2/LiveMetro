/**
 * F-01: delayReports create must not let a client forge a "verified" report
 * (which used to fire a mass push), and the push marker collection must be
 * server-only. The legit client shape (delayReportService.submitReport) must
 * keep working.
 */
import { after, beforeEach, describe, it } from 'node:test';
import {
  addDoc, collection, doc, getDoc, setDoc, updateDoc, Timestamp, arrayUnion, increment,
} from 'firebase/firestore';
import { assertDenied, assertSucceeds, cleanup, clearData, dbAs } from './helpers.mjs';

/** Mirrors src/services/delay/delayReportService.ts submitReport() payload. */
const legitReport = (userId, overrides = {}) => {
  const now = Timestamp.fromDate(new Date());
  return {
    userId,
    userDisplayName: '익명',
    lineId: '2',
    stationId: '0222',
    stationName: '강남',
    reportType: 'delay',
    severity: 'medium',
    description: '',
    estimatedDelayMinutes: null,
    direction: null,
    timestamp: now,
    upvotes: 0,
    upvotedBy: [],
    verified: false,
    active: true,
    updatedAt: now,
    ...overrides,
  };
};

describe('delayReports create (F-01)', () => {
  beforeEach(clearData);
  after(cleanup);

  it('allows the legit submitReport shape (null optionals)', async () => {
    const db = dbAs('alice');
    await assertSucceeds(addDoc(collection(db, 'delayReports'), legitReport('alice')));
  });

  it('allows the legit shape with optional values set', async () => {
    const db = dbAs('alice');
    await assertSucceeds(addDoc(collection(db, 'delayReports'),
      legitReport('alice', { estimatedDelayMinutes: 10, direction: 'up', description: '정차 중' })));
  });

  it('denies a forged status:"verified" report', async () => {
    const db = dbAs('mallory');
    await assertDenied(addDoc(collection(db, 'delayReports'),
      legitReport('mallory', { status: 'verified', delayMinutes: 30 })));
  });

  it('denies verified:true on create', async () => {
    const db = dbAs('mallory');
    await assertDenied(addDoc(collection(db, 'delayReports'), legitReport('mallory', { verified: true })));
  });

  it('denies pre-inflated upvotes on create', async () => {
    const db = dbAs('mallory');
    await assertDenied(addDoc(collection(db, 'delayReports'), legitReport('mallory', { upvotes: 999 })));
  });

  it('denies unknown fields (lineName/reason push copy) on create', async () => {
    const db = dbAs('mallory');
    await assertDenied(addDoc(collection(db, 'delayReports'),
      legitReport('mallory', { lineName: '피싱', reason: 'http://evil' })));
  });

  it('denies creating a report for another user', async () => {
    const db = dbAs('mallory');
    await assertDenied(addDoc(collection(db, 'delayReports'), legitReport('alice')));
  });

  it('still allows an upvote by another user and denies a status update', async () => {
    const alice = dbAs('alice');
    const ref = doc(alice, 'delayReports', 'r1');
    await assertSucceeds(setDoc(ref, legitReport('alice')));
    const bob = dbAs('bob');
    const bobRef = doc(bob, 'delayReports', 'r1');
    await assertSucceeds(updateDoc(bobRef, {
      upvotes: increment(1), upvotedBy: arrayUnion('bob'), updatedAt: Timestamp.fromDate(new Date()),
    }));
    await assertDenied(updateDoc(bobRef, { status: 'verified' }));
    await assertDenied(updateDoc(ref, { status: 'verified' }));
  });
});

describe('verifiedDelays server marker (F-01)', () => {
  beforeEach(clearData);
  after(cleanup);

  it('denies client writes and reads', async () => {
    const db = dbAs('mallory');
    const ref = doc(db, 'verifiedDelays', 'r1');
    await assertDenied(setDoc(ref, { lineId: '2', delayMinutes: 30 }));
    await assertDenied(getDoc(ref));
  });
});
