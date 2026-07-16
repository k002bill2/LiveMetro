/**
 * firebaseCredentialSignIn service tests.
 *
 * Covers the credential → Firebase session bridge: anonymous upgrade via
 * linkWithCredential, the credential-already-in-use fallback (reusable vs null
 * extraction), and the full error → SocialAuthError mapping table including the
 * email-enumeration-protection branch of account-exists. No dynamic import is
 * involved (static firebase/auth + config), so every branch is reachable.
 */
import type { AuthCredential } from 'firebase/auth';

// SUT import at the top; jest hoists the jest.mock() calls below above it.
import { signInOrLinkWithCredential } from '@/services/auth/social/firebaseCredentialSignIn';

const mockLinkWithCredential = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockFetchSignInMethodsForEmail = jest.fn();
const mockCredentialFromError = jest.fn();
const mockCurrentUser: { value: { isAnonymous?: boolean; uid?: string } | null } = {
  value: null,
};

jest.mock('firebase/auth', () => ({
  __esModule: true,
  OAuthProvider: {
    credentialFromError: (...args: unknown[]) => mockCredentialFromError(...args),
  },
  fetchSignInMethodsForEmail: (...args: unknown[]) => mockFetchSignInMethodsForEmail(...args),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
}));

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

const fakeCredential = { providerId: 'google.com' } as unknown as AuthCredential;
const reusableCredential = { providerId: 'reused.com' } as unknown as AuthCredential;

describe('signInOrLinkWithCredential', () => {
  beforeEach(() => {
    mockLinkWithCredential.mockReset();
    mockSignInWithCredential.mockReset();
    mockFetchSignInMethodsForEmail.mockReset();
    mockCredentialFromError.mockReset();
    mockCurrentUser.value = null;
  });

  it('signs in directly with the credential for a non-anonymous user', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockResolvedValue({ user: { uid: 'user-1' } });

    await signInOrLinkWithCredential(fakeCredential, 'Google');

    expect(mockSignInWithCredential).toHaveBeenCalledWith(expect.anything(), fakeCredential);
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });

  it('links the credential onto an anonymous user and skips signInWithCredential', async () => {
    const anonUser = { isAnonymous: true, uid: 'anon-1' };
    mockCurrentUser.value = anonUser;
    mockLinkWithCredential.mockResolvedValue({ user: anonUser });

    await signInOrLinkWithCredential(fakeCredential, 'Google');

    expect(mockLinkWithCredential).toHaveBeenCalledWith(anonUser, fakeCredential);
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('falls back to signInWithCredential with the reusable credential on credential-already-in-use', async () => {
    mockCurrentUser.value = { isAnonymous: true, uid: 'anon-1' };
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    mockCredentialFromError.mockReturnValue(reusableCredential);
    mockSignInWithCredential.mockResolvedValue({ user: { uid: 'existing' } });

    await signInOrLinkWithCredential(fakeCredential, 'Google');

    expect(mockCredentialFromError).toHaveBeenCalled();
    expect(mockSignInWithCredential).toHaveBeenCalledWith(expect.anything(), reusableCredential);
  });

  it('falls back to the ORIGINAL credential when credentialFromError returns null', async () => {
    mockCurrentUser.value = { isAnonymous: true, uid: 'anon-1' };
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/email-already-in-use' });
    mockCredentialFromError.mockReturnValue(null);
    mockSignInWithCredential.mockResolvedValue({ user: { uid: 'existing' } });

    await signInOrLinkWithCredential(fakeCredential, 'Google');

    expect(mockSignInWithCredential).toHaveBeenCalledWith(expect.anything(), fakeCredential);
  });

  it('maps a non-in-use link error (network) to a SocialAuthError', async () => {
    mockCurrentUser.value = { isAnonymous: true, uid: 'anon-1' };
    mockLinkWithCredential.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(signInOrLinkWithCredential(fakeCredential, 'Google')).rejects.toMatchObject({
      code: 'network',
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('names the existing method (password → 이메일/비밀번호) on account-exists', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'a@b.com' },
    });
    mockFetchSignInMethodsForEmail.mockResolvedValue(['password']);

    await expect(signInOrLinkWithCredential(fakeCredential, 'Google')).rejects.toMatchObject({
      code: 'account-exists',
      userMessage: expect.stringContaining('이메일/비밀번호'),
    });
  });

  it('uses a generic message on account-exists when methods are empty (enumeration protection)', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'a@b.com' },
    });
    mockFetchSignInMethodsForEmail.mockResolvedValue([]);

    await expect(signInOrLinkWithCredential(fakeCredential, 'Google')).rejects.toMatchObject({
      code: 'account-exists',
      userMessage: expect.stringContaining('다른 방법으로'),
    });
  });

  it('uses a generic message on account-exists when method lookup itself throws', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'a@b.com' },
    });
    mockFetchSignInMethodsForEmail.mockRejectedValue(new Error('lookup failed'));

    await expect(signInOrLinkWithCredential(fakeCredential, 'Google')).rejects.toMatchObject({
      code: 'account-exists',
      userMessage: expect.stringContaining('다른 방법으로'),
    });
  });

  it('maps auth/network-request-failed to code network', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(signInOrLinkWithCredential(fakeCredential, 'Google')).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('maps auth/operation-not-allowed to code configuration', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockRejectedValue({ code: 'auth/operation-not-allowed' });

    await expect(signInOrLinkWithCredential(fakeCredential, 'Google')).rejects.toMatchObject({
      code: 'configuration',
    });
  });

  it('maps an unknown error to code unknown with a provider-labelled message', async () => {
    mockCurrentUser.value = { isAnonymous: false, uid: 'user-1' };
    mockSignInWithCredential.mockRejectedValue({ code: 'auth/some-unmapped-error' });

    await expect(signInOrLinkWithCredential(fakeCredential, 'Kakao')).rejects.toMatchObject({
      code: 'unknown',
      userMessage: expect.stringContaining('Kakao'),
    });
  });
});
