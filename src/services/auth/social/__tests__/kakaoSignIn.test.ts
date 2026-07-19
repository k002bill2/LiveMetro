/**
 * kakaoSignIn service tests.
 *
 * @react-native-seoul/kakao-login is loaded via dynamic `await import()`; under
 * jest, babel-plugin-dynamic-import-node (env.test) lowers that to a lazy
 * require so jest.mock intercepts it. Covers the accessToken → Cloud Function
 * kakaoLogin → custom-token flow, both cancellation shapes, empty accessToken,
 * the callable error mapping table, and the module-unavailable branch.
 */
import { Platform } from 'react-native';

// SUT import at the top; jest hoists the jest.mock() calls below above it.
import { signInWithKakao } from '@/services/auth/social/kakaoSignIn';

// firebase/auth: signInWithCustomToken.
const mockSignInWithCustomToken = jest.fn();

jest.mock('firebase/auth', () => ({
  __esModule: true,
  signInWithCustomToken: (...args: unknown[]) => mockSignInWithCustomToken(...args),
}));

// firebase/functions: httpsCallable returns the callable that hits kakaoLogin.
const mockCallable = jest.fn();
const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  __esModule: true,
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock('@/services/firebase/config', () => ({
  __esModule: true,
  auth: { currentUser: null },
  firestore: {},
  functions: {},
}));

// Native Kakao SDK, loaded via dynamic import inside the service.
const mockKakaoLogin = jest.fn();
let mockKakaoImportThrows = false;

jest.mock('@react-native-seoul/kakao-login', () => {
  if (mockKakaoImportThrows) {
    throw new Error('native module missing');
  }
  return {
    __esModule: true,
    login: (...args: unknown[]) => mockKakaoLogin(...args),
  };
});

const originalOS = Platform.OS;

const setOS = (os: typeof Platform.OS): void => {
  (Platform as { OS: string }).OS = os;
};

describe('signInWithKakao', () => {
  beforeEach(() => {
    setOS('ios');
    mockHttpsCallable.mockReturnValue((...args: unknown[]) => mockCallable(...args));
    mockKakaoLogin.mockResolvedValue({ accessToken: 'kakao-access-token' });
    mockCallable.mockResolvedValue({
      data: { token: 'firebase-custom-token', profile: { nickname: '카카오유저' } },
    });
    mockSignInWithCustomToken.mockResolvedValue({ user: { uid: 'kakao-uid' } });
  });

  afterEach(() => {
    setOS(originalOS);
  });

  it('exchanges the access token via the callable and signs in with the custom token', async () => {
    const result = await signInWithKakao();

    expect(mockKakaoLogin).toHaveBeenCalledTimes(1);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'kakaoLogin');
    expect(mockCallable).toHaveBeenCalledWith({ accessToken: 'kakao-access-token' });
    expect(mockSignInWithCustomToken).toHaveBeenCalledWith(
      expect.anything(),
      'firebase-custom-token',
    );
    expect(result).toEqual({ status: 'success' });
  });

  it('rejects with unsupported-platform on web', async () => {
    setOS('web');
    await expect(signInWithKakao()).rejects.toMatchObject({
      code: 'unsupported-platform',
      userMessage: expect.stringContaining('카카오'),
    });
    expect(mockKakaoLogin).not.toHaveBeenCalled();
  });

  it('returns cancelled when the SDK reports a cancellation message', async () => {
    mockKakaoLogin.mockRejectedValue({ message: 'user cancelled the login' });

    const result = await signInWithKakao();

    expect(result).toEqual({ status: 'cancelled' });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('returns cancelled when the SDK reports E_CANCELLED_OPERATION', async () => {
    mockKakaoLogin.mockRejectedValue({ code: 'E_CANCELLED_OPERATION' });

    const result = await signInWithKakao();

    expect(result).toEqual({ status: 'cancelled' });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('rejects with unknown on a generic login failure', async () => {
    mockKakaoLogin.mockRejectedValue({ code: 'E_UNKNOWN', message: 'boom' });

    await expect(signInWithKakao()).rejects.toMatchObject({
      code: 'unknown',
      userMessage: expect.stringContaining('카카오'),
    });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('rejects with unknown when the SDK returns an empty access token', async () => {
    mockKakaoLogin.mockResolvedValue({ accessToken: '' });

    await expect(signInWithKakao()).rejects.toMatchObject({ code: 'unknown' });
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('maps functions/unavailable to code network', async () => {
    mockCallable.mockRejectedValue({ code: 'functions/unavailable' });

    await expect(signInWithKakao()).rejects.toMatchObject({ code: 'network' });
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });

  it('maps functions/unauthenticated to code server', async () => {
    mockCallable.mockRejectedValue({ code: 'functions/unauthenticated' });

    await expect(signInWithKakao()).rejects.toMatchObject({ code: 'server' });
  });

  it('maps functions/failed-precondition to code configuration', async () => {
    mockCallable.mockRejectedValue({ code: 'functions/failed-precondition' });

    await expect(signInWithKakao()).rejects.toMatchObject({
      code: 'configuration',
      userMessage: expect.stringContaining('카카오'),
    });
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });

  it('maps an unrecognised callable error to code unknown', async () => {
    mockCallable.mockRejectedValue({ code: 'functions/weird' });

    await expect(signInWithKakao()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('rejects with module-unavailable when the native module import throws', async () => {
    mockKakaoImportThrows = true;
    jest.resetModules();

    try {
      await expect(signInWithKakao()).rejects.toMatchObject({ code: 'module-unavailable' });
    } finally {
      mockKakaoImportThrows = false;
      jest.resetModules();
    }
  });
});
