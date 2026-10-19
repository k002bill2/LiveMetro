/**
 * Firestore security-rules test helpers (emulator only, zero extra deps).
 *
 * Uses the already-installed `firebase` client SDK with `mockUserToken`, so no
 * @firebase/rules-unit-testing dependency is needed. Run via
 * `npm run test:rules` (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST).
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';
import assert from 'node:assert/strict';

export const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-livemetro';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulatorHost) {
  throw new Error('FIRESTORE_EMULATOR_HOST is not set — run via `npm run test:rules`.');
}
const [host, portStr] = emulatorHost.split(':');
const port = Number(portStr);

const opened = [];

/** Firestore instance authenticated as `uid` (or unauthenticated when null). */
export function dbAs(uid) {
  const app = initializeApp({ projectId: PROJECT_ID }, `app-${uid ?? 'anon'}-${opened.length}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port, uid ? { mockUserToken: { user_id: uid } } : undefined);
  opened.push({ app, db });
  return db;
}

export async function cleanup() {
  for (const { app, db } of opened.splice(0)) {
    await terminate(db);
    await deleteApp(app);
  }
}

export async function clearData() {
  const res = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  assert.ok(res.ok, `clearData failed: ${res.status}`);
}

export async function assertSucceeds(promise) {
  await promise;
}

export async function assertDenied(promise) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, 'permission-denied', `expected permission-denied, got ${err.code}`);
    return true;
  });
}
