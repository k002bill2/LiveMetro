/**
 * Native social SDK session cleanup — Google / Kakao.
 *
 * Firebase `signOut()` only ends the Firebase session. The native SDKs keep
 * their own: the Android Google Sign-In client (`GoogleSignIn.getClient`, used
 * by google-signin v16 `signIn()` → `getSignInIntent()`) silently returns the
 * last signed-in account until `GoogleSignin.signOut()` is called, so without
 * this the account chooser never reappears after logout. Kakao keeps its
 * OAuth token until `logout()`.
 *
 * Contract: best-effort, never throws, bounded by a per-provider timeout so a
 * hung native call cannot block Firebase sign-out. Both SDKs are imported
 * lazily (OTA safety, same as the sign-in services): a binary without the
 * native module, or web, is a silent no-op. Calling either SDK while not
 * signed in to it rejects — that rejection is swallowed.
 */
import { Platform } from 'react-native';

/** Upper bound for one provider's cleanup (providers run in parallel). */
export const SOCIAL_SDK_CLEANUP_TIMEOUT_MS = 3000;

/**
 * Which provider grants to revoke (account deletion only). Plain sign-out
 * passes nothing → local SDK sign-out only, the app grant is kept.
 */
export interface SocialSdkRevocation {
  readonly google: boolean;
  readonly kakao: boolean;
}

const NO_REVOCATION: SocialSdkRevocation = Object.freeze({ google: false, kakao: false });

interface RevocationSubject {
  readonly uid: string;
  readonly providerData?: readonly { readonly providerId: string }[];
}

/**
 * Derive revocation targets from the account being deleted. Only that
 * account's own provider is revoked — never a provider it was not signed in
 * with. Kakao accounts are Firebase custom-token users with uid `kakao:{id}`
 * (functions/src/services/kakaoAuthService.ts), so they carry no providerData.
 */
export function getSocialRevocationTargets(
  user: RevocationSubject | null | undefined,
): SocialSdkRevocation {
  if (!user) return NO_REVOCATION;
  return {
    google: (user.providerData ?? []).some((p) => p.providerId === 'google.com'),
    kakao: user.uid.startsWith('kakao:'),
  };
}

/** Dev-only diagnostics; logs the step and an error code only (no PII/tokens). */
const logStep = (step: string, error: unknown): void => {
  if (!__DEV__) return;
  const code = (error as { code?: unknown } | undefined)?.code;
  // eslint-disable-next-line no-console
  console.warn(`[socialSdkSessions] ${step} failed`, typeof code === 'string' ? code : '');
};

/** Run one SDK call; resolves true on success, false on failure. Never rejects. */
const attempt = async (step: string, call: () => Promise<unknown>): Promise<boolean> => {
  try {
    await call();
    return true;
  } catch (error) {
    logStep(step, error);
    return false;
  }
};

/** Resolve after `ms` or when `task` settles, whichever is first. Never rejects. */
const withTimeout = async (step: string, task: Promise<void>, ms: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      logStep(`${step} (timeout)`, undefined);
      resolve();
    }, ms);
  });
  try {
    // `task` is built from `attempt`, so it never rejects — no late unhandled rejection.
    await Promise.race([task, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const clearGoogle = async (revoke: boolean): Promise<void> => {
  let sdk: typeof import('@react-native-google-signin/google-signin');
  try {
    sdk = await import('@react-native-google-signin/google-signin');
  } catch {
    return; // native module absent in this binary
  }
  const { GoogleSignin } = sdk;

  // Android rejects signOut/revokeAccess with "apiClient is null" until
  // configure() has run in this process — a cold-started app that never opened
  // the sign-in flow would otherwise keep the cached account.
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (webClientId) {
    try {
      GoogleSignin.configure({ webClientId });
    } catch (error) {
      logStep('google.configure', error);
    }
  }

  // revokeAccess needs the live account, so it must precede signOut.
  if (revoke) {
    await attempt('google.revokeAccess', () => GoogleSignin.revokeAccess());
  }
  await attempt('google.signOut', () => GoogleSignin.signOut());
};

const clearKakao = async (unlink: boolean): Promise<void> => {
  let sdk: typeof import('@react-native-seoul/kakao-login');
  try {
    sdk = await import('@react-native-seoul/kakao-login');
  } catch {
    return; // native module absent in this binary
  }

  // unlink also discards the local token; fall back to logout if it fails
  // (offline, token already expired) so the local session is still cleared.
  if (unlink && (await attempt('kakao.unlink', () => sdk.unlink()))) {
    return;
  }
  await attempt('kakao.logout', () => sdk.logout());
};

/**
 * Clear native Google/Kakao SDK sessions. Safe to call regardless of which
 * provider (if any) the user signed in with. Resolves within
 * {@link SOCIAL_SDK_CLEANUP_TIMEOUT_MS}; never rejects.
 */
export async function clearSocialSdkSessions(
  revoke: SocialSdkRevocation = NO_REVOCATION,
): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all([
    withTimeout('google', clearGoogle(revoke.google), SOCIAL_SDK_CLEANUP_TIMEOUT_MS),
    withTimeout('kakao', clearKakao(revoke.kakao), SOCIAL_SDK_CLEANUP_TIMEOUT_MS),
  ]);
}
