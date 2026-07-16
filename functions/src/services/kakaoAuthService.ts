/**
 * Kakao Auth Service
 *
 * Server-side verification of a Kakao access token (against kapi.kakao.com) and
 * upsert of the corresponding Firebase Auth user. Written as pure logic with
 * dependency injection (a `fetch`-like function + a firebase-admin Auth-like
 * object) so it can be unit-tested without an emulator or network.
 *
 * This module intentionally does NOT import firebase-admin — index.ts injects
 * `admin.auth()`. It never logs the access token or raw Kakao response bodies.
 */

const KAKAO_TOKEN_INFO_URL = 'https://kapi.kakao.com/v1/user/access_token_info';
const KAKAO_USER_ME_URL = 'https://kapi.kakao.com/v2/user/me';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface KakaoProfile {
  id: number;
  nickname: string | null;
  photoUrl: string | null;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: { method: 'GET'; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<FetchResponseLike>;

export type KakaoAuthErrorKind =
  | 'invalid-token'
  | 'app-mismatch'
  | 'kakao-unavailable'
  | 'timeout'
  | 'malformed-response';

export class KakaoAuthError extends Error {
  constructor(
    readonly kind: KakaoAuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'KakaoAuthError';
  }
}

export interface AdminAuthLike {
  updateUser(uid: string, props: { displayName?: string; photoURL?: string }): Promise<unknown>;
  createUser(props: { uid: string; displayName?: string; photoURL?: string }): Promise<unknown>;
  createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * GET `url` with a Bearer token and a hard timeout. Maps transport failures to
 * KakaoAuthError: an aborted request → 'timeout', any other rejection (network
 * error, DNS, TLS) → 'kakao-unavailable'. Status/shape mapping happens in the
 * caller. The timer is always cleared so no dangling handle survives resolve.
 */
async function fetchKakao(
  url: string,
  accessToken: string,
  fetchFn: FetchLike,
  timeoutMs: number,
): Promise<FetchResponseLike> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
  } catch (error) {
    if (isRecord(error) && error.name === 'AbortError') {
      throw new KakaoAuthError('timeout', 'Kakao 서버 응답이 지연되었습니다.');
    }
    throw new KakaoAuthError('kakao-unavailable', 'Kakao 서버에 연결할 수 없습니다.');
  } finally {
    clearTimeout(timer);
  }
}

const assertKakaoResponseOk = (response: FetchResponseLike): void => {
  if (response.status === 401) {
    throw new KakaoAuthError('invalid-token', 'Kakao 액세스 토큰이 유효하지 않습니다.');
  }
  if (!response.ok) {
    throw new KakaoAuthError('kakao-unavailable', 'Kakao 서버에 연결할 수 없습니다.');
  }
};

/**
 * Verify a Kakao access token server-side and return the user's profile.
 *
 * 1. token info → guards `{ id, app_id }`. A token issued for a different Kakao
 *    app is rejected ('app-mismatch') — this is the core defense against a
 *    token minted by an attacker's app being replayed here.
 * 2. user/me → nickname & photo, tolerating missing fields via `?? null`.
 */
export async function verifyKakaoAccessToken(
  accessToken: string,
  expectedAppId: string,
  fetchFn: FetchLike,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<KakaoProfile> {
  const tokenInfoResponse = await fetchKakao(KAKAO_TOKEN_INFO_URL, accessToken, fetchFn, timeoutMs);
  assertKakaoResponseOk(tokenInfoResponse);

  const tokenInfo = await tokenInfoResponse.json();
  if (!isRecord(tokenInfo) || typeof tokenInfo.id !== 'number' || typeof tokenInfo.app_id !== 'number') {
    throw new KakaoAuthError('malformed-response', 'Kakao 응답 형식이 올바르지 않습니다.');
  }
  if (String(tokenInfo.app_id) !== expectedAppId) {
    throw new KakaoAuthError('app-mismatch', '허용되지 않은 Kakao 앱에서 발급된 토큰입니다.');
  }

  const meResponse = await fetchKakao(KAKAO_USER_ME_URL, accessToken, fetchFn, timeoutMs);
  assertKakaoResponseOk(meResponse);

  const me = await meResponse.json();
  if (!isRecord(me)) {
    throw new KakaoAuthError('malformed-response', 'Kakao 응답 형식이 올바르지 않습니다.');
  }

  const kakaoAccount = isRecord(me.kakao_account) ? me.kakao_account : undefined;
  const profile = kakaoAccount && isRecord(kakaoAccount.profile) ? kakaoAccount.profile : undefined;
  const properties = isRecord(me.properties) ? me.properties : undefined;

  const nickname = readString(profile?.nickname) ?? readString(properties?.nickname) ?? null;
  const photoUrl =
    readString(profile?.profile_image_url) ?? readString(properties?.profile_image) ?? null;

  return { id: tokenInfo.id, nickname, photoUrl };
}

/**
 * Upsert the Firebase Auth user for a Kakao profile and return its uid
 * (`kakao:{id}`). Tries updateUser first; only on `auth/user-not-found` does it
 * createUser. Null profile fields are omitted entirely (never sent as
 * `undefined`, which firebase-admin rejects).
 */
export async function upsertKakaoFirebaseUser(
  adminAuth: AdminAuthLike,
  profile: KakaoProfile,
): Promise<string> {
  const uid = `kakao:${profile.id}`;
  const props: { displayName?: string; photoURL?: string } = {
    ...(profile.nickname !== null ? { displayName: profile.nickname } : {}),
    ...(profile.photoUrl !== null ? { photoURL: profile.photoUrl } : {}),
  };

  try {
    await adminAuth.updateUser(uid, props);
  } catch (error) {
    if (isRecord(error) && error.code === 'auth/user-not-found') {
      await adminAuth.createUser({ uid, ...props });
    } else {
      throw error;
    }
  }

  return uid;
}
