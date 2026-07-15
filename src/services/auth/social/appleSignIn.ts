/**
 * Apple sign-in — expo-apple-authentication + SHA256 nonce (expo-crypto) →
 * OAuthProvider('apple.com') credential → Firebase link/sign-in.
 *
 * OTA safety: native modules are imported lazily inside the functions; a failed
 * import yields `SocialAuthError('module-unavailable')` rather than a crash.
 * `import type` references are compile-time only.
 */
import { Platform } from 'react-native';
import { OAuthProvider, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { AppleAuthenticationFullName } from 'expo-apple-authentication';

import { auth, firestore } from '@/services/firebase/config';
import {
  SocialAuthError,
  SocialSignInResult,
} from '@/services/auth/social/types';
import { signInOrLinkWithCredential } from '@/services/auth/social/firebaseCredentialSignIn';

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    const AppleAuthentication = await import('expo-apple-authentication');
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Convert random bytes to a lowercase hex string for use as the raw nonce. */
const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Best-effort: Apple returns fullName only on the FIRST authorization. If the
 * signed-in user has no displayName yet, persist it to Auth + Firestore. Any
 * failure here must not fail the login.
 */
const reflectAppleFullName = async (
  fullName: AppleAuthenticationFullName | null,
): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.displayName) {
      return;
    }
    const displayName = [fullName?.familyName, fullName?.givenName]
      .filter(Boolean)
      .join('');
    if (!displayName) {
      return;
    }
    // updateProfile FIRST: the auth listener's createOrGetUserDocument seeds a
    // new user doc from firebaseUser.displayName, so this value is picked up
    // when the doc is created there.
    await updateProfile(currentUser, { displayName });
    // Only write to an EXISTING doc. setDoc(merge:true) would CREATE a missing
    // doc, making createOrGetUserDocument take its "exists" branch and skip
    // initializing preferences/subscription/createdAt — a race that leaves a
    // partial user document.
    const userRef = doc(firestore, 'users', currentUser.uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      await setDoc(userRef, { displayName }, { merge: true });
    }
  } catch {
    // best-effort: name reflection must not fail the sign-in.
  }
};

export async function signInWithApple(): Promise<SocialSignInResult> {
  if (Platform.OS !== 'ios') {
    throw new SocialAuthError(
      'unsupported-platform',
      '이 기기에서는 Apple 로그인을 사용할 수 없습니다.',
    );
  }

  let AppleAuthentication: typeof import('expo-apple-authentication');
  let Crypto: typeof import('expo-crypto');
  try {
    AppleAuthentication = await import('expo-apple-authentication');
    Crypto = await import('expo-crypto');
  } catch {
    throw new SocialAuthError(
      'module-unavailable',
      '최신 버전의 앱이 필요합니다. 앱을 업데이트한 뒤 다시 시도해주세요.',
    );
  }

  const rawNonce = toHex(await Crypto.getRandomBytesAsync(32));
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let appleCredential: import('expo-apple-authentication').AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if ((error as { code?: string } | undefined)?.code === 'ERR_REQUEST_CANCELED') {
      return { status: 'cancelled' };
    }
    throw new SocialAuthError('unknown', 'Apple 로그인에 실패했습니다.');
  }

  const { identityToken, fullName } = appleCredential;
  if (!identityToken) {
    throw new SocialAuthError('unknown', 'Apple 로그인에 실패했습니다.');
  }

  const firebaseCredential = new OAuthProvider('apple.com').credential({
    idToken: identityToken,
    rawNonce,
  });
  await signInOrLinkWithCredential(firebaseCredential, 'Apple');
  await reflectAppleFullName(fullName);
  return { status: 'success' };
}
