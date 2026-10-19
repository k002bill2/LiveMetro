/**
 * emailRecipient Tests
 *
 * Pure unit tests (F-02: email relay). The recipient must come only from the
 * Firebase Auth record (verified email), never from the client-writable
 * Firestore users doc. getUser is injected as a fake.
 */
import {
  resolveVerifiedRecipient,
  resolveRecipientForUid,
  isEmailOptInEnabled,
  AuthUserLike,
} from '../emailRecipient';

describe('resolveVerifiedRecipient', () => {
  it('returns null for a null user', () => {
    expect(resolveVerifiedRecipient(null)).toBeNull();
  });

  it('returns null when the email is not verified', () => {
    expect(
      resolveVerifiedRecipient({ email: 'victim@example.com', emailVerified: false }),
    ).toBeNull();
  });

  it('returns null for an empty email even if flagged verified', () => {
    expect(resolveVerifiedRecipient({ email: '', emailVerified: true })).toBeNull();
  });

  it('returns null when there is no email (anonymous / phone / Kakao custom token)', () => {
    expect(resolveVerifiedRecipient({ emailVerified: false })).toBeNull();
    expect(resolveVerifiedRecipient({ emailVerified: true })).toBeNull();
  });

  it('returns the email for a verified user', () => {
    expect(
      resolveVerifiedRecipient({ email: 'me@example.com', emailVerified: true }),
    ).toBe('me@example.com');
  });
});

describe('resolveRecipientForUid', () => {
  it('returns the verified auth email for the uid', async () => {
    const getAuthUser = jest.fn(
      async (): Promise<AuthUserLike> => ({ email: 'me@example.com', emailVerified: true }),
    );
    await expect(resolveRecipientForUid('uid-1', getAuthUser)).resolves.toEqual({
      ok: true,
      email: 'me@example.com',
    });
    expect(getAuthUser).toHaveBeenCalledWith('uid-1');
  });

  it('returns a Korean error when the auth email is unverified', async () => {
    const result = await resolveRecipientForUid('uid-1', async () => ({
      email: 'victim@example.com',
      emailVerified: false,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/[가-힣]/);
      expect(result.error).not.toContain('victim@example.com');
    }
  });

  it('maps a getUser throw to a generic Korean error without leaking details', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await resolveRecipientForUid('uid-1', async () => {
      throw new Error('auth/user-not-found: There is no user record for secret@x.com');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/[가-힣]/);
      expect(result.error).not.toContain('user-not-found');
      expect(result.error).not.toContain('secret@x.com');
    }
    for (const call of consoleSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('secret@x.com');
    }
    consoleSpy.mockRestore();
  });
});

describe('isEmailOptInEnabled', () => {
  it('is false for missing prefs', () => {
    expect(isEmailOptInEnabled(null)).toBe(false);
  });

  it('requires both the master switch and email notifications', () => {
    expect(isEmailOptInEnabled({ enabled: true, emailNotifications: true })).toBe(true);
    expect(isEmailOptInEnabled({ enabled: false, emailNotifications: true })).toBe(false);
    expect(isEmailOptInEnabled({ enabled: true, emailNotifications: false })).toBe(false);
  });
});
