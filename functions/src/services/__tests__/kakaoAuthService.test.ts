/**
 * kakaoAuthService Tests
 *
 * Pure unit tests: fetch and firebase-admin Auth are injected as fakes, so no
 * network or emulator is required. Covers Kakao token verification (status/shape
 * mapping, app-mismatch defense, timeout) and the Firebase user upsert (update →
 * create-on-not-found, error propagation, undefined-field omission).
 */
import {
  verifyKakaoAccessToken,
  upsertKakaoFirebaseUser,
  KakaoAuthError,
  FetchLike,
  FetchResponseLike,
  AdminAuthLike,
  KakaoProfile,
} from '../kakaoAuthService';

const jsonResponse = (status: number, body: unknown): FetchResponseLike => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

// Fake fetch that returns/throws a distinct value for the token-info URL vs the
// user/me URL, based on the requested path.
const makeFetch = (
  tokenInfo: FetchResponseLike | Error,
  me?: FetchResponseLike | Error,
): FetchLike => {
  return async (url: string): Promise<FetchResponseLike> => {
    const target = url.includes('access_token_info') ? tokenInfo : me;
    if (target === undefined) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    if (target instanceof Error) {
      throw target;
    }
    return target;
  };
};

const abortError = (): Error => Object.assign(new Error('aborted'), { name: 'AbortError' });

// Await a promise expected to reject and hand back the thrown value (as unknown,
// so tests narrow it with `instanceof` rather than casting).
const captureError = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject, but it resolved');
    },
    (error: unknown) => error,
  );

describe('verifyKakaoAccessToken', () => {
  it('maps nickname/photo from kakao_account.profile on success', async () => {
    const fetchFn = makeFetch(
      jsonResponse(200, { id: 12345, app_id: 999 }),
      jsonResponse(200, {
        id: 12345,
        kakao_account: {
          profile: {
            nickname: 'Alice',
            profile_image_url: 'https://img/alice.png',
          },
        },
        properties: { nickname: 'ignored', profile_image: 'https://img/ignored.png' },
      }),
    );

    const profile = await verifyKakaoAccessToken('access-token', '999', fetchFn);

    expect(profile).toEqual({
      id: 12345,
      nickname: 'Alice',
      photoUrl: 'https://img/alice.png',
    });
  });

  it('falls back to properties when kakao_account is absent', async () => {
    const fetchFn = makeFetch(
      jsonResponse(200, { id: 777, app_id: 999 }),
      jsonResponse(200, {
        id: 777,
        properties: { nickname: 'Bob', profile_image: 'https://img/bob.png' },
      }),
    );

    const profile = await verifyKakaoAccessToken('access-token', '999', fetchFn);

    expect(profile).toEqual({
      id: 777,
      nickname: 'Bob',
      photoUrl: 'https://img/bob.png',
    });
  });

  it('returns null nickname/photo when both sources are missing', async () => {
    const fetchFn = makeFetch(
      jsonResponse(200, { id: 1, app_id: 999 }),
      jsonResponse(200, { id: 1 }),
    );

    const profile = await verifyKakaoAccessToken('access-token', '999', fetchFn);

    expect(profile).toEqual({ id: 1, nickname: null, photoUrl: null });
  });

  it('throws invalid-token on 401 token info', async () => {
    const fetchFn = makeFetch(jsonResponse(401, { msg: 'unauthorized' }));

    const error = await captureError(verifyKakaoAccessToken('bad', '999', fetchFn));

    expect(error).toBeInstanceOf(KakaoAuthError);
    if (error instanceof KakaoAuthError) {
      expect(error.kind).toBe('invalid-token');
    }
  });

  it('throws app-mismatch when app_id differs from expected', async () => {
    const fetchFn = makeFetch(jsonResponse(200, { id: 5, app_id: 111 }));

    const error = await captureError(verifyKakaoAccessToken('access-token', '999', fetchFn));

    expect(error).toBeInstanceOf(KakaoAuthError);
    if (error instanceof KakaoAuthError) {
      expect(error.kind).toBe('app-mismatch');
    }
  });

  it('throws kakao-unavailable on 5xx', async () => {
    const fetchFn = makeFetch(jsonResponse(503, { msg: 'service unavailable' }));

    const error = await captureError(verifyKakaoAccessToken('access-token', '999', fetchFn));

    expect(error).toBeInstanceOf(KakaoAuthError);
    if (error instanceof KakaoAuthError) {
      expect(error.kind).toBe('kakao-unavailable');
    }
  });

  it('throws timeout when the request is aborted', async () => {
    const fetchFn = makeFetch(abortError());

    const error = await captureError(verifyKakaoAccessToken('access-token', '999', fetchFn, 5));

    expect(error).toBeInstanceOf(KakaoAuthError);
    if (error instanceof KakaoAuthError) {
      expect(error.kind).toBe('timeout');
    }
  });

  it('throws malformed-response when token info lacks id', async () => {
    const fetchFn = makeFetch(jsonResponse(200, { app_id: 999 }));

    const error = await captureError(verifyKakaoAccessToken('access-token', '999', fetchFn));

    expect(error).toBeInstanceOf(KakaoAuthError);
    if (error instanceof KakaoAuthError) {
      expect(error.kind).toBe('malformed-response');
    }
  });
});

describe('upsertKakaoFirebaseUser', () => {
  const makeAdminAuth = (
    updateUser: jest.Mock,
    createUser: jest.Mock = jest.fn(async () => ({})),
  ): AdminAuthLike => ({
    updateUser,
    createUser,
    createCustomToken: jest.fn(async () => 'custom-token'),
  });

  it('updates an existing user without calling createUser', async () => {
    const updateUser = jest.fn(async () => ({}));
    const createUser = jest.fn(async () => ({}));
    const auth = makeAdminAuth(updateUser, createUser);
    const profile: KakaoProfile = { id: 42, nickname: 'Existing', photoUrl: 'https://img/e.png' };

    const uid = await upsertKakaoFirebaseUser(auth, profile);

    expect(uid).toBe('kakao:42');
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the user on auth/user-not-found with uid kakao:{id}', async () => {
    const updateUser = jest.fn(async () => {
      throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
    });
    const createUser = jest.fn(async () => ({}));
    const auth = makeAdminAuth(updateUser, createUser);
    const profile: KakaoProfile = { id: 7, nickname: 'New', photoUrl: 'https://img/n.png' };

    const uid = await upsertKakaoFirebaseUser(auth, profile);

    expect(uid).toBe('kakao:7');
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser).toHaveBeenCalledWith({
      uid: 'kakao:7',
      displayName: 'New',
      photoURL: 'https://img/n.png',
    });
  });

  it('propagates a non-not-found updateUser error', async () => {
    const updateUser = jest.fn(async () => {
      throw Object.assign(new Error('internal boom'), { code: 'auth/internal-error' });
    });
    const createUser = jest.fn(async () => ({}));
    const auth = makeAdminAuth(updateUser, createUser);
    const profile: KakaoProfile = { id: 9, nickname: 'X', photoUrl: null };

    await expect(upsertKakaoFirebaseUser(auth, profile)).rejects.toThrow('internal boom');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('omits displayName/photoURL keys when nickname and photo are null', async () => {
    const updateUser = jest.fn<
      Promise<unknown>,
      [string, { displayName?: string; photoURL?: string }]
    >(async () => ({}));
    const auth = makeAdminAuth(updateUser);
    const profile: KakaoProfile = { id: 3, nickname: null, photoUrl: null };

    await upsertKakaoFirebaseUser(auth, profile);

    const props = updateUser.mock.calls[0][1];
    expect(props).toStrictEqual({});
    expect(props).not.toHaveProperty('displayName');
    expect(props).not.toHaveProperty('photoURL');
  });
});
