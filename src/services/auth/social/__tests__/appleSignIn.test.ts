/**
 * appleSignIn service tests.
 *
 * expo-apple-authentication + expo-crypto are loaded via dynamic `await
 * import()`; under jest, babel-plugin-dynamic-import-node (env.test) lowers that
 * to a lazy require so jest.mock intercepts it. Covers the SHA256-nonce flow,
 * the OAuthProvider('apple.com') credential, user cancellation, null identity
 * token, best-effort fullName reflection, the module-unavailable branch, and
 * isAppleSignInAvailable's three outcomes.
 */
import { Platform } from 'react-native';

// SUT import at the top; jest hoists the jest.mock() calls below above it.
import {
  signInWithApple,
  isAppleSignInAvailable,
} from '@/services/auth/social/appleSignIn';

// firebase/auth: OAuthProvider (constructed with a providerId, then .credential)
// and updateProfile.
const mockOAuthConstruct = jest.fn();
const mockOAuthCredential = jest.fn(
  (arg: { idToken: string; rawNonce: string }) => ({ providerId: 'apple.com', ...arg }),
);
const mockUpdateProfile = jest.fn();

jest.mock('firebase/auth', () => ({
  __esModule: true,
  OAuthProvider: class {
    constructor(providerId: string) {
      mockOAuthConstruct(providerId);
    }
    credential(arg: { idToken: string; rawNonce: string }): unknown {
      return mockOAuthCredential(arg);
    }
  },
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// firebase/firestore: doc + getDoc + setDoc for the best-effort name write.
// setDoc must only fire when getDoc reports the user doc already exists.
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

// Firebase config — mutable currentUser drives reflectAppleFullName.
const mockCurrentUser: { value: { uid?: string; displayName?: string | null } | null } = {
  value: null,
};

jest.mock('@/services/firebase/config', () => ({
  __esModule: true,
  auth: {
    get currentUser() {
      return mockCurrentUser.value;
    },
  },
  firestore: {},
  functions: {},
}));

// The credential → Firebase bridge is exercised in its own suite; stub it.
const mockSignInOrLink = jest.fn();

jest.mock('@/services/auth/social/firebaseCredentialSignIn', () => ({
  __esModule: true,
  signInOrLinkWithCredential: (...args: unknown[]) => mockSignInOrLink(...args),
}));

// Native modules loaded via dynamic import inside the service.
const mockIsAvailableAsync = jest.fn();
const mockSignInAsync = jest.fn();
const mockGetRandomBytes = jest.fn();
const mockDigestString = jest.fn();
let mockAppleImportThrows = false;

jest.mock('expo-apple-authentication', () => {
  if (mockAppleImportThrows) {
    throw new Error('native module missing');
  }
  return {
    __esModule: true,
    isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
    signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
    AppleAuthenticationScope: { FULL_NAME: 'FULL_NAME', EMAIL: 'EMAIL' },
  };
});

jest.mock('expo-crypto', () => ({
  __esModule: true,
  getRandomBytesAsync: (...args: unknown[]) => mockGetRandomBytes(...args),
  digestStringAsync: (...args: unknown[]) => mockDigestString(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const FIXED_BYTES = new Uint8Array(32).fill(0xab);
const EXPECTED_RAW_NONCE = 'ab'.repeat(32);
const originalOS = Platform.OS;

const setOS = (os: typeof Platform.OS): void => {
  (Platform as { OS: string }).OS = os;
};

describe('signInWithApple', () => {
  beforeEach(() => {
    setOS('ios');
    mockCurrentUser.value = null;
    mockDoc.mockReturnValue('userDocRef');
    mockGetDoc.mockResolvedValue({ exists: () => true });
    mockGetRandomBytes.mockResolvedValue(FIXED_BYTES);
    mockDigestString.mockResolvedValue('hashed-nonce');
    mockSignInAsync.mockResolvedValue({ identityToken: 'apple-id-token', fullName: null });
    mockSignInOrLink.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setOS(originalOS);
  });

  it('hashes a nonce, builds an apple.com credential, and reports success', async () => {
    const result = await signInWithApple();

    expect(mockGetRandomBytes).toHaveBeenCalledWith(32);
    expect(mockDigestString).toHaveBeenCalledWith('SHA-256', EXPECTED_RAW_NONCE);
    expect(mockSignInAsync).toHaveBeenCalledWith({
      requestedScopes: ['FULL_NAME', 'EMAIL'],
      nonce: 'hashed-nonce',
    });
    expect(mockOAuthConstruct).toHaveBeenCalledWith('apple.com');
    expect(mockOAuthCredential).toHaveBeenCalledWith({
      idToken: 'apple-id-token',
      rawNonce: EXPECTED_RAW_NONCE,
    });
    expect(mockSignInOrLink).toHaveBeenCalledWith(
      { providerId: 'apple.com', idToken: 'apple-id-token', rawNonce: EXPECTED_RAW_NONCE },
      'Apple',
    );
    expect(result).toEqual({ status: 'success' });
  });

  it('rejects with unsupported-platform on Android', async () => {
    setOS('android');
    await expect(signInWithApple()).rejects.toMatchObject({
      code: 'unsupported-platform',
      userMessage: expect.stringContaining('Apple'),
    });
    expect(mockSignInAsync).not.toHaveBeenCalled();
  });

  it('rejects with unsupported-platform on web', async () => {
    setOS('web');
    await expect(signInWithApple()).rejects.toMatchObject({ code: 'unsupported-platform' });
  });

  it('returns cancelled on ERR_REQUEST_CANCELED', async () => {
    mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    const result = await signInWithApple();

    expect(result).toEqual({ status: 'cancelled' });
    expect(mockSignInOrLink).not.toHaveBeenCalled();
  });

  it('rejects with unknown on any other native sign-in error', async () => {
    mockSignInAsync.mockRejectedValue({ code: 'ERR_SOMETHING' });

    await expect(signInWithApple()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('rejects with unknown when the identity token is null', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null, fullName: null });

    await expect(signInWithApple()).rejects.toMatchObject({ code: 'unknown' });
    expect(mockSignInOrLink).not.toHaveBeenCalled();
  });

  it('persists the fullName to Auth + Firestore when the user doc already exists', async () => {
    mockCurrentUser.value = { uid: 'apple-uid', displayName: null };
    mockGetDoc.mockResolvedValue({ exists: () => true });
    mockSignInAsync.mockResolvedValue({
      identityToken: 'apple-id-token',
      fullName: { familyName: '길동', givenName: '홍' },
    });

    const result = await signInWithApple();

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      { uid: 'apple-uid', displayName: null },
      { displayName: '길동홍' },
    );
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'apple-uid');
    expect(mockGetDoc).toHaveBeenCalledWith('userDocRef');
    expect(mockSetDoc).toHaveBeenCalledWith(
      'userDocRef',
      { displayName: '길동홍' },
      { merge: true },
    );
    expect(result).toEqual({ status: 'success' });
  });

  it('updates the Auth profile but skips setDoc when the user doc does not exist yet', async () => {
    mockCurrentUser.value = { uid: 'apple-uid', displayName: null };
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSignInAsync.mockResolvedValue({
      identityToken: 'apple-id-token',
      fullName: { familyName: '길동', givenName: '홍' },
    });

    const result = await signInWithApple();

    // updateProfile still runs (seeds the doc created by the auth listener),
    // but setDoc must NOT create/merge a doc that does not exist yet.
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      { uid: 'apple-uid', displayName: null },
      { displayName: '길동홍' },
    );
    expect(mockGetDoc).toHaveBeenCalledWith('userDocRef');
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'success' });
  });

  it('does not overwrite an existing displayName', async () => {
    mockCurrentUser.value = { uid: 'apple-uid', displayName: '기존이름' };
    mockSignInAsync.mockResolvedValue({
      identityToken: 'apple-id-token',
      fullName: { familyName: '길동', givenName: '홍' },
    });

    await signInWithApple();

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('still succeeds when reflecting the fullName throws', async () => {
    mockCurrentUser.value = { uid: 'apple-uid', displayName: null };
    mockSignInAsync.mockResolvedValue({
      identityToken: 'apple-id-token',
      fullName: { familyName: '길동', givenName: '홍' },
    });
    mockUpdateProfile.mockRejectedValue(new Error('profile write failed'));

    const result = await signInWithApple();

    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(result).toEqual({ status: 'success' });
  });

  it('rejects with module-unavailable when the native module import throws', async () => {
    mockAppleImportThrows = true;
    jest.resetModules();

    try {
      await expect(signInWithApple()).rejects.toMatchObject({ code: 'module-unavailable' });
    } finally {
      mockAppleImportThrows = false;
      jest.resetModules();
    }
  });
});

describe('isAppleSignInAvailable', () => {
  beforeEach(() => {
    setOS('ios');
    mockIsAvailableAsync.mockResolvedValue(true);
  });

  afterEach(() => {
    setOS(originalOS);
  });

  it('resolves true on iOS when the native check reports available', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    await expect(isAppleSignInAvailable()).resolves.toBe(true);
  });

  it('resolves false on a non-iOS platform without invoking the native check', async () => {
    setOS('android');
    await expect(isAppleSignInAvailable()).resolves.toBe(false);
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
  });

  it('resolves false when the native availability check throws', async () => {
    mockIsAvailableAsync.mockRejectedValue(new Error('check failed'));
    await expect(isAppleSignInAvailable()).resolves.toBe(false);
  });
});
