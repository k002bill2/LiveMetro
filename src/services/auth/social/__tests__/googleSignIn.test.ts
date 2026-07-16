/**
 * googleSignIn service tests.
 *
 * The service loads @react-native-google-signin/google-signin via a dynamic
 * `await import()`. Under jest, babel-plugin-dynamic-import-node (env.test)
 * lowers that to a lazy require, so `jest.mock` intercepts it and the full flow
 * (configure → credential → Firebase bridge) plus every status-code branch is
 * reachable. The module-unavailable branch is simulated with a toggled factory
 * + resetModules so the running service re-requires the throwing module.
 */
import { Platform } from 'react-native';

// SUT import at the top; jest hoists the jest.mock() calls below above it.
import { signInWithGoogle } from '@/services/auth/social/googleSignIn';

// firebase/auth: only GoogleAuthProvider.credential is used here.
const mockGoogleCredential = jest.fn(
  (token: string) => ({ providerId: 'google.com', token }) as unknown,
);

jest.mock('firebase/auth', () => ({
  __esModule: true,
  GoogleAuthProvider: {
    credential: (...args: unknown[]) => mockGoogleCredential(...(args as [string])),
  },
}));

// The credential → Firebase bridge is exercised in its own suite; stub it.
const mockSignInOrLink = jest.fn();

jest.mock('@/services/auth/social/firebaseCredentialSignIn', () => ({
  __esModule: true,
  signInOrLinkWithCredential: (...args: unknown[]) => mockSignInOrLink(...args),
}));

// Native Google SDK, loaded via dynamic import inside the service.
const mockGoogleConfigure = jest.fn();
const mockGoogleHasPlayServices = jest.fn();
const mockGoogleSignInCall = jest.fn();
const mockGoogleStatusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
};
// Toggle to simulate an OTA binary missing the native module: the factory reads
// it at require time, so the module-unavailable test flips it and busts the
// module cache via resetModules.
let mockGoogleImportThrows = false;

jest.mock('@react-native-google-signin/google-signin', () => {
  if (mockGoogleImportThrows) {
    throw new Error('native module missing');
  }
  return {
    __esModule: true,
    GoogleSignin: {
      configure: (...args: unknown[]) => mockGoogleConfigure(...args),
      hasPlayServices: (...args: unknown[]) => mockGoogleHasPlayServices(...args),
      signIn: (...args: unknown[]) => mockGoogleSignInCall(...args),
    },
    statusCodes: mockGoogleStatusCodes,
  };
});

const WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';
const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const originalOS = Platform.OS;

const setOS = (os: typeof Platform.OS): void => {
  (Platform as { OS: string }).OS = os;
};

describe('signInWithGoogle', () => {
  beforeEach(() => {
    setOS('ios');
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = WEB_CLIENT_ID;
    mockGoogleSignInCall.mockResolvedValue({ idToken: 'id-token-123' });
    mockGoogleHasPlayServices.mockResolvedValue(true);
    mockSignInOrLink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setOS(originalOS);
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalEnv;
    }
  });

  it('configures with the web client id, builds a credential, and reports success', async () => {
    const result = await signInWithGoogle();

    expect(mockGoogleConfigure).toHaveBeenCalledWith({ webClientId: WEB_CLIENT_ID });
    expect(mockGoogleCredential).toHaveBeenCalledWith('id-token-123');
    expect(mockSignInOrLink).toHaveBeenCalledWith(
      { providerId: 'google.com', token: 'id-token-123' },
      'Google',
    );
    expect(result).toEqual({ status: 'success' });
  });

  it('rejects with unsupported-platform on web', async () => {
    setOS('web');
    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: 'unsupported-platform',
      userMessage: expect.stringContaining('Google'),
    });
    expect(mockGoogleConfigure).not.toHaveBeenCalled();
  });

  it('rejects with configuration when the web client id env is missing', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'configuration' });
    expect(mockGoogleConfigure).not.toHaveBeenCalled();
    expect(mockSignInOrLink).not.toHaveBeenCalled();
  });

  it('returns cancelled (not an error) on SIGN_IN_CANCELLED', async () => {
    mockGoogleSignInCall.mockRejectedValue({ code: mockGoogleStatusCodes.SIGN_IN_CANCELLED });

    const result = await signInWithGoogle();

    expect(result).toEqual({ status: 'cancelled' });
    expect(mockSignInOrLink).not.toHaveBeenCalled();
  });

  it('rejects with unknown (in-progress message) on IN_PROGRESS', async () => {
    mockGoogleSignInCall.mockRejectedValue({ code: mockGoogleStatusCodes.IN_PROGRESS });

    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: 'unknown',
      userMessage: expect.stringContaining('진행 중'),
    });
    expect(mockSignInOrLink).not.toHaveBeenCalled();
  });

  it('rejects with unknown on any other sign-in error', async () => {
    mockGoogleSignInCall.mockRejectedValue({ code: 'SOMETHING_ELSE' });

    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: 'unknown',
      userMessage: expect.stringContaining('Google'),
    });
  });

  it('rejects with play-services-unavailable when Play services check fails on Android', async () => {
    setOS('android');
    mockGoogleHasPlayServices.mockRejectedValue(new Error('no play services'));

    await expect(signInWithGoogle()).rejects.toMatchObject({
      code: 'play-services-unavailable',
    });
    expect(mockGoogleSignInCall).not.toHaveBeenCalled();
  });

  it('checks Play services on Android before signing in', async () => {
    setOS('android');

    await signInWithGoogle();

    expect(mockGoogleHasPlayServices).toHaveBeenCalledWith({
      showPlayServicesUpdateDialog: true,
    });
    expect(mockSignInOrLink).toHaveBeenCalled();
  });

  it('rejects with configuration when the SDK returns a null idToken', async () => {
    mockGoogleSignInCall.mockResolvedValue({ idToken: null });

    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'configuration' });
    expect(mockSignInOrLink).not.toHaveBeenCalled();
  });

  it('rejects with module-unavailable when the native module import throws', async () => {
    // The native module is loaded via a dynamic import() at call time. Flip the
    // factory to throw and bust the module cache so the running service
    // re-requires it and hits the failed-import branch.
    mockGoogleImportThrows = true;
    jest.resetModules();

    try {
      await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'module-unavailable' });
    } finally {
      mockGoogleImportThrows = false;
      jest.resetModules();
    }
  });
});
