/**
 * F-03: delayReports vote/reaction/comment aggregates and comment likes.
 * Every counter change must be exactly the caller's own ±1, tied to their uid
 * membership — never a free-form write that can inflate counts or erase
 * another user's vote. The legit client writes (delayReportService /
 * reportCommentService) must keep passing.
 */
import { after, beforeEach, describe, it } from 'node:test';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteField, doc, increment, setDoc,
  Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { assertDenied, assertSucceeds, cleanup, clearData, dbAs, seed } from './helpers.mjs';

const now = () => Timestamp.fromDate(new Date());

/** Mirrors delayReportService.submitReport() payload. */
const legitReport = (userId, overrides = {}) => ({
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
  timestamp: now(),
  upvotes: 0,
  upvotedBy: [],
  verified: false,
  active: true,
  updatedAt: now(),
  ...overrides,
});

/** Seed report r1 owned by alice, bypassing rules (for pre-existing votes). */
const seedReport = (overrides = {}) => seed('delayReports/r1', {
  userId: 'alice', lineId: '2', stationId: '0222', active: true, verified: false,
  upvotes: 0, upvotedBy: [], timestamp: new Date(), updatedAt: new Date(), ...overrides,
});

const reportRef = (uid) => doc(dbAs(uid), 'delayReports', 'r1');

// --- client write shapes (delayReportService.ts) ---------------------------
const upvote = (uid) => ({ upvotes: increment(1), upvotedBy: arrayUnion(uid), updatedAt: now() });
const unvote = (uid) => ({ upvotes: increment(-1), upvotedBy: arrayRemove(uid), updatedAt: now() });
const setReaction = (uid, prev, next) => ({
  [`reactions.${next}`]: increment(1),
  [`reactedBy.${uid}`]: next,
  ...(prev ? { [`reactions.${prev}`]: increment(-1) } : {}),
  updatedAt: now(),
});
const clearReaction = (uid, prev) => ({
  [`reactions.${prev}`]: increment(-1),
  [`reactedBy.${uid}`]: deleteField(),
  updatedAt: now(),
});

describe('delayReports upvotes (F-03)', () => {
  beforeEach(clearData);
  after(cleanup);

  it('allows the legit upvote then un-upvote by the caller', async () => {
    await assertSucceeds(setDoc(doc(dbAs('alice'), 'delayReports', 'r1'), legitReport('alice')));
    await assertSucceeds(updateDoc(reportRef('bob'), upvote('bob')));
    await assertSucceeds(updateDoc(reportRef('bob'), unvote('bob')));
  });

  it('denies a second upvote by the same user (count inflation)', async () => {
    await seedReport({ upvotes: 1, upvotedBy: ['bob'] });
    await assertDenied(updateDoc(reportRef('bob'), upvote('bob')));
  });

  it('denies an upvote that adds more than 1', async () => {
    await seedReport();
    await assertDenied(updateDoc(reportRef('bob'), {
      upvotes: increment(5), upvotedBy: arrayUnion('bob'), updatedAt: now(),
    }));
  });

  it('denies counting a vote under someone else\'s uid', async () => {
    await seedReport();
    await assertDenied(updateDoc(reportRef('mallory'), upvote('carol')));
  });

  it('denies removing another user\'s existing upvote', async () => {
    await seedReport({ upvotes: 1, upvotedBy: ['alice'] });
    await assertDenied(updateDoc(reportRef('mallory'), unvote('alice')));
  });

  it('denies wiping upvotedBy / resetting the count', async () => {
    await seedReport({ upvotes: 2, upvotedBy: ['alice', 'carol'] });
    await assertDenied(updateDoc(reportRef('mallory'), { upvotes: 0, upvotedBy: [] }));
  });

  it('denies un-upvoting when the caller never voted', async () => {
    await seedReport({ upvotes: 1, upvotedBy: ['alice'] });
    await assertDenied(updateDoc(reportRef('mallory'), unvote('mallory')));
  });

  it('denies an explicit duplicate own entry in upvotedBy', async () => {
    await seedReport({ upvotes: 1, upvotedBy: ['bob'] });
    await assertDenied(updateDoc(reportRef('bob'), {
      upvotes: increment(1), upvotedBy: ['bob', 'bob'], updatedAt: now(),
    }));
  });

  it('denies an un-upvote that also drops another member', async () => {
    await seedReport({ upvotes: 2, upvotedBy: ['alice', 'carol'] });
    await assertDenied(updateDoc(reportRef('alice'), {
      upvotes: increment(-1), upvotedBy: [], updatedAt: now(),
    }));
  });

  it('denies an un-upvote that subtracts more than 1', async () => {
    await seedReport({ upvotes: 5, upvotedBy: ['bob'] });
    await assertDenied(updateDoc(reportRef('bob'), {
      upvotes: increment(-5), upvotedBy: arrayRemove('bob'), updatedAt: now(),
    }));
  });

  it('denies mixing an upvote with a reaction write in one update', async () => {
    await seedReport();
    await assertDenied(updateDoc(reportRef('bob'), {
      ...upvote('bob'), 'reactions.helped': increment(50),
    }));
  });

  it('denies pre-seeded upvotedBy on create', async () => {
    await assertDenied(addDoc(collection(dbAs('mallory'), 'delayReports'),
      legitReport('mallory', { upvotedBy: ['alice', 'carol'] })));
  });
});

describe('delayReports reactions (F-03)', () => {
  beforeEach(clearData);
  after(cleanup);

  it('allows first reaction, change of kind, and clear (legit flow)', async () => {
    await assertSucceeds(setDoc(doc(dbAs('alice'), 'delayReports', 'r1'), legitReport('alice')));
    await assertSucceeds(updateDoc(reportRef('bob'), setReaction('bob', null, 'helped')));
    await assertSucceeds(updateDoc(reportRef('bob'), setReaction('bob', 'helped', 'same')));
    await assertSucceeds(updateDoc(reportRef('bob'), clearReaction('bob', 'same')));
  });

  it('allows reacting when a legacy null reactedBy entry exists (#318)', async () => {
    await seedReport({ reactions: { helped: 0 }, reactedBy: { bob: null } });
    await assertSucceeds(updateDoc(reportRef('bob'), setReaction('bob', null, 'helped')));
  });

  it('denies repeating the same kind increment without a reactedBy change', async () => {
    await seedReport({ reactions: { helped: 1 }, reactedBy: { bob: 'helped' } });
    await assertDenied(updateDoc(reportRef('bob'), { 'reactions.helped': increment(1), updatedAt: now() }));
  });

  it('denies erasing another user\'s reaction', async () => {
    await seedReport({ reactions: { helped: 1 }, reactedBy: { alice: 'helped' } });
    await assertDenied(updateDoc(reportRef('mallory'), clearReaction('alice', 'helped')));
  });

  it('denies changing another user\'s reaction kind', async () => {
    await seedReport({ reactions: { helped: 1 }, reactedBy: { alice: 'helped' } });
    await assertDenied(updateDoc(reportRef('mallory'), setReaction('alice', 'helped', 'differ')));
  });

  it('denies a +2 reaction and an unknown kind', async () => {
    await seedReport();
    await assertDenied(updateDoc(reportRef('bob'), {
      'reactions.helped': increment(2), 'reactedBy.bob': 'helped', updatedAt: now(),
    }));
    await assertDenied(updateDoc(reportRef('bob'), setReaction('bob', null, 'evil')));
  });

  it('denies decrementing a kind the caller never chose', async () => {
    await seedReport({ reactions: { same: 3 }, reactedBy: { alice: 'same' } });
    await assertDenied(updateDoc(reportRef('bob'), setReaction('bob', 'same', 'helped')));
  });

  it('denies an own reaction that also erases another user\'s entry', async () => {
    await seedReport({ reactions: { same: 1 }, reactedBy: { alice: 'same' } });
    await assertDenied(updateDoc(reportRef('mallory'), {
      ...setReaction('mallory', null, 'helped'), 'reactedBy.alice': deleteField(),
    }));
  });

  it('denies an unknown kind in reactedBy even without a counter change', async () => {
    await seedReport();
    await assertDenied(updateDoc(reportRef('bob'), { 'reactedBy.bob': 'evil', updatedAt: now() }));
  });
});

describe('delayReports commentCount + comments (F-03)', () => {
  beforeEach(clearData);
  after(cleanup);

  /** Mirrors reportCommentService.addComment() comment payload. */
  const legitComment = (userId, overrides = {}) => ({
    reportId: 'r1', userId, userDisplayName: '익명', badge: null, text: '저도요',
    createdAt: now(), likes: 0, likedBy: [], replyCount: 0, ...overrides,
  });
  const commentRef = (uid) => doc(dbAs(uid), 'delayReports', 'r1', 'comments', 'c1');
  const seedComment = (overrides = {}) => seed('delayReports/r1/comments/c1', {
    reportId: 'r1', userId: 'alice', text: 'x', createdAt: new Date(),
    likes: 0, likedBy: [], replyCount: 0, ...overrides,
  });

  it('allows the legit addComment flow (comment + commentCount +1)', async () => {
    await assertSucceeds(setDoc(doc(dbAs('alice'), 'delayReports', 'r1'), legitReport('alice')));
    const db = dbAs('bob');
    const reportDoc = doc(db, 'delayReports', 'r1');
    await assertSucceeds(addDoc(collection(reportDoc, 'comments'), legitComment('bob')));
    const batch = writeBatch(db);
    batch.update(reportDoc, { commentCount: increment(1) });
    await assertSucceeds(batch.commit());
    const batch2 = writeBatch(db);
    batch2.update(reportDoc, { commentCount: increment(1) });
    await assertSucceeds(batch2.commit());
  });

  it('denies commentCount jumps and decreases', async () => {
    await seedReport({ commentCount: 3 });
    await assertDenied(updateDoc(reportRef('mallory'), { commentCount: increment(5) }));
    await assertDenied(updateDoc(reportRef('mallory'), { commentCount: 0 }));
  });

  it('denies a comment created with inflated likes or extra fields', async () => {
    const reportDoc = doc(dbAs('mallory'), 'delayReports', 'r1');
    await assertDenied(addDoc(collection(reportDoc, 'comments'),
      legitComment('mallory', { likes: 9999, likedBy: ['a', 'b'] })));
    await assertDenied(addDoc(collection(reportDoc, 'comments'),
      legitComment('mallory', { pinned: true })));
    await assertDenied(addDoc(collection(reportDoc, 'comments'),
      legitComment('mallory', { likes: 9999 })));
  });

  it('allows the legit like then unlike by the caller', async () => {
    await seedComment();
    await assertSucceeds(updateDoc(commentRef('bob'), { likes: increment(1), likedBy: arrayUnion('bob') }));
    await assertSucceeds(updateDoc(commentRef('bob'), { likes: increment(-1), likedBy: arrayRemove('bob') }));
  });

  it('denies removing another user\'s like', async () => {
    await seedComment({ likes: 1, likedBy: ['alice'] });
    await assertDenied(updateDoc(commentRef('mallory'),
      { likes: increment(-1), likedBy: arrayRemove('alice') }));
  });

  it('denies a double like and a like under another uid', async () => {
    await seedComment({ likes: 1, likedBy: ['bob'] });
    await assertDenied(updateDoc(commentRef('bob'), { likes: increment(1), likedBy: arrayUnion('bob') }));
    await assertDenied(updateDoc(commentRef('mallory'), { likes: increment(1), likedBy: arrayUnion('carol') }));
  });

  it('denies setting likes to an arbitrary value', async () => {
    await seedComment({ likes: 1, likedBy: ['alice'] });
    await assertDenied(updateDoc(commentRef('mallory'), { likes: 500 }));
  });

  it('denies a like that also rewrites the comment text', async () => {
    await seedComment();
    await assertDenied(updateDoc(commentRef('bob'), {
      likes: increment(1), likedBy: arrayUnion('bob'), text: '광고',
    }));
  });
});
