/**
 * Common credential → Firebase session bridge for social sign-in.
 *
 * - Anonymous upgrade: when the current user is anonymous, prefer
 *   `linkWithCredential` so per-uid data survives. If the credential is already
 *   bound to another account (`credential-already-in-use` /
 *   `email-already-in-use`), fall back to `signInWithCredential` using the
 *   reusable credential extracted from the error (Apple's one-time nonce cannot
 *   be reused, so extraction may be null → original credential fallback).
 * - Every failure exit routes through `toSocialAuthError`, so callers only ever
 *   see a `SocialAuthError` (Korean userMessage).
 */
import { FirebaseError } from 'firebase/app';
import {
  AuthCredential,
  OAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithCredential,
} from 'firebase/auth';

import { auth } from '@/services/firebase/config';
import { SocialAuthError, isSocialAuthError } from '@/services/auth/social/types';

/**
 * Human-readable Korean name for a Firebase sign-in method id, or null when the
 * method is unknown (so the caller can fall back to a generic message).
 */
const methodKoreanName = (method: string): string | null => {
  switch (method) {
    case 'password':
      return '이메일/비밀번호';
    case 'google.com':
      return 'Google';
    case 'apple.com':
      return 'Apple';
    case 'phone':
      return '휴대폰 인증';
    default:
      return null;
  }
};

/** Safely extract the conflicting email from a Firebase error's customData. */
const extractEmail = (error: FirebaseError): string | null => {
  const email = (error.customData as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.length > 0 ? email : null;
};

/**
 * Build the user-facing message for `account-exists-with-different-credential`.
 * Looks up existing sign-in methods (empty when email-enumeration protection is
 * on) and names the first recognised method in Korean.
 */
const buildAccountExistsMessage = async (error: FirebaseError): Promise<string> => {
  const email = extractEmail(error);
  let methods: string[] = [];
  if (email) {
    try {
      methods = await fetchSignInMethodsForEmail(auth, email);
    } catch {
      methods = [];
    }
  }
  const known = methods.map(methodKoreanName).find((n): n is string => n !== null);
  if (known) {
    return `이미 ${known}(으)로 가입된 이메일입니다. 해당 방법으로 로그인해주세요.`;
  }
  return '이미 다른 방법으로 가입된 이메일입니다. 기존 로그인 방법으로 로그인해주세요.';
};

/** Map any thrown error to a `SocialAuthError` with a Korean userMessage. */
const toSocialAuthError = async (
  error: unknown,
  providerLabel: string,
): Promise<SocialAuthError> => {
  if (isSocialAuthError(error)) {
    return error;
  }
  const code = (error as FirebaseError | undefined)?.code;
  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return new SocialAuthError(
        'account-exists',
        await buildAccountExistsMessage(error as FirebaseError),
      );
    case 'auth/network-request-failed':
      return new SocialAuthError('network', '네트워크 연결을 확인한 뒤 다시 시도해주세요.');
    case 'auth/operation-not-allowed':
      return new SocialAuthError('configuration', '현재 이 로그인 방식을 사용할 수 없습니다.');
    case 'auth/user-disabled':
    case 'auth/too-many-requests':
      return new SocialAuthError('server', '로그인 서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
    default:
      return new SocialAuthError('unknown', `${providerLabel} 로그인에 실패했습니다.`);
  }
};

export async function signInOrLinkWithCredential(
  credential: AuthCredential,
  providerLabel: string,
): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    if (currentUser?.isAnonymous) {
      try {
        await linkWithCredential(currentUser, credential);
        return;
      } catch (linkError) {
        const linkCode = (linkError as FirebaseError | undefined)?.code;
        if (
          linkCode === 'auth/credential-already-in-use' ||
          linkCode === 'auth/email-already-in-use'
        ) {
          const reusable =
            OAuthProvider.credentialFromError(linkError as FirebaseError) ?? credential;
          await signInWithCredential(auth, reusable);
          return;
        }
        throw linkError;
      }
    }
    await signInWithCredential(auth, credential);
  } catch (error) {
    throw await toSocialAuthError(error, providerLabel);
  }
}
