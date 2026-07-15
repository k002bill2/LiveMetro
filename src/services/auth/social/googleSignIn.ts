/**
 * Google sign-in — native SDK idToken → GoogleAuthProvider credential →
 * Firebase link/sign-in.
 *
 * OTA safety: `@react-native-google-signin/google-signin` is a native module
 * that is only present in a dev/production binary, never in Expo Go or an older
 * OTA-updated binary. It is imported lazily inside the function; a failed import
 * yields `SocialAuthError('module-unavailable')` instead of a hard crash.
 * `import type` is compile-time only, so it does not pull the module at runtime.
 */
import { Platform } from 'react-native';
import { GoogleAuthProvider } from 'firebase/auth';

import {
  SocialAuthError,
  SocialSignInResult,
} from '@/services/auth/social/types';
import { signInOrLinkWithCredential } from '@/services/auth/social/firebaseCredentialSignIn';

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  if (Platform.OS === 'web') {
    throw new SocialAuthError(
      'unsupported-platform',
      '이 기기에서는 Google 로그인을 사용할 수 없습니다.',
    );
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new SocialAuthError('configuration', '현재 Google 로그인을 사용할 수 없습니다.');
  }

  let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin;
  let statusCodes: typeof import('@react-native-google-signin/google-signin').statusCodes;
  try {
    const mod = await import('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    statusCodes = mod.statusCodes;
  } catch {
    throw new SocialAuthError(
      'module-unavailable',
      '최신 버전의 앱이 필요합니다. 앱을 업데이트한 뒤 다시 시도해주세요.',
    );
  }

  GoogleSignin.configure({ webClientId });

  if (Platform.OS === 'android') {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    } catch {
      throw new SocialAuthError(
        'play-services-unavailable',
        'Google Play 서비스를 사용할 수 없습니다. Play 스토어에서 업데이트한 뒤 다시 시도해주세요.',
      );
    }
  }

  let idToken: string | null;
  try {
    const result = await GoogleSignin.signIn();
    idToken = result.idToken;
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { status: 'cancelled' };
    }
    if (code === statusCodes.IN_PROGRESS) {
      throw new SocialAuthError('unknown', '이미 로그인을 진행 중입니다. 잠시 후 다시 시도해주세요.');
    }
    throw new SocialAuthError('unknown', 'Google 로그인에 실패했습니다.');
  }

  if (!idToken) {
    throw new SocialAuthError('configuration', '현재 Google 로그인을 사용할 수 없습니다.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await signInOrLinkWithCredential(credential, 'Google');
  return { status: 'success' };
}
