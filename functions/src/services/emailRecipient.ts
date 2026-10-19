/**
 * Email recipient resolution (F-02).
 *
 * The recipient address must come ONLY from the Firebase Auth record, and only
 * when that email is verified. The Firestore `users/{uid}` doc is
 * client-writable, so its `email` / `isAnonymous` fields are never trusted for
 * routing. Opt-in preferences are still read from Firestore (a user can only
 * opt themselves in, which is harmless once the address is auth-bound).
 *
 * Pure (no firebase imports): the Auth lookup is injected.
 */

/** Minimal shape of `admin.auth.UserRecord` that recipient resolution needs. */
export interface AuthUserLike {
  email?: string;
  emailVerified: boolean;
}

/** Minimal opt-in preferences read from the Firestore users doc. */
export interface EmailOptInPrefs {
  enabled: boolean;
  emailNotifications: boolean;
}

export type RecipientResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const NO_VERIFIED_EMAIL_MESSAGE =
  '인증된 이메일 주소가 없습니다. 이메일 인증 후 다시 시도해 주세요.';
const LOOKUP_FAILED_MESSAGE =
  '사용자 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.';

/**
 * Return the auth email only if it is non-empty and verified. Anonymous,
 * phone-only and Kakao custom-token users have no email and resolve to null.
 */
export function resolveVerifiedRecipient(authUser: AuthUserLike | null): string | null {
  if (authUser === null || authUser.emailVerified !== true) {
    return null;
  }
  const email = authUser.email;
  return typeof email === 'string' && email.length > 0 ? email : null;
}

/**
 * Look up the auth user for `uid` and resolve a verified recipient. A lookup
 * failure (e.g. user-not-found) maps to a generic Korean message; only the uid
 * is logged, never the error detail (it can contain PII).
 */
export async function resolveRecipientForUid(
  uid: string,
  getAuthUser: (uid: string) => Promise<AuthUserLike>,
): Promise<RecipientResult> {
  let authUser: AuthUserLike;
  try {
    authUser = await getAuthUser(uid);
  } catch {
    console.error(`Email recipient lookup failed (uid: ${uid})`);
    return { ok: false, error: LOOKUP_FAILED_MESSAGE };
  }

  const email = resolveVerifiedRecipient(authUser);
  return email === null
    ? { ok: false, error: NO_VERIFIED_EMAIL_MESSAGE }
    : { ok: true, email };
}

/** Opt-in requires both the master notification switch and email notifications. */
export function isEmailOptInEnabled(prefs: EmailOptInPrefs | null): boolean {
  return prefs !== null && prefs.enabled === true && prefs.emailNotifications === true;
}
