/**
 * Kakao sign-in — native SDK accessToken → Cloud Function `kakaoLogin`
 * (server-side verification) → Firebase custom token → signInWithCustomToken.
 *
 * NOTE: Kakao uses a Firebase custom token, so it CANNOT be linked onto an
 * existing anonymous account — `signInWithCustomToken` replaces the current
 * session. Anonymous per-uid data is therefore not carried over on Kakao login.
 *
 * OTA safety: `@react-native-seoul/kakao-login` is imported lazily; a failed
 * import yields `SocialAuthError('module-unavailable')` rather than a crash.
 */
import { Platform } from 'react-native';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/services/firebase/config';
import {
  SocialAuthError,
  SocialSignInResult,
} from '@/services/auth/social/types';

interface KakaoLoginRequest {
  accessToken: string;
}

interface KakaoLoginResponse {
  token: string;
  profile: { nickname: string | null };
}

/** Detect user-cancellation across iOS/Android Kakao SDK error shapes. */
const isKakaoCancellation = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string } | undefined;
  return /cancel/i.test(`${e?.code ?? ''}${e?.message ?? ''}`);
};

/** Map a callable/auth error to a Korean SocialAuthError. */
const mapKakaoCallableError = (error: unknown): SocialAuthError => {
  const code = (error as { code?: string } | undefined)?.code;
  switch (code) {
    case 'functions/failed-precondition':
      return new SocialAuthError('configuration', '현재 카카오 로그인을 사용할 수 없습니다.');
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'auth/network-request-failed':
      return new SocialAuthError('network', '네트워크 연결을 확인한 뒤 다시 시도해주세요.');
    case 'functions/unauthenticated':
    case 'functions/permission-denied':
      return new SocialAuthError('server', '카카오 인증에 실패했습니다. 다시 시도해주세요.');
    case 'functions/invalid-argument':
    case 'functions/internal':
      return new SocialAuthError('server', '카카오 인증에 실패했습니다. 다시 시도해주세요.');
    default:
      return new SocialAuthError('unknown', '카카오 로그인에 실패했습니다.');
  }
};

export async function signInWithKakao(): Promise<SocialSignInResult> {
  if (Platform.OS === 'web') {
    throw new SocialAuthError(
      'unsupported-platform',
      '이 기기에서는 카카오 로그인을 사용할 수 없습니다.',
    );
  }

  let kakaoLogin: typeof import('@react-native-seoul/kakao-login').login;
  try {
    const mod = await import('@react-native-seoul/kakao-login');
    kakaoLogin = mod.login;
  } catch {
    throw new SocialAuthError(
      'module-unavailable',
      '최신 버전의 앱이 필요합니다. 앱을 업데이트한 뒤 다시 시도해주세요.',
    );
  }

  let accessToken: string;
  try {
    const token = await kakaoLogin();
    accessToken = token.accessToken;
  } catch (error) {
    if (isKakaoCancellation(error)) {
      return { status: 'cancelled' };
    }
    throw new SocialAuthError('unknown', '카카오 로그인에 실패했습니다.');
  }

  if (!accessToken) {
    throw new SocialAuthError('unknown', '카카오 로그인에 실패했습니다.');
  }

  try {
    const callable = httpsCallable<KakaoLoginRequest, KakaoLoginResponse>(
      functions,
      'kakaoLogin',
    );
    const { data } = await callable({ accessToken });
    await signInWithCustomToken(auth, data.token);
    return { status: 'success' };
  } catch (error) {
    throw mapKakaoCallableError(error);
  }
}
