/**
 * F-02: a user must not be able to rewrite `email` / `isAnonymous` on their
 * own users doc (the email callable used to trust those fields). Existing
 * client writes (AuthContext, favoritesService, appleSignIn) must keep working.
 */
import { after, beforeEach, describe, it } from 'node:test';
import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { assertDenied, assertSucceeds, cleanup, clearData, dbAs } from './helpers.mjs';

/** Mirrors AuthContext.createOrGetUserDocument() new-user payload. */
const newUserDoc = (uid) => ({
  id: uid,
  email: 'alice@example.com',
  displayName: '익명 사용자',
  isAnonymous: false,
  profilePicture: null,
  preferences: { favoriteStations: [], notificationSettings: { enabled: true, emailNotifications: false } },
  subscription: 'free',
  createdAt: new Date(),
  lastLoginAt: new Date(),
});

describe('users writes (F-02)', () => {
  beforeEach(clearData);
  after(cleanup);

  const seed = async () => {
    const db = dbAs('alice');
    const ref = doc(db, 'users', 'alice');
    await assertSucceeds(setDoc(ref, newUserDoc('alice')));
    return ref;
  };

  it('allows the AuthContext create + legit merges', async () => {
    const ref = await seed();
    await assertSucceeds(setDoc(ref, { lastActiveAt: new Date() }, { merge: true }));
    await assertSucceeds(setDoc(ref,
      { preferences: { notificationSettings: { emailNotifications: true } }, lastActiveAt: new Date() },
      { merge: true }));
    await assertSucceeds(setDoc(ref, { displayName: '앨리스', lastActiveAt: new Date() }, { merge: true }));
    await assertSucceeds(updateDoc(ref, {
      'preferences.favoriteStations': arrayUnion({ id: 'fav_1', stationId: '0222' }),
      lastActiveAt: new Date(),
    }));
  });

  it('denies changing email', async () => {
    const ref = await seed();
    await assertDenied(setDoc(ref, { email: 'victim@example.com' }, { merge: true }));
    await assertDenied(updateDoc(ref, { email: 'victim@example.com' }));
  });

  it('denies changing isAnonymous', async () => {
    const ref = await seed();
    await assertDenied(updateDoc(ref, { isAnonymous: true }));
  });

  it('still denies role/isAdmin escalation', async () => {
    const ref = await seed();
    await assertDenied(updateDoc(ref, { isAdmin: true }));
  });

  it("denies writing another user's doc", async () => {
    await seed();
    const mallory = dbAs('mallory');
    await assertDenied(setDoc(doc(mallory, 'users', 'alice'), { email: 'x@example.com' }, { merge: true }));
  });
});
